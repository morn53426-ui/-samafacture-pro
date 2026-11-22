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

test('une base v19 conservant un essai actif migre vers v23 sans perdre ses dates', async () => {
  const userId = await addUser('from-v19', true);
  const [[trialBefore]] = await pool.query(
    'SELECT trial_plan, trial_started_at, trial_ends_at, trial_status FROM users WHERE id = ?',
    [userId]
  );
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
  assert.equal(migration.status, 0, migration.stderr || migration.stdout || 'La migration v19 → v23 a échoué.');

  const [[meta]] = await pool.query('SELECT version FROM _samafacture_schema_meta WHERE id = 1');
  assert.equal(Number(meta.version), 23);

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
  assert.deepEqual(
    {
      trial_plan: account.trial_plan,
      trial_started_at: account.trial_started_at,
      trial_ends_at: account.trial_ends_at,
      trial_status: account.trial_status
    },
    trialBefore,
    'La migration v19 → v23 ne doit ni redémarrer ni raccourcir l’essai actif.'
  );

  const [[expense]] = await pool.query(
    'SELECT mode_reglement FROM depenses WHERE user_id = ? AND libelle = ?',
    [userId, 'Dépense conservée pendant upgrade v19']
  );
  assert.equal(expense.mode_reglement, 'caisse');
  assert.equal(await columnExists('pro_compta_facture_events', 'facture_id'), true);

  await removeTestUser(userId);
});

