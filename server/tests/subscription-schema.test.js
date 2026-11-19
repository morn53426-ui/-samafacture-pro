'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  pool,
  setupTestDatabase,
  teardownTestEnvironment
} = require('./setup');

const EXPECTED_TABLES = [
  'saas_subscription_price_versions',
  'saas_subscriptions',
  'saas_subscription_consents',
  'saas_subscription_mandates',
  'saas_subscription_periods',
  'saas_subscription_payment_attempts',
  'saas_subscription_webhook_events',
  'saas_subscription_audit_events'
];

before(async () => {
  await setupTestDatabase();
});

after(async () => {
  await teardownTestEnvironment();
});

test('la migration v15 crée les huit tables du moteur SaaS', async () => {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (${EXPECTED_TABLES.map(() => '?').join(', ')})`,
    EXPECTED_TABLES
  );

  const actual = rows.map(row => row.TABLE_NAME).sort();
  assert.deepEqual(actual, [...EXPECTED_TABLES].sort());
});

test('la base de test annonce la version de schéma 18 après migration', async () => {
  const [[meta]] = await pool.query(
    'SELECT version FROM _samafacture_schema_meta WHERE id = 1'
  );
  assert.ok(meta);
  assert.equal(Number(meta.version), 18);
});

test('la fondation du moteur est vide : aucun prix publié, abonnement, mandat ou débit créé', async () => {
  const tables = [
    'saas_subscription_price_versions',
    'saas_subscriptions',
    'saas_subscription_consents',
    'saas_subscription_mandates',
    'saas_subscription_periods',
    'saas_subscription_payment_attempts',
    'saas_subscription_webhook_events',
    'saas_subscription_audit_events'
  ];

  for (const table of tables) {
    // Les noms proviennent uniquement de la liste statique ci-dessus, jamais d'une entrée HTTP.
    const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM `' + table + '`');
    assert.equal(Number(row.total), 0, table + ' doit être vide immédiatement après migration');
  }
});

test('la migration SQL reste additive et utilise CREATE TABLE IF NOT EXISTS', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'database', 'migrations', '010_saas_subscriptions_simulation.sql'),
    'utf8'
  );
  assert.equal((sql.match(/CREATE TABLE IF NOT EXISTS/g) || []).length, 8);
  assert.doesNotMatch(sql, /INSERT INTO|UPDATE users|ALTER TABLE users/i);
  assert.doesNotMatch(sql, /CALL |CREATE TRIGGER|CREATE EVENT/i);
});
