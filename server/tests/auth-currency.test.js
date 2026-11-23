const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment
} = require('./setup');

let userId;
let token;
let clientId;

const profile = (devise) => ({
  entreprise_nom: 'Entreprise test devise',
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
});

before(async () => {
  await setupTestDatabase();
  const registration = await request(app)
    .post('/api/auth/register')
    .send({
      nom: 'Compte réglage devise',
      email: emailDeTest('auth-currency'),
      password: 'motdepasse123',
      acceptTerms: true
    });
  assert.equal(registration.status, 201, registration.text);
  userId = registration.body.user.id;
  token = registration.body.token;
});

test("l'ancienne route entreprise ne peut pas contourner la protection de devise", async () => {
  const firstCurrency = await request(app)
    .put('/api/auth/entreprise')
    .set('Authorization', 'Bearer ' + token)
    .send(profile('EUR'));
  assert.equal(firstCurrency.status, 200, firstCurrency.text);
  assert.equal(firstCurrency.body.user.devise, 'EUR');

  const client = await request(app)
    .post('/api/clients')
    .set('Authorization', 'Bearer ' + token)
    .send({ nom: 'Client avec historique' });
  assert.equal(client.status, 201, client.text);
  clientId = client.body.client.id;

  const orderPayload = {
    client_id: clientId,
    lignes: [{ designation: 'Prestation test', quantite: 1, prix_unitaire: 2500 }]
  };
  const invalidOrderCurrency = await request(app)
    .post('/api/pro/orders')
    .set('Authorization', 'Bearer ' + token)
    .send({ ...orderPayload, devise: 'ZZZ' });
  assert.equal(invalidOrderCurrency.status, 400, invalidOrderCurrency.text);

  const order = await request(app)
    .post('/api/pro/orders')
    .set('Authorization', 'Bearer ' + token)
    .send(orderPayload);
  assert.equal(order.status, 201, order.text);
  const [[storedOrder]] = await pool.query(
    'SELECT devise FROM pro_commandes WHERE id = ? AND user_id = ?',
    [order.body.id, userId]
  );
  assert.equal(storedOrder.devise, 'EUR', 'une commande sans devise explicite utilise la devise de l’entreprise');

  const changeAfterOrder = await request(app)
    .put('/api/auth/entreprise')
    .set('Authorization', 'Bearer ' + token)
    .send(profile('USD'));
  assert.equal(changeAfterOrder.status, 409, changeAfterOrder.text,
    'la présence d’une commande commerciale doit verrouiller la devise de base');

  await pool.query(
    "INSERT INTO factures (user_id, client_id, numero, type, date_emission, statut, remise, frais_livraison, sous_total, total_tva, total, montant_paye, devise) VALUES (?, ?, ?, 'facture', '2026-11-16', 'en_attente', 0, 0, 5000, 0, 5000, 0, 'EUR')",
    [userId, clientId, 'CURRENCY-LOCK-' + Date.now()]
  );

  const omittedCurrency = await request(app)
    .put('/api/auth/entreprise')
    .set('Authorization', 'Bearer ' + token)
    .send(profile(undefined));
  assert.equal(omittedCurrency.status, 200, omittedCurrency.text);
  assert.equal(omittedCurrency.body.user.devise, 'EUR', 'une devise omise ne doit pas réinitialiser le compte en FCFA');

  const localizationOmitted = await request(app)
    .put('/api/pro/localization')
    .set('Authorization', 'Bearer ' + token)
    .send({
      pays_code: 'SN',
      langue: 'fr',
      fuseau_horaire: 'Africa/Dakar',
      format_date: 'dd/MM/yyyy',
      regime_fiscal: 'standard'
    });
  assert.equal(localizationOmitted.status, 200, localizationOmitted.text);
  assert.equal(localizationOmitted.body.parametres.devise, 'EUR',
    'la route internationale doit également préserver la devise omise');

  const localizationChange = await request(app)
    .put('/api/pro/localization')
    .set('Authorization', 'Bearer ' + token)
    .send({ pays_code: 'SN', langue: 'fr', devise: 'USD', fuseau_horaire: 'Africa/Dakar', format_date: 'dd/MM/yyyy', regime_fiscal: 'standard' });
  assert.equal(localizationChange.status, 409, localizationChange.text);

  const changeCurrency = await request(app)
    .put('/api/auth/entreprise')
    .set('Authorization', 'Bearer ' + token)
    .send(profile('USD'));
  assert.equal(changeCurrency.status, 409, changeCurrency.text);

  const [[stored]] = await pool.query('SELECT devise FROM users WHERE id = ?', [userId]);
  assert.equal(stored.devise, 'EUR');
});

after(async () => {
  await nettoyerUtilisateur(userId);
  await teardownTestEnvironment();
});
