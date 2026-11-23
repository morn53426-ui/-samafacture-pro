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

async function assertHistoryCreationRace(company, updateRequest, createRequest, tableName, idField) {
  const [updateResponse, createResponse] = await Promise.all([
    updateRequest,
    createRequest
  ]);

  assert.equal(createResponse.status, 201, createResponse.text);
  assert.ok(
    [200, 409].includes(updateResponse.status),
    'le réglage doit passer avant la création ou être refusé après sa création: ' + updateResponse.text
  );

  const [[account]] = await pool.query('SELECT devise FROM users WHERE id = ?', [company.userId]);
  if (updateResponse.status === 200) assert.equal(account.devise, 'EUR');
  else assert.equal(account.devise, 'FCFA');

  const recordId = idField.split('.').reduce((value, key) => value && value[key], createResponse.body);
  assert.ok(recordId, 'la réponse doit contenir l’identifiant du nouvel enregistrement');
  const [[stored]] = await pool.query(
    'SELECT id FROM ' + tableName + ' WHERE id = ? AND user_id = ?',
    [recordId, company.userId]
  );
  assert.ok(stored, 'le nouvel enregistrement doit rester présent après la course concurrente');
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

test('le changement de devise est sérialisé avec la création d’un produit', async () => {
  const company = await createCompanyAndClient('currency-race-product');
  const updateRequest = request(app)
    .put('/api/auth/entreprise')
    .set('Authorization', 'Bearer ' + company.token)
    .send(entrepriseProfile('EUR'));
  const createRequest = request(app)
    .post('/api/produits')
    .set('Authorization', 'Bearer ' + company.token)
    .send({ nom: 'Service concurrent', type_catalogue: 'service', prix_ht: 1500 });
  await assertHistoryCreationRace(company, updateRequest, createRequest, 'produits', 'produit.id');
});

test('le changement de devise est sérialisé avec la création d’une dépense', async () => {
  const company = await createCompanyAndClient('currency-race-expense');
  const updateRequest = request(app)
    .put('/api/auth/entreprise')
    .set('Authorization', 'Bearer ' + company.token)
    .send(entrepriseProfile('EUR'));
  const createRequest = request(app)
    .post('/api/depenses')
    .set('Authorization', 'Bearer ' + company.token)
    .send({ libelle: 'Dépense concurrente', montant: 1250, mode_reglement: 'caisse' });
  await assertHistoryCreationRace(company, updateRequest, createRequest, 'depenses', 'depense.id');
});

test('le changement de devise est sérialisé avec la création d’un modèle récurrent', async () => {
  const company = await createCompanyAndClient('currency-race-recurring');
  const updateRequest = request(app)
    .put('/api/auth/entreprise')
    .set('Authorization', 'Bearer ' + company.token)
    .send(entrepriseProfile('EUR'));
  const createRequest = request(app)
    .post('/api/factures-recurrentes')
    .set('Authorization', 'Bearer ' + company.token)
    .send({
      client_id: company.clientId,
      libelle: 'Entretien mensuel',
      frequence: 'mensuelle',
      prochaine_date: '2026-12-01',
      lignes: [{ designation: 'Entretien', quantite: 1, prix_unitaire: 3000, tva: 0 }]
    });
  await assertHistoryCreationRace(company, updateRequest, createRequest, 'factures_recurrentes', 'recurrente.id');
});

test('le changement de devise est sérialisé avec une écriture comptable manuelle', async () => {
  const company = await createCompanyAndClient('currency-race-accounting');
  const config = await request(app)
    .get('/api/pro/accounting/config')
    .set('Authorization', 'Bearer ' + company.token);
  assert.equal(config.status, 200, config.text);
  const debitAccount = config.body.comptes.find(account => account.code === '411');
  const creditAccount = config.body.comptes.find(account => account.code === '571');
  assert.ok(debitAccount && creditAccount, 'les comptes de démarrage 411 et 571 doivent être disponibles');
  assert.ok(config.body.journaux.length > 0, 'un journal de comptabilité doit être disponible');

  const updateRequest = request(app)
    .put('/api/auth/entreprise')
    .set('Authorization', 'Bearer ' + company.token)
    .send(entrepriseProfile('EUR'));
  const createRequest = request(app)
    .post('/api/pro/accounting/entries')
    .set('Authorization', 'Bearer ' + company.token)
    .send({
      journal_id: config.body.journaux[0].id,
      date_ecriture: '2026-11-23',
      libelle: 'Écriture concurrente de test',
      lignes: [
        { compte_id: debitAccount.id, libelle: 'Débit test', debit: 2500, credit: 0 },
        { compte_id: creditAccount.id, libelle: 'Crédit test', debit: 0, credit: 2500 }
      ]
    });
  await assertHistoryCreationRace(company, updateRequest, createRequest, 'pro_compta_ecritures', 'id');
});
