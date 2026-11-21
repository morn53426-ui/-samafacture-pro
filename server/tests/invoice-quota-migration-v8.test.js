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
  await pool.query('UPDATE _samafacture_schema_meta SET version = 7 WHERE id = 1');

  const child = runMigrationInNewProcess();
  assert.equal(child.error, undefined, child.error?.message);
  assert.equal(child.status, 0, child.stderr || child.stdout || 'La migration v7 → v18 a échoué.');

  const [[meta]] = await pool.query('SELECT version FROM _samafacture_schema_meta WHERE id = 1');
  assert.equal(Number(meta.version), 19, 'une base v7 doit exécuter toute la chaîne de migrations v8 à v19');

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
});

after(teardownTestEnvironment);
