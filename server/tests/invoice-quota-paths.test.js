const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  app, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment
} = require('./setup');
const { pool } = require('../config/db');
const { FREE_MONTHLY_INVOICE_LIMIT } = require('../utils/plans');

describe('Quota mensuel : tous les parcours de création de facture', () => {
  let userId;
  let token;
  let clientId;

  before(async () => {
    await setupTestDatabase();

    const registration = await request(app)
      .post('/api/auth/register')
      .send({
        nom: 'Compte quota multi-parcours',
        email: emailDeTest('quota-parcours'),
        password: 'motdepasse123'
      });
    assert.equal(registration.status, 201, registration.text);
    userId = registration.body.user.id;
    token = registration.body.token;

    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client quota multi-parcours' });
    assert.equal(client.status, 201, client.text);
    clientId = client.body.client.id;
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  test('création, duplication, conversion, récurrence et suppression ne contournent pas la limite', async () => {
    const createDocument = (type = 'facture') => request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type,
        date_emission: '2000-01-01',
        lignes: [{ designation: 'Prestation de quota', quantite: 1, prix_unitaire: 100, tva: 0 }]
      });

    const invoices = [];
    for (let i = 0; i < FREE_MONTHLY_INVOICE_LIMIT - 2; i++) {
      const created = await createDocument('facture');
      assert.equal(created.status, 201, created.text);
      invoices.push(created.body.facture);
    }

    // Une duplication de facture est une nouvelle facture et consomme une unité.
    const duplicate = await request(app)
      .post(`/api/factures/${invoices[0].id}/dupliquer`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(duplicate.status, 201, duplicate.text);

    // Un devis créé auparavant peut être transformé plus tard : la conversion consomme
    // le quota du mois de conversion, pas celui de sa date d'émission ou de création.
    const oldQuote = await createDocument('devis');
    assert.equal(oldQuote.status, 201, oldQuote.text);
    await pool.query(
      'UPDATE factures SET created_at = DATE_SUB(NOW(), INTERVAL 2 MONTH) WHERE id = ? AND user_id = ?',
      [oldQuote.body.facture.id, userId]
    );

    const converted = await request(app)
      .post(`/api/factures/${oldQuote.body.facture.id}/transformer-en-facture`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(converted.status, 200, converted.text);
    assert.equal(converted.body.facture.type, 'facture');

    // À la limite : dupliquer ou convertir un autre document ne doit pas créer une facture.
    const blockedDuplicate = await request(app)
      .post(`/api/factures/${invoices[0].id}/dupliquer`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(blockedDuplicate.status, 403, blockedDuplicate.text);
    assert.equal(blockedDuplicate.body.code, 'QUOTA_DEPASSE');

    const secondQuote = await createDocument('devis');
    assert.equal(secondQuote.status, 201, secondQuote.text);
    await pool.query(
      'UPDATE factures SET created_at = DATE_SUB(NOW(), INTERVAL 2 MONTH) WHERE id = ? AND user_id = ?',
      [secondQuote.body.facture.id, userId]
    );
    const blockedConversion = await request(app)
      .post(`/api/factures/${secondQuote.body.facture.id}/transformer-en-facture`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(blockedConversion.status, 403, blockedConversion.text);
    assert.equal(blockedConversion.body.code, 'QUOTA_DEPASSE');

    // Une facture récurrente peut être préparée, mais sa génération respecte le même quota.
    const recurring = await request(app)
      .post('/api/factures-recurrentes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        libelle: 'Maintenance mensuelle',
        frequence: 'mensuelle',
        prochaine_date: '2026-11-10',
        lignes: [{ designation: 'Maintenance', quantite: 1, prix_unitaire: 100, tva: 0 }]
      });
    assert.equal(recurring.status, 201, recurring.text);

    const blockedRecurring = await request(app)
      .post(`/api/factures-recurrentes/${recurring.body.recurrente.id}/generer`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(blockedRecurring.status, 403, blockedRecurring.text);
    assert.equal(blockedRecurring.body.code, 'QUOTA_DEPASSE');

    // La suppression d'une facture ne rend pas une place gratuite : le compteur garde
    // la trace de la création initiale pendant toute la période mensuelle.
    const deleted = await request(app)
      .delete(`/api/factures/${invoices[0].id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(deleted.status, 200, deleted.text);

    const afterDelete = await createDocument('facture');
    assert.equal(afterDelete.status, 403, afterDelete.text);
    assert.equal(afterDelete.body.code, 'QUOTA_DEPASSE');

    const [[usage]] = await pool.query(
      "SELECT nombre_factures FROM facture_usage_mensuelle WHERE user_id = ? AND periode = DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')",
      [userId]
    );
    assert.equal(Number(usage.nombre_factures), FREE_MONTHLY_INVOICE_LIMIT);
  });
});

after(teardownTestEnvironment);
