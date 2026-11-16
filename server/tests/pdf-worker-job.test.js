const { test } = require('node:test');
const assert = require('node:assert/strict');
const { processPdfQueueEntry } = require('../pdf-worker-job');

function createRedis(initial = {}) {
  const hash = { ...initial };
  const acked = [];
  return {
    hash,
    acked,
    async hGetAll() { return { ...hash }; },
    async hSet(key, fields) { Object.assign(hash, fields); return 'OK'; },
    async hIncrBy(key, field, amount) {
      hash[field] = String(Number(hash[field] || 0) + amount);
      return Number(hash[field]);
    },
    async expire() { return true; }
  };
}

function makeEntry(id = 'stream-1') {
  return {
    id,
    message: {
      job: JSON.stringify({
        id: '12345678-1234-4234-8234-123456789abc',
        factureId: 42,
        user: { id: 7, email: 'client@example.test', role: 'user', nom: 'Client' },
        createdAt: '2026-11-16T12:00:00.000Z'
      })
    }
  };
}

function dependencies(redis, renderPdf, savePdf, entry = makeEntry()) {
  return {
    entry,
    redis,
    acknowledge: async id => redis.acked.push(id),
    renderPdf,
    savePdf,
    jobPrefix: 'samafacture:pdf:job:',
    jobTtl: 3600,
    maxAttempts: 3
  };
}

test('génère le PDF, enregistre le statut terminal puis acquitte le message', async () => {
  const redis = createRedis();
  let saved = null;
  const result = await processPdfQueueEntry(dependencies(
    redis,
    async (factureId, user) => {
      assert.equal(factureId, 42);
      assert.equal(user.id, 7);
      return Buffer.from('%PDF-test');
    },
    async (id, pdf) => { saved = { id, pdf }; return '/pdf/job.pdf'; }
  ));

  assert.equal(result, 'completed');
  assert.equal(saved.id, '12345678-1234-4234-8234-123456789abc');
  assert.equal(saved.pdf.toString(), '%PDF-test');
  assert.equal(redis.hash.status, 'completed');
  assert.equal(redis.hash.file, '/pdf/job.pdf');
  assert.equal(redis.hash.attempts, '1');
  assert.deepEqual(redis.acked, ['stream-1']);
});

test('ne perd pas une tâche après une erreur temporaire : elle reste pending pour reprise', async () => {
  const redis = createRedis();
  const entry = makeEntry();
  const first = await processPdfQueueEntry(dependencies(
    redis,
    async () => { throw new Error('renderer temporarily unavailable'); },
    async () => '/unused',
    entry
  ));

  assert.equal(first, 'retrying');
  assert.equal(redis.hash.status, 'queued');
  assert.equal(redis.hash.attempts, '1');
  assert.deepEqual(redis.acked, []);

  const second = await processPdfQueueEntry(dependencies(
    redis,
    async () => Buffer.from('%PDF-recovered'),
    async () => '/pdf/job.pdf',
    entry
  ));

  assert.equal(second, 'completed');
  assert.equal(redis.hash.attempts, '2');
  assert.deepEqual(redis.acked, ['stream-1']);
});

test('marque failed et acquitte après le nombre maximal de tentatives', async () => {
  const redis = createRedis({ attempts: '2' });
  const result = await processPdfQueueEntry(dependencies(
    redis,
    async () => { throw new Error('renderer permanently unavailable'); },
    async () => '/unused'
  ));

  assert.equal(result, 'failed');
  assert.equal(redis.hash.status, 'failed');
  assert.match(redis.hash.error, /plusieurs tentatives/);
  assert.deepEqual(redis.acked, ['stream-1']);
});

test('une tâche déjà terminée est acquittée sans régénération', async () => {
  const redis = createRedis({
    id: '12345678-1234-4234-8234-123456789abc',
    status: 'completed'
  });
  let renderCalls = 0;
  const result = await processPdfQueueEntry(dependencies(
    redis,
    async () => { renderCalls += 1; return Buffer.from('%PDF-test'); },
    async () => '/unused'
  ));

  assert.equal(result, 'completed');
  assert.equal(renderCalls, 0);
  assert.deepEqual(redis.acked, ['stream-1']);
});

test("une défaillance de XACK après completed ne régénère pas le PDF lors de la reprise", async () => {
  const redis = createRedis();
  let renderCalls = 0;
  let shouldFailAck = true;
  const deps = dependencies(
    redis,
    async () => {
      renderCalls += 1;
      return Buffer.from('%PDF-once');
    },
    async () => '/pdf/job.pdf'
  );
  deps.acknowledge = async id => {
    if (shouldFailAck) {
      shouldFailAck = false;
      throw new Error('XACK temporarily unavailable');
    }
    redis.acked.push(id);
  };

  await assert.rejects(processPdfQueueEntry(deps), /XACK temporarily unavailable/);
  assert.equal(redis.hash.status, 'completed');
  assert.equal(renderCalls, 1);

  const recovered = await processPdfQueueEntry(deps);
  assert.equal(recovered, 'completed');
  assert.equal(renderCalls, 1, 'le résultat terminal déjà écrit ne doit pas être recalculé');
  assert.deepEqual(redis.acked, ['stream-1']);
});

test('refuse un identifiant de tâche qui pourrait sortir du répertoire PDF', async () => {
  const redis = createRedis();
  let renderCalls = 0;
  const entry = makeEntry();
  entry.message.job = JSON.stringify({
    id: '../../etc/passwd',
    factureId: 42,
    user: { id: 7 }
  });
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  let result;
  try {
    result = await processPdfQueueEntry(dependencies(
      redis,
      async () => { renderCalls += 1; return Buffer.from('x'); },
      async () => '/unused',
      entry
    ));
  } finally {
    console.error = originalError;
  }

  assert.equal(result, 'invalid');
  assert.equal(logged.length, 1);
  assert.match(String(logged[0][0]), /Tâche PDF invalide acquittée/);
  assert.equal(logged[0][1], 'stream-1');
  assert.equal(JSON.stringify(logged).includes('../../etc/passwd'), false);
  assert.equal(renderCalls, 0);
  assert.deepEqual(redis.acked, ['stream-1']);
});
