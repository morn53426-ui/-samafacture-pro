'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment
} = require('./setup');

let userId;
let token;

before(async () => {
  await setupTestDatabase();
  const registration = await request(app)
    .post('/api/auth/register')
    .send({
      nom: 'Entreprise affectations comptables',
      email: emailDeTest('expense-account-mappings'),
      password: 'motdepasse123',
      acceptTerms: true
    });
  assert.equal(registration.status, 201, registration.text);
  userId = registration.body.user.id;
  token = registration.body.token;
  await pool.query("UPDATE users SET plan = 'pro' WHERE id = ?", [userId]);
});

after(async () => {
  await nettoyerUtilisateur(userId);
  await teardownTestEnvironment();
});

async function mapCategory(categorie, compte_code) {
  return request(app)
    .put('/api/pro/accounting/expense-mappings')
    .set('Authorization', 'Bearer ' + token)
    .send({ categorie, compte_code });
}

async function createExpense(payload) {
  return request(app)
    .post('/api/depenses')
    .set('Authorization', 'Bearer ' + token)
    .send(payload);
}

test('les catégories de dépenses sont affectées à un compte actif de classe 6 et normalisées', async () => {
  const first = await mapCategory('  Loyer  ', '622');
  assert.equal(first.status, 200, first.text);
  const firstId = first.body.affectation.id;
  assert.equal(first.body.affectation.categorie_key, 'loyer');
  assert.equal(first.body.affectation.compte_code, '622');

  const updated = await mapCategory('LOYER', '625');
  assert.equal(updated.status, 200, updated.text);
  assert.equal(updated.body.affectation.id, firstId, 'une même catégorie normalisée met à jour la correspondance, sans doublon');
  assert.equal(updated.body.affectation.compte_code, '625');

  const invalidTreasury = await mapCategory('Loyer', '521');
  assert.equal(invalidTreasury.status, 400);
  assert.equal(invalidTreasury.body.code, 'COMPTE_CHARGES_INVALIDE');

  const listed = await request(app)
    .get('/api/pro/accounting/expense-mappings')
    .set('Authorization', 'Bearer ' + token);
  assert.equal(listed.status, 200, listed.text);
  assert.equal(listed.body.affectations.length, 1);
  assert.equal(listed.body.affectations[0].compte_code, '625');
});

test('la comptabilisation utilise le compte affecté et reste idempotente', async () => {
  const mapped = await mapCategory('Loyer', '625');
  assert.equal(mapped.status, 200, mapped.text);
  const expense = await createExpense({
    libelle: 'Loyer du bureau',
    montant: 875,
    categorie: 'LOYER',
    mode_reglement: 'caisse',
    date_depense: '2026-11-22'
  });
  assert.equal(expense.status, 201, expense.text);

  const posted = await request(app)
    .post('/api/pro/accounting/post-expense/' + expense.body.depense.id)
    .set('Authorization', 'Bearer ' + token);
  assert.equal(posted.status, 201, posted.text);

  const [[entry]] = await pool.query(
    "SELECT id, total_debit, total_credit FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'depense' AND source_id = ?",
    [userId, expense.body.depense.id]
  );
  assert.equal(Number(entry.total_debit), 875);
  assert.equal(Number(entry.total_credit), 875);
  const [lines] = await pool.query(
    'SELECT c.code, l.debit, l.credit FROM pro_compta_lignes l JOIN pro_compta_comptes c ON c.id = l.compte_id AND c.user_id = l.user_id WHERE l.user_id = ? AND l.ecriture_id = ? ORDER BY c.code',
    [userId, entry.id]
  );
  assert.deepEqual(lines.map(line => ({
    code: line.code, debit: Number(line.debit), credit: Number(line.credit)
  })), [
    { code: '571', debit: 0, credit: 875 },
    { code: '625', debit: 875, credit: 0 }
  ]);

  await mapCategory('Loyer', '622');
  const replay = await request(app)
    .post('/api/pro/accounting/post-expense/' + expense.body.depense.id)
    .set('Authorization', 'Bearer ' + token);
  assert.equal(replay.status, 200, replay.text);
  assert.equal(replay.body.duplicate, true, 'un rejeu retourne l’écriture existante même si l’affectation a changé');
});

test('une catégorie non affectée est bloquée sans écriture comptable', async () => {
  const expense = await createExpense({
    libelle: 'Frais de mission',
    montant: 2400,
    categorie: 'Mission terrain',
    date_depense: '2026-11-22'
  });
  assert.equal(expense.status, 201, expense.text);
  const posting = await request(app)
    .post('/api/pro/accounting/post-expense/' + expense.body.depense.id)
    .set('Authorization', 'Bearer ' + token);
  assert.equal(posting.status, 409, posting.text);
  assert.equal(posting.body.code, 'AFFECTATION_COMPTABLE_DEPENSE_MANQUANTE');
  const [[count]] = await pool.query(
    "SELECT COUNT(*) AS total FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'depense' AND source_id = ?",
    [userId, expense.body.depense.id]
  );
  assert.equal(Number(count.total), 0);
});

test('les dépenses sans catégorie peuvent recevoir une affectation dédiée', async () => {
  const mapped = await mapCategory('__sans_categorie__', '622');
  assert.equal(mapped.status, 200, mapped.text);
  assert.equal(mapped.body.affectation.categorie_label, 'Sans catégorie');
  const expense = await createExpense({
    libelle: 'Dépense exceptionnelle',
    montant: 300,
    date_depense: '2026-11-22'
  });
  assert.equal(expense.status, 201, expense.text);
  const posting = await request(app)
    .post('/api/pro/accounting/post-expense/' + expense.body.depense.id)
    .set('Authorization', 'Bearer ' + token);
  assert.equal(posting.status, 201, posting.text);
});

test('les affectations sont isolées par entreprise et ne permettent pas de supprimer celles d’un autre tenant', async () => {
  const mapped = await mapCategory('Transport', '622');
  assert.equal(mapped.status, 200, mapped.text);
  const mappingId = mapped.body.affectation.id;
  const expense = await createExpense({
    libelle: 'Transport test',
    montant: 500,
    categorie: 'Transport'
  });
  assert.equal(expense.status, 201, expense.text);

  const other = await request(app)
    .post('/api/auth/register')
    .send({
      nom: 'Autre entreprise',
      email: emailDeTest('expense-account-mappings-other'),
      password: 'motdepasse123',
      acceptTerms: true
    });
  assert.equal(other.status, 201, other.text);
  await pool.query("UPDATE users SET plan = 'pro' WHERE id = ?", [other.body.user.id]);
  try {
    const listed = await request(app)
      .get('/api/pro/accounting/expense-mappings')
      .set('Authorization', 'Bearer ' + other.body.token);
    assert.equal(listed.status, 200, listed.text);
    assert.deepEqual(listed.body.affectations, []);

    const deletion = await request(app)
      .delete('/api/pro/accounting/expense-mappings/' + mappingId)
      .set('Authorization', 'Bearer ' + other.body.token);
    assert.equal(deletion.status, 404, deletion.text);

    const crossTenantPosting = await request(app)
      .post('/api/pro/accounting/post-expense/' + expense.body.depense.id)
      .set('Authorization', 'Bearer ' + other.body.token);
    assert.equal(crossTenantPosting.status, 404, crossTenantPosting.text);
  } finally {
    await nettoyerUtilisateur(other.body.user.id);
  }
});
