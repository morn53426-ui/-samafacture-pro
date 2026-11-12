const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');
const {
  app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment
} = require('./setup');

let userId, token, clientId, productId;
const originalEncryptionKey = process.env.DATA_ENCRYPTION_KEY;
const originalAppUrl = process.env.APP_URL;
const originalFetch = global.fetch;

async function creerFacture({ amount = 1000, tax = 0, quantity = 1, product = false } = {}) {
  const line = { designation: 'Prestation de test', quantite: quantity, prix_unitaire: amount, tva: tax };
  if (product) line.produit_id = productId;
  const response = await request(app)
    .post('/api/factures')
    .set('Authorization', 'Bearer ' + token)
    .send({ client_id: clientId, type: 'facture', lignes: [line] });
  assert.equal(response.status, 201, response.text);
  return response.body.facture;
}

before(async () => {
  process.env.DATA_ENCRYPTION_KEY = 'test-encryption-key-phases-2-4-ne-pas-utiliser';
  process.env.APP_URL = 'https://staging.samafacture.invalid';
  await setupTestDatabase();
  const registration = await request(app)
    .post('/api/auth/register')
    .send({ nom: 'Entreprise Phases 2-4', entreprise_nom: 'Entreprise Phases 2-4', email: emailDeTest('phases24'), password: 'motdepasse123' });
  assert.equal(registration.status, 201, registration.text);
  userId = registration.body.user.id;
  token = registration.body.token;

  const client = await request(app).post('/api/clients').set('Authorization', 'Bearer ' + token).send({ nom: 'Client recette phases 2-4' });
  assert.equal(client.status, 201, client.text);
  clientId = client.body.client.id;

  const product = await request(app).post('/api/produits').set('Authorization', 'Bearer ' + token)
    .send({ nom: 'Produit recette multi-entrepôt', reference: 'PHASE24-001', prix_ht: 1000, prix_achat: 500, tva: 18, stock: 10 });
  assert.equal(product.status, 201, product.text);
  productId = product.body.produit.id;
});

test('les clés marchandes sont chiffrées, spécifiques à l’entreprise et jamais renvoyées en lecture', async () => {
  const apiKey = 'wave_test_api_key_123456789';
  const signingSecret = 'wave_test_webhook_secret_123456789';
  const configured = await request(app)
    .put('/api/pro/payment-gateways/wave')
    .set('Authorization', 'Bearer ' + token)
    .send({ api_key: apiKey, signing_secret: signingSecret });
  assert.equal(configured.status, 200, configured.text);

  const listed = await request(app).get('/api/pro/payment-gateways').set('Authorization', 'Bearer ' + token);
  assert.equal(listed.status, 200, listed.text);
  assert.equal(listed.body.gateways.length, 1);
  assert.equal(listed.body.gateways[0].fournisseur, 'wave');
  assert.equal(JSON.stringify(listed.body).includes(apiKey), false, 'la clé API ne doit jamais apparaître dans la réponse');
  assert.equal(JSON.stringify(listed.body).includes(signingSecret), false, 'le secret webhook ne doit jamais apparaître dans la réponse');

  const [[stored]] = await pool.query('SELECT credentials_enc FROM pro_payment_gateways WHERE user_id = ? AND fournisseur = ?', [userId, 'wave']);
  assert.equal(stored.credentials_enc.includes(apiKey), false, 'la clé API doit être chiffrée dans MySQL');
  assert.equal(stored.credentials_enc.includes(signingSecret), false, 'le secret webhook doit être chiffré dans MySQL');
});

