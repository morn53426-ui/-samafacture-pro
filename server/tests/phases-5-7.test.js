const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment
} = require('./setup');

let userA, tokenA, userB, tokenB, clientA, clientB, originalEnv;
const smtpVars = ['SMTP_HOST','SMTP_USER','SMTP_PASSWORD','SMTP_PORT','APP_URL'];

async function register(nom, prefix) {
  const r = await request(app).post('/api/auth/register').send({
    nom, entreprise_nom: nom, email: emailDeTest(prefix), password: 'motdepasse123'
  , acceptTerms: true});
  assert.equal(r.status, 201, r.text);
  return { id: r.body.user.id, token: r.body.token };
}

async function createClient(token, nom, email) {
  const r = await request(app).post('/api/clients').set('Authorization', 'Bearer ' + token)
    .send({ nom, email, telephone: '+221770000000' });
  assert.equal(r.status, 201, r.text);
  return r.body.client.id;
}

async function createDocument(token, clientId, type, devise='FCFA') {
  const r = await request(app).post('/api/factures').set('Authorization', 'Bearer ' + token)
    .send({
      client_id: clientId, type, devise,
      date_emission: '2026-11-12',
      date_validite: type === 'devis' ? '2026-12-15' : undefined,
      lignes: [{ designation: 'Prestation test', quantite: 1, prix_unitaire: 12000, tva: 18 }]
    });
  assert.equal(r.status, 201, r.text);
  return r.body.facture;
}

before(async () => {
  originalEnv = Object.fromEntries(smtpVars.map(k => [k, process.env[k]]));
  for (const key of ['SMTP_HOST','SMTP_USER','SMTP_PASSWORD']) delete process.env[key];
  process.env.APP_URL = 'https://staging.samafacture.invalid';
  await setupTestDatabase();
  const a = await register('Entreprise A phases 5-7', 'phase57a');
  const b = await register('Entreprise B phases 5-7', 'phase57b');
  userA = a.id; tokenA = a.token; userB = b.id; tokenB = b.token;
  clientA = await createClient(tokenA, 'Client Portail A', 'client-a@example.test');
  clientB = await createClient(tokenB, 'Client privé B', 'client-b@example.test');
});

