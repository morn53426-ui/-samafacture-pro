'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment
} = require('./setup');

let userId;
let token;
let accountIds;
const secondaryUserIds = [];

before(async () => {
  await setupTestDatabase();
  const registration = await request(app)
    .post('/api/auth/register')
    .send({
      nom: 'Entreprise tests correspondances dépenses',
      entreprise_nom: 'Entreprise tests correspondances dépenses',
      email: emailDeTest('expense-mapping-current'),
      password: 'motdepasse123',
      acceptTerms: true
    });
  assert.equal(registration.status, 201, registration.text);
  userId = registration.body.user.id;
  token = registration.body.token;

  // Le lot teste la comptabilisation Pro sans dépendre du quota gratuit.
  await pool.query("UPDATE users SET plan = 'pro' WHERE id = ?", [userId]);

  const config = await request(app)
    .get('/api/pro/accounting/config')
    .set('Authorization', 'Bearer ' + token);
  assert.equal(config.status, 200, config.text);
  accountIds = Object.fromEntries(
    config.body.comptes.map(account => [account.code, account.id])
  );
  for (const code of ['521', '571', '6181', '625', '638']) {
    assert.ok(accountIds[code], 'Le compte OHADA ' + code + ' doit être initialisé.');
  }
});

after(async () => {
  try {
    for (const id of secondaryUserIds) {
      await nettoyerUtilisateur(id);
    }
    if (userId) await nettoyerUtilisateur(userId);
  } finally {
    await teardownTestEnvironment();
  }
});

function setExpenseMapping(categorie, compteId, tokenValue = token) {
  return request(app)
    .put('/api/pro/accounting/mappings')
    .set('Authorization', 'Bearer ' + tokenValue)
    .send({ type_source: 'depense', cle_source: categorie, compte_id: compteId });
}

function createExpense(payload, tokenValue = token) {
  return request(app)
    .post('/api/depenses')
    .set('Authorization', 'Bearer ' + tokenValue)
    .send(payload);
}

function postExpense(id, tokenValue = token) {
  return request(app)
    .post('/api/pro/accounting/post-expense/' + id)
    .set('Authorization', 'Bearer ' + tokenValue)
    .send({});
}

test('les catégories sont normalisées, mises à jour sans doublon et limitées aux comptes actifs de classe 6', async () => {
  const first = await setExpenseMapping('  Loyer  ', accountIds['625']);
  assert.equal(first.status, 200, first.text);

  const updated = await setExpenseMapping('LOYER', accountIds['625']);
  assert.equal(updated.status, 200, updated.text);

  const listed = await request(app)
    .get('/api/pro/accounting/mappings')
    .set('Authorization', 'Bearer ' + token);
  assert.equal(listed.status, 200, listed.text);

  const rentMappings = listed.body.correspondances.filter(mapping =>
    mapping.type_source === 'depense' && mapping.cle_source === 'loyer'
  );
  assert.equal(rentMappings.length, 1, 'la normalisation doit empêcher les doublons de catégorie');
  assert.equal(rentMappings[0].code, '625');

  const invalidClass = await setExpenseMapping('Loyer', accountIds['521']);
  assert.equal(invalidClass.status, 400, invalidClass.text);
  assert.equal(invalidClass.body.code, 'CLASSE_COMPTE_CORRESPONDANCE_INVALIDE');

  const afterRejectedUpdate = await request(app)
    .get('/api/pro/accounting/mappings')
    .set('Authorization', 'Bearer ' + token);
  const retained = afterRejectedUpdate.body.correspondances.filter(mapping =>
    mapping.type_source === 'depense' && mapping.cle_source === 'loyer'
  );
  assert.equal(retained.length, 1);
  assert.equal(retained[0].code, '625', 'un choix invalide ne doit pas écraser la correspondance active');
});

test('la dépense utilise le compte personnalisé et un rejeu ne recalcule pas une écriture validée', async () => {
  const mapping = await setExpenseMapping('Loyer', accountIds['625']);
  assert.equal(mapping.status, 200, mapping.text);

  const created = await createExpense({
    libelle: 'Loyer du bureau',
    montant: 875,
    categorie: ' LOYER ',
    mode_reglement: 'caisse',
    date_depense: '2026-11-22'
  });
  assert.equal(created.status, 201, created.text);

  const posted = await postExpense(created.body.depense.id);
  assert.equal(posted.status, 201, posted.text);

  const [[entry]] = await pool.query(
    "SELECT id, total_debit, total_credit FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'depense' AND source_id = ?",
    [userId, created.body.depense.id]
  );
  assert.ok(entry);
  assert.equal(Number(entry.total_debit), 875);
  assert.equal(Number(entry.total_credit), 875);

  const [lines] = await pool.query(
    'SELECT c.code, l.debit, l.credit FROM pro_compta_lignes l JOIN pro_compta_comptes c ON c.id = l.compte_id AND c.user_id = l.user_id WHERE l.user_id = ? AND l.ecriture_id = ? ORDER BY c.code',
    [userId, entry.id]
  );
  assert.deepEqual(lines.map(line => ({
    code: line.code,
    debit: Number(line.debit),
    credit: Number(line.credit)
  })), [
    { code: '571', debit: 0, credit: 875 },
    { code: '625', debit: 875, credit: 0 }
  ]);

  await setExpenseMapping('loyer', accountIds['6181']);
  const replay = await postExpense(created.body.depense.id);
  assert.equal(replay.status, 200, replay.text);
  assert.equal(replay.body.duplicate, true);

  const [unchangedLines] = await pool.query(
    'SELECT c.code FROM pro_compta_lignes l JOIN pro_compta_comptes c ON c.id = l.compte_id AND c.user_id = l.user_id WHERE l.user_id = ? AND l.ecriture_id = ? AND l.debit > 0',
    [userId, entry.id]
  );
  assert.deepEqual(unchangedLines.map(line => line.code), ['625'],
    'la nouvelle correspondance ne doit pas réécrire une dépense déjà validée');
});

