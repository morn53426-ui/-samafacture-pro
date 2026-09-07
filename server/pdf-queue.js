const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { getRedisClient, isRedisReady } = require('./config/redis');

const QUEUE_KEY = process.env.PDF_QUEUE_KEY || 'samafacture:pdf:queue';
const JOB_PREFIX = process.env.PDF_JOB_PREFIX || 'samafacture:pdf:job:';
const JOB_TTL = Number(process.env.PDF_JOB_TTL_SECONDS) || 3600;
const JOB_DIR = process.env.PDF_JOBS_DIR || path.join(__dirname, 'pdf-jobs');

async function enqueuePdfJob({ factureId, user }) {
  const redis = getRedisClient();
  if (!redis || !isRedisReady()) throw new Error('La file PDF asynchrone nécessite Redis.');
  await fs.mkdir(JOB_DIR, { recursive: true });
  const id = crypto.randomUUID();
  const job = { id, factureId: Number(factureId), user: { id: user.id, email: user.email, role: user.role, nom: user.nom }, createdAt: new Date().toISOString() };
  // Audit final : le champ `id` n'était jamais écrit ici (ni par le worker dans
  // workers/pdf-worker.js), alors que getPdfJob() ci-dessous teste `data.id` — code mort qui ne
  // fonctionnait que par accident grâce au `||` avec `status`. On l'écrit désormais réellement.
  await redis.hSet(JOB_PREFIX + id, { id, status: 'queued', userId: String(user.id), factureId: String(factureId), createdAt: job.createdAt });
  await redis.expire(JOB_PREFIX + id, JOB_TTL);
  await redis.rPush(QUEUE_KEY, JSON.stringify(job));
  return id;
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
  return path.join(JOB_DIR, `${id}.pdf`);
}

module.exports = { enqueuePdfJob, getPdfJob, getPdfPath, QUEUE_KEY, JOB_PREFIX, JOB_TTL, JOB_DIR };