test('un checkout Wave est confirmé par serveur-à-serveur, idempotent et inscrit dans les paiements de facture', async () => {
  const invoice = await creerFacture({ amount: 2500, tax: 0 });
  const signingSecret = 'wave_test_webhook_secret_123456789';
  let clientReference = null;
  const providerSessionId = 'cs_sama_test_24001';
  const expectedAmount = Number(invoice.total);
  const restoreFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target === 'https://api.wave.com/v1/checkout/sessions' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      clientReference = body.client_reference;
      assert.equal(body.currency, 'XOF');
      assert.equal(Number(body.amount), expectedAmount);
      return { ok: true, json: async () => ({ id: providerSessionId, wave_launch_url: 'https://pay.wave.com/c/test-session' }) };
    }
    if (target === 'https://api.wave.com/v1/checkout/sessions/' + providerSessionId) {
      return {
        ok: true,
        json: async () => ({
          id: providerSessionId,
          transaction_id: 'txn_sama_test_24001',
          checkout_status: 'complete',
          payment_status: 'succeeded',
          client_reference: clientReference,
          currency: 'XOF',
          amount: String(expectedAmount)
        })
      };
    }
    throw new Error('Appel réseau inattendu dans le test : ' + target);
  };

  try {
    const checkout = await request(app)
      .post('/api/pro/invoices/' + invoice.id + '/checkout')
      .set('Authorization', 'Bearer ' + token)
      .send({ fournisseur: 'wave' });
    assert.equal(checkout.status, 201, checkout.text);
    assert.equal(checkout.body.fournisseur, 'wave');
    assert.equal(checkout.body.montant, expectedAmount);
    assert.match(checkout.body.checkout_url, /^https:\/\//);
    const reference = checkout.body.reference;
    assert.equal(clientReference, reference);

    const invalidEvent = { type: 'checkout.session.completed', data: { id: providerSessionId, client_reference: reference } };
    const invalidRawBody = JSON.stringify(invalidEvent);
    const invalidTimestamp = String(Math.floor(Date.now() / 1000));
    const invalid = await request(app)
      .post('/api/payment-webhooks/wave')
      .set('Content-Type', 'application/json')
      .set('Wave-Signature', 't=' + invalidTimestamp + ',v1=' + '0'.repeat(64))
      .send(invalidRawBody);
    assert.equal(invalid.status, 401, 'une signature falsifiée ne doit pas créditer une facture');

    const event = {
      id: 'evt_sama_test_24001',
      type: 'checkout.session.completed',
      data: { id: providerSessionId, client_reference: reference }
    };
    const rawBody = JSON.stringify(event);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = crypto.createHmac('sha256', signingSecret).update(timestamp + rawBody).digest('hex');
    const first = await request(app)
      .post('/api/payment-webhooks/wave')
      .set('Content-Type', 'application/json')
      .set('Wave-Signature', 't=' + timestamp + ',v1=' + signature)
      .send(rawBody);
    assert.equal(first.status, 200, first.text);
    assert.equal(first.body.received, true);

    const second = await request(app)
      .post('/api/payment-webhooks/wave')
      .set('Content-Type', 'application/json')
      .set('Wave-Signature', 't=' + timestamp + ',v1=' + signature)
      .send(rawBody);
    assert.equal(second.status, 200, second.text);
    assert.equal(second.body.duplicate, true);

    const [[updatedInvoice]] = await pool.query('SELECT statut, montant_paye FROM factures WHERE id = ? AND user_id = ?', [invoice.id, userId]);
    assert.equal(updatedInvoice.statut, 'payee');
    assert.equal(Number(updatedInvoice.montant_paye), expectedAmount);
    const [[paymentCount]] = await pool.query('SELECT COUNT(*) AS total FROM paiements WHERE user_id = ? AND facture_id = ?', [userId, invoice.id]);
    assert.equal(Number(paymentCount.total), 1, 'un même événement Wave ne doit créer qu’un paiement');
  } finally {
    global.fetch = restoreFetch;
  }
});

test('les achats et réceptions partielles mettent à jour le stock global et le stock par entrepôt', async () => {
  const saleInvoice = await creerFacture({ amount: 1000, quantity: 2, product: true });
  const [[afterSale]] = await pool.query('SELECT stock FROM produits WHERE id = ? AND user_id = ?', [productId, userId]);
  assert.equal(Number(afterSale.stock), 8, 'la facture client doit décrémenter le stock existant');

  const supplier = await request(app).post('/api/pro/suppliers').set('Authorization', 'Bearer ' + token)
    .send({ nom: 'Fournisseur recette phases 2-4', email: 'fournisseur@example.test', ninea: 'SN-TEST-24' });
  assert.equal(supplier.status, 201, supplier.text);

  const warehouse = await request(app).post('/api/pro/warehouses').set('Authorization', 'Bearer ' + token)
    .send({ code: 'ANNEXE-24', nom: 'Dépôt annexe recette' });
  assert.equal(warehouse.status, 201, warehouse.text);

  const order = await request(app).post('/api/pro/purchase-orders').set('Authorization', 'Bearer ' + token)
    .send({
      fournisseur_id: supplier.body.id,
      date_commande: '2026-11-12',
      devise: 'XOF',
      lignes: [{ produit_id: productId, designation: 'Produit recette multi-entrepôt', quantite: 5, prix_unitaire: 500, tva: 18 }]
    });
  assert.equal(order.status, 201, order.text);

  const detail = await request(app).get('/api/pro/purchase-orders/' + order.body.id).set('Authorization', 'Bearer ' + token);
  assert.equal(detail.status, 200, detail.text);
  const lineId = detail.body.lignes[0].id;

  const receipt = await request(app).post('/api/pro/purchase-orders/' + order.body.id + '/receive')
    .set('Authorization', 'Bearer ' + token)
    .send({ entrepot_id: warehouse.body.id, date_reception: '2026-11-12', lignes: [{ ligne_id: lineId, quantite: 3 }] });
  assert.equal(receipt.status, 201, receipt.text);
  assert.equal(receipt.body.statut, 'partiellement_recue');

  const [[afterReceipt]] = await pool.query('SELECT stock FROM produits WHERE id = ? AND user_id = ?', [productId, userId]);
  assert.equal(Number(afterReceipt.stock), 11, 'la réception doit augmenter le stock total après la vente de deux unités');

  const duplicate = await request(app).post('/api/pro/purchase-orders/' + order.body.id + '/receive')
    .set('Authorization', 'Bearer ' + token)
    .send({ entrepot_id: warehouse.body.id, lignes: [{ ligne_id: lineId, quantite: 3 }, { ligne_id: lineId, quantite: 1 }] });
  assert.equal(duplicate.status, 400, duplicate.text);

  const stock = await request(app).get('/api/pro/inventory/stock').set('Authorization', 'Bearer ' + token);
  assert.equal(stock.status, 200, stock.text);
  assert.equal(Number(stock.body.stocks.find(row => Number(row.produit_id) === Number(productId)).quantite), 11);

  const transfer = await request(app).post('/api/pro/inventory/transfers').set('Authorization', 'Bearer ' + token)
    .send({ produit_id: productId, entrepot_source_id: warehouse.body.id, entrepot_destination_id: 99999999, quantite: 1 });
  assert.notEqual(transfer.status, 201, 'un entrepôt de destination qui appartient pas à l’entreprise doit être refusé');

  const [[movementCount]] = await pool.query('SELECT COUNT(*) AS total FROM pro_mouvements_stock WHERE user_id = ? AND produit_id = ?', [userId, productId]);
  assert.ok(Number(movementCount.total) >= 2, 'les ventes et réceptions doivent être journalisées');
  assert.ok(saleInvoice.id);
});

