const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { getRedisClient, isRedisReady } = require('./config/redis');
const { isUuid } = require('./utils/uuid');

const QUEUE_KEY = process.env.PDF_QUEUE_KEY || 'samafacture:pdf:queue';
const STREAM_KEY = process.env.PDF_STREAM_KEY || 'samafacture:pdf:stream';
const GROUP_NAME = process.env.PDF_STREAM_GROUP || 'samafacture:pdf:workers';
const JOB_PREFIX = process.env.PDF_JOB_PREFIX || 'samafacture:pdf:job:';
const configuredJobTtl = Number(process.env.PDF_JOB_TTL_SECONDS);
const BASE_JOB_TTL = Number.isSafeInteger(configuredJobTtl) && configuredJobTtl > 0
  ? configuredJobTtl
  : 3600;
const DEFAULT_FILE_RETENTION_SECONDS = BASE_JOB_TTL + 24 * 60 * 60;
const requestedFileRetention = Number(process.env.PDF_FILE_RETENTION_SECONDS);
const PDF_FILE_RETENTION_SECONDS = Number.isSafeInteger(requestedFileRetention) && requestedFileRetention >= BASE_JOB_TTL
  ? requestedFileRetention
  : DEFAULT_FILE_RETENTION_SECONDS;
// The job hash stores both owner authorization and download status. Keep it at least
// as long as the PDF itself, otherwise the file still exists but its owner gets 404.
const JOB_TTL = Math.max(BASE_JOB_TTL, PDF_FILE_RETENTION_SECONDS);
const CLAIM_IDLE_MS = Number(process.env.PDF_JOB_CLAIM_IDLE_MS) || 1800000;
const JOB_DIR = process.env.PDF_JOBS_DIR || path.join(__dirname, 'pdf-jobs');
const MAX_PENDING_SCAN_PAGES = 25;
let pendingCursor = '0-0';

// Lua makes the legacy LPOP + XADD indivisible: a worker crash cannot lose an item
// between removing it from the old list and inserting it into the durable stream.
const MIGRATE_LEGACY_JOB_SCRIPT = [
  "local raw = redis.call('LINDEX', KEYS[1], 0)",
  'if not raw then return nil end',
  "local entry = redis.pcall('XADD', KEYS[2], '*', 'job', raw)",
  "if type(entry) == 'table' and entry.err then return redis.error_reply(entry.err) end",
  "redis.call('LPOP', KEYS[1])",
  'return entry'
].join('\n');

// HSET the owner metadata first, then XADD. If XADD returns a command error (for
// example because Redis is out of memory), delete the hash before returning the error.
const ENQUEUE_PDF_JOB_SCRIPT = [
  "redis.call('HSET', KEYS[1], 'id', ARGV[1], 'status', 'queued', 'userId', ARGV[2], 'factureId', ARGV[3], 'createdAt', ARGV[4])",
  "local entry = redis.pcall('XADD', KEYS[2], '*', 'job', ARGV[5])",
  "if type(entry) == 'table' and entry.err then redis.call('DEL', KEYS[1]); return redis.error_reply(entry.err) end",
  'return entry'
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

  // A single Lua script keeps the metadata and stream entry consistent. If XADD
  // fails after HSET, the script removes the just-created metadata hash and returns
  // the original Redis error; no queued job is silently accepted.
  await redis.eval(ENQUEUE_PDF_JOB_SCRIPT, {
    keys: [key, STREAM_KEY],
    arguments: [id, String(user.id), String(factureId), job.createdAt, JSON.stringify(job)]
  });
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

async function cleanupExpiredPdfFiles({
  now = Date.now(),
  retentionMs = PDF_FILE_RETENTION_SECONDS * 1000
} = {}) {
  if (!Number.isFinite(now) || !Number.isFinite(retentionMs) || retentionMs < 0) {
    throw new TypeError('Paramètres de rétention PDF invalides.');
  }

  let entries;
  try {
    entries = await fs.readdir(JOB_DIR, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === 'ENOENT') return { removed: 0 };
    throw err;
  }

  let removed = 0;
  for (const entry of entries) {
    // Do not follow symlinks or touch unrelated files in a shared volume.
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.pdf') || !isUuid(entry.name.slice(0, -4))) continue;
    const file = path.join(JOB_DIR, entry.name);
    const stat = await fs.stat(file).catch(() => null);
    if (!stat || !stat.isFile() || now - stat.mtimeMs < retentionMs) continue;
    try {
      await fs.unlink(file);
      removed += 1;
    } catch (err) {
      if (!err || err.code !== 'ENOENT') throw err;
    }
  }
  return { removed };
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
  if (!isUuid(id)) throw new TypeError('Identifiant de tâche PDF invalide.');
  return path.join(JOB_DIR, id + '.pdf');
}

module.exports = {
  enqueuePdfJob,
  ENQUEUE_PDF_JOB_SCRIPT,
  MIGRATE_LEGACY_JOB_SCRIPT,
  getPdfJob,
  getPdfPath,
  cleanupExpiredPdfFiles,
  PDF_FILE_RETENTION_SECONDS,
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
