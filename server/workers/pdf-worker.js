require('dotenv').config();
const os = require('os');
const crypto = require('crypto');
const fs = require('fs/promises');
const { pool } = require('../config/db');
const { waitForDatabase } = require('../config/database-readiness');
const { initRedis, closeRedis, getRedisClient } = require('../config/redis');
const { genererPdfFacture, closeBrowser } = require('../utils/pdf');
const {
  ensurePdfConsumerGroup,
  migrateLegacyPdfQueue,
  claimNextPdfJob,
  acknowledgePdfJob,
  getPdfPath,
  JOB_TTL,
  JOB_DIR,
  JOB_PREFIX,
  STREAM_KEY
} = require('../pdf-queue');
const { processPdfQueueEntry } = require('../pdf-worker-job');

let stopping = false;
let cleaning = false;
const consumerName = os.hostname() + '-' + process.pid + '-' + crypto.randomUUID();

async function nettoyerFichiersPdfExpires() {
  const result = await cleanupExpiredPdfFiles();
  if (result.removed) {
    console.log(result.removed + ' ancien(s) fichier(s) PDF temporaire(s) supprimé(s).');
  }
}

async function processJob(entry, redis) {
  return processPdfQueueEntry({
    entry,
    redis,
    acknowledge: entryId => acknowledgePdfJob(redis, entryId),
    renderPdf: genererPdfFacture,
    async savePdf(id, pdf) {
      await fs.mkdir(JOB_DIR, { recursive: true });
      const file = await getPdfPath(id);
      await fs.writeFile(file, pdf, { mode: 0o600 });
      return file;
    },
    jobPrefix: JOB_PREFIX,
    jobTtl: JOB_TTL,
    maxAttempts: Number(process.env.PDF_JOB_MAX_ATTEMPTS) || 3
  });
}

async function cleanup(exitCode = 0) {
  if (cleaning) return;
  cleaning = true;
  await closeBrowser().catch(() => {});
  await closeRedis().catch(() => {});
  await pool.end().catch(() => {});
  process.exitCode = exitCode;
}

async function main() {
  // L'application initialise le schéma avant d'être déclarée healthy par Compose.
  // Le worker PDF vérifie uniquement MySQL et ne lance pas les migrations en concurrence.
  await waitForDatabase(pool, {
    onRetry(err, attempt, maxAttempts) {
      console.warn('MySQL pas encore disponible pour le worker PDF (' + attempt + '/' + maxAttempts + ') : ' + err.message);
    }
  });
  console.log('Connexion MySQL vérifiée pour le worker PDF.');

  await initRedis();
  const redis = getRedisClient();
  if (!redis) throw new Error('REDIS_URL est obligatoire pour le worker PDF.');

  await ensurePdfConsumerGroup(redis);
  const migrated = await migrateLegacyPdfQueue(redis);
  if (migrated) {
    console.log(migrated + ' ancienne(s) tâche(s) PDF migrée(s) vers Redis Streams.');
  }

  await fs.mkdir(JOB_DIR, { recursive: true });
  await nettoyerFichiersPdfExpires();
  const pdfCleanupTimer = setInterval(() => {
    void nettoyerFichiersPdfExpires().catch(err => {
      console.warn('Nettoyage périodique des PDF différé :', err.message);
    });
  }, 15 * 60 * 1000);
  pdfCleanupTimer.unref();
  console.log('Worker PDF prêt — stream=' + STREAM_KEY + ', consumer=' + consumerName);

  while (!stopping) {
    const entry = await claimNextPdfJob(redis, consumerName);
    if (entry) await processJob(entry, redis);
  }
}

process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });

main()
  .then(() => cleanup(0))
  .catch(async err => {
    console.error('Worker PDF arrêté :', err);
    stopping = true;
    await cleanup(1);
  });
