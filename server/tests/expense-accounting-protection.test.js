const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment
} = require('./setup');

describe('Protection des dépenses comptabilisées', () => {
  let userId;
  let token;

  before(async () => {
    await setupTestDatabase();
    const registration = await request(app)
      .post('/api/auth/register')
      .send({
        nom: 'Compte protection dépenses',
        email: emailDeTest('expense-ledger-protection'),
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
  });

  async function createExpense({ libelle = 'Fournitures', montant = 5000, categorie = 'Bureau', date_depense = '2026-11-20' } = {}) {
    const response = await request(app)
      .post('/api/depenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ libelle, montant, categorie, date_depense });
    assert.equal(response.status, 201, response.text);
    return response.body.depense;
  }

  async function postExpense(expenseId) {
    return request(app)
      .post(`/api/pro/accounting/post-expense/${expenseId}`)
      .set('Authorization', `Bearer ${token}`);
  }

  test('une dépense comptabilisée ne peut être modifiée ni supprimée; l’écriture reste', async () => {
    const expense = await createExpense();
    const posted = await postExpense(expense.id);
    assert.equal(posted.status, 201, posted.text);

    const update = await request(app)
      .put(`/api/depenses/${expense.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ libelle: 'Libellé modifié', montant: 9000, categorie: 'Transport' });
    assert.equal(update.status, 409, update.text);
    assert.equal(update.body.code, 'DEPENSE_COMPTABILISEE_PROTEGEE');

    const deletion = await request(app)
      .delete(`/api/depenses/${expense.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(deletion.status, 409, deletion.text);
    assert.equal(deletion.body.code, 'DEPENSE_COMPTABILISEE_PROTEGEE');

    const [[stored]] = await pool.query('SELECT libelle, montant FROM depenses WHERE id = ? AND user_id = ?', [expense.id, userId]);
    const [[entry]] = await pool.query(
      "SELECT total_debit, total_credit FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'depense' AND source_id = ?",
      [userId, expense.id]
    );
    assert.equal(stored.libelle, 'Fournitures');
    assert.equal(Number(stored.montant), 5000);
    assert.equal(Number(entry.total_debit), 5000);
    assert.equal(Number(entry.total_credit), 5000);
  });

  test('une dépense non comptabilisée reste modifiable et supprimable', async () => {
    const expense = await createExpense({ libelle: 'Dépense libre', montant: 3000 });
    const update = await request(app)
      .put(`/api/depenses/${expense.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ libelle: 'Dépense mise à jour', montant: 3500 });
    assert.equal(update.status, 200, update.text);
    assert.equal(update.body.depense.libelle, 'Dépense mise à jour');
    assert.equal(Number(update.body.depense.montant), 3500);

    const deletion = await request(app)
      .delete(`/api/depenses/${expense.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(deletion.status, 200, deletion.text);
    const [[stored]] = await pool.query('SELECT id FROM depenses WHERE id = ? AND user_id = ?', [expense.id, userId]);
    assert.equal(stored, undefined);
  });

  test('édition et comptabilisation concurrentes ne produisent pas de montant divergent', async () => {
    const expense = await createExpense({ libelle: 'Race dépense', montant: 6000, categorie: 'Bureau' });
    const [update, posting] = await Promise.all([
      request(app)
        .put(`/api/depenses/${expense.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ libelle: 'Race dépense modifiée', montant: 7000, categorie: 'Transport', date_depense: '2026-11-21' }),
      postExpense(expense.id)
    ]);

    assert.ok([200, 409].includes(update.status), update.text);
    assert.ok([201, 409].includes(posting.status), posting.text);
    const [[stored]] = await pool.query('SELECT montant, libelle, date_depense, categorie FROM depenses WHERE id = ? AND user_id = ?', [expense.id, userId]);
    const [[entry]] = await pool.query(
      "SELECT total_debit, total_credit FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'depense' AND source_id = ?",
      [userId, expense.id]
    );
    if (posting.status === 201) {
      assert.ok(entry, 'une comptabilisation réussie doit avoir une écriture');
      assert.equal(Number(entry.total_debit), Number(stored.montant));
      assert.equal(Number(entry.total_credit), Number(stored.montant));
      if (update.status === 409) {
        assert.equal(Number(stored.montant), 6000, 'si le posting verrouille d’abord, la source reste inchangée');
      } else {
        assert.equal(update.status, 200);
        assert.equal(Number(stored.montant), 7000, 'si l’édition précède le posting, la nouvelle source est comptabilisée');
        assert.equal(stored.libelle, 'Race dépense modifiée');
      }
    } else {
      assert.equal(entry, undefined, 'un posting refusé ne doit pas laisser d’écriture');
      assert.equal(update.status, 200, 'si l’édition gagne, le posting stale doit être refusé');
      assert.equal(Number(stored.montant), 7000);
      assert.equal(stored.libelle, 'Race dépense modifiée');
    }
  });
});

after(teardownTestEnvironment);
