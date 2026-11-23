const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');
const {
  app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment
} = require('./setup');

let userId, token, clientId, productId, serviceProductId;
const originalEncryptionKey = process.env.DATA_ENCRYPTION_KEY;
const originalAppUrl = process.env.APP_URL;
const originalFetch = global.fetch;

async function creerFacture({ amount = 1000, tax = 0, quantity = 1, product = false, freeText = false } = {}) {
  const line = { designation: 'Prestation de test', quantite: quantity, prix_unitaire: amount, tva: tax };
  if (!freeText) line.produit_id = product ? productId : serviceProductId;
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
    .send({ nom: 'Entreprise Phases 2-4', entreprise_nom: 'Entreprise Phases 2-4', email: emailDeTest('phases24'), password: 'motdepasse123' , acceptTerms: true});
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

  const service = await request(app).post('/api/produits').set('Authorization', 'Bearer ' + token)
    .send({ nom: 'Service recette comptable', type_catalogue: 'service', prix_ht: 1000, prix_achat: 0, tva: 0 });
  assert.equal(service.status, 201, service.text);
  serviceProductId = service.body.produit.id;
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

test('les liens de paiement héritent de la devise facture et rejettent les incohérences', async () => {
  const invoice = await creerFacture({ amount: 2000, tax: 0 });
  await pool.query('UPDATE factures SET devise = ? WHERE id = ? AND user_id = ?', ['EUR', invoice.id, userId]);

  const link = await request(app)
    .post('/api/pro/payment-links')
    .set('Authorization', 'Bearer ' + token)
    .send({ facture_id: invoice.id, montant: 1200 });
  assert.equal(link.status, 201, link.text);
  assert.equal(link.body.devise, 'EUR', 'la devise absente doit hériter de celle de la facture');

  const tokenFromUrl = new URL(link.body.url).searchParams.get('token');
  assert.match(tokenFromUrl || '', /^[a-f0-9]{64}$/);
  const publicLink = await request(app).get('/api/public/paiement/' + tokenFromUrl);
  assert.equal(publicLink.status, 200, publicLink.text);
  assert.equal(publicLink.body.devise, 'EUR');
  assert.equal(Number(publicLink.body.montant), 1200);
  assert.equal(Number(publicLink.body.solde_facture), 2000);

  const [[beforeInvalid]] = await pool.query(
    'SELECT COUNT(*) AS total FROM pro_payment_links WHERE user_id = ? AND facture_id = ?',
    [userId, invoice.id]
  );
  const mismatch = await request(app)
    .post('/api/pro/payment-links')
    .set('Authorization', 'Bearer ' + token)
    .send({ facture_id: invoice.id, montant: 500, devise: 'USD' });
  assert.equal(mismatch.status, 409, mismatch.text);
  const unsupported = await request(app)
    .post('/api/pro/payment-links')
    .set('Authorization', 'Bearer ' + token)
    .send({ facture_id: invoice.id, montant: 500, devise: 'ZZZ' });
  assert.equal(unsupported.status, 400, unsupported.text);

  const [[afterInvalid]] = await pool.query(
    'SELECT COUNT(*) AS total FROM pro_payment_links WHERE user_id = ? AND facture_id = ?',
    [userId, invoice.id]
  );
  assert.equal(Number(afterInvalid.total), Number(beforeInvalid.total),
    'aucun lien ne doit être créé pour une devise incohérente ou non prise en charge');

  const sameCurrency = await request(app)
    .post('/api/pro/payment-links')
    .set('Authorization', 'Bearer ' + token)
    .send({ facture_id: invoice.id, montant: 500, devise: 'EUR' });
  assert.equal(sameCurrency.status, 201, sameCurrency.text);
  assert.equal(sameCurrency.body.devise, 'EUR');
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
      devise: 'FCFA',
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

  const catalogueStock = await request(app).put('/api/produits/' + productId)
    .set('Authorization', 'Bearer ' + token)
    .send({ stock: 12 });
  assert.equal(catalogueStock.status, 200, catalogueStock.text);
  assert.equal(Number(catalogueStock.body.produit.stock), 12, 'la modification du catalogue doit ajuster le dépôt principal et conserver le total');
  const duplicate = await request(app).post('/api/pro/purchase-orders/' + order.body.id + '/receive')
    .set('Authorization', 'Bearer ' + token)
    .send({ entrepot_id: warehouse.body.id, lignes: [{ ligne_id: lineId, quantite: 3 }, { ligne_id: lineId, quantite: 1 }] });
  assert.equal(duplicate.status, 400, duplicate.text);

  const stock = await request(app).get('/api/pro/inventory/stock').set('Authorization', 'Bearer ' + token);
  assert.equal(stock.status, 200, stock.text);
  assert.equal(Number(stock.body.stocks.find(row => Number(row.produit_id) === Number(productId)).quantite), 12);

  const transfer = await request(app).post('/api/pro/inventory/transfers').set('Authorization', 'Bearer ' + token)
    .send({ produit_id: productId, entrepot_source_id: warehouse.body.id, entrepot_destination_id: 99999999, quantite: 1 });
  assert.notEqual(transfer.status, 201, 'un entrepôt de destination qui appartient pas à l’entreprise doit être refusé');

  const [[movementCount]] = await pool.query('SELECT COUNT(*) AS total FROM pro_mouvements_stock WHERE user_id = ? AND produit_id = ?', [userId, productId]);
  assert.ok(Number(movementCount.total) >= 2, 'les ventes et réceptions doivent être journalisées');
  assert.ok(saleInvoice.id);
});

test('la comptabilité applique la partie double, publie la balance et empêche les écritures non équilibrées', async () => {
  const invoice = await creerFacture({ amount: 5000, tax: 18, freeText: true });
  const config = await request(app).get('/api/pro/accounting/config').set('Authorization', 'Bearer ' + token);
  assert.equal(config.status, 200, config.text);
  assert.ok(config.body.comptes.some(account => account.code === '411'));
  assert.ok(config.body.comptes.some(account => account.code === '706'));
  assert.ok(config.body.journaux.some(journal => journal.code === 'VE'));

  const defaultMappings = await request(app).get('/api/pro/accounting/mappings').set('Authorization', 'Bearer ' + token);
  assert.equal(defaultMappings.status, 200, defaultMappings.text);
  assert.equal(defaultMappings.body.correspondances.some(mapping => mapping.type_source === 'vente' && mapping.cle_source === 'saisie_libre'), false,
    'une ligne libre ne doit pas être assimilée automatiquement à un service');
  const missingTextMapping = await request(app).post('/api/pro/accounting/post-invoice/' + invoice.id)
    .set('Authorization', 'Bearer ' + token).send({});
  assert.equal(missingTextMapping.status, 409, missingTextMapping.text);
  assert.equal(missingTextMapping.body.code, 'CORRESPONDANCE_COMPTABLE_MANQUANTE');
  const [[missingTextEntry]] = await pool.query(
    "SELECT COUNT(*) AS total FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'facture' AND source_id = ?",
    [userId, invoice.id]
  );
  assert.equal(Number(missingTextEntry.total), 0, 'aucune écriture ne doit être créée sans classification explicite');

  const explicitTextMapping = await request(app).put('/api/pro/accounting/mappings')
    .set('Authorization', 'Bearer ' + token)
    .send({ type_source: 'vente', cle_source: 'saisie_libre', compte_id: config.body.comptes.find(account => account.code === '706').id });
  assert.equal(explicitTextMapping.status, 200, explicitTextMapping.text);

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

test('annulation et réactivation contre-passent chaque écriture facture sans doublon', async () => {
  const invoice = await creerFacture({ amount: 5000, tax: 18 });
  const posted = await request(app)
    .post('/api/pro/accounting/post-invoice/' + invoice.id)
    .set('Authorization', 'Bearer ' + token)
    .send({});
  assert.equal(posted.status, 201, posted.text);

  const [[originalEntry]] = await pool.query(
    "SELECT id FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'facture' AND source_id = ?",
    [userId, invoice.id]
  );
  assert.ok(originalEntry, 'l’écriture initiale de la facture doit exister');

  const readLines = async entryId => {
    const [rows] = await pool.query(
      'SELECT c.code, l.debit, l.credit FROM pro_compta_lignes l JOIN pro_compta_comptes c ON c.id = l.compte_id AND c.user_id = l.user_id WHERE l.user_id = ? AND l.ecriture_id = ? ORDER BY c.code',
      [userId, entryId]
    );
    return rows.map(row => ({
      code: row.code,
      debit: Number(row.debit),
      credit: Number(row.credit)
    }));
  };
  const originalLines = await readLines(originalEntry.id);
  assert.deepEqual(originalLines, [
    { code: '411', debit: 5900, credit: 0 },
    { code: '443', debit: 0, credit: 900 },
    { code: '706', debit: 0, credit: 5000 }
  ]);

  const cancel = async () => request(app)
    .put('/api/factures/' + invoice.id + '/statut')
    .set('Authorization', 'Bearer ' + token)
    .send({ statut: 'annulee' });
  const reactivate = async () => request(app)
    .put('/api/factures/' + invoice.id + '/statut')
    .set('Authorization', 'Bearer ' + token)
    .send({ statut: 'en_attente' });

  const cancelled = await cancel();
  assert.equal(cancelled.status, 200, cancelled.text);
  assert.equal(cancelled.body.facture.statut, 'annulee');

  let [events] = await pool.query(
    'SELECT id, transition, previous_ecriture_id, ecriture_id FROM pro_compta_facture_events WHERE user_id = ? AND facture_id = ? ORDER BY id',
    [userId, invoice.id]
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].transition, 'annulation');
  const [reversalRows] = await pool.query(
    'SELECT id, source_type, source_id, total_debit, total_credit FROM pro_compta_ecritures WHERE id = ? AND user_id = ?',
    [events[0].ecriture_id, userId]
  );
  assert.equal(reversalRows.length, 1);
  assert.equal(reversalRows[0].source_type, 'facture_annulation');
  assert.equal(Number(reversalRows[0].source_id), Number(events[0].id));
  assert.equal(Number(reversalRows[0].total_debit), 5900);
  assert.equal(Number(reversalRows[0].total_credit), 5900);
  const reversalLines = await readLines(events[0].ecriture_id);
  assert.deepEqual(reversalLines, originalLines.map(line => ({
    code: line.code,
    debit: line.credit,
    credit: line.debit
  })), 'l’annulation doit inverser chaque ligne et chaque compte de l’écriture initiale');

  const duplicateCancel = await cancel();
  assert.equal(duplicateCancel.status, 200, duplicateCancel.text);
  [events] = await pool.query(
    'SELECT id FROM pro_compta_facture_events WHERE user_id = ? AND facture_id = ?',
    [userId, invoice.id]
  );
  assert.equal(events.length, 1, 'répéter le statut annulé ne doit pas créer une seconde contrepassation');

  const restored = await reactivate();
  assert.equal(restored.status, 200, restored.text);
  assert.equal(restored.body.facture.statut, 'en_attente');
  [events] = await pool.query(
    'SELECT id, transition, previous_ecriture_id, ecriture_id FROM pro_compta_facture_events WHERE user_id = ? AND facture_id = ? ORDER BY id',
    [userId, invoice.id]
  );
  assert.equal(events.length, 2);
  assert.equal(events[1].transition, 'reactivation');
  assert.equal(Number(events[1].previous_ecriture_id), Number(events[0].ecriture_id));
  assert.deepEqual(await readLines(events[1].ecriture_id), originalLines,
    'la réactivation doit rétablir exactement les lignes de l’écriture d’origine');

  const cancelledAgain = await cancel();
  assert.equal(cancelledAgain.status, 200, cancelledAgain.text);
  [events] = await pool.query(
    'SELECT id, transition, previous_ecriture_id, ecriture_id FROM pro_compta_facture_events WHERE user_id = ? AND facture_id = ? ORDER BY id',
    [userId, invoice.id]
  );
  assert.equal(events.length, 3, 'plusieurs cycles annulation/réactivation doivent être journalisés');
  assert.equal(events[2].transition, 'annulation');
  assert.notEqual(Number(events[2].ecriture_id), Number(events[0].ecriture_id));
  assert.deepEqual(await readLines(events[2].ecriture_id), reversalLines,
    'la seconde annulation doit de nouveau inverser la dernière écriture active');

  const deletePostedInvoice = await request(app)
    .delete('/api/factures/' + invoice.id)
    .set('Authorization', 'Bearer ' + token);
  assert.equal(deletePostedInvoice.status, 409, deletePostedInvoice.text);
  assert.equal(deletePostedInvoice.body.code, 'DOCUMENT_HISTORIQUE_PROTEGE');
  const [[retainedInvoice]] = await pool.query(
    'SELECT id, statut FROM factures WHERE id = ? AND user_id = ?',
    [invoice.id, userId]
  );
  assert.equal(Number(retainedInvoice.id), Number(invoice.id));
  assert.equal(retainedInvoice.statut, 'annulee',
    'une facture comptabilisée annulée doit rester consultable pour la piste d’audit');

  const unpostedInvoice = await creerFacture({ amount: 1200, tax: 0 });
  const cancelUnposted = await request(app)
    .put('/api/factures/' + unpostedInvoice.id + '/statut')
    .set('Authorization', 'Bearer ' + token)
    .send({ statut: 'annulee' });
  assert.equal(cancelUnposted.status, 200, cancelUnposted.text);
  const [unpostedEvents] = await pool.query(
    'SELECT id FROM pro_compta_facture_events WHERE user_id = ? AND facture_id = ?',
    [userId, unpostedInvoice.id]
  );
  assert.deepEqual(unpostedEvents, [],
    'une facture jamais comptabilisée ne doit pas générer de ligne de contrepassation');

  const deleteUnpostedInvoice = await request(app)
    .delete('/api/factures/' + unpostedInvoice.id)
    .set('Authorization', 'Bearer ' + token);
  assert.equal(deleteUnpostedInvoice.status, 409, deleteUnpostedInvoice.text,
    'une facture émise reste dans l’historique même sans écriture comptable');
  assert.equal(deleteUnpostedInvoice.body.code, 'DOCUMENT_HISTORIQUE_PROTEGE');
  const [[retainedUnpostedInvoice]] = await pool.query(
    'SELECT id, statut FROM factures WHERE id = ? AND user_id = ?',
    [unpostedInvoice.id, userId]
  );
  assert.equal(Number(retainedUnpostedInvoice.id), Number(unpostedInvoice.id));
  assert.equal(retainedUnpostedInvoice.statut, 'annulee');
});

test('les dépenses distinguent caisse et banque et deviennent immuables après comptabilisation', async () => {
  const createExpense = payload => request(app).post('/api/depenses')
    .set('Authorization', 'Bearer ' + token).send(payload);
  const postExpense = id => request(app).post('/api/pro/accounting/post-expense/' + id)
    .set('Authorization', 'Bearer ' + token);

  const invalidMode = await createExpense({ libelle: 'Mode invalide', montant: 1000, mode_reglement: 'mobile' });
  assert.equal(invalidMode.status, 400);
  assert.equal(invalidMode.body.code, 'MODE_REGLEMENT_INVALIDE');

  const bankExpense = await createExpense({
    libelle: 'Frais bancaires de test', montant: 8500,
    categorie: 'Frais généraux', mode_reglement: 'banque'
  });
  assert.equal(bankExpense.status, 201, bankExpense.text);
  assert.equal(bankExpense.body.depense.mode_reglement, 'banque');
  const bankPosted = await postExpense(bankExpense.body.depense.id);
  assert.equal(bankPosted.status, 201, bankPosted.text);
  const [[bankEntry]] = await pool.query(
    'SELECT e.id, e.total_debit, e.total_credit, j.code AS journal_code FROM pro_compta_ecritures e JOIN pro_compta_journaux j ON j.id = e.journal_id AND j.user_id = e.user_id WHERE e.user_id = ? AND e.source_type = ? AND e.source_id = ?',
    [userId, 'depense', bankExpense.body.depense.id]
  );
  assert.equal(bankEntry.journal_code, 'BQ');
  assert.equal(Number(bankEntry.total_debit), 8500);
  assert.equal(Number(bankEntry.total_credit), 8500);
  const [bankLines] = await pool.query(
    'SELECT c.code, l.debit, l.credit FROM pro_compta_lignes l JOIN pro_compta_comptes c ON c.id = l.compte_id AND c.user_id = l.user_id WHERE l.user_id = ? AND l.ecriture_id = ? ORDER BY c.code',
    [userId, bankEntry.id]
  );
  assert.deepEqual(bankLines.map(line => ({ code: line.code, debit: Number(line.debit), credit: Number(line.credit) })), [
    { code: '521', debit: 0, credit: 8500 },
    { code: '638', debit: 8500, credit: 0 }
  ]);

  const bankReplay = await postExpense(bankExpense.body.depense.id);
  assert.equal(bankReplay.status, 200, bankReplay.text);
  assert.equal(bankReplay.body.duplicate, true);
  const updatePosted = await request(app).put('/api/depenses/' + bankExpense.body.depense.id)
    .set('Authorization', 'Bearer ' + token).send({ montant: 9999, mode_reglement: 'caisse' });
  assert.equal(updatePosted.status, 409, updatePosted.text);
  assert.equal(updatePosted.body.code, 'DEPENSE_COMPTABILISEE_PROTEGEE');
  const deletePosted = await request(app).delete('/api/depenses/' + bankExpense.body.depense.id)
    .set('Authorization', 'Bearer ' + token);
  assert.equal(deletePosted.status, 409, deletePosted.text);
  assert.equal(deletePosted.body.code, 'DEPENSE_COMPTABILISEE_PROTEGEE');

  const listed = await request(app).get('/api/depenses').set('Authorization', 'Bearer ' + token);
  assert.equal(listed.status, 200, listed.text);
  const listedExpense = listed.body.depenses.find(row => Number(row.id) === Number(bankExpense.body.depense.id));
  assert.equal(Number(listedExpense.comptabilisee), 1);

  const cashExpense = await createExpense({ libelle: 'Petite caisse test', montant: 1200 });
  assert.equal(cashExpense.status, 201, cashExpense.text);
  assert.equal(cashExpense.body.depense.mode_reglement, 'caisse');
  const cashPosted = await postExpense(cashExpense.body.depense.id);
  assert.equal(cashPosted.status, 201, cashPosted.text);
  const [[cashEntry]] = await pool.query(
    'SELECT e.id, j.code AS journal_code FROM pro_compta_ecritures e JOIN pro_compta_journaux j ON j.id = e.journal_id AND j.user_id = e.user_id WHERE e.user_id = ? AND e.source_type = ? AND e.source_id = ?',
    [userId, 'depense', cashExpense.body.depense.id]
  );
  assert.equal(cashEntry.journal_code, 'CA');
  const [cashLines] = await pool.query(
    'SELECT c.code, l.debit, l.credit FROM pro_compta_lignes l JOIN pro_compta_comptes c ON c.id = l.compte_id AND c.user_id = l.user_id WHERE l.user_id = ? AND l.ecriture_id = ?',
    [userId, cashEntry.id]
  );
  assert.ok(cashLines.some(line => line.code === '571' && Number(line.credit) === 1200));
});

test('un remboursement réellement exécuté contre-passe le journal du paiement sans doublon', async () => {
  const createPayment = async (invoiceId, amount, method) => {
    const response = await request(app)
      .post('/api/factures/' + invoiceId + '/paiements')
      .set('Authorization', 'Bearer ' + token)
      .set('Idempotency-Key', 'phase24-refund-' + crypto.randomBytes(8).toString('hex'))
      .send({ montant: amount, methode: method });
    assert.equal(response.status, 201, response.text);
    const [[paymentRow]] = await pool.query(
      'SELECT id FROM paiements WHERE user_id = ? AND facture_id = ? ORDER BY id DESC LIMIT 1',
      [userId, invoiceId]
    );
    return paymentRow;
  };
  const requestRefund = async (paymentId, amount, motif) => request(app)
    .post('/api/pro/payments/' + paymentId + '/refunds')
    .set('Authorization', 'Bearer ' + token)
    .send({ montant: amount, motif });
  const completeRefund = async (refundId, reference) => request(app)
    .put('/api/pro/refunds/' + refundId + '/status')
    .set('Authorization', 'Bearer ' + token)
    .send({ statut: 'rembourse', reference_prestataire: reference });

  // Virement bancaire : le remboursement doit créditer le même compte 521.
  const bankInvoice = await creerFacture({ amount: 4000, tax: 0 });
  const bankInvoiceEntry = await request(app)
    .post('/api/pro/accounting/post-invoice/' + bankInvoice.id)
    .set('Authorization', 'Bearer ' + token)
    .send({});
  assert.equal(bankInvoiceEntry.status, 201, bankInvoiceEntry.text);
  const bankPayment = await createPayment(bankInvoice.id, 3000, 'virement');
  const postedBankPayment = await request(app)
    .post('/api/pro/accounting/post-payment/' + bankPayment.id)
    .set('Authorization', 'Bearer ' + token)
    .send({});
  assert.equal(postedBankPayment.status, 201, postedBankPayment.text);

  const bankRefundOne = await requestRefund(bankPayment.id, 800, 'Remboursement partiel test banque');
  assert.equal(bankRefundOne.status, 201, bankRefundOne.text);
  const completedBankRefundOne = await completeRefund(bankRefundOne.body.id, 'REF-BANK-001');
  assert.equal(completedBankRefundOne.status, 200, completedBankRefundOne.text);

  const bankRefundTwo = await requestRefund(bankPayment.id, 200, 'Deuxième remboursement partiel test banque');
  assert.equal(bankRefundTwo.status, 201, bankRefundTwo.text);
  const completedBankRefundTwo = await completeRefund(bankRefundTwo.body.id, 'REF-BANK-002');
  assert.equal(completedBankRefundTwo.status, 200, completedBankRefundTwo.text);

  const [[bankInvoiceAfter]] = await pool.query(
    'SELECT montant_paye, statut FROM factures WHERE id = ? AND user_id = ?',
    [bankInvoice.id, userId]
  );
  assert.equal(Number(bankInvoiceAfter.montant_paye), 2000);
  assert.equal(bankInvoiceAfter.statut, 'en_attente');

  const [bankRefundEntries] = await pool.query(
    "SELECT e.id, e.source_id, e.total_debit, e.total_credit, j.code AS journal_code FROM pro_compta_ecritures e JOIN pro_compta_journaux j ON j.id = e.journal_id AND j.user_id = e.user_id WHERE e.user_id = ? AND e.source_type = 'remboursement' AND e.source_id IN (?, ?) ORDER BY e.source_id",
    [userId, bankRefundOne.body.id, bankRefundTwo.body.id]
  );
  assert.equal(bankRefundEntries.length, 2);
  for (const entry of bankRefundEntries) {
    assert.equal(entry.journal_code, 'BQ');
    assert.equal(Number(entry.total_debit), Number(entry.total_credit));
  }
  const [bankRefundLines] = await pool.query(
    "SELECT c.code, SUM(l.debit) AS debit, SUM(l.credit) AS credit FROM pro_compta_lignes l JOIN pro_compta_comptes c ON c.id = l.compte_id AND c.user_id = l.user_id JOIN pro_compta_ecritures e ON e.id = l.ecriture_id AND e.user_id = l.user_id WHERE l.user_id = ? AND e.source_type = 'remboursement' AND e.source_id IN (?, ?) GROUP BY c.code ORDER BY c.code",
    [userId, bankRefundOne.body.id, bankRefundTwo.body.id]
  );
  assert.deepEqual(bankRefundLines.map(line => ({
    code: line.code, debit: Number(line.debit), credit: Number(line.credit)
  })), [
    { code: '411', debit: 1000, credit: 0 },
    { code: '521', debit: 0, credit: 1000 }
  ]);

  const replayRefund = await completeRefund(bankRefundOne.body.id, 'REF-BANK-001');
  assert.equal(replayRefund.status, 404, replayRefund.text);
  const [[refundCount]] = await pool.query(
    "SELECT COUNT(*) AS n FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'remboursement' AND source_id = ?",
    [userId, bankRefundOne.body.id]
  );
  assert.equal(Number(refundCount.n), 1, 'une demande remboursée ne doit pas être comptabilisée deux fois');

  // Espèces : si l'encaissement initial n'a jamais été journalisé, il est
  // d'abord comptabilisé puis contre-passé dans la même transaction.
  const cashInvoice = await creerFacture({ amount: 1500, tax: 0 });
  const cashPayment = await createPayment(cashInvoice.id, 1000, 'Espèces');
  const cashRefund = await requestRefund(cashPayment.id, 400, 'Remboursement espèces test');
  assert.equal(cashRefund.status, 201, cashRefund.text);
  const completedCashRefund = await completeRefund(cashRefund.body.id, 'REF-CASH-001');
  assert.equal(completedCashRefund.status, 200, completedCashRefund.text);

  const [[autoPostedPayment]] = await pool.query(
    "SELECT id FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'paiement' AND source_id = ?",
    [userId, cashPayment.id]
  );
  assert.ok(autoPostedPayment, 'le paiement d’origine doit être journalisé avant la sortie de trésorerie');
  const [[cashRefundEntry]] = await pool.query(
    "SELECT e.id, e.total_debit, e.total_credit, j.code AS journal_code FROM pro_compta_ecritures e JOIN pro_compta_journaux j ON j.id = e.journal_id AND j.user_id = e.user_id WHERE e.user_id = ? AND e.source_type = 'remboursement' AND e.source_id = ?",
    [userId, cashRefund.body.id]
  );
  assert.equal(cashRefundEntry.journal_code, 'CA');
  assert.equal(Number(cashRefundEntry.total_debit), 400);
  assert.equal(Number(cashRefundEntry.total_credit), 400);
  const [cashRefundLines] = await pool.query(
    "SELECT c.code, l.debit, l.credit FROM pro_compta_lignes l JOIN pro_compta_comptes c ON c.id = l.compte_id AND c.user_id = l.user_id WHERE l.user_id = ? AND l.ecriture_id = ? ORDER BY c.code",
    [userId, cashRefundEntry.id]
  );
  assert.deepEqual(cashRefundLines.map(line => ({
    code: line.code, debit: Number(line.debit), credit: Number(line.credit)
  })), [
    { code: '411', debit: 400, credit: 0 },
    { code: '571', debit: 0, credit: 400 }
  ]);

  // Le chèque est un moyen bancaire : l'écriture doit utiliser 521, pas 571.
  const chequeInvoice = await creerFacture({ amount: 2000, tax: 0 });
  const chequePayment = await createPayment(chequeInvoice.id, 1500, 'Chèque');
  const postedCheque = await request(app)
    .post('/api/pro/accounting/post-payment/' + chequePayment.id)
    .set('Authorization', 'Bearer ' + token)
    .send({});
  assert.equal(postedCheque.status, 201, postedCheque.text);
  const [[chequeEntry]] = await pool.query(
    "SELECT e.id, j.code AS journal_code FROM pro_compta_ecritures e JOIN pro_compta_journaux j ON j.id = e.journal_id AND j.user_id = e.user_id WHERE e.user_id = ? AND e.source_type = 'paiement' AND e.source_id = ?",
    [userId, chequePayment.id]
  );
  assert.equal(chequeEntry.journal_code, 'BQ');
  const [chequeLines] = await pool.query(
    'SELECT c.code, l.debit, l.credit FROM pro_compta_lignes l JOIN pro_compta_comptes c ON c.id = l.compte_id AND c.user_id = l.user_id WHERE l.user_id = ? AND l.ecriture_id = ? ORDER BY c.code',
    [userId, chequeEntry.id]
  );
  assert.deepEqual(chequeLines.map(line => ({ code: line.code, debit: Number(line.debit), credit: Number(line.credit) })), [
    { code: '411', debit: 0, credit: 1500 },
    { code: '521', debit: 1500, credit: 0 }
  ]);

  // Si l'écriture paiement manque, le remboursement du chèque doit la recréer sur 521.
  const chequeRefundInvoice = await creerFacture({ amount: 2000, tax: 0 });
  const chequeRefundPayment = await createPayment(chequeRefundInvoice.id, 1000, 'Chèque');
  const chequeRefundRequest = await requestRefund(chequeRefundPayment.id, 300, 'Remboursement chèque test');
  assert.equal(chequeRefundRequest.status, 201, chequeRefundRequest.text);
  const chequeRefundCompleted = await completeRefund(chequeRefundRequest.body.id, 'REF-CHEQUE-001');
  assert.equal(chequeRefundCompleted.status, 200, chequeRefundCompleted.text);
  const [[autoChequeEntry]] = await pool.query(
    "SELECT e.id, j.code AS journal_code FROM pro_compta_ecritures e JOIN pro_compta_journaux j ON j.id = e.journal_id AND j.user_id = e.user_id WHERE e.user_id = ? AND e.source_type = 'paiement' AND e.source_id = ?",
    [userId, chequeRefundPayment.id]
  );
  assert.equal(autoChequeEntry.journal_code, 'BQ');
  const [[chequeRefundEntry]] = await pool.query(
    "SELECT e.id, e.total_debit, e.total_credit, j.code AS journal_code FROM pro_compta_ecritures e JOIN pro_compta_journaux j ON j.id = e.journal_id AND j.user_id = e.user_id WHERE e.user_id = ? AND e.source_type = 'remboursement' AND e.source_id = ?",
    [userId, chequeRefundRequest.body.id]
  );
  assert.equal(chequeRefundEntry.journal_code, 'BQ');
  assert.equal(Number(chequeRefundEntry.total_debit), 300);
  assert.equal(Number(chequeRefundEntry.total_credit), 300);
  const [chequeRefundLines] = await pool.query(
    'SELECT c.code, l.debit, l.credit FROM pro_compta_lignes l JOIN pro_compta_comptes c ON c.id = l.compte_id AND c.user_id = l.user_id WHERE l.user_id = ? AND l.ecriture_id = ? ORDER BY c.code',
    [userId, chequeRefundEntry.id]
  );
  assert.deepEqual(chequeRefundLines.map(line => ({ code: line.code, debit: Number(line.debit), credit: Number(line.credit) })), [
    { code: '411', debit: 300, credit: 0 },
    { code: '521', debit: 0, credit: 300 }
  ]);

  // Une méthode libre inconnue ne doit jamais être devinée comme caisse.
  const unknownInvoice = await creerFacture({ amount: 1500, tax: 0 });
  const unknownPayment = await createPayment(unknownInvoice.id, 1000, 'Mode personnalisé');
  const unknownPost = await request(app)
    .post('/api/pro/accounting/post-payment/' + unknownPayment.id)
    .set('Authorization', 'Bearer ' + token)
    .send({});
  assert.equal(unknownPost.status, 409, unknownPost.text);
  assert.equal(unknownPost.body.code, 'METHODE_PAIEMENT_NON_RECONNUE');
  const unknownRefundRequest = await requestRefund(unknownPayment.id, 250, 'Remboursement méthode inconnue');
  assert.equal(unknownRefundRequest.status, 201, unknownRefundRequest.text);
  const unknownRefundCompleted = await completeRefund(unknownRefundRequest.body.id, 'REF-UNKNOWN-001');
  assert.equal(unknownRefundCompleted.status, 409, unknownRefundCompleted.text);
  assert.equal(unknownRefundCompleted.body.code, 'METHODE_PAIEMENT_NON_RECONNUE');
  const [[unknownEntries]] = await pool.query(
    "SELECT COUNT(*) AS total FROM pro_compta_ecritures WHERE user_id = ? AND ((source_type = 'paiement' AND source_id = ?) OR (source_type = 'remboursement' AND source_id = ?))",
    [userId, unknownPayment.id, unknownRefundRequest.body.id]
  );
  assert.equal(Number(unknownEntries.total), 0, 'aucuna écriture ne doit être créée pour une méthode non reconnue');

  const balance = await request(app)
    .get('/api/pro/accounting/trial-balance')
    .set('Authorization', 'Bearer ' + token);
  assert.equal(balance.status, 200, balance.text);
  assert.equal(balance.body.equilibree, true);
});


test('la comptabilisation des dépenses est équilibrée, idempotente et isolée par entreprise', async () => {
  const expense = await request(app)
    .post('/api/depenses')
    .set('Authorization', 'Bearer ' + token)
    .send({
      libelle: 'Loyer du bureau — recette comptable',
      montant: 875,
      categorie: 'Loyer',
      date_depense: '2026-11-13'
    });
  assert.equal(expense.status, 201, expense.text);
  const expenseId = expense.body.depense.id;

  const config = await request(app)
    .get('/api/pro/accounting/config')
    .set('Authorization', 'Bearer ' + token);
  assert.equal(config.status, 200, config.text);
  const expenseAccount = config.body.comptes.find(account => account.code === '622');
  const cashAccount = config.body.comptes.find(account => account.code === '571');
  assert.ok(expenseAccount, 'le compte de loyers 622 doit être disponible');
  assert.ok(cashAccount, 'le compte de caisse 571 doit être disponible');
  const mappingLoyer = await request(app).put('/api/pro/accounting/mappings')
    .set('Authorization', 'Bearer ' + token)
    .send({ type_source: 'depense', cle_source: 'Loyer', compte_id: expenseAccount.id });
  assert.equal(mappingLoyer.status, 200, mappingLoyer.text);

  const posted = await request(app)
    .post('/api/pro/accounting/post-expense/' + expenseId)
    .set('Authorization', 'Bearer ' + token)
    .send({});
  assert.equal(posted.status, 201, posted.text);
  assert.equal(posted.body.duplicate, false);

  const replay = await request(app)
    .post('/api/pro/accounting/post-expense/' + expenseId)
    .set('Authorization', 'Bearer ' + token)
    .send({});
  assert.equal(replay.status, 200, replay.text);
  assert.equal(replay.body.duplicate, true, 'une dépense ne doit pas créer deux écritures');

  const [expenseLedger, cashLedger] = await Promise.all([
    request(app)
      .get('/api/pro/accounting/ledger?compte_id=' + expenseAccount.id)
      .set('Authorization', 'Bearer ' + token),
    request(app)
      .get('/api/pro/accounting/ledger?compte_id=' + cashAccount.id)
      .set('Authorization', 'Bearer ' + token)
  ]);
  assert.equal(expenseLedger.status, 200, expenseLedger.text);
  assert.equal(cashLedger.status, 200, cashLedger.text);
  const debitLine = expenseLedger.body.ecritures.find(entry =>
    entry.ecriture_libelle === 'Dépense Loyer du bureau — recette comptable'
  );
  const creditLine = cashLedger.body.ecritures.find(entry =>
    entry.ecriture_libelle === 'Dépense Loyer du bureau — recette comptable'
  );
  assert.ok(debitLine, 'le journal des charges doit contenir la dépense');
  assert.ok(creditLine, 'la contrepartie caisse doit être présente');
  assert.equal(Number(debitLine.debit), 875);
  assert.equal(Number(debitLine.credit), 0);
  assert.equal(Number(creditLine.debit), 0);
  assert.equal(Number(creditLine.credit), 875);

  const balance = await request(app)
    .get('/api/pro/accounting/trial-balance?from=2026-11-13&to=2026-11-13')
    .set('Authorization', 'Bearer ' + token);
  assert.equal(balance.status, 200, balance.text);
  assert.equal(balance.body.equilibree, true);
  assert.equal(Number(balance.body.total_debit), 875);
  assert.equal(Number(balance.body.total_credit), 875);

  const other = await request(app)
    .post('/api/auth/register')
    .send({
      nom: 'Entreprise Comptabilité B',
      email: emailDeTest('phases24-compta-b'),
      password: 'motdepasse123',
      acceptTerms: true
    });
  assert.equal(other.status, 201, other.text);
  const otherToken = other.body.token;
  try {
    const isolated = await request(app)
      .get('/api/pro/accounting/entries')
      .set('Authorization', 'Bearer ' + otherToken);
    assert.equal(isolated.status, 200, isolated.text);
    assert.deepEqual(isolated.body.ecritures, [],
      'une entreprise ne doit pas voir les écritures de la première entreprise');

    const crossTenantExpense = await request(app)
      .post('/api/pro/accounting/post-expense/' + expenseId)
      .set('Authorization', 'Bearer ' + otherToken)
      .send({});
    assert.equal(crossTenantExpense.status, 404, crossTenantExpense.text);
  } finally {
    await nettoyerUtilisateur(other.body.user.id);
  }
});


test('les correspondances OHADA ventilent les ventes par type et les dépenses par catégorie sans reclasser les données', async () => {
  // Ce scénario crée plusieurs factures. Le plan pro est simulé uniquement dans
  // la base de test afin que le quota Gratuit ne masque pas les tests de mapping.
  await pool.query("UPDATE users SET plan = 'pro' WHERE id = ?", [userId]);
  const getMappings = () => request(app).get('/api/pro/accounting/mappings').set('Authorization', 'Bearer ' + token);
  const setMapping = (type_source, cle_source, account) => request(app)
    .put('/api/pro/accounting/mappings')
    .set('Authorization', 'Bearer ' + token)
    .send({ type_source, cle_source, compte_id: account.id });
  const config = await request(app).get('/api/pro/accounting/config').set('Authorization', 'Bearer ' + token);
  assert.equal(config.status, 200, config.text);
  const account = code => config.body.comptes.find(item => item.code === code);
  assert.ok(account('701'));
  assert.ok(account('706'));
  assert.ok(account('707'));
  assert.ok(account('6181'));
  assert.ok(account('625'));
  assert.ok(account('638'));
  assert.ok(account('702'));
  assert.ok(account('703'));
  assert.ok(account('704'));
  assert.ok(account('705'));

  const defaults = await getMappings();
  assert.equal(defaults.status, 200, defaults.text);
  assert.ok(defaults.body.correspondances.some(row => row.type_source === 'vente' && row.cle_source === 'produit' && row.code === '701'));
  assert.ok(defaults.body.correspondances.some(row => row.type_source === 'vente' && row.cle_source === 'service' && row.code === '706'));
  assert.ok(defaults.body.correspondances.some(row => row.type_source === 'depense' && row.cle_source === '__default__' && row.code === '638'));

  const invalidClass = await setMapping('vente', 'produit', account('521'));
  assert.equal(invalidClass.status, 400);
  assert.equal(invalidClass.body.code, 'CLASSE_COMPTE_CORRESPONDANCE_INVALIDE');

  const product = await pool.query('SELECT type_catalogue FROM produits WHERE id = ? AND user_id = ?', [productId, userId]);
  assert.equal(product[0][0].type_catalogue, 'produit');
  const serviceResponse = await request(app).post('/api/produits')
    .set('Authorization', 'Bearer ' + token)
    .send({ nom: 'Service correspondance', type_catalogue: 'service', prix_ht: 1000, prix_achat: 0, tva: 0 });
  assert.equal(serviceResponse.status, 201, serviceResponse.text);
  const serviceId = serviceResponse.body.produit.id;

  const productMapping = await setMapping('vente', 'produit', account('702'));
  assert.equal(productMapping.status, 200, productMapping.text);
  const serviceMapping = await setMapping('vente', 'service', account('706'));
  assert.equal(serviceMapping.status, 200, serviceMapping.text);

  const invoice = await request(app).post('/api/factures').set('Authorization', 'Bearer ' + token).send({
    client_id: clientId,
    type: 'facture',
    remise: 500,
    frais_livraison: 100,
    lignes: [
      { designation: 'Marchandise comptable', produit_id: productId, quantite: 1, prix_unitaire: 1000, tva: 0 },
      { designation: 'Prestation comptable', produit_id: serviceId, quantite: 1, prix_unitaire: 1000, tva: 0 }
    ]
  });
  assert.equal(invoice.status, 201, invoice.text);
  assert.equal(Number(invoice.body.facture.total), 1600);

  const posted = await request(app).post('/api/pro/accounting/post-invoice/' + invoice.body.facture.id)
    .set('Authorization', 'Bearer ' + token).send({});
  assert.equal(posted.status, 201, posted.text);
  const [[entry]] = await pool.query(
    "SELECT id, total_debit, total_credit FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'facture' AND source_id = ?",
    [userId, invoice.body.facture.id]
  );
  assert.equal(Number(entry.total_debit), 1600);
  assert.equal(Number(entry.total_credit), 1600);
  const [revenueLines] = await pool.query(
    "SELECT c.code, SUM(l.credit) AS credit FROM pro_compta_lignes l JOIN pro_compta_comptes c ON c.id = l.compte_id AND c.user_id = l.user_id WHERE l.user_id = ? AND l.ecriture_id = ? AND c.classe = 7 GROUP BY c.code ORDER BY c.code",
    [userId, entry.id]
  );
  assert.deepEqual(revenueLines.map(row => ({ code: row.code, credit: Number(row.credit) })), [
    { code: '702', credit: 750 },
    { code: '706', credit: 750 },
    { code: '707', credit: 100 }
  ]);

  await pool.query("UPDATE pro_compta_comptes SET actif = 0 WHERE user_id = ? AND code = '702'", [userId]);
  const replayAfterAccountDeactivation = await request(app)
    .post('/api/pro/accounting/post-invoice/' + invoice.body.facture.id)
    .set('Authorization', 'Bearer ' + token).send({});
  assert.equal(replayAfterAccountDeactivation.status, 200, replayAfterAccountDeactivation.text);
  assert.equal(replayAfterAccountDeactivation.body.duplicate, true,
    'une écriture déjà validée doit rester rejouable même si son compte de correspondance est désactivé');
  await pool.query("UPDATE pro_compta_comptes SET actif = 1 WHERE user_id = ? AND code = '702'", [userId]);

  const shippingOnlyInvoice = await request(app).post('/api/factures').set('Authorization', 'Bearer ' + token).send({
    client_id: clientId,
    type: 'facture',
    frais_livraison: 250,
    lignes: [{ designation: 'Ligne sans prix — frais de transport', quantite: 1, prix_unitaire: 0, tva: 0 }]
  });
  assert.equal(shippingOnlyInvoice.status, 201, shippingOnlyInvoice.text);
  assert.equal(Number(shippingOnlyInvoice.body.facture.total), 250);
  const shippingOnlyPosted = await request(app).post('/api/pro/accounting/post-invoice/' + shippingOnlyInvoice.body.facture.id)
    .set('Authorization', 'Bearer ' + token).send({});
  assert.equal(shippingOnlyPosted.status, 201, shippingOnlyPosted.text);
  const [[shippingOnlyEntry]] = await pool.query(
    "SELECT id FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'facture' AND source_id = ?",
    [userId, shippingOnlyInvoice.body.facture.id]
  );
  const [shippingOnlyLines] = await pool.query(
    'SELECT c.code, l.debit, l.credit FROM pro_compta_lignes l JOIN pro_compta_comptes c ON c.id = l.compte_id AND c.user_id = l.user_id WHERE l.user_id = ? AND l.ecriture_id = ? ORDER BY c.code',
    [userId, shippingOnlyEntry.id]
  );
  assert.deepEqual(shippingOnlyLines.map(row => ({ code: row.code, debit: Number(row.debit), credit: Number(row.credit) })), [
    { code: '411', debit: 250, credit: 0 },
    { code: '707', debit: 0, credit: 250 }
  ]);

  const unclassified = await request(app).post('/api/produits').set('Authorization', 'Bearer ' + token)
    .send({ nom: 'Ancienne fiche non classée', type_catalogue: 'non_classe', stock: 2, prix_ht: 100, tva: 0 });
  assert.equal(unclassified.status, 201, unclassified.text);
  const unclassifiedId = unclassified.body.produit.id;
  const legacyInvoice = await request(app).post('/api/factures').set('Authorization', 'Bearer ' + token).send({
    client_id: clientId, type: 'facture',
    lignes: [{ designation: 'Ligne ancienne non classée', produit_id: unclassifiedId, quantite: 1, prix_unitaire: 100, tva: 0 }]
  });
  assert.equal(legacyInvoice.status, 201, legacyInvoice.text);
  const missingLegacyMapping = await request(app).post('/api/pro/accounting/post-invoice/' + legacyInvoice.body.facture.id)
    .set('Authorization', 'Bearer ' + token).send({});
  assert.equal(missingLegacyMapping.status, 409, missingLegacyMapping.text);
  assert.equal(missingLegacyMapping.body.code, 'CORRESPONDANCE_COMPTABLE_MANQUANTE');
  const [[missingLegacyEntry]] = await pool.query(
    "SELECT COUNT(*) AS total FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'facture' AND source_id = ?",
    [userId, legacyInvoice.body.facture.id]
  );
  assert.equal(Number(missingLegacyEntry.total), 0, 'une fiche non classée ne doit pas être envoyée silencieusement en 706');
  const explicitLegacyMapping = await setMapping('vente', 'non_classe', account('706'));
  assert.equal(explicitLegacyMapping.status, 200, explicitLegacyMapping.text);
  const legacyPosted = await request(app).post('/api/pro/accounting/post-invoice/' + legacyInvoice.body.facture.id)
    .set('Authorization', 'Bearer ' + token).send({});
  assert.equal(legacyPosted.status, 201, legacyPosted.text);
  const [[legacyType]] = await pool.query('SELECT type_catalogue FROM produits WHERE id = ? AND user_id = ?', [unclassifiedId, userId]);
  assert.equal(legacyType.type_catalogue, 'non_classe', 'la correspondance ne doit jamais reclasser automatiquement la fiche historique');
  const [legacyRevenue] = await pool.query(
    "SELECT c.code FROM pro_compta_lignes l JOIN pro_compta_comptes c ON c.id = l.compte_id AND c.user_id = l.user_id JOIN pro_compta_ecritures e ON e.id = l.ecriture_id AND e.user_id = l.user_id WHERE l.user_id = ? AND e.source_type = 'facture' AND e.source_id = ? AND l.credit > 0 AND c.classe = 7",
    [userId, legacyInvoice.body.facture.id]
  );
  assert.deepEqual(legacyRevenue.map(row => row.code), ['706']);

  const categoryExpense = await request(app).post('/api/depenses').set('Authorization', 'Bearer ' + token)
    .send({ libelle: 'Déplacement client', montant: 500, categorie: 'Déplacements', mode_reglement: 'banque', date_depense: '2026-11-22' });
  assert.equal(categoryExpense.status, 201, categoryExpense.text);
  const categoryMapping = await setMapping('depense', 'déplacements', account('6181'));
  assert.equal(categoryMapping.status, 200, categoryMapping.text);
  const expensePosted = await request(app).post('/api/pro/accounting/post-expense/' + categoryExpense.body.depense.id)
    .set('Authorization', 'Bearer ' + token).send({});
  assert.equal(expensePosted.status, 201, expensePosted.text);
  const [[expenseEntry]] = await pool.query(
    "SELECT id FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'depense' AND source_id = ?",
    [userId, categoryExpense.body.depense.id]
  );
  const [expenseLines] = await pool.query(
    'SELECT c.code, l.debit, l.credit FROM pro_compta_lignes l JOIN pro_compta_comptes c ON c.id = l.compte_id AND c.user_id = l.user_id WHERE l.user_id = ? AND l.ecriture_id = ? ORDER BY c.code',
    [userId, expenseEntry.id]
  );
  assert.deepEqual(expenseLines.map(row => ({ code: row.code, debit: Number(row.debit), credit: Number(row.credit) })), [
    { code: '521', debit: 0, credit: 500 },
    { code: '6181', debit: 500, credit: 0 }
  ]);

  await pool.query("UPDATE pro_compta_comptes SET actif = 0 WHERE user_id = ? AND code = '6181'", [userId]);
  const replayExpenseAfterAccountDeactivation = await request(app)
    .post('/api/pro/accounting/post-expense/' + categoryExpense.body.depense.id)
    .set('Authorization', 'Bearer ' + token).send({});
  assert.equal(replayExpenseAfterAccountDeactivation.status, 200, replayExpenseAfterAccountDeactivation.text);
  assert.equal(replayExpenseAfterAccountDeactivation.body.duplicate, true,
    'une dépense déjà validée doit rester rejouable même si son compte de correspondance est désactivé');
  await pool.query("UPDATE pro_compta_comptes SET actif = 1 WHERE user_id = ? AND code = '6181'", [userId]);

  const readBack = await getMappings();
  assert.equal(readBack.status, 200, readBack.text);
  assert.ok(readBack.body.categories_depenses.some(row => row.categorie === 'Déplacements' && row.personnalisee && row.code === '6181'));
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
