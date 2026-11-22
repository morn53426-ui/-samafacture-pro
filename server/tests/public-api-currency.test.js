const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment
} = require('./setup');
const { localDateString } = require('../utils/local-date');

let userId;
let apiKey;
let clientId;

before(async () => {
  await setupTestDatabase();
  const registration = await request(app)
    .post('/api/auth/register')
    .send({
      nom: 'Compte API devise',
      email: emailDeTest('api-currency'),
      password: 'motdepasse123',
      acceptTerms: true
    });
  assert.equal(registration.status, 201, registration.text);
  userId = registration.body.user.id;
  await pool.query(
    "UPDATE users SET devise = 'EUR', fuseau_horaire = 'Europe/Paris' WHERE id = ?",
    [userId]
  );

  const client = await request(app)
    .post('/api/clients')
    .set('Authorization', 'Bearer ' + registration.body.token)
    .send({ nom: 'Client API EUR' });
  assert.equal(client.status, 201, client.text);
  clientId = client.body.client.id;

  const key = await request(app)
    .post('/api/pro/integrations/api-keys')
    .set('Authorization', 'Bearer ' + registration.body.token)
    .send({ nom: 'Clé API devise', scopes: ['invoices:write', 'invoices:read', 'clients:read'] });
  assert.equal(key.status, 201, key.text);
  apiKey = key.body.token;
});

test('la création par API utilise la devise de l’entreprise et sa date locale', async () => {
  const invalidDate = await request(app)
    .post('/api/v1/invoices')
    .set('X-SamaFacture-Key', apiKey)
    .send({
      client_id: clientId,
      date_echeance: '2026-02-30',
      lignes: [{ designation: 'Prestation', quantite: 1, prix_unitaire: 100, tva: 0 }]
    });
  assert.equal(invalidDate.status, 400, invalidDate.text);

  const created = await request(app)
    .post('/api/v1/invoices')
    .set('X-SamaFacture-Key', apiKey)
    .send({
      client_id: clientId,
      lignes: [{ designation: 'Prestation', quantite: 1, prix_unitaire: 100, tva: 0 }]
    });
  assert.equal(created.status, 201, created.text);
  assert.equal(created.body.facture.devise, 'EUR');

  const [[stored]] = await pool.query(
    'SELECT devise, date_emission FROM factures WHERE id = ? AND user_id = ?',
    [created.body.facture.id, userId]
  );
  assert.equal(stored.devise, 'EUR');
  assert.equal(String(stored.date_emission).slice(0, 10), localDateString('Europe/Paris'));

  const list = await request(app)
    .get('/api/v1/invoices')
    .set('X-SamaFacture-Key', apiKey);
  assert.equal(list.status, 200, list.text);
  assert.equal(list.body.data.find(invoice => Number(invoice.id) === Number(created.body.facture.id))?.devise, 'EUR');

  // Une valeur JSON valide mais de forme incorrecte doit être refusée de façon sûre.
  const crypto = require('node:crypto');
  const tokenHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  await pool.query("UPDATE pro_api_keys SET scopes_json = '{}' WHERE token_hash = ?", [tokenHash]);
  const malformedScopes = await request(app)
    .get('/api/v1/clients')
    .set('X-SamaFacture-Key', apiKey);
  assert.equal(malformedScopes.status, 401);
});

after(async () => {
  await nettoyerUtilisateur(userId);
  await teardownTestEnvironment();
});
