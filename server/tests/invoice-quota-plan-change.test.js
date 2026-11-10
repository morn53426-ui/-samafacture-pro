const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  app, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment
} = require('./setup');
const { pool } = require('../config/db');
const { FREE_MONTHLY_INVOICE_LIMIT } = require('../utils/plans');

describe('Quota mensuel après changement de formule', () => {
  let userId;
  let token;
  let clientId;

  before(async () => {
    await setupTestDatabase();
    const registration = await request(app)
      .post('/api/auth/register')
      .send({
        nom: 'Compte changement de formule',
        email: emailDeTest('quota-upgrade-downgrade'),
        password: 'motdepasse123'
      });
    assert.equal(registration.status, 201, registration.text);
    userId = registration.body.user.id;
    token = registration.body.token;

    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client changement de formule' });
    assert.equal(client.status, 201, client.text);
    clientId = client.body.client.id;
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  test('les factures créées sous Pro restent comptées après retour au plan Gratuit', async () => {
    const createInvoice = () => request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'facture',
        lignes: [{ designation: 'Facture changement formule', quantite: 1, prix_unitaire: 100, tva: 0 }]
      });

    // Le registre est créé sous Gratuit avec les premières factures.
    for (let i = 0; i < 2; i++) {
      const response = await createInvoice();
      assert.equal(response.status, 201, response.text);
    }

    await pool.query("UPDATE users SET plan = 'pro' WHERE id = ?", [userId]);
    for (let i = 0; i < 3; i++) {
      const response = await createInvoice();
      assert.equal(response.status, 201, response.text);
    }

    await pool.query("UPDATE users SET plan = 'gratuit' WHERE id = ?", [userId]);
    for (let i = 0; i < FREE_MONTHLY_INVOICE_LIMIT - 5; i++) {
      const response = await createInvoice();
      assert.equal(response.status, 201, response.text);
    }

    const blocked = await createInvoice();
    assert.equal(blocked.status, 403, blocked.text);
    assert.equal(blocked.body.code, 'QUOTA_DEPASSE');

    const [[usage]] = await pool.query(
      "SELECT nombre_factures FROM facture_usage_mensuelle WHERE user_id = ? AND periode = DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')",
      [userId]
    );
    assert.equal(Number(usage.nombre_factures), FREE_MONTHLY_INVOICE_LIMIT);
  });
});

after(teardownTestEnvironment);
