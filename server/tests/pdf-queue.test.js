const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const originalJobsDir = process.env.PDF_JOBS_DIR;
const jobsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'samafacture-pdf-stream-'));
process.env.PDF_JOBS_DIR = jobsDir;

const state = {
  hashes: new Map(),
  streams: new Map(),
  lists: new Map(),
  pending: [],
  groups: new Set(),
  expireCalls: 0,
  failExec: false,
  nextId: 1
};

function cloneMapOfArrays(source) {
  return new Map([...source].map(([key, values]) => [key, values.map(value => ({ ...value }))]));
}

const fakeRedis = {
  multi() {
    const commands = [];
    const transaction = {
      hSet(key, fields) { commands.push({ type: 'hSet', key, fields }); return transaction; },
      xAdd(key, id, message) { commands.push({ type: 'xAdd', key, id, message }); return transaction; },
      xAck(key, group, id) { commands.push({ type: 'xAck', key, group, id }); return transaction; },
      xDel(key, id) { commands.push({ type: 'xDel', key, id }); return transaction; },
      async exec() {
        if (state.failExec) throw new Error('EXEC failed');
        const before = {
          hashes: new Map([...state.hashes].map(([key, value]) => [key, { ...value }])),
          streams: cloneMapOfArrays(state.streams),
          pending: [...state.pending]
        };
        try {
          for (const command of commands) {
            if (command.type === 'hSet') {
              state.hashes.set(command.key, {
                ...(state.hashes.get(command.key) || {}),
                ...command.fields
              });
            } else if (command.type === 'xAdd') {
              const entries = state.streams.get(command.key) || [];
              const id = 'test-' + state.nextId++;
              entries.push({ id, message: command.message });
              state.streams.set(command.key, entries);
            } else if (command.type === 'xAck') {
              state.pending = state.pending.filter(entry => entry.id !== command.id);
            } else if (command.type === 'xDel') {
              const entries = state.streams.get(command.key) || [];
              state.streams.set(command.key, entries.filter(entry => entry.id !== command.id));
            }
          }
        } catch (err) {
          state.hashes = before.hashes;
          state.streams = before.streams;
          state.pending = before.pending;
          throw err;
        }
        return commands.map(() => 'OK');
      }
    };
    return transaction;
  },

  async hGetAll(key) { return state.hashes.get(key) || {}; },
  async expire() { state.expireCalls += 1; return true; },

  async xGroupCreate(key, group) {
    const id = key + ':' + group;
    if (state.groups.has(id)) throw new Error('BUSYGROUP Consumer Group name already exists');
    state.groups.add(id);
    return 'OK';
  },

  async xAutoClaim(key, group, consumer, minIdle, cursor) {
    state.lastClaimConsumer = consumer;
    const index = state.pending.findIndex(entry => cursor === '0-0' || entry.id >= cursor);
    if (index < 0) return { nextId: '0-0', messages: [], deletedMessages: [] };
    const entry = state.pending[index];
    entry.consumer = consumer;
    return { nextId: '0-0', messages: [{ id: entry.id, message: entry.message }], deletedMessages: [] };
  },

  async xReadGroup(group, consumer, streams) {
    const key = streams[0].key;
    const entries = state.streams.get(key) || [];
    const pendingIds = new Set(state.pending.map(entry => entry.id));
    const entry = entries.find(value => !pendingIds.has(value.id));
    if (!entry) return null;
    state.pending.push({ ...entry, consumer });
    return [{ name: key, messages: [{ id: entry.id, message: entry.message }] }];
  },

  async eval(script, options) {
    const legacyKey = options.keys[0];
    const streamKey = options.keys[1];
    const legacy = state.lists.get(legacyKey) || [];
    const raw = legacy.shift();
    state.lists.set(legacyKey, legacy);
    if (!raw) return null;
    const entries = state.streams.get(streamKey) || [];
    const id = 'legacy-' + state.nextId++;
    entries.push({ id, message: { job: raw } });
    state.streams.set(streamKey, entries);
    return id;
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
const {
  enqueuePdfJob,
  getPdfJob,
  ensurePdfConsumerGroup,
  migrateLegacyPdfQueue,
  claimNextPdfJob,
  acknowledgePdfJob,
  JOB_PREFIX,
  QUEUE_KEY,
  STREAM_KEY,
  GROUP_NAME
} = require('../pdf-queue');

after(() => {
  delete require.cache[queuePath];
  delete require.cache[redisPath];
  fs.rmSync(jobsDir, { recursive: true, force: true });
  if (originalJobsDir === undefined) delete process.env.PDF_JOBS_DIR;
  else process.env.PDF_JOBS_DIR = originalJobsDir;
});

test('conserve les métadonnées du propriétaire tant que le PDF est en attente dans le stream', async () => {
  const id = await enqueuePdfJob({
    factureId: 42,
    user: { id: 7, email: 'client@example.test', role: 'user', nom: 'Client test' }
  });
  const job = await getPdfJob(id, 7);
  const entries = state.streams.get(STREAM_KEY) || [];

  assert.equal(job.id, id);
  assert.equal(job.status, 'queued');
  assert.equal(job.userId, '7');
  assert.equal(job.factureId, '42');
  assert.equal(entries.length, 1);
  assert.equal(JSON.parse(entries[0].message.job).id, id);
  assert.equal(state.expireCalls, 0, 'le TTL ne démarre qu’après un état terminal');
  assert.ok(state.hashes.has(JOB_PREFIX + id));
});

test('une transaction échouée ne laisse ni hash ni entrée de stream partielle', async () => {
  const hashCountBefore = state.hashes.size;
  const streamCountBefore = (state.streams.get(STREAM_KEY) || []).length;
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
  assert.equal((state.streams.get(STREAM_KEY) || []).length, streamCountBefore);
});

test('crée le consumer group et tolère son existence lors des redémarrages', async () => {
  await ensurePdfConsumerGroup(fakeRedis);
  await assert.doesNotReject(() => ensurePdfConsumerGroup(fakeRedis));
  assert.ok(state.groups.has(STREAM_KEY + ':' + GROUP_NAME));
});

test('migre les tâches de l’ancienne liste vers le stream', async () => {
  const oldJob = JSON.stringify({
    id: 'legacy-job-00000000-0000-0000-0000-000000000000',
    factureId: 17,
    user: { id: 4, email: 'legacy@example.test', role: 'user', nom: 'Legacy' }
  });
  state.lists.set(QUEUE_KEY, [oldJob]);

  const migrated = await migrateLegacyPdfQueue(fakeRedis);
  const entries = state.streams.get(STREAM_KEY) || [];

  assert.equal(migrated, 1);
  assert.deepEqual(state.lists.get(QUEUE_KEY), []);
  assert.equal(entries.at(-1).message.job, oldJob);
});

test('réclame une tâche pending laissée par un worker arrêté', async () => {
  const entry = { id: 'pending-0001', message: { job: '{"id":"pending"}' }, consumer: 'old-worker' };
  state.pending.push(entry);

  const claimed = await claimNextPdfJob(fakeRedis, 'recovery-worker', {
    blockMs: 1,
    minIdleMs: 0
  });

  assert.equal(claimed.id, entry.id);
  assert.equal(state.lastClaimConsumer, 'recovery-worker');
});

test('acquitte et retire du stream une tâche terminée', async () => {
  const entry = { id: 'ack-0001', message: { job: '{}' } };
  state.pending.push(entry);
  state.streams.set(STREAM_KEY, [entry]);

  await acknowledgePdfJob(fakeRedis, entry.id);

  assert.equal(state.pending.some(value => value.id === entry.id), false);
  assert.equal((state.streams.get(STREAM_KEY) || []).some(value => value.id === entry.id), false);
});