test('la comptabilité applique la partie double, publie la balance et empêche les écritures non équilibrées', async () => {
  const invoice = await creerFacture({ amount: 5000, tax: 18 });
  const config = await request(app).get('/api/pro/accounting/config').set('Authorization', 'Bearer ' + token);
  assert.equal(config.status, 200, config.text);
  assert.ok(config.body.comptes.some(account => account.code === '411'));
  assert.ok(config.body.comptes.some(account => account.code === '706'));
  assert.ok(config.body.journaux.some(journal => journal.code === 'VE'));

  const posted = await request(app).post('/api/pro/accounting/post-invoice/' + invoice.id).set('Authorization', 'Bearer ' + token).send({});
  assert.ok([200,201].includes(posted.status), posted.text);
  const replay = await request(app).post('/api/pro/accounting/post-invoice/' + invoice.id).set('Authorization', 'Bearer ' + token).send({});
  assert.equal(replay.status, 200, replay.text);
  assert.equal(replay.body.duplicate, true);

  const balance = await request(app).get('/api/pro/accounting/trial-balance').set('Authorization', 'Bearer ' + token);
  assert.equal(balance.status, 200, balance.text);
  assert.equal(balance.body.equilibree, true);
  assert.ok(Math.abs(Number(balance.body.total_debit) - Number(balance.body.total_credit)) <= 0.01);

  const accountDebit = config.body.comptes.find(account => account.code === '521');
  const accountCredit = config.body.comptes.find(account => account.code === '571');
  const invalid = await request(app).post('/api/pro/accounting/entries').set('Authorization', 'Bearer ' + token)
    .send({ journal_id: config.body.journaux.find(j => j.code === 'OD').id, date_ecriture: '2026-11-12', libelle: 'Écriture déséquilibrée', lignes: [{ compte_id: accountDebit.id, debit: 100, credit: 0 }, { compte_id: accountCredit.id, debit: 0, credit: 50 }] });
  assert.equal(invalid.status, 400, invalid.text);

  const payment = await request(app).post('/api/factures/' + invoice.id + '/paiements').set('Authorization', 'Bearer ' + token)
    .set('Idempotency-Key', 'phase24-accounting-payment-' + Date.now())
    .send({ montant: invoice.total, methode: 'virement' });
  assert.equal(payment.status, 201, payment.text);
  const [[paymentRow]] = await pool.query('SELECT id FROM paiements WHERE user_id = ? AND facture_id = ? LIMIT 1', [userId, invoice.id]);
  const postedPayment = await request(app).post('/api/pro/accounting/post-payment/' + paymentRow.id).set('Authorization', 'Bearer ' + token).send({});
  assert.ok([200,201].includes(postedPayment.status), postedPayment.text);

  const finalBalance = await request(app).get('/api/pro/accounting/trial-balance').set('Authorization', 'Bearer ' + token);
  assert.equal(finalBalance.status, 200, finalBalance.text);
  assert.equal(finalBalance.body.equilibree, true);
  const entries = await request(app).get('/api/pro/accounting/entries').set('Authorization', 'Bearer ' + token);
  assert.equal(entries.status, 200, entries.text);
  assert.ok(entries.body.ecritures.length >= 2);
});

after(async () => {
  try {
    await nettoyerUtilisateur(userId);
  } finally {
    global.fetch = originalFetch;
    if (originalEncryptionKey === undefined) delete process.env.DATA_ENCRYPTION_KEY;
    else process.env.DATA_ENCRYPTION_KEY = originalEncryptionKey;
    if (originalAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = originalAppUrl;
    await teardownTestEnvironment();
  }
});
