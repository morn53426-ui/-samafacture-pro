'use strict';

// Processus isolé : le secret du compte DB_BACKUP_USER n'est jamais injecté dans l'API HTTP.
require('dotenv').config();

const { pool } = require('../config/db');
const { waitForDatabase } = require('../config/database-readiness');
const { startBackupScheduler } = require('../config/backup');

let timer = null;
let stopping = false;

async function shutdown() {
  if (stopping) return;
  stopping = true;
  if (timer) clearInterval(timer);
  await pool.end().catch(() => {});
}

process.once('SIGTERM', () => {
  void shutdown().then(() => { process.exitCode = 0; });
});
process.once('SIGINT', () => {
  void shutdown().then(() => { process.exitCode = 0; });
});

async function main() {
  await waitForDatabase(pool, {
    onRetry(err, attempt, maxAttempts) {
      console.warn('MySQL pas encore disponible pour backup-worker (' + attempt + '/' + maxAttempts + ') : ' + err.message);
    }
  });
  // Les migrations sont terminées avant le démarrage de ce service par Docker Compose.
  await pool.query('SELECT derniere_sauvegarde FROM backup_meta WHERE id = 1').catch(async err => {
    if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
    throw new Error('Schéma non migré : backup_meta est absent. Attendez db-migrate avant backup-worker.');
  });
  timer = startBackupScheduler({ keepAlive: true });
  if (!timer) {
    console.log('backup-worker inactif : BACKUP_ENABLED=false.');
    await shutdown();
  } else {
    console.log('backup-worker prêt ; les sauvegardes utilisent le compte SQL dédié.');
  }
}

main().catch(async err => {
  console.error('backup-worker arrêté :', err);
  await shutdown();
  process.exitCode = 1;
});