test('portail client : lien à jeton haché, documents limités au client et révocation immédiate', async () => {
  const invoiceA = await createDocument(tokenA, clientA, 'facture', 'FCFA');
  const quoteA = await createDocument(tokenA, clientA, 'devis', 'FCFA');
  const foreignClient = await createClient(tokenA, 'Autre client A', 'autre-a@example.test');
  await createDocument(tokenA, foreignClient, 'facture', 'FCFA');

  const invited = await request(app).post('/api/pro/clients/' + clientA + '/portal')
    .set('Authorization', 'Bearer ' + tokenA).send({});
  assert.equal(invited.status, 201, invited.text);
  assert.equal(invited.body.sent, false, 'Sans SMTP, l’invitation ne doit pas être présentée comme envoyée.');
  assert.match(invited.body.url, /portail-client\.html#token=[a-f0-9]{64}$/);
  const token = new URLSearchParams(new URL(invited.body.url).hash.slice(1)).get('token');
  const [[stored]] = await pool.query(
    'SELECT token_hash, expires_at, revoked_at FROM pro_customer_portal_access WHERE user_id = ? AND client_id = ?',
    [userA, clientA]
  );
  assert.equal(stored.token_hash, require('node:crypto').createHash('sha256').update(token).digest('hex'));
  assert.equal(stored.token_hash.includes(token), false);

  const publicView = await request(app).get('/api/portal/').set('X-SF-Portal-Token', token);
  assert.equal(publicView.status, 200, publicView.text);
  assert.equal(publicView.headers['cache-control'], 'no-store');
  assert.deepEqual(new Set(publicView.body.documents.map(d => Number(d.id))), new Set([Number(invoiceA.id), Number(quoteA.id)]));

  const decision = await request(app).post('/api/portal/quotes/' + quoteA.id + '/decision').set('X-SF-Portal-Token', token)
    .send({ decision: 'accepte', commentaire: 'Bon pour accord.' });
  assert.equal(decision.status, 201, decision.text);
  const [[crmDecision]] = await pool.query(
    "SELECT titre, description FROM pro_crm_activities WHERE user_id = ? AND client_id = ? AND titre = ? ORDER BY id DESC LIMIT 1",
    [userA, clientA, 'Réponse client au devis ' + quoteA.numero]
  );
  assert.ok(crmDecision, 'la réponse au devis doit apparaître dans le CRM');
  assert.match(crmDecision.description, /Devis accepté/);
  const replay = await request(app).post('/api/portal/quotes/' + quoteA.id + '/decision').set('X-SF-Portal-Token', token)
    .send({ decision: 'refuse' });
  assert.equal(replay.status, 409, replay.text);

  const afterDecision = await request(app).get('/api/portal/').set('X-SF-Portal-Token', token);
  assert.equal(afterDecision.status, 200, afterDecision.text);
  assert.equal(afterDecision.body.documents.find(d => Number(d.id) === Number(quoteA.id)).portail_decision, 'accepte');

  const revoked = await request(app).delete('/api/pro/clients/' + clientA + '/portal')
    .set('Authorization', 'Bearer ' + tokenA).send({});
  assert.equal(revoked.status, 200, revoked.text);
  const inaccessible = await request(app).get('/api/portal/' + token);
  assert.equal(inaccessible.status, 404, inaccessible.text);
});

test('CRM : activités, tâches et isolation stricte des clients entre entreprises', async () => {
  const activity = await request(app).post('/api/pro/crm/activities')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({
      client_id: clientA, type: 'tache', titre: 'Rappeler le client',
      description: 'Confirmer le besoin.', due_at: '2026-11-20T10:00:00.000Z'
    });
  assert.equal(activity.status, 201, activity.text);

  const list = await request(app).get('/api/pro/crm/activities?client_id=' + clientA)
    .set('Authorization', 'Bearer ' + tokenA);
  assert.equal(list.status, 200, list.text);
  assert.ok(list.body.activites.length >= 2, 'l’historique doit inclure la tâche et la décision de devis déjà reçue');
  const createdTask = list.body.activites.find(row => Number(row.id) === Number(activity.body.id));
  assert.ok(createdTask);
  assert.equal(createdTask.statut, 'a_faire');

  const foreign = await request(app).post('/api/pro/crm/activities')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ client_id: clientB, type: 'note', titre: 'Tentative inter-entreprise' });
  assert.equal(foreign.status, 404, foreign.text);

  const complete = await request(app).put('/api/pro/crm/activities/' + activity.body.id)
    .set('Authorization', 'Bearer ' + tokenA).send({ statut: 'terminee' });
  assert.equal(complete.status, 200, complete.text);
});

test('internationalisation : devise, langue, fuseau et formats sont propres à chaque entreprise', async () => {
  const settings = await request(app).put('/api/pro/localization')
    .set('Authorization', 'Bearer ' + tokenB)
    .send({
      pays_code: 'US', langue: 'en', devise: 'USD',
      fuseau_horaire: 'America/New_York', format_date: 'MM/dd/yyyy',
      regime_fiscal: 'standard'
    });
  assert.equal(settings.status, 200, settings.text);
  assert.equal(settings.body.parametres.locale, 'en-US');

  const invalid = await request(app).put('/api/pro/localization')
    .set('Authorization', 'Bearer ' + tokenB)
    .send({ pays_code: 'US', langue: 'xx', devise: 'BTC', fuseau_horaire: 'Mars/Phobos' });
  assert.equal(invalid.status, 400, invalid.text);

  const invoice = await createDocument(tokenB, clientB, 'facture', 'USD');
  const [[stored]] = await pool.query('SELECT devise FROM factures WHERE id = ? AND user_id = ?', [invoice.id, userB]);
  assert.equal(stored.devise, 'USD');

  const currencyChangeAfterHistory = await request(app).put('/api/pro/localization')
    .set('Authorization', 'Bearer ' + tokenB)
    .send({ pays_code: 'US', langue: 'en', devise: 'EUR', fuseau_horaire: 'America/New_York', format_date: 'MM/dd/yyyy', regime_fiscal: 'standard' });
  assert.equal(currencyChangeAfterHistory.status, 409, currencyChangeAfterHistory.text);

  const getSettings = await request(app).get('/api/pro/localization').set('Authorization', 'Bearer ' + tokenB);
  assert.equal(getSettings.status, 200, getSettings.text);
  assert.equal(getSettings.body.parametres.devise, 'USD');
  assert.equal(getSettings.body.parametres.fuseau_horaire, 'America/New_York');

  const secondTenant = await request(app).get('/api/pro/localization').set('Authorization', 'Bearer ' + tokenA);
  assert.equal(secondTenant.status, 200, secondTenant.text);
  assert.equal(secondTenant.body.parametres.devise, 'FCFA', 'les paramètres d’entreprise ne doivent pas fuiter');
});

