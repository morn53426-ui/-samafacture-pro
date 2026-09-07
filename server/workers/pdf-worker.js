require('dotenv').config();
const fs = require('fs/promises');
const { initDatabase, pool } = require('../config/db');
const { initRedis, closeRedis, getRedisClient } = require('../config/redis');
const { genererPdfFacture, closeBrowser } = require('../utils/pdf');
const { QUEUE_KEY, JOB_PREFIX, JOB_TTL, getPdfPath, JOB_DIR } = require('../pdf-queue');

let stopping = false;

async function processJob(raw) {
  const job = JSON.parse(raw);
  const redis = getRedisClient();
  const key = JOB_PREFIX + job.id;
  try {
    await redis.hSet(key, { status: 'processing', startedAt: new Date().toISOString() });
    await fs.mkdir(JOB_DIR, { recursive: true });
    const pdf = await genererPdfFacture(job.factureId, job.user);
    const file = await getPdfPath(job.id);
    await fs.writeFile(file, pdf);
    await redis.hSet(key, { status: 'completed', file: file, completedAt: new Date().toISOString(), size: String(pdf.length) });
    await redis.expire(key, JOB_TTL);
  } catch (err) {
    console.error(`PDF job ${job.id} échoué :`, err.message);
    await redis.hSet(key, { status: 'failed', error: 'La génération du PDF a échoué.', failedAt: new Date().toISOString() });
    await redis.expire(key, JOB_TTL);
  }
}

async function main() {
  await initDatabase();
  await initRedis();
  if (!getRedisClient()) throw new Error('REDIS_URL est obligatoire pour le worker PDF.');
  await fs.mkdir(JOB_DIR, { recursive: true });
  console.log(`📄 Worker PDF prêt — queue=${QUEUE_KEY}`);
  const redis = getRedisClient();
  while (!stopping) {
    const item = await redis.blPop(QUEUE_KEY, 5);
    if (item?.element) await processJob(item.element);
  }
}

async function shutdown() {
  if (stopping) return;
  stopping = true;
  await closeBrowser().catch(() => {});
  await closeRedis().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
main().catch(async err => { console.error('❌ Worker PDF arrêté :', err); await shutdown(); });