test('une base v20 conserve les règlements bancaires et reçoit un essai neutre en v23', async () => {
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
    `SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS
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
  assert.equal(migration.status, 0, migration.stderr || migration.stdout || 'La migration v20 → v23 a échoué.');

  const [[meta]] = await pool.query('SELECT version FROM _samafacture_schema_meta WHERE id = 1');
  assert.equal(Number(meta.version), 23);

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
    `SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
       AND INDEX_NAME = 'idx_users_trial_status_end'`
  );
  assert.equal(indexes.length, 1);

  // Rejouer le chemin de migration depuis la version précédente doit rester idempotent
  // et ne modifier ni l'essai neutre ni le règlement bancaire déjà enregistré.
  await pool.query('UPDATE _samafacture_schema_meta SET version = 20 WHERE id = 1');
  const repeatedMigration = runMigrationInNewProcess();
  assert.equal(repeatedMigration.error, undefined, repeatedMigration.error?.message);
  assert.equal(repeatedMigration.status, 0,
    repeatedMigration.stderr || repeatedMigration.stdout || 'La migration répétée v20 → v23 a échoué.');
  const [[repeatedMeta]] = await pool.query('SELECT version FROM _samafacture_schema_meta WHERE id = 1');
  assert.equal(Number(repeatedMeta.version), 23);
  const [[repeatedExpense]] = await pool.query(
    'SELECT mode_reglement FROM depenses WHERE user_id = ? AND libelle = ?',
    [userId, 'Dépense banque conservée pendant upgrade v20']
  );
  assert.equal(repeatedExpense.mode_reglement, 'banque');
  const [[repeatedAccount]] = await pool.query(
    'SELECT trial_status, trial_started_at, trial_ends_at FROM users WHERE id = ?',
    [userId]
  );
  assert.equal(repeatedAccount.trial_status, 'not_started');
  assert.equal(repeatedAccount.trial_started_at, null);
  assert.equal(repeatedAccount.trial_ends_at, null);

  await removeTestUser(userId);
});

test('une base v21 protège les événements comptables contre la suppression en cascade et rejoue la migration v23', async () => {
  const userId = await addUser('from-v21', false);
  let clientId = null;
  let invoiceId = null;
  try {
    const [client] = await pool.query(
      'INSERT INTO clients (user_id, nom) VALUES (?, ?)',
      [userId, 'Client audit migration v23']
    );
    clientId = client.insertId;
    const numero = 'AUDIT-EVENT-' + crypto.randomUUID().slice(0, 8);
    const [invoice] = await pool.query(
      `INSERT INTO factures
        (user_id, client_id, numero, type, date_emission, statut, sous_total, total_tva, total, montant_paye)
       VALUES (?, ?, ?, 'facture', UTC_DATE(), 'annulee', 0, 0, 0, 0)`,
      [userId, clientId, numero]
    );
    invoiceId = invoice.insertId;
    await pool.query(
      'INSERT INTO pro_compta_facture_events (user_id, facture_id, transition, previous_ecriture_id) VALUES (?, ?, ?, ?)',
      [userId, invoiceId, 'annulation', 1]
    );

    // Simuler précisément le schéma v21 : la FK facture était en ON DELETE CASCADE.
    const [[fkBefore]] = await pool.query(
      `SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'pro_compta_facture_events'
         AND CONSTRAINT_NAME = 'fk_pro_compta_facture_events_invoice'`
    );
    if (!fkBefore || fkBefore.DELETE_RULE !== 'CASCADE') {
      if (fkBefore) {
        await pool.query('ALTER TABLE pro_compta_facture_events DROP FOREIGN KEY fk_pro_compta_facture_events_invoice');
      }
      await pool.query(
        'ALTER TABLE pro_compta_facture_events ADD CONSTRAINT fk_pro_compta_facture_events_invoice FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE CASCADE'
      );
    }
    await pool.query('UPDATE _samafacture_schema_meta SET version = 21 WHERE id = 1');

    const migration = runMigrationInNewProcess();
    assert.equal(migration.error, undefined, migration.error?.message);
    assert.equal(migration.status, 0, migration.stderr || migration.stdout || 'La migration v21 → v23 a échoué.');

    const [[meta]] = await pool.query('SELECT version FROM _samafacture_schema_meta WHERE id = 1');
    assert.equal(Number(meta.version), 23);
    const [[mappingTable]] = await pool.query(
      "SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pro_compta_correspondances'"
    );
    assert.equal(Number(mappingTable.n), 1, 'la migration v23 doit créer la table des correspondances comptables');
    const [[mappingAccountIndex]] = await pool.query(
      "SELECT COUNT(DISTINCT INDEX_NAME) AS n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pro_compta_comptes' AND INDEX_NAME = 'uk_pro_compta_compte_id_user'"
    );
    assert.equal(Number(mappingAccountIndex.n), 1, 'la clé composée compte + entreprise doit exister');
    const [[mappingForeignKey]] = await pool.query(
      "SELECT COUNT(*) AS n FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_pro_compta_correspondance_account'"
    );
    assert.equal(Number(mappingForeignKey.n), 1, 'chaque correspondance doit référencer un compte du même tenant');
    const [[fkAfter]] = await pool.query(
      `SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'pro_compta_facture_events'
         AND CONSTRAINT_NAME = 'fk_pro_compta_facture_events_invoice'`
    );
    assert.equal(fkAfter, undefined,
      'aucune FK facture→événement ne doit permettre à MySQL de supprimer l’historique ou de bloquer la purge du tenant');

    // Une suppression exceptionnelle de facture peut laisser une référence d'audit :
    // l'événement reste attribué au tenant et garde l'identifiant original.
    await pool.query('DELETE FROM factures WHERE id = ? AND user_id = ?', [invoiceId, userId]);
    const [[eventAfterInvoiceDelete]] = await pool.query(
      'SELECT id, facture_id, transition FROM pro_compta_facture_events WHERE user_id = ? AND facture_id = ?',
      [userId, invoiceId]
    );
    assert.ok(eventAfterInvoiceDelete);
    assert.equal(Number(eventAfterInvoiceDelete.facture_id), Number(invoiceId));
    assert.equal(eventAfterInvoiceDelete.transition, 'annulation');

    // Le chemin v21→v23 doit être rejouable sans remplacer ni perdre l'événement.
    await pool.query('UPDATE _samafacture_schema_meta SET version = 21 WHERE id = 1');
    const repeated = runMigrationInNewProcess();
    assert.equal(repeated.error, undefined, repeated.error?.message);
    assert.equal(repeated.status, 0, repeated.stderr || repeated.stdout || 'La migration v21 → v23 rejouée a échoué.');
    const [[repeatMeta]] = await pool.query('SELECT version FROM _samafacture_schema_meta WHERE id = 1');
    assert.equal(Number(repeatMeta.version), 23);
    const [[repeatEvent]] = await pool.query(
      'SELECT id, facture_id, transition FROM pro_compta_facture_events WHERE user_id = ? AND facture_id = ?',
      [userId, invoiceId]
    );
    assert.deepEqual(repeatEvent, eventAfterInvoiceDelete);

    // La suppression du compte doit pouvoir effacer les données de test via la FK
    // user→event et les autres cascades, tandis que l'audit est conservé tant que le tenant vit.
    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    const createdIndex = createdUserIds.indexOf(userId);
    if (createdIndex !== -1) createdUserIds.splice(createdIndex, 1);
    const [[remainingEvents]] = await pool.query(
      'SELECT COUNT(*) AS total FROM pro_compta_facture_events WHERE user_id = ?',
      [userId]
    );
    const [[remainingInvoices]] = await pool.query(
      'SELECT COUNT(*) AS total FROM factures WHERE user_id = ?',
      [userId]
    );
    assert.equal(Number(remainingEvents.total), 0);
    assert.equal(Number(remainingInvoices.total), 0);
    invoiceId = null;
    clientId = null;
  } finally {
    if (invoiceId) {
      await pool.query('DELETE FROM pro_compta_facture_events WHERE user_id = ? AND facture_id = ?', [userId, invoiceId]);
      await pool.query('DELETE FROM factures WHERE id = ? AND user_id = ?', [invoiceId, userId]);
    }
    if (clientId) await pool.query('DELETE FROM clients WHERE id = ? AND user_id = ?', [clientId, userId]);
    await removeTestUser(userId);
  }
});
