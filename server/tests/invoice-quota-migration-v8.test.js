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

test('une base déjà en version 7 reçoit la table et l’index du quota en version 8', async () => {
  await setupTestDatabase();
  await pool.query('DROP TABLE IF EXISTS facture_usage_mensuelle');
  await pool.query('UPDATE _samafacture_schema_meta SET version = 7 WHERE id = 1');

  const child = runMigrationInNewProcess();
  assert.equal(child.error, undefined, child.error?.message);
  assert.equal(child.status, 0, child.stderr || child.stdout || 'La migration v7 → v8 a échoué.');

  const [[meta]] = await pool.query('SELECT version FROM _samafacture_schema_meta WHERE id = 1');
  assert.equal(Number(meta.version), 8);

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
});

after(teardownTestEnvironment);
