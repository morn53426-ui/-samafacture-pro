const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pool, setupTestDatabase, teardownTestEnvironment } = require('./setup');

function runMigrationInNewProcess() {
  const script = `
    const { initDatabase, pool } = require('./config/db');
    initDatabase()
      .then(() => pool.end())
      .then(() => process.exit(0))
      .catch((err) => { console.error(err); process.exit(1); });
  `;
  return spawnSync(process.execPath, ['-e', script], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'test' },
    encoding: 'utf8',
    timeout: 45000
  });
}

test('une base en version 7 reçoit la migration du quota sans bloquer les versions suivantes', async () => {
  await setupTestDatabase();
  assert.match(String(process.env.DB_NAME || ''), /test/i, 'Ce test destructif de schéma doit utiliser une base dédiée de test.');
  const [[trialUsersBefore]] = await pool.query("SELECT COUNT(*) AS total FROM users WHERE trial_status = 'trialing' OR trial_started_at IS NOT NULL OR trial_ends_at IS NOT NULL");
  assert.equal(Number(trialUsersBefore.total), 0, 'Ne pas supprimer des dates d’essai existantes dans la base de test.');
  const [[nonDefaultExpenseModes]] = await pool.query("SELECT COUNT(*) AS total FROM depenses WHERE mode_reglement <> 'caisse'");
  assert.equal(Number(nonDefaultExpenseModes.total), 0, 'Ne pas supprimer des modes de règlement de test non standards.');
  const [[accountingEventsBefore]] = await pool.query('SELECT COUNT(*) AS total FROM pro_compta_facture_events');
  assert.equal(Number(accountingEventsBefore.total), 0, 'Ne pas supprimer des événements comptables de test existants.');
  await pool.query('DROP TABLE pro_compta_facture_events');
  await pool.query('ALTER TABLE depenses DROP COLUMN mode_reglement');
  await pool.query('DROP TABLE IF EXISTS facture_usage_mensuelle');
  const [warehouseColumnsBefore] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'factures' AND COLUMN_NAME = 'entrepot_id'`
  );
  if (warehouseColumnsBefore.length) await pool.query('ALTER TABLE factures DROP COLUMN entrepot_id');
  const [backfillMarkerBefore] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pro_entrepots'
       AND COLUMN_NAME = 'backfill_stock_termine'`
  );
  if (backfillMarkerBefore.length) await pool.query('ALTER TABLE pro_entrepots DROP COLUMN backfill_stock_termine');
  const [trialIndexBefore] = await pool.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
       AND INDEX_NAME = 'idx_users_trial_status_end'`
  );
  if (trialIndexBefore.length) await pool.query('ALTER TABLE users DROP INDEX idx_users_trial_status_end');
  for (const column of ['trial_plan', 'trial_started_at', 'trial_ends_at', 'trial_status']) {
    const [found] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?`,
      [column]
    );
    if (found.length) await pool.query('ALTER TABLE users DROP COLUMN `' + column + '`');
  }
  await pool.query('UPDATE _samafacture_schema_meta SET version = 7 WHERE id = 1');

  const child = runMigrationInNewProcess();
  assert.equal(child.error, undefined, child.error?.message);
  assert.equal(child.status, 0, child.stderr || child.stdout || 'La migration v7 → v25 a échoué.');

  const [[meta]] = await pool.query('SELECT version FROM _samafacture_schema_meta WHERE id = 1');
  assert.equal(Number(meta.version), 26, 'une base v7 doit exécuter toute la chaîne de migrations v8 à v26');

  const [tables] = await pool.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'facture_usage_mensuelle'`
  );
  assert.equal(tables.length, 1, 'La table de consommation mensuelle doit exister après migration.');

  const [indexes] = await pool.query(
    `SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'factures'
       AND INDEX_NAME = 'idx_factures_user_type_created_at'`
  );
  assert.equal(indexes.length, 1, 'L’index de recherche du quota doit être créé.');

  const [warehouseColumnsAfter] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'factures' AND COLUMN_NAME = 'entrepot_id'`
  );
  assert.equal(warehouseColumnsAfter.length, 1, 'La migration v17 doit ajouter la colonne entrepot_id.');

  const [backfillMarkerAfter] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pro_entrepots'
       AND COLUMN_NAME = 'backfill_stock_termine'`
  );
  assert.equal(backfillMarkerAfter.length, 1, 'La migration v18 doit ajouter le marqueur de reprise des stocks.');

  const [trialColumnsAfter] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
       AND COLUMN_NAME IN ('trial_plan', 'trial_started_at', 'trial_ends_at', 'trial_status')`
  );
  assert.deepEqual(trialColumnsAfter.map(row => row.COLUMN_NAME).sort(), [
    'trial_ends_at', 'trial_plan', 'trial_started_at', 'trial_status'
  ]);
  const [[trialDefaultAfter]] = await pool.query(
    `SELECT COLUMN_DEFAULT FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'trial_status'`
  );
  assert.equal(trialDefaultAfter.COLUMN_DEFAULT, 'not_started');
  const [[expenseModeColumn]] = await pool.query(
    `SELECT COLUMN_DEFAULT FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'depenses' AND COLUMN_NAME = 'mode_reglement'`
  );
  assert.equal(expenseModeColumn.COLUMN_DEFAULT, 'caisse');
  const [accountingEventsAfter] = await pool.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pro_compta_facture_events'`
  );
  assert.equal(accountingEventsAfter.length, 1);
});

after(teardownTestEnvironment);
