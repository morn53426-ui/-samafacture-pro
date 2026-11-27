'use strict';

// Processus isolé : le secret du compte DB_BACKUP_USER n'est jamais injecté dans l'API HTTP.
require('dotenv').config();

const { pool } = require('../config/db');
const { waitForDatabase } = require('../config/database-readiness');
const { startBackupScheduler, verifierSchemaRegistreAudit } = require('../config/backup');

const AUDIT_LEDGER_SCHEMA_CHECK_INTERVAL_MS = 5 * 60 * 1000;

let timer = null;
let auditSchemaCheckTimer = null;
let auditSchemaCheckInProgress = false;
let stopping = false;

async function shutdown() {
  if (stopping) return;
  stopping = true;
  if (timer) clearInterval(timer);
  if (auditSchemaCheckTimer) clearInterval(auditSchemaCheckTimer);
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

  // Le compte backup dispose du droit TRIGGER nécessaire pour contrôler les définitions.
  // Le contrôle reste hors du processus HTTP et n'accorde aucun privilège supplémentaire au runtime.
  await verifierSchemaRegistreAudit();
  console.log('Protections append-only du registre d’audit vérifiées.');

  auditSchemaCheckTimer = setInterval(async () => {
    if (auditSchemaCheckInProgress || stopping) return;
    auditSchemaCheckInProgress = true;
    try {
      await verifierSchemaRegistreAudit();
    } catch (err) {
      console.error('Dérive du schéma du registre d’audit détectée ; arrêt du backup-worker :', err);
      await shutdown();
      process.exitCode = 1;
    } finally {
      auditSchemaCheckInProgress = false;
    }
  }, AUDIT_LEDGER_SCHEMA_CHECK_INTERVAL_MS);

  timer = startBackupScheduler({ keepAlive: true });
  if (!timer) {
    // La sauvegarde peut être désactivée indépendamment du contrôle d'intégrité.
    // auditSchemaCheckTimer reste actif et maintient ce worker en vie.
    console.log('Sauvegardes automatiques désactivées ; surveillance du registre d’audit toujours active.');
  } else {
    console.log('backup-worker prêt ; les sauvegardes utilisent le compte SQL dédié.');
  }
}

main().catch(async err => {
  console.error('backup-worker arrêté :', err);
  await shutdown();
  process.exitCode = 1;
});