test('une dépense sans catégorie utilise le compte de repli 638 sans inventer une catégorie', async () => {
  const created = await createExpense({
    libelle: 'Petite dépense non catégorisée',
    montant: 300,
    mode_reglement: 'caisse',
    date_depense: '2026-11-22'
  });
  assert.equal(created.status, 201, created.text);
  assert.equal(created.body.depense.categorie, null);

  const posted = await postExpense(created.body.depense.id);
  assert.equal(posted.status, 201, posted.text);

  const [lines] = await pool.query(
    'SELECT c.code, l.debit, l.credit FROM pro_compta_lignes l JOIN pro_compta_comptes c ON c.id = l.compte_id AND c.user_id = l.user_id JOIN pro_compta_ecritures e ON e.id = l.ecriture_id AND e.user_id = l.user_id WHERE e.user_id = ? AND e.source_type = ? AND e.source_id = ? ORDER BY c.code',
    [userId, 'depense', created.body.depense.id]
  );
  assert.deepEqual(lines.map(line => ({
    code: line.code,
    debit: Number(line.debit),
    credit: Number(line.credit)
  })), [
    { code: '571', debit: 0, credit: 300 },
    { code: '638', debit: 300, credit: 0 }
  ]);
});

test('les correspondances et les dépenses restent strictement isolées entre entreprises', async () => {
  await setExpenseMapping('Transport', accountIds['6181']);
  const created = await createExpense({
    libelle: 'Transport entreprise A',
    montant: 500,
    categorie: 'Transport',
    mode_reglement: 'banque',
    date_depense: '2026-11-22'
  });
  assert.equal(created.status, 201, created.text);

  const other = await request(app)
    .post('/api/auth/register')
    .send({
      nom: 'Entreprise B correspondances',
      entreprise_nom: 'Entreprise B correspondances',
      email: emailDeTest('expense-mapping-tenant-b'),
      password: 'motdepasse123',
      acceptTerms: true
    });
  assert.equal(other.status, 201, other.text);
  const otherUserId = other.body.user.id;
  secondaryUserIds.push(otherUserId);
  await pool.query("UPDATE users SET plan = 'pro' WHERE id = ?", [otherUserId]);

  const otherConfig = await request(app)
    .get('/api/pro/accounting/config')
    .set('Authorization', 'Bearer ' + other.body.token);
  assert.equal(otherConfig.status, 200, otherConfig.text);
  const otherAccountIds = Object.fromEntries(
    otherConfig.body.comptes.map(account => [account.code, account.id])
  );
  assert.ok(otherAccountIds['622']);

  const isolatedList = await request(app)
    .get('/api/pro/accounting/mappings')
    .set('Authorization', 'Bearer ' + other.body.token);
  assert.equal(isolatedList.status, 200, isolatedList.text);
  assert.equal(isolatedList.body.correspondances.some(mapping =>
    mapping.type_source === 'depense' && mapping.cle_source === 'transport'
  ), false, 'l’entreprise B ne doit pas lire la correspondance de A');

  const crossTenantAccount = await setExpenseMapping('Loyer', accountIds['625'], other.body.token);
  assert.equal(crossTenantAccount.status, 404, crossTenantAccount.text,
    'un compte d’une autre entreprise ne peut pas être affecté');

  const crossTenantExpense = await postExpense(created.body.depense.id, other.body.token);
  assert.equal(crossTenantExpense.status, 404, crossTenantExpense.text,
    'une dépense d’une autre entreprise ne peut pas être comptabilisée');

  const ownMapping = await setExpenseMapping('Transport', otherAccountIds['622'], other.body.token);
  assert.equal(ownMapping.status, 200, ownMapping.text);

  const [ownRead] = await pool.query(
    'SELECT c.code FROM pro_compta_correspondances m JOIN pro_compta_comptes c ON c.id = m.compte_id AND c.user_id = m.user_id WHERE m.user_id = ? AND m.type_source = ? AND m.cle_source = ?',
    [otherUserId, 'depense', 'transport']
  );
  const [originalRead] = await pool.query(
    'SELECT c.code FROM pro_compta_correspondances m JOIN pro_compta_comptes c ON c.id = m.compte_id AND c.user_id = m.user_id WHERE m.user_id = ? AND m.type_source = ? AND m.cle_source = ?',
    [userId, 'depense', 'transport']
  );
  assert.deepEqual(ownRead.map(row => row.code), ['622']);
  assert.deepEqual(originalRead.map(row => row.code), ['6181']);
});
