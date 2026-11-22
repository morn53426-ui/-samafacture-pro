const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment
} = require('./setup');
const { FREE_MONTHLY_INVOICE_LIMIT } = require('../utils/plans');

let userId;
let token;
let clientId;
let apiKey;
let invoiceIds = [];
let quoteId;
let recurringId;

const invoicePayload = (type = 'facture') => ({
  client_id: clientId,
  type,
  lignes: [{ designation: 'Facture de récupération quota', quantite: 1, prix_unitaire: 100, tva: 0 }]
});

async function supprimerRegistreMensuel() {
  await pool.query(
    "DELETE FROM facture_usage_mensuelle WHERE user_id = ? AND periode = DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')",
    [userId]
  );
}

async function assertRefusalPersistsRecoveredUsage(label, operation) {
  await supprimerRegistreMensuel();

  const response = await operation();
  assert.equal(response.status, 403, `${label}: ${response.text}`);
  assert.equal(response.body.code, 'QUOTA_DEPASSE', label);

  const [[usage]] = await pool.query(
    "SELECT nombre_factures FROM facture_usage_mensuelle WHERE user_id = ? AND periode = DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')",
    [userId]
  );
  assert.ok(usage, `${label}: le registre reconstitué doit être validé même si la facture est refusée.`);
  assert.equal(Number(usage.nombre_factures), FREE_MONTHLY_INVOICE_LIMIT, label);
}

before(async () => {
  await setupTestDatabase();

  const registration = await request(app)
    .post('/api/auth/register')
    .send({
      nom: 'Compte récupération registre quota',
      email: emailDeTest('quota-registry-recovery'),
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
    .send({ nom: 'Client récupération registre quota' });
  assert.equal(client.status, 201, client.text);
  clientId = client.body.client.id;

  // Préparer un historique déjà à la limite pendant que le compte est sur Pro.
  for (let i = 0; i < FREE_MONTHLY_INVOICE_LIMIT; i++) {
    const created = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send(invoicePayload());
    assert.equal(created.status, 201, created.text);
    invoiceIds.push(created.body.facture.id);
  }

  const quote = await request(app)
    .post('/api/factures')
    .set('Authorization', `Bearer ${token}`)
    .send(invoicePayload('devis'));
  assert.equal(quote.status, 201, quote.text);
  quoteId = quote.body.facture.id;

  const recurring = await request(app)
    .post('/api/factures-recurrentes')
    .set('Authorization', `Bearer ${token}`)
    .send({
      client_id: clientId,
      libelle: 'Récurrence de test quota',
      frequence: 'mensuelle',
      prochaine_date: '2026-11-10',
      lignes: [{ designation: 'Maintenance', quantite: 1, prix_unitaire: 100, tva: 0 }]
    });
  assert.equal(recurring.status, 201, recurring.text);
  recurringId = recurring.body.recurrente.id;

  const key = await request(app)
    .post('/api/pro/integrations/api-keys')
    .set('Authorization', `Bearer ${token}`)
    .send({ nom: 'Clé test récupération quota', scopes: ['invoices:write'] });
  assert.equal(key.status, 201, key.text);
  apiKey = key.body.token;

  // Simuler un ancien compte : ses factures existent, mais sa ligne de registre a disparu.
  await supprimerRegistreMensuel();
  await pool.query("UPDATE users SET plan = 'gratuit' WHERE id = ?", [userId]);
});

test('création manuelle : le compteur historique est conservé après refus', async () => {
  await assertRefusalPersistsRecoveredUsage('Création manuelle', () =>
    request(app).post('/api/factures').set('Authorization', `Bearer ${token}`).send(invoicePayload())
  );
});

test('API publique : le compteur historique est conservé après refus', async () => {
  await assertRefusalPersistsRecoveredUsage('API publique', () =>
    request(app).post('/api/v1/invoices').set('X-SamaFacture-Key', apiKey).send(invoicePayload())
  );
});

test('facture récurrente : le compteur historique est conservé après refus', async () => {
  await assertRefusalPersistsRecoveredUsage('Facture récurrente', () =>
    request(app).post(`/api/factures-recurrentes/${recurringId}/generer`).set('Authorization', `Bearer ${token}`)
  );
});

test('duplication : le compteur historique est conservé après refus', async () => {
  await assertRefusalPersistsRecoveredUsage('Duplication', () =>
    request(app).post(`/api/factures/${invoiceIds[0]}/dupliquer`).set('Authorization', `Bearer ${token}`)
  );
});

test('conversion devis : le compteur historique est conservé après refus', async () => {
  await assertRefusalPersistsRecoveredUsage('Conversion devis', () =>
    request(app).post(`/api/factures/${quoteId}/transformer-en-facture`).set('Authorization', `Bearer ${token}`)
  );
});


test('supprimer une ancienne facture après un refus ne libère pas de quota', async () => {
  const deleted = await request(app)
    .delete(`/api/factures/${invoiceIds[0]}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(deleted.status, 409, deleted.text);
  assert.equal(deleted.body.code, 'DOCUMENT_HISTORIQUE_PROTEGE');

  const blocked = await request(app)
    .post('/api/factures')
    .set('Authorization', `Bearer ${token}`)
    .send(invoicePayload());
  assert.equal(blocked.status, 403, blocked.text);
  assert.equal(blocked.body.code, 'QUOTA_DEPASSE');

  const [[usage]] = await pool.query(
    "SELECT nombre_factures FROM facture_usage_mensuelle WHERE user_id = ? AND periode = DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')",
    [userId]
  );
  assert.equal(Number(usage.nombre_factures), FREE_MONTHLY_INVOICE_LIMIT);
});

after(async () => {
  await nettoyerUtilisateur(userId);
});
after(teardownTestEnvironment);
