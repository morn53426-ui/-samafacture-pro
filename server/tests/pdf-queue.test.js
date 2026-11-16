const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const originalJobsDir = process.env.PDF_JOBS_DIR;
const jobsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'samafacture-pdf-queue-'));
process.env.PDF_JOBS_DIR = jobsDir;

const state = {
  hashes: new Map(),
  lists: new Map(),
  expireCalls: 0,
  failExec: false
};

const fakeRedis = {
  multi() {
    const commands = [];
    const transaction = {
      hSet(key, fields) {
        commands.push({ type: 'hSet', key, fields });
        return transaction;
      },
      rPush(key, value) {
        commands.push({ type: 'rPush', key, value });
        return transaction;
      },
      async exec() {
        if (state.failExec) throw new Error('EXEC failed');
        // Applique les commandes seulement à l'exécution : le test vérifie que le
        // producteur utilise bien une transaction, pas deux écritures indépendantes.
        for (const command of commands) {
          if (command.type === 'hSet') {
            state.hashes.set(command.key, {
              ...(state.hashes.get(command.key) || {}),
              ...command.fields
            });
          } else if (command.type === 'rPush') {
            const list = state.lists.get(command.key) || [];
            list.push(command.value);
            state.lists.set(command.key, list);
          }
        }
        return commands.map(() => 'OK');
      }
    };
    return transaction;
  },
  async hGetAll(key) {
    return state.hashes.get(key) || {};
  },
  async expire() {
    state.expireCalls += 1;
    return true;
  }
};

const redisPath = require.resolve('../config/redis');
require.cache[redisPath] = {
  id: redisPath,
  filename: redisPath,
  loaded: true,
  exports: {
    getRedisClient: () => fakeRedis,
    isRedisReady: () => true
  }
};

const queuePath = require.resolve('../pdf-queue');
delete require.cache[queuePath];
const { enqueuePdfJob, getPdfJob, JOB_PREFIX, QUEUE_KEY } = require('../pdf-queue');

after(() => {
  delete require.cache[queuePath];
  delete require.cache[redisPath];
  fs.rmSync(jobsDir, { recursive: true, force: true });
  if (originalJobsDir === undefined) delete process.env.PDF_JOBS_DIR;
  else process.env.PDF_JOBS_DIR = originalJobsDir;
});

test('conserve les métadonnées tant que le PDF est encore en attente', async () => {
  const id = await enqueuePdfJob({
    factureId: 42,
    user: { id: 7, email: 'client@example.test', role: 'user', nom: 'Client test' }
  });

  const job = await getPdfJob(id, 7);
  const queued = state.lists.get(QUEUE_KEY) || [];

  assert.equal(job.id, id);
  assert.equal(job.status, 'queued');
  assert.equal(job.userId, '7');
  assert.equal(job.factureId, '42');
  assert.equal(queued.length, 1);
  assert.equal(JSON.parse(queued[0]).id, id);
  assert.equal(state.expireCalls, 0, 'le TTL ne doit démarrer qu’après completed/failed');
  assert.ok(state.hashes.has(JOB_PREFIX + id));
});

test('une transaction échouée ne laisse ni hash ni élément de file partiel', async () => {
  const hashCountBefore = state.hashes.size;
  const queueCountBefore = (state.lists.get(QUEUE_KEY) || []).length;
  state.failExec = true;

  try {
    await assert.rejects(
      enqueuePdfJob({
        factureId: 99,
        user: { id: 8, email: 'autre@example.test', role: 'user', nom: 'Autre client' }
      }),
      /EXEC failed/
    );
  } finally {
    state.failExec = false;
  }

  assert.equal(state.hashes.size, hashCountBefore);
  assert.equal((state.lists.get(QUEUE_KEY) || []).length, queueCountBefore);
});
