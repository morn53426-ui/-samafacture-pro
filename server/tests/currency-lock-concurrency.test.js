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

const createdUserIds = [];

before(async () => {
  await setupTestDatabase();
});

after(async () => {
  for (const id of createdUserIds) {
    await nettoyerUtilisateur(id);
  }
  await teardownTestEnvironment();
});

async function createCompanyAndClient(prefix) {
  const registration = await request(app)
    .post('/api/auth/register')
    .send({
      nom: 'Compte concurrence devise',
      email: emailDeTest(prefix),
      password: 'motdepasse123',
      acceptTerms: true
    });
  assert.equal(registration.status, 201, registration.text);
  const userId = registration.body.user.id;
  createdUserIds.push(userId);

  const clientResponse = await request(app)
    .post('/api/clients')
    .set('Authorization', 'Bearer ' + registration.body.token)
    .send({ nom: 'Client test concurrence' });
  assert.equal(clientResponse.status, 201, clientResponse.text);

  return {
    userId,
    token: registration.body.token,
    clientId: clientResponse.body.client.id
  };
}

function entrepriseProfile(devise) {
  return {
    entreprise_nom: 'Entreprise test concurrence',
    entreprise_logo: null,
    entreprise_adresse: 'Dakar',
    entreprise_telephone: '',
    entreprise_email: '',
    entreprise_ninea: '',
    entreprise_rccm: null,
    entreprise_site_web: null,
    entreprise_banque: null,
    entreprise_rib: null,
    entreprise_conditions_reglement: null,
    entreprise_mentions_legales: null,
    devise,
    facture_template: 'classique',
    signature_default: null,
    facture_personnalisation: null
  };
}

async function assertCurrencyChangeAndOrderAreSerialized(company, updateRequest) {
  const orderRequest = request(app)
    .post('/api/pro/orders')
    .set('Authorization', 'Bearer ' + company.token)
    .send({
      client_id: company.clientId,
      lignes: [{ designation: 'Prestation test', quantite: 1, prix_unitaire: 2500 }]
    });

  const [updateResponse, orderResponse] = await Promise.all([
    updateRequest,
    orderRequest
  ]);

  assert.equal(orderResponse.status, 201, orderResponse.text);
  assert.ok(
    [200, 409].includes(updateResponse.status),
    'le changement de devise doit réussir avant la commande ou être refusé après sa création: ' + updateResponse.text
  );

  const [[account]] = await pool.query(
    'SELECT devise FROM users WHERE id = ?',
    [company.userId]
  );
  const [[storedOrder]] = await pool.query(
    'SELECT devise FROM pro_commandes WHERE id = ? AND user_id = ?',
    [orderResponse.body.id, company.userId]
  );

  assert.ok(storedOrder, 'la commande concurrente doit être enregistrée');
  assert.equal(
    storedOrder.devise,
    account.devise,
    'la devise de la commande doit toujours correspondre à la devise finale du compte'
  );

  if (updateResponse.status === 200) {
    assert.equal(account.devise, 'EUR');
    assert.equal(orderResponse.body.devise, 'EUR');
  } else {
    assert.equal(account.devise, 'FCFA');
    assert.equal(updateResponse.status, 409);
  }
}

test('le profil entreprise sérialise le changement de devise avec la création de commande', async () => {
  const company = await createCompanyAndClient('currency-race-profile');
  const updateRequest = request(app)
    .put('/api/auth/entreprise')
    .set('Authorization', 'Bearer ' + company.token)
    .send(entrepriseProfile('EUR'));

  await assertCurrencyChangeAndOrderAreSerialized(company, updateRequest);
});

test('la localisation sérialise le changement de devise avec la création de commande', async () => {
  const company = await createCompanyAndClient('currency-race-localization');
  const updateRequest = request(app)
    .put('/api/pro/localization')
    .set('Authorization', 'Bearer ' + company.token)
    .send({
      pays_code: 'SN',
      langue: 'fr',
      devise: 'EUR',
      fuseau_horaire: 'Africa/Dakar',
      format_date: 'dd/MM/yyyy',
      regime_fiscal: 'standard'
    });

  await assertCurrencyChangeAndOrderAreSerialized(company, updateRequest);
});
