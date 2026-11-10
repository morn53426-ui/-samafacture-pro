const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  app, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment
} = require('./setup');
const { FREE_MONTHLY_INVOICE_LIMIT } = require('../utils/plans');
const { pool } = require('../config/db');

describe('API publique : quota mensuel des factures gratuites', () => {
  let userId;
  let clientId;
  let apiKey;

  before(async () => {
    await setupTestDatabase();

    const email = emailDeTest('api-quota');
    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Compte API quota', email, password: 'motdepasse123' });
    assert.equal(inscription.status, 201, inscription.text);
    userId = inscription.body.user.id;

    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${inscription.body.token}`)
      .send({ nom: 'Client API quota' });
    assert.equal(client.status, 201, client.text);
    clientId = client.body.client.id;

    const createdKey = await request(app)
      .post('/api/pro/integrations/api-keys')
      .set('Authorization', `Bearer ${inscription.body.token}`)
      .send({ nom: 'Test quota API', scopes: ['invoices:write'] });
    assert.equal(createdKey.status, 201, createdKey.text);
    apiKey = createdKey.body.token;
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  test("une date d'émission passée ne permet pas de dépasser le quota par l'API publique", async () => {
    const createInvoice = () => request(app)
      .post('/api/v1/invoices')
      .set('X-SamaFacture-Key', apiKey)
      .send({
        client_id: clientId,
        date_emission: '2000-01-01',
        lignes: [{ designation: 'Facture API quota', quantite: 1, prix_unitaire: 100, tva: 0 }]
      });

    for (let i = 0; i < FREE_MONTHLY_INVOICE_LIMIT - 1; i++) {
      const created = await createInvoice();
      assert.equal(created.status, 201, created.text);
    }

    const concurrent = await Promise.all(Array.from({ length: 4 }, createInvoice));
    assert.equal(concurrent.filter(r => r.status === 201).length, 1);
    assert.equal(concurrent.filter(r => r.status === 403 && r.body.code === 'QUOTA_DEPASSE').length, 3);

    const [[row]] = await pool.query(
      "SELECT COUNT(*) AS n FROM factures WHERE user_id = ? AND type = 'facture' AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')",
      [userId]
    );
    assert.equal(Number(row.n), FREE_MONTHLY_INVOICE_LIMIT);
  });
});

after(teardownTestEnvironment);