test('assistant IA : conversations et analyses respectent l’entreprise sélectionnée', async () => {
  const [created] = await pool.query(
    'INSERT INTO assistant_conversations (user_id, titre) VALUES (?, ?)',
    [userA, 'Conversation privée entreprise A']
  );
  const ownerView = await request(app).get('/api/assistant/conversations')
    .set('Authorization', 'Bearer ' + tokenA);
  assert.equal(ownerView.status, 200, ownerView.text);
  assert.ok(ownerView.body.conversations.some(row => Number(row.id) === Number(created.insertId)));

  const foreignView = await request(app).get('/api/assistant/conversations')
    .set('Authorization', 'Bearer ' + tokenB);
  assert.equal(foreignView.status, 200, foreignView.text);
  assert.equal(foreignView.body.conversations.some(row => Number(row.id) === Number(created.insertId)), false);
});

test('automation stock : sans SMTP, aucune alerte n’est déclarée envoyée', async () => {
  const product = await request(app).post('/api/produits')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ nom: 'Stock sans SMTP', prix_ht: 500, prix_achat: 200, stock: 1, stock_minimum: 3 });
  assert.equal(product.status, 201, product.text);

  const created = await request(app).post('/api/pro/automations')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ type: 'alerte_stock_email', nom: 'Test SMTP absent', configuration: { frequence_jours: 1 } });
  assert.equal(created.status, 201, created.text);
  await pool.query('UPDATE pro_automations SET prochaine_execution = NOW() WHERE id = ? AND user_id = ?', [created.body.id, userA]);

  const { executerRelancesAutomatiques } = require('../config/scheduler');
  await executerRelancesAutomatiques();
  const [[automation]] = await pool.query('SELECT dernier_resultat FROM pro_automations WHERE id = ? AND user_id = ?', [created.body.id, userA]);
  assert.equal(automation.dernier_resultat, 'smtp_non_configure');
  const [[runs]] = await pool.query('SELECT COUNT(*) AS total FROM pro_automation_runs WHERE automation_id = ?', [created.body.id]);
  assert.equal(Number(runs.total), 0, 'un email non envoyé ne doit pas être enregistré comme livré');
});

test('seuil minimum de stock : la fiche produit conserve le seuil utilisable par les alertes', async () => {
  const created = await request(app).post('/api/produits')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ nom: 'Produit seuil phases 5-7', prix_ht: 1000, prix_achat: 500, stock: 2, stock_minimum: 5 });
  assert.equal(created.status, 201, created.text);
  assert.equal(Number(created.body.produit.stock_minimum), 5);

  const updated = await request(app).put('/api/produits/' + created.body.produit.id)
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ stock_minimum: 3 });
  assert.equal(updated.status, 200, updated.text);
  assert.equal(Number(updated.body.produit.stock_minimum), 3);

  const [[stored]] = await pool.query('SELECT stock_minimum FROM produits WHERE id = ? AND user_id = ?', [created.body.produit.id, userA]);
  assert.equal(Number(stored.stock_minimum), 3);
});

