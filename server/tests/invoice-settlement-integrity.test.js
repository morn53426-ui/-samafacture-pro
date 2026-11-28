const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment
} = require('./setup');

describe('Intégrité des règlements de facture', () => {
  let userId;
  let token;
  let clientId;

  before(async () => {
    await setupTestDatabase();
    const registration = await request(app)
      .post('/api/auth/register')
      .send({
        nom: 'Compte intégrité règlements',
        email: emailDeTest('invoice-settlement-integrity'),
        password: 'motdepasse123',
        acceptTerms: true
      });
    assert.equal(registration.status, 201, registration.text);
    userId = registration.body.user.id;
    token = registration.body.token;
    await pool.query("UPDATE users SET plan = 'pro' WHERE id = ?", [userId]);

    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client règlements' });
    assert.equal(client.status, 201, client.text);
    clientId = client.body.client.id;
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  async function createDocument(type = 'facture', amount = 1000) {
    const response = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type,
        lignes: [{ designation: 'Prestation', quantite: 1, prix_unitaire: amount, tva: 0 }]
      });
    assert.equal(response.status, 201, response.text);
    return response.body.facture;
  }

  test('une facture impayée ne peut pas être forcée au statut payée', async () => {
    const facture = await createDocument('facture', 1500);
    const response = await request(app)
      .put(`/api/factures/${facture.id}/statut`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statut: 'payee' });

    assert.equal(response.status, 409, response.text);
    assert.equal(response.body.code, 'PAIEMENT_INCOMPLET');
    const [[stored]] = await pool.query(
      'SELECT statut, montant_paye FROM factures WHERE id = ? AND user_id = ?',
      [facture.id, userId]
    );
    assert.equal(stored.statut, 'en_attente');
    assert.equal(Number(stored.montant_paye), 0);
  });

  test('une clé de paiement concurrente ne crée qu’un règlement et ne peut pas être réutilisée sur une autre facture', async () => {
    const factureA = await createDocument('facture', 1000);
    const factureB = await createDocument('facture', 1000);
    const key = `payment-key-${Date.now()}-invoice`;
    const payA = () => request(app)
      .post(`/api/factures/${factureA.id}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({ montant: 250, methode: '  Espèces  ', reference: '  reçu  ' });

    const [first, concurrentReplay] = await Promise.all([payA(), payA()]);
    assert.ok([200, 201].includes(first.status), first.text);
    assert.ok([200, 201].includes(concurrentReplay.status), concurrentReplay.text);
    assert.equal(first.body.facture.id, factureA.id);
    assert.equal(concurrentReplay.body.facture.id, factureA.id);

    const [[storedPayment]] = await pool.query(
      'SELECT COUNT(*) AS n, SUM(montant) AS total FROM paiements WHERE user_id = ? AND idempotency_key = ?',
      [userId, key]
    );
    assert.equal(Number(storedPayment.n), 1);
    assert.equal(Number(storedPayment.total), 250);

    const reused = await request(app)
      .post(`/api/factures/${factureB.id}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({ montant: 250, methode: 'Espèces' });
    assert.equal(reused.status, 409, reused.text);
    assert.equal(reused.body.code, 'IDEMPOTENCY_KEY_REUTILISEE');
  });

  test('deux paiements partiels concurrents avec des clés différentes ne dépassent jamais le solde', async () => {
    const facture = await createDocument('facture', 1000);
    const requestPayment = (suffix) => request(app)
      .post(`/api/factures/${facture.id}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `concurrent-balance-${Date.now()}-${suffix}`)
      .send({ montant: 600, methode: 'virement', reference: `RACE-${suffix}` });

    const [first, second] = await Promise.all([
      requestPayment('A'),
      requestPayment('B')
    ]);

    assert.deepEqual(
      [first.status, second.status].sort((a, b) => a - b),
      [201, 400],
      'une requête doit être validée et l’autre refusée après relecture du solde sous verrou'
    );

    const [[stored]] = await pool.query(
      `SELECT
         f.montant_paye,
         f.statut,
         (SELECT COUNT(*) FROM paiements p WHERE p.user_id = f.user_id AND p.facture_id = f.id) AS payment_count,
         (SELECT COALESCE(SUM(p.montant), 0) FROM paiements p WHERE p.user_id = f.user_id AND p.facture_id = f.id) AS payments_total
       FROM factures f
       WHERE f.id = ? AND f.user_id = ?`,
      [facture.id, userId]
    );

    assert.equal(Number(stored.payment_count), 1, 'un seul règlement concurrent doit être enregistré');
    assert.equal(Number(stored.payments_total), 600);
    assert.equal(Number(stored.montant_paye), 600);
    assert.equal(stored.statut, 'en_attente');
    assert.ok(Number(stored.montant_paye) <= Number(facture.total), 'le total encaissé ne doit jamais dépasser le TTC');
  });

  test('les montants de paiement sont normalisés au centime avant le calcul du solde', async () => {
    const facture = await createDocument('facture', 10.01);
    const first = await request(app)
      .post(`/api/factures/${facture.id}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ montant: 5.005, methode: 'Espèces' });
    assert.equal(first.status, 201, first.text);
    assert.equal(Number(first.body.facture.montant_paye), 5.01);

    const second = await request(app)
      .post(`/api/factures/${facture.id}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ montant: 5, methode: 'Espèces' });
    assert.equal(second.status, 201, second.text);
    assert.equal(Number(second.body.facture.montant_paye), 10.01);
    assert.equal(second.body.facture.statut, 'payee');

    const status = await request(app)
      .put(`/api/factures/${facture.id}/statut`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statut: 'payee' });
    assert.equal(status.status, 200, status.text);
  });

  test('un devis et une facture annulée ne peuvent pas recevoir de règlement', async () => {
    const devis = await createDocument('devis', 1000);
    const paiementDevis = await request(app)
      .post(`/api/factures/${devis.id}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ montant: 100, methode: 'Espèces' });
    assert.equal(paiementDevis.status, 409, paiementDevis.text);
    assert.equal(paiementDevis.body.code, 'FACTURE_NON_ENCAISSABLE');

    const facture = await createDocument('facture', 1000);
    const annulation = await request(app)
      .put(`/api/factures/${facture.id}/statut`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statut: 'annulee' });
    assert.equal(annulation.status, 200, annulation.text);

    const paiementAnnule = await request(app)
      .post(`/api/factures/${facture.id}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ montant: 100, methode: 'Espèces' });
    assert.equal(paiementAnnule.status, 409, paiementAnnule.text);
    assert.equal(paiementAnnule.body.code, 'FACTURE_NON_ENCAISSABLE');
  });
});

after(teardownTestEnvironment);
