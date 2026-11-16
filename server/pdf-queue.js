const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { getRedisClient, isRedisReady } = require('./config/redis');

const QUEUE_KEY = process.env.PDF_QUEUE_KEY || 'samafacture:pdf:queue';
const STREAM_KEY = process.env.PDF_STREAM_KEY || 'samafacture:pdf:stream';
const GROUP_NAME = process.env.PDF_STREAM_GROUP || 'samafacture:pdf:workers';
const JOB_PREFIX = process.env.PDF_JOB_PREFIX || 'samafacture:pdf:job:';
const JOB_TTL = Number(process.env.PDF_JOB_TTL_SECONDS) || 3600;
const CLAIM_IDLE_MS = Number(process.env.PDF_JOB_CLAIM_IDLE_MS) || 1800000;
const JOB_DIR = process.env.PDF_JOBS_DIR || path.join(__dirname, 'pdf-jobs');
const MAX_PENDING_SCAN_PAGES = 25;
let pendingCursor = '0-0';

// Lua makes the legacy LPOP + XADD indivisible: a worker crash cannot lose an item
// between removing it from the old list and inserting it into the durable stream.
const MIGRATE_LEGACY_JOB_SCRIPT = [
  "local raw = redis.call('LPOP', KEYS[1])",
  'if not raw then return nil end',
  "return redis.call('XADD', KEYS[2], '*', 'job', raw)"
].join('\n');

async function ensurePdfConsumerGroup(redis = getRedisClient()) {
  if (!redis) throw new Error('Redis indisponible pour initialiser la file PDF.');
  try {
    await redis.xGroupCreate(STREAM_KEY, GROUP_NAME, '0-0', { MKSTREAM: true });
  } catch (err) {
    if (!String(err && err.message).includes('BUSYGROUP')) throw err;
  }
}

async function migrateLegacyPdfQueue(redis = getRedisClient()) {
  if (!redis) throw new Error('Redis indisponible pour migrer la file PDF historique.');
  let migrated = 0;
  while (true) {
    const entryId = await redis.eval(MIGRATE_LEGACY_JOB_SCRIPT, {
      keys: [QUEUE_KEY, STREAM_KEY],
      arguments: []
    });
    if (!entryId) break;
    migrated += 1;
  }
  return migrated;
}

async function enqueuePdfJob({ factureId, user }) {
  const redis = getRedisClient();
  if (!redis || !isRedisReady()) throw new Error('La file PDF asynchrone nécessite Redis.');
  await fs.mkdir(JOB_DIR, { recursive: true });
  const id = crypto.randomUUID();
  const job = {
    id,
    factureId: Number(factureId),
    user: { id: user.id, email: user.email, role: user.role, nom: user.nom },
    createdAt: new Date().toISOString()
  };
  const key = JOB_PREFIX + id;

  // Keep owner metadata for as long as the stream entry is pending.
  // MULTI/EXEC publishes the hash and stream entry together.
  const transaction = redis.multi();
  transaction.hSet(key, {
    id,
    status: 'queued',
    userId: String(user.id),
    factureId: String(factureId),
    createdAt: job.createdAt
  });
  transaction.xAdd(STREAM_KEY, '*', { job: JSON.stringify(job) });
  await transaction.exec();
  return id;
}

async function claimNextPdfJob(redis, consumer, {
  blockMs = 5000,
  minIdleMs = CLAIM_IDLE_MS,
  maxScanPages = MAX_PENDING_SCAN_PAGES
} = {}) {
  // XAUTOCLAIM returns a cursor. Retain it between polls so a large PEL is scanned
  // progressively instead of repeatedly inspecting only its first page.
  for (let page = 0; page < maxScanPages; page += 1) {
    const result = await redis.xAutoClaim(
      STREAM_KEY, GROUP_NAME, consumer, minIdleMs, pendingCursor, { COUNT: 1 }
    );
    const messages = result && Array.isArray(result.messages) ? result.messages : [];
    pendingCursor = String(result && result.nextId || '0-0');

    if (result && Array.isArray(result.deletedMessages) && result.deletedMessages.length) {
      console.error('Entrées PDF absentes du stream mais référencées dans la PEL :', result.deletedMessages);
    }
    if (messages.length) return messages[0];
    if (pendingCursor === '0-0') break;
  }

  const response = await redis.xReadGroup(
    GROUP_NAME,
    consumer,
    [{ key: STREAM_KEY, id: '>' }],
    { COUNT: 1, BLOCK: blockMs }
  );
  const stream = Array.isArray(response)
    ? response.find(item => item && Array.isArray(item.messages) && item.messages.length)
    : null;
  return stream ? stream.messages[0] : null;
}

async function acknowledgePdfJob(redis, entryId) {
  const transaction = redis.multi();
  transaction.xAck(STREAM_KEY, GROUP_NAME, entryId);
  transaction.xDel(STREAM_KEY, entryId);
  await transaction.exec();
}

async function getPdfJob(id, userId) {
  const redis = getRedisClient();
  if (!redis || !isRedisReady()) throw new Error('Redis indisponible.');
  const data = await redis.hGetAll(JOB_PREFIX + id);
  if (!data || !data.id && !data.status) return null;
  if (String(data.userId) !== String(userId)) return null;
  return data;
}

async function getPdfPath(id) {
  return path.join(JOB_DIR, id + '.pdf');
}

module.exports = {
  enqueuePdfJob,
  getPdfJob,
  getPdfPath,
  ensurePdfConsumerGroup,
  migrateLegacyPdfQueue,
  claimNextPdfJob,
  acknowledgePdfJob,
  QUEUE_KEY,
  STREAM_KEY,
  GROUP_NAME,
  JOB_PREFIX,
  JOB_TTL,
  CLAIM_IDLE_MS,
  JOB_DIR
};