test('une commande fournisseur en attente bloque la conversion en service et reste réceptionnable', async () => {
  const product = await request(app).post('/api/produits')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ nom: 'Article avec commande ouverte', prix_ht: 1000, prix_achat: 500, stock: 0 });
  assert.equal(product.status, 201, product.text);

  const supplier = await request(app).post('/api/pro/suppliers')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ nom: 'Fournisseur commande ouverte' });
  assert.equal(supplier.status, 201, supplier.text);

  const order = await request(app).post('/api/pro/purchase-orders')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({
      fournisseur_id: supplier.body.id,
      lignes: [{
        produit_id: product.body.produit.id,
        designation: 'Article à recevoir',
        quantite: 3,
        prix_unitaire: 500,
        tva: 18
      }]
    });
  assert.equal(order.status, 201, order.text);

  const conversion = await request(app).put('/api/produits/' + product.body.produit.id)
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ type_catalogue: 'service' });
  assert.equal(conversion.status, 409, conversion.text);
  assert.match(conversion.body.error, /commande fournisseur reste à réceptionner/);

  const details = await request(app).get('/api/pro/purchase-orders/' + order.body.id)
    .set('Authorization', 'Bearer ' + tokenA);
  assert.equal(details.status, 200, details.text);
  assert.equal(details.body.lignes.length, 1);

  const receiptPayload = { operation_id: 'phase57-full-receipt-retry-001', lignes: [{ ligne_id: details.body.lignes[0].id, quantite: 3 }] };
  const receipt = await request(app).post('/api/pro/purchase-orders/' + order.body.id + '/receive')
    .set('Authorization', 'Bearer ' + tokenA).send(receiptPayload);
  assert.equal(receipt.status, 201, receipt.text);
  assert.equal(receipt.body.repeated, false);
  const replayedReceipt = await request(app).post('/api/pro/purchase-orders/' + order.body.id + '/receive')
    .set('Authorization', 'Bearer ' + tokenA).send(receiptPayload);
  assert.equal(replayedReceipt.status, 200, replayedReceipt.text);
  assert.equal(replayedReceipt.body.repeated, true);
  assert.equal(replayedReceipt.body.reception_id, receipt.body.reception_id);

  const stored = await request(app).get('/api/produits')
    .set('Authorization', 'Bearer ' + tokenA);
  const receivedProduct = stored.body.produits.find(item => Number(item.id) === Number(product.body.produit.id));
  assert.equal(Number(receivedProduct.stock), 3, 'la réception fournisseur doit alimenter le stock du produit');
});

