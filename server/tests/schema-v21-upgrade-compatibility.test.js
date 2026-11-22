'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const crypto = require('node:crypto');
const { pool, setupTestDatabase, teardownTestEnvironment } = require('./setup');

const createdUserIds = [];

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

async function addUser(name, withTrial) {
  const email = 'schema-v21-' + name + '-' + crypto.randomUUID() + '@example.test';
  if (withTrial) {
    const [result] = await pool.query(
      `INSERT INTO users
        (nom, email, password_hash, entreprise_nom, plan, trial_plan, trial_started_at, trial_ends_at, trial_status)
       VALUES (?, ?, ?, ?, 'pro', 'pro', UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 DAY), 'trialing')`,
      [name, email, 'test-hash-not-for-authentication', name]
    );
    createdUserIds.push(result.insertId);
    return result.insertId;
  }
  const [result] = await pool.query(
    'INSERT INTO users (nom, email, password_hash, entreprise_nom) VALUES (?, ?, ?, ?)',
    [name, email, 'test-hash-not-for-authentication', name]
  );
  createdUserIds.push(result.insertId);
  return result.insertId;
}

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function removeTestUser(userId) {
  await pool.query('DELETE FROM users WHERE id = ?', [userId]);
  const index = createdUserIds.indexOf(userId);
  if (index !== -1) createdUserIds.splice(index, 1);
}

before(async () => {
  await setupTestDatabase();
  assert.match(String(process.env.DB_NAME || ''), /test/i,
    'Les scénarios de migration doivent utiliser une base dédiée de test.');
});

after(async () => {
  for (const userId of createdUserIds) {
    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
  }
  await teardownTestEnvironment();
});

test('une base v19 conservant un essai actif migre vers v21 sans perdre ses dates', async () => {
  const userId = await addUser('from-v19', true);
  const date = new Date().toISOString().slice(0, 10);
  await pool.query(
    'INSERT INTO depenses (user_id, libelle, montant, date_depense) VALUES (?, ?, ?, ?)',
    [userId, 'Dépense conservée pendant upgrade v19', 1250, date]
  );

  const [[eventCount]] = await pool.query(
    'SELECT COUNT(*) AS total FROM pro_compta_facture_events'
  );
  assert.equal(Number(eventCount.total), 0,
    'Le scénario v19 ne doit pas supprimer un historique comptable existant.');
  await pool.query('DROP TABLE pro_compta_facture_events');

  const [[nonDefaultExpenseModes]] = await pool.query(
    "SELECT COUNT(*) AS total FROM depenses WHERE mode_reglement <> 'caisse'"
  );
  assert.equal(Number(nonDefaultExpenseModes.total), 0,
    'Ne pas supprimer des modes de règlement non standards.');
  await pool.query('ALTER TABLE depenses DROP COLUMN mode_reglement');
  await pool.query('UPDATE _samafacture_schema_meta SET version = 19 WHERE id = 1');

  const migration = runMigrationInNewProcess();
  assert.equal(migration.error, undefined, migration.error?.message);
  assert.equal(migration.status, 0, migration.stderr || migration.stdout || 'La migration v19 → v21 a échoué.');

  const [[meta]] = await pool.query('SELECT version FROM _samafacture_schema_meta WHERE id = 1');
  assert.equal(Number(meta.version), 21);

  const [[account]] = await pool.query(
    'SELECT plan, trial_plan, trial_started_at, trial_ends_at, trial_status FROM users WHERE id = ?',
    [userId]
  );
  assert.ok(account);
  assert.equal(account.plan, 'pro');
  assert.equal(account.trial_plan, 'pro');
  assert.equal(account.trial_status, 'trialing');
  assert.ok(account.trial_started_at);
  assert.ok(account.trial_ends_at);

  const [[expense]] = await pool.query(
    'SELECT mode_reglement FROM depenses WHERE user_id = ? AND libelle = ?',
    [userId, 'Dépense conservée pendant upgrade v19']
  );
  assert.equal(expense.mode_reglement, 'caisse');
  assert.equal(await columnExists('pro_compta_facture_events', 'facture_id'), true);

  await removeTestUser(userId);
});

test('une base v20 conserve les règlements bancaires et reçoit un essai neutre en v21', async () => {
  const userId = await addUser('from-v20', false);
  const date = new Date().toISOString().slice(0, 10);
  await pool.query(
    'INSERT INTO depenses (user_id, libelle, montant, categorie, mode_reglement, date_depense) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, 'Dépense banque conservée pendant upgrade v20', 2500, 'fournitures', 'banque', date]
  );

  const [[activeTrials]] = await pool.query(
    "SELECT COUNT(*) AS total FROM users WHERE trial_status = 'trialing' OR trial_started_at IS NOT NULL OR trial_ends_at IS NOT NULL"
  );
  assert.equal(Number(activeTrials.total), 0,
    'Ne pas supprimer les dates d’essai déjà attribuées.');
  const [[eventCount]] = await pool.query(
    'SELECT COUNT(*) AS total FROM pro_compta_facture_events'
  );
  assert.equal(Number(eventCount.total), 0,
    'Ne pas supprimer des événements comptables existants.');

  const [trialIndex] = await pool.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
       AND INDEX_NAME = 'idx_users_trial_status_end'`
  );
  if (trialIndex.length) await pool.query('ALTER TABLE users DROP INDEX idx_users_trial_status_end');
  for (const column of ['trial_plan', 'trial_started_at', 'trial_ends_at', 'trial_status']) {
    if (await columnExists('users', column)) {
      await pool.query('ALTER TABLE users DROP COLUMN `' + column + '`');
    }
  }
  await pool.query('UPDATE _samafacture_schema_meta SET version = 20 WHERE id = 1');

  const migration = runMigrationInNewProcess();
  assert.equal(migration.error, undefined, migration.error?.message);
  assert.equal(migration.status, 0, migration.stderr || migration.stdout || 'La migration v20 → v21 a échoué.');

  const [[meta]] = await pool.query('SELECT version FROM _samafacture_schema_meta WHERE id = 1');
  assert.equal(Number(meta.version), 21);

  const [[account]] = await pool.query(
    'SELECT trial_plan, trial_started_at, trial_ends_at, trial_status FROM users WHERE id = ?',
    [userId]
  );
  assert.ok(account);
  assert.equal(account.trial_plan, null);
  assert.equal(account.trial_started_at, null);
  assert.equal(account.trial_ends_at, null);
  assert.equal(account.trial_status, 'not_started');

  const [[expense]] = await pool.query(
    'SELECT mode_reglement FROM depenses WHERE user_id = ? AND libelle = ?',
    [userId, 'Dépense banque conservée pendant upgrade v20']
  );
  assert.equal(expense.mode_reglement, 'banque');

  const [indexes] = await pool.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
       AND INDEX_NAME = 'idx_users_trial_status_end'`
  );
  assert.equal(indexes.length, 1);

  await removeTestUser(userId);
});
