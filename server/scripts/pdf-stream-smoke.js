const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createClient } = require('redis');
const { ENQUEUE_PDF_JOB_SCRIPT, MIGRATE_LEGACY_JOB_SCRIPT } = require('../pdf-queue');

const url = process.env.REDIS_URL;
if (!url) throw new Error('REDIS_URL est obligatoire pour le smoke test Redis Streams.');

const suffix = crypto.randomUUID();
const stream = 'samafacture:pdf:smoke:' + suffix;
const group = 'workers:' + suffix;
const legacy = 'samafacture:pdf:legacy-smoke:' + suffix;
const metadata = 'samafacture:pdf:job:smoke:' + suffix;
const badStream = 'samafacture:pdf:wrong-type:' + suffix;
const failedMetadata = 'samafacture:pdf:job:failed-smoke:' + suffix;
const client = createClient({ url });

client.on('error', err => {
  console.error('Redis smoke client error:', err.message);
});

async function main() {
  await client.connect();
  try {
    await client.xGroupCreate(stream, group, '0-0', { MKSTREAM: true });

    const createdAt = new Date().toISOString();
    const rawJob = JSON.stringify({ id: suffix, factureId: 42, user: { id: 'ci-user' } });
    const entryId = await client.eval(ENQUEUE_PDF_JOB_SCRIPT, {
      keys: [metadata, stream],
      arguments: [suffix, 'ci-user', '42', createdAt, rawJob]
    });
    assert.ok(entryId, 'le script Lua doit publier une entrée');
    const hash = await client.hGetAll(metadata);
    assert.equal(hash.userId, 'ci-user', 'le hash doit conserver le propriétaire');

    await client.rPush(badStream, 'this key is intentionally a list');
    await assert.rejects(
      client.eval(ENQUEUE_PDF_JOB_SCRIPT, {
        keys: [failedMetadata, badStream],
        arguments: [suffix + '-failed', 'ci-user', '42', createdAt, rawJob]
      }),
      /WRONGTYPE/
    );
    assert.equal(await client.exists(failedMetadata), 0, 'un XADD refusé doit supprimer le hash créé par le script');

    const fresh = await client.xReadGroup(group, 'consumer-a', [{ key: stream, id: '>' }], { COUNT: 1 });
    assert.ok(fresh && fresh.length === 1 && fresh[0].messages.length === 1, 'XREADGROUP doit livrer une nouvelle tâche');
    const first = fresh[0].messages[0];
    await new Promise(resolve => setTimeout(resolve, 10));

    const reclaimed = await client.xAutoClaim(stream, group, 'consumer-b', 0, '0-0', { COUNT: 1 });
    assert.ok(reclaimed.messages.length === 1, 'XAUTOCLAIM doit réclamer la tâche pending');
    assert.equal(reclaimed.messages[0].id, first.id, 'la tâche réclamée doit conserver son identifiant');

    const ackResults = await client.multi()
      .xAck(stream, group, first.id)
      .xDel(stream, first.id)
      .exec();
    assert.equal(Number(ackResults[0]), 1, 'XACK doit acquitter la tâche');
    assert.equal(await client.xLen(stream), 0, 'XDEL doit retirer le message acquitté');

    const legacyJob = JSON.stringify({ id: 'legacy-' + suffix });
    await client.rPush(legacy, legacyJob);
    const migratedId = await client.eval(
      MIGRATE_LEGACY_JOB_SCRIPT,
      { keys: [legacy, stream], arguments: [] }
    );
    assert.ok(migratedId, 'le script de migration doit créer une entrée stream');
    assert.equal(await client.lLen(legacy), 0, 'l’élément historique doit être retiré de la liste');
    const migrated = await client.xRange(stream, '-', '+');
    assert.equal(migrated.length, 1);
    assert.equal(migrated[0].message.job, legacyJob);

    console.log('Redis Streams smoke test réussi : group, Lua enqueue, XREADGROUP, XAUTOCLAIM, XACK/XDEL et migration Lua.');
  } finally {
    await client.del([stream, legacy, metadata, badStream, failedMetadata]);
    await client.quit();
  }
}

main().catch(err => {
  console.error('Redis Streams smoke test échoué :', err);
  process.exitCode = 1;
});