test('annuler une commande fournisseur conserve les réceptions partielles et bloque tout nouveau reliquat', async () => {
  const product = await request(app).post('/api/produits')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ nom: 'Article réception partielle annulée', prix_ht: 1000, prix_achat: 500, stock: 0 });
  assert.equal(product.status, 201, product.text);
  const supplier = await request(app).post('/api/pro/suppliers')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ nom: 'Fournisseur annulation partielle' });
  assert.equal(supplier.status, 201, supplier.text);

  const order = await request(app).post('/api/pro/purchase-orders')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ fournisseur_id: supplier.body.id, lignes: [{
      produit_id: product.body.produit.id, designation: 'Article commandé',
      quantite: 5, prix_unitaire: 500, tva: 18
    }] });
  assert.equal(order.status, 201, order.text);
  const details = await request(app).get('/api/pro/purchase-orders/' + order.body.id)
    .set('Authorization', 'Bearer ' + tokenA);
  assert.equal(details.status, 200, details.text);

  const partialPayload = { operation_id: 'phase57-partial-receipt-retry-001', lignes: [{ ligne_id: details.body.lignes[0].id, quantite: 2 }] };
  const partialResponses = await Promise.all([
    request(app).post('/api/pro/purchase-orders/' + order.body.id + '/receive').set('Authorization', 'Bearer ' + tokenA).send(partialPayload),
    request(app).post('/api/pro/purchase-orders/' + order.body.id + '/receive').set('Authorization', 'Bearer ' + tokenA).send(partialPayload)
  ]);
  assert.deepEqual(partialResponses.map(response => response.status).sort(), [200, 201],
    'deux soumissions simultanées doivent créer une seule réception');
  const partial = partialResponses.find(response => response.status === 201);
  const partialReplay = partialResponses.find(response => response.status === 200);
  assert.equal(partial.body.statut, 'partiellement_recue');
  assert.equal(partialReplay.body.repeated, true);
  assert.equal(partialReplay.body.reception_id, partial.body.reception_id);
  const alteredReplay = await request(app).post('/api/pro/purchase-orders/' + order.body.id + '/receive')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ operation_id: 'phase57-partial-receipt-retry-001', lignes: [{ ligne_id: details.body.lignes[0].id, quantite: 1 }] });
  assert.equal(alteredReplay.status, 409, alteredReplay.text);
  const productAfterReplay = await request(app).get('/api/produits').set('Authorization', 'Bearer ' + tokenA);
  const stockAfterReplay = productAfterReplay.body.produits.find(p => Number(p.id) === Number(product.body.produit.id));
  assert.equal(Number(stockAfterReplay.stock), 2, 'une répétition simultanée ne doit pas ajouter de stock en double');

  const foreignCancel = await request(app).post('/api/pro/purchase-orders/' + order.body.id + '/cancel')
    .set('Authorization', 'Bearer ' + tokenB).send({});
  assert.equal(foreignCancel.status, 404, foreignCancel.text);

  const cancelled = await request(app).post('/api/pro/purchase-orders/' + order.body.id + '/cancel')
    .set('Authorization', 'Bearer ' + tokenA).send({});
  assert.equal(cancelled.status, 200, cancelled.text);
  assert.equal(cancelled.body.statut, 'annulee');
  assert.equal(Number(cancelled.body.quantite_recue_conservee), 2);
  assert.equal(Number(cancelled.body.quantite_restante_annulee), 3);

  const afterCancel = await request(app).get('/api/pro/purchase-orders/' + order.body.id)
    .set('Authorization', 'Bearer ' + tokenA);
  assert.equal(afterCancel.body.commande.statut, 'annulee');
  assert.equal(Number(afterCancel.body.lignes[0].quantite_recue), 2);
  const productsAfterCancel = await request(app).get('/api/produits')
    .set('Authorization', 'Bearer ' + tokenA);
  const stockAfterCancel = productsAfterCancel.body.produits.find(p => Number(p.id) === Number(product.body.produit.id));
  assert.equal(Number(stockAfterCancel.stock), 2, 'les unités déjà reçues restent physiquement en stock');

  const blockedReceipt = await request(app).post('/api/pro/purchase-orders/' + order.body.id + '/receive')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ lignes: [{ ligne_id: details.body.lignes[0].id, quantite: 3 }] });
  assert.equal(blockedReceipt.status, 409, blockedReceipt.text);
  const duplicateCancel = await request(app).post('/api/pro/purchase-orders/' + order.body.id + '/cancel')
    .set('Authorization', 'Bearer ' + tokenA).send({});
  assert.equal(duplicateCancel.status, 409, duplicateCancel.text);

  const fullyReceivedOrder = await request(app).post('/api/pro/purchase-orders')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ fournisseur_id: supplier.body.id, lignes: [{
      produit_id: product.body.produit.id, designation: 'Article complètement reçu',
      quantite: 1, prix_unitaire: 500, tva: 18
    }] });
  assert.equal(fullyReceivedOrder.status, 201, fullyReceivedOrder.text);
  const fullyReceivedDetails = await request(app).get('/api/pro/purchase-orders/' + fullyReceivedOrder.body.id)
    .set('Authorization', 'Bearer ' + tokenA);
  const fullReceipt = await request(app).post('/api/pro/purchase-orders/' + fullyReceivedOrder.body.id + '/receive')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ lignes: [{ ligne_id: fullyReceivedDetails.body.lignes[0].id, quantite: 1 }] });
  assert.equal(fullReceipt.status, 201, fullReceipt.text);
  assert.equal(fullReceipt.body.statut, 'recue');
  const fullCancel = await request(app).post('/api/pro/purchase-orders/' + fullyReceivedOrder.body.id + '/cancel')
    .set('Authorization', 'Bearer ' + tokenA).send({});
  assert.equal(fullCancel.status, 409, fullCancel.text);
});
test('les ajustements et transferts de stock restent atomiques, isolés et sans stock négatif', async () => {
  const product = await request(app).post('/api/produits')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ nom: 'Article transfert concurrent phases 5-7', prix_ht: 1000, prix_achat: 500, stock: 5 });
  assert.equal(product.status, 201, product.text);
  const productId = Number(product.body.produit.id);

  const defaultWarehouses = await request(app).get('/api/pro/warehouses')
    .set('Authorization', 'Bearer ' + tokenA);
  assert.equal(defaultWarehouses.status, 200, defaultWarehouses.text);
  const sourceWarehouse = defaultWarehouses.body.entrepots.find(item => Number(item.par_defaut) === 1);
  assert.ok(sourceWarehouse, 'un entrepôt principal doit être créé');
  const destination = await request(app).post('/api/pro/warehouses')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ code: 'PHASE57-DEST', nom: 'Dépôt destination phases 5-7' });
  assert.equal(destination.status, 201, destination.text);
  const destinationId = Number(destination.body.id);

  const foreignWarehouses = await request(app).get('/api/pro/warehouses')
    .set('Authorization', 'Bearer ' + tokenB);
  assert.equal(foreignWarehouses.status, 200, foreignWarehouses.text);
  const foreignWarehouse = foreignWarehouses.body.entrepots.find(item => Number(item.par_defaut) === 1);
  assert.ok(foreignWarehouse, 'le second tenant doit avoir son propre entrepôt principal');

  const rowsForProduct = async () => {
    const [rows] = await pool.query(
      `SELECT e.id AS entrepot_id, s.quantite
         FROM pro_stocks_entrepots s
         JOIN pro_entrepots e ON e.id = s.entrepot_id AND e.user_id = s.user_id
        WHERE s.user_id = ? AND s.produit_id = ?`,
      [userA, productId]
    );
    return Object.fromEntries(rows.map(row => [Number(row.entrepot_id), Number(row.quantite)]));
  };
  let balances = await rowsForProduct();
  assert.equal(balances[Number(sourceWarehouse.id)], 5, 'le stock initial doit être placé dans le magasin principal');

  const invalidAdjustment = await request(app).post('/api/pro/inventory/adjustments')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ produit_id: productId, entrepot_id: sourceWarehouse.id, quantite: -6, motif: 'Test refus stock négatif' });
  assert.equal(invalidAdjustment.status, 409, invalidAdjustment.text);
  balances = await rowsForProduct();
  assert.equal(balances[Number(sourceWarehouse.id)], 5, 'un ajustement refusé ne doit pas modifier le stock');

  const adjustment = await request(app).post('/api/pro/inventory/adjustments')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ produit_id: productId, entrepot_id: sourceWarehouse.id, quantite: 2, motif: 'Réception inventaire test' });
  assert.equal(adjustment.status, 200, adjustment.text);
  balances = await rowsForProduct();
  assert.equal(balances[Number(sourceWarehouse.id)], 7);

  const crossTenantTransfer = await request(app).post('/api/pro/inventory/transfers')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ produit_id: productId, entrepot_source_id: sourceWarehouse.id, entrepot_destination_id: foreignWarehouse.id, quantite: 1 });
  assert.equal(crossTenantTransfer.status, 404, crossTenantTransfer.text);

  const concurrentTransfers = await Promise.all([
    request(app).post('/api/pro/inventory/transfers').set('Authorization', 'Bearer ' + tokenA)
      .send({ produit_id: productId, entrepot_source_id: sourceWarehouse.id, entrepot_destination_id: destinationId, quantite: 4 }),
    request(app).post('/api/pro/inventory/transfers').set('Authorization', 'Bearer ' + tokenA)
      .send({ produit_id: productId, entrepot_source_id: sourceWarehouse.id, entrepot_destination_id: destinationId, quantite: 4 })
  ]);
  assert.deepEqual(concurrentTransfers.map(response => response.status).sort(), [200, 409],
    'deux transferts concurrents ne doivent jamais retirer plus que le stock disponible');
  balances = await rowsForProduct();
  assert.equal(balances[Number(sourceWarehouse.id)], 3, 'un seul transfert doit débiter quatre unités');
  assert.equal(balances[destinationId], 4, 'le dépôt cible doit recevoir les quatre unités une seule fois');
  assert.equal(Object.values(balances).reduce((sum, qty) => sum + qty, 0), 7,
    'un transfert interne doit conserver le stock total de l’entreprise');

  const [[movementSummary]] = await pool.query(
    `SELECT COUNT(*) AS total, COUNT(DISTINCT reference) AS references_distinctes,
            SUM(CASE WHEN type = 'transfert_sortant' THEN quantite ELSE 0 END) AS sortant,
            SUM(CASE WHEN type = 'transfert_entrant' THEN quantite ELSE 0 END) AS entrant
       FROM pro_mouvements_stock
      WHERE user_id = ? AND produit_id = ? AND type IN ('transfert_sortant', 'transfert_entrant')`,
    [userA, productId]
  );
  assert.equal(Number(movementSummary.total), 2, 'un seul transfert doit créer deux mouvements liés');
  assert.equal(Number(movementSummary.references_distinctes), 1, 'les deux mouvements doivent partager une référence');
  assert.equal(Number(movementSummary.sortant), -4);
  assert.equal(Number(movementSummary.entrant), 4);

  const tooLarge = await request(app).post('/api/pro/inventory/transfers')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ produit_id: productId, entrepot_source_id: sourceWarehouse.id, entrepot_destination_id: destinationId, quantite: 4 });
  assert.equal(tooLarge.status, 409, tooLarge.text);
  const service = await request(app).post('/api/produits')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ nom: 'Prestation non stockable transfert', prix_ht: 1000, type_catalogue: 'service', stock: 0 });
  assert.equal(service.status, 201, service.text);
  const serviceTransfer = await request(app).post('/api/pro/inventory/transfers')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ produit_id: service.body.produit.id, entrepot_source_id: sourceWarehouse.id, entrepot_destination_id: destinationId, quantite: 1 });
  assert.equal(serviceTransfer.status, 409, serviceTransfer.text);

  const productList = await request(app).get('/api/produits').set('Authorization', 'Bearer ' + tokenA);
  const storedProduct = productList.body.produits.find(item => Number(item.id) === productId);
  assert.equal(Number(storedProduct.stock), 7, 'le stock global du produit doit rester égal à la somme des entrepôts');
});
test('associer une ligne d’achat saisie libre à un produit permet sa réception sans réaffecter le stock après coup', async () => {
  const product = await request(app).post('/api/produits')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ nom: 'Produit à associer à une commande', prix_ht: 1000, prix_achat: 400, stock: 0 });
  assert.equal(product.status, 201, product.text);
  const service = await request(app).post('/api/produits')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ nom: 'Service non réceptionnable', prix_ht: 1000, type_catalogue: 'service', stock: 0 });
  assert.equal(service.status, 201, service.text);
  const supplier = await request(app).post('/api/pro/suppliers')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ nom: 'Fournisseur ligne libre' });
  assert.equal(supplier.status, 201, supplier.text);
  const malformedProduct = await request(app).post('/api/pro/purchase-orders')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ fournisseur_id: supplier.body.id, lignes: [{
      produit_id: 'identifiant-invalide', designation: 'Produit mal référencé', quantite: 1, prix_unitaire: 400, tva: 18
    }] });
  assert.equal(malformedProduct.status, 400, malformedProduct.text);

  const order = await request(app).post('/api/pro/purchase-orders')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ fournisseur_id: supplier.body.id, lignes: [{
      designation: 'Article à identifier à la réception', quantite: 1, prix_unitaire: 400, tva: 18
    }] });
  assert.equal(order.status, 201, order.text);
  const details = await request(app).get('/api/pro/purchase-orders/' + order.body.id)
    .set('Authorization', 'Bearer ' + tokenA);
  const lineId = details.body.lignes[0].id;

  const unlinkedReceipt = await request(app).post('/api/pro/purchase-orders/' + order.body.id + '/receive')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ lignes: [{ ligne_id: lineId, quantite: 1 }] });
  assert.equal(unlinkedReceipt.status, 400, unlinkedReceipt.text);
  const foreignLink = await request(app).put('/api/pro/purchase-orders/' + order.body.id + '/lines/' + lineId + '/product')
    .set('Authorization', 'Bearer ' + tokenB).send({ produit_id: product.body.produit.id });
  assert.equal(foreignLink.status, 404, foreignLink.text);
  const serviceLink = await request(app).put('/api/pro/purchase-orders/' + order.body.id + '/lines/' + lineId + '/product')
    .set('Authorization', 'Bearer ' + tokenA).send({ produit_id: service.body.produit.id });
  assert.equal(serviceLink.status, 400, serviceLink.text);

  const linked = await request(app).put('/api/pro/purchase-orders/' + order.body.id + '/lines/' + lineId + '/product')
    .set('Authorization', 'Bearer ' + tokenA).send({ produit_id: product.body.produit.id });
  assert.equal(linked.status, 200, linked.text);
  const receipt = await request(app).post('/api/pro/purchase-orders/' + order.body.id + '/receive')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ operation_id: 'phase57-free-line-receipt-001', lignes: [{ ligne_id: lineId, quantite: 1 }] });
  assert.equal(receipt.status, 201, receipt.text);

  const reassign = await request(app).put('/api/pro/purchase-orders/' + order.body.id + '/lines/' + lineId + '/product')
    .set('Authorization', 'Bearer ' + tokenA).send({ produit_id: product.body.produit.id });
  assert.equal(reassign.status, 409, reassign.text);
  const products = await request(app).get('/api/produits').set('Authorization', 'Bearer ' + tokenA);
  const received = products.body.produits.find(p => Number(p.id) === Number(product.body.produit.id));
  assert.equal(Number(received.stock), 1, 'la réception alimente le produit associé');
});
test('automatisations : créer, lister, désactiver et supprimer les règles autorisées', async () => {
  const rules = [
    { type: 'relance_impayes_email', nom: 'Relance impayés test', configuration: { jours_retard: 10, frequence_jours: 5 } },
    { type: 'relance_devis_email', nom: 'Rappel devis test', configuration: { jours_avant_expiration: 4, frequence_jours: 2 } },
    { type: 'alerte_stock_email', nom: 'Alerte stock test', configuration: { frequence_jours: 1 } }
  ];
  const ids = [];
  for (const rule of rules) {
    const created = await request(app).post('/api/pro/automations')
      .set('Authorization', 'Bearer ' + tokenA).send(rule);
    assert.equal(created.status, 201, created.text);
    ids.push(created.body.id);
  }
  const whatsapp = await request(app).post('/api/pro/automations')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ type: 'relance_impayes_whatsapp', nom: 'WhatsApp test' });
  assert.equal(whatsapp.status, 501, whatsapp.text);

  const listed = await request(app).get('/api/pro/automations').set('Authorization', 'Bearer ' + tokenA);
  assert.equal(listed.status, 200, listed.text);
  assert.ok(listed.body.automatisations.length >= 3);

  const disabled = await request(app).put('/api/pro/automations/' + ids[0])
    .set('Authorization', 'Bearer ' + tokenA).send({ actif: false });
  assert.equal(disabled.status, 200, disabled.text);
  const deleted = await request(app).delete('/api/pro/automations/' + ids[1])
    .set('Authorization', 'Bearer ' + tokenA);
  assert.equal(deleted.status, 200, deleted.text);

  const secondTenant = await request(app).delete('/api/pro/automations/' + ids[2])
    .set('Authorization', 'Bearer ' + tokenB);
  assert.equal(secondTenant.status, 404, secondTenant.text);
});

test('API portail sans jeton ou jeton mal formé : aucun document n’est exposé', async () => {
  const missing = await request(app).get('/api/portal/').set('X-SF-Portal-Token', 'not-a-token');
  assert.equal(missing.status, 404, missing.text);
});

after(async () => {
  try {
    await nettoyerUtilisateur(userA);
    await nettoyerUtilisateur(userB);
  } finally {
    for (const key of smtpVars) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    await teardownTestEnvironment();
  }
});
