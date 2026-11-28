'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  app,
  pool,
  setupTestDatabase,
  emailDeTest,
  nettoyerUtilisateur,
  teardownTestEnvironment
} = require('./setup');
const { reserveInvoiceCheckout } = require('../services/invoice-checkout-lifecycle');

let userId;
let token;
let clientId;
const createdCheckouts = [];

async function createInvoice(label) {
  const response = await request(app)
    .post('/api/factures')
    .set('Authorization', 'Bearer ' + token)
    .send({
      client_id: clientId,
      type: 'facture',
      lignes: [{ designation: label, quantite: 1, prix_unitaire: 10000, tva: 0 }]
    });
  assert.equal(response.status, 201, response.text);
  return Number(response.body.facture.id);
}

async function reserve(invoiceId, suffix) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await reserveInvoiceCheckout(connection, {
      userId,
      invoiceId,
      provider: 'wave',
      reference: (suffix + Date.now().toString(16)).padEnd(64, '0').slice(0, 64)
    });
    await connection.commit();
    createdCheckouts.push(result.checkoutId);
    return result;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

before(async () => {
  await setupTestDatabase();
  const registration = await request(app)
    .post('/api/auth/register')
    .send({
      nom: 'Checkout concurrency test',
      email: emailDeTest('checkout-concurrency'),
      password: 'motdepasse123',
      acceptTerms: true
    });
  assert.equal(registration.status, 201, registration.text);
  userId = Number(registration.body.user.id);
  token = registration.body.token;

  const client = await request(app)
    .post('/api/clients')
    .set('Authorization', 'Bearer ' + token)
    .send({ nom: 'Client checkout concurrency' });
  assert.equal(client.status, 201, client.text);
  clientId = Number(client.body.client.id);
});

after(async () => {
  await nettoyerUtilisateur(userId);
  await teardownTestEnvironment();
});

test('deux réservations concurrentes ne créent qu’un seul checkout actif', async () => {
  const invoiceId = await createInvoice('Checkout concurrent');
  const attempts = await Promise.all([
    reserve(invoiceId, 'a'.repeat(16)),
    reserve(invoiceId, 'b'.repeat(16))
  ].map(promise => promise.then(value => ({ ok: true, value })).catch(error => ({
    ok: false,
    code: error.code,
    status: error.status
  }))));

  assert.deepEqual(attempts.map(result => result.ok).sort(), [false, true]);
  const rejected = attempts.find(result => !result.ok);
  assert.equal(rejected.code, 'CHECKOUT_DEJA_ACTIF');
  assert.equal(rejected.status, 409);

  const [[count]] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM pro_invoice_checkouts
      WHERE user_id = ? AND facture_id = ?
        AND statut IN ('creation', 'en_attente')
        AND (expire_at IS NULL OR expire_at > NOW())`,
    [userId, invoiceId]
  );
  assert.equal(Number(count.total), 1);
});

test('un checkout actif bloque le paiement manuel et l’annulation de la facture', async () => {
  const invoiceId = await createInvoice('Checkout bloque les opérations concurrentes');
  const checkout = await reserve(invoiceId, 'c'.repeat(16));

  const manualPayment = await request(app)
    .post('/api/factures/' + invoiceId + '/paiements')
    .set('Authorization', 'Bearer ' + token)
    .send({ montant: 100, methode: 'especes', reference: 'TEST-CHECKOUT-ACTIF' });
  assert.equal(manualPayment.status, 409, manualPayment.text);
  assert.equal(manualPayment.body.code, 'CHECKOUT_DEJA_ACTIF');

  const cancelInvoice = await request(app)
    .put('/api/factures/' + invoiceId + '/statut')
    .set('Authorization', 'Bearer ' + token)
    .send({ statut: 'annulee' });
  assert.equal(cancelInvoice.status, 409, cancelInvoice.text);
  assert.equal(cancelInvoice.body.code, 'CHECKOUT_DEJA_ACTIF');

  const [[invoice]] = await pool.query(
    'SELECT statut, montant_paye FROM factures WHERE id = ? AND user_id = ?',
    [invoiceId, userId]
  );
  assert.equal(invoice.statut, 'en_attente');
  assert.equal(Number(invoice.montant_paye), 0);

  const [[paymentCount]] = await pool.query(
    'SELECT COUNT(*) AS total FROM paiements WHERE user_id = ? AND facture_id = ?',
    [userId, invoiceId]
  );
  assert.equal(Number(paymentCount.total), 0);

  await pool.query(
    "UPDATE pro_invoice_checkouts SET expire_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE id = ? AND user_id = ?",
    [checkout.checkoutId, userId]
  );

  const nowAllowed = await request(app)
    .post('/api/factures/' + invoiceId + '/paiements')
    .set('Authorization', 'Bearer ' + token)
    .send({ montant: 100, methode: 'especes', reference: 'TEST-CHECKOUT-EXPIRE' });
  assert.equal(nowAllowed.status, 201, nowAllowed.text);
});
