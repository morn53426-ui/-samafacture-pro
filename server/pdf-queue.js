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
  const key = JOB_PREFIX + id;

  // Le hash reste disponible tant que le travail est en attente. La liste Redis ne possède
  // pas de TTL : expirer le hash ici ferait perdre userId si le worker restait arrêté plus
  // longtemps que JOB_TTL, même si l'élément de la file était encore présent.
  // Le worker applique JOB_TTL uniquement après un état terminal (completed/failed).
  // MULTI/EXEC rend la création du hash et l'ajout à la file atomiques : pas de hash orphelin
  // si l'ajout à la liste échoue entre deux commandes.
  const transaction = redis.multi();
  transaction.hSet(key, {
    id,
    status: 'queued',
    userId: String(user.id),
    factureId: String(factureId),
    createdAt: job.createdAt
  });
  transaction.rPush(QUEUE_KEY, JSON.stringify(job));
  await transaction.exec();
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
