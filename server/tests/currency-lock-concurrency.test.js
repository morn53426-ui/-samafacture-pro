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

function observeAccountLockAttempts() {
  const originalGetConnection = pool.getConnection;
  const waiters = [];
  let active = true;

  pool.getConnection = async (...args) => {
    const conn = await originalGetConnection.apply(pool, args);
    const originalQuery = conn.query.bind(conn);
    conn.query = (sql, ...queryArgs) => {
      const isAccountLock = typeof sql === 'string' &&
        /\bFROM\s+users\s+WHERE\s+id\s*=\s*\?\s+FOR\s+UPDATE\b/i.test(sql);
      const result = originalQuery(sql, ...queryArgs);
      if (active && isAccountLock) {
        const waiter = waiters.shift();
        if (waiter) {
          clearTimeout(waiter.timer);
          waiter.resolve();
        }
      }
      return result;
    };
    return conn;
  };

  return {
    waitForNextAccountLock(timeoutMs = 5000) {
      return new Promise((resolve, reject) => {
        const waiter = {
          resolve,
          timer: setTimeout(() => {
            const index = waiters.indexOf(waiter);
            if (index !== -1) waiters.splice(index, 1);
            reject(new Error('La requête n’a pas tenté de verrouiller la ligne users dans le délai imparti.'));
          }, timeoutMs)
        };
        waiters.push(waiter);
      });
    },
    restore() {
      active = false;
      pool.getConnection = originalGetConnection;
      for (const waiter of waiters.splice(0)) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error('Observation des verrous interrompue avant le signal attendu.'));
      }
    }
  };
}

async function runCreationBeforeCurrencyChange(company, createRequest, updateRequest) {
  const lock = await pool.getConnection();
  let lockHeld = false;
  let createSettled = false;
  let updateSettled = false;
  let createPromise;
  let updatePromise;
  let lockObserver;
  try {
    await lock.beginTransaction();
    await lock.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [company.userId]);
    lockHeld = true;

    lockObserver = observeAccountLockAttempts();

    // La création est démarrée avant le changement. On attend la tentative SQL
    // réelle sur users ... FOR UPDATE plutôt qu'une temporisation arbitraire.
    const createLockAttempt = lockObserver.waitForNextAccountLock();
    createPromise = createRequest.then(
      response => { createSettled = true; return { response }; },
      error => { createSettled = true; return { error }; }
    );
    await createLockAttempt;
    assert.equal(createSettled, false,
      'la création doit rester en attente tant que la transaction détient le verrou du compte');

    // Le changement de devise doit tenter d'acquérir le même verrou après la création.
    const updateLockAttempt = lockObserver.waitForNextAccountLock();
    updatePromise = updateRequest.then(
      response => { updateSettled = true; return { response }; },
      error => { updateSettled = true; return { error }; }
    );
    await updateLockAttempt;
    assert.equal(updateSettled, false,
      'le changement de devise doit attendre le verrou détenu par la transaction de test');

    await lock.commit();
    lockHeld = false;
    const [createResult, updateResult] = await Promise.all([createPromise, updatePromise]);
    if (createResult.error) throw createResult.error;
    if (updateResult.error) throw updateResult.error;

    const createResponse = createResult.response;
    const updateResponse = updateResult.response;
    assert.equal(createResponse.status, 201, createResponse.text);
    assert.ok(
      [200, 409].includes(updateResponse.status),
      'le réglage doit réussir avant la création ou être refusé après sa création: ' + updateResponse.text
    );

    const [[account]] = await pool.query('SELECT devise FROM users WHERE id = ?', [company.userId]);
    assert.equal(account.devise, updateResponse.status === 200 ? 'EUR' : 'FCFA',
      'la devise effective doit refléter le résultat du contrôle historique');

    return { createResponse, updateResponse };
  } finally {
    // La connexion test est libérée avant de rétablir le pool; si un test échoue,
    // les requêtes déjà démarrées peuvent alors terminer sans garder le verrou.
    if (lockHeld) await lock.rollback().catch(() => {});
    if (lockObserver) lockObserver.restore();
    lock.release();
    await Promise.allSettled([createPromise, updatePromise].filter(Boolean));
  }
}

async function assertCurrencyChangeAndOrderAreSerialized(company, updateRequest) {
  const orderRequest = request(app)
    .post('/api/pro/orders')
    .set('Authorization', 'Bearer ' + company.token)
    .send({
      client_id: company.clientId,
      lignes: [{ designation: 'Prestation test', quantite: 1, prix_unitaire: 2500 }]
    });

  const { createResponse: orderResponse } =
    await runCreationBeforeCurrencyChange(company, orderRequest, updateRequest);

  const [[storedOrder]] = await pool.query(
    'SELECT devise FROM pro_commandes WHERE id = ? AND user_id = ?',
    [orderResponse.body.id, company.userId]
  );
  assert.ok(storedOrder, 'la commande doit être conservée');
  assert.equal(storedOrder.devise, 'FCFA',
    'la commande doit enregistrer la devise qui reste active sur le compte');
}

async function assertHistoryCreationRace(company, updateRequest, createRequest, tableName, idField) {
  const { createResponse } =
    await runCreationBeforeCurrencyChange(company, createRequest, updateRequest);

  const recordId = idField.split('.').reduce((value, key) => value && value[key], createResponse.body);
  assert.ok(recordId, 'la réponse doit contenir l’identifiant du nouvel enregistrement');
  const [[stored]] = await pool.query(
    'SELECT id FROM ' + tableName + ' WHERE id = ? AND user_id = ?',
    [recordId, company.userId]
  );
  assert.ok(stored, 'le nouvel enregistrement doit rester présent après la course concurrente');
}

async function runCurrencyChangeBeforeCreation(company, updateRequest, createRequest, getStoredDocument) {
  const lock = await pool.getConnection();
  let lockHeld = false;
  let updateSettled = false;
  let createSettled = false;
  let updatePromise;
  let createPromise;
  let lockObserver;
  try {
    await lock.beginTransaction();
    await lock.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [company.userId]);
    lockHeld = true;
    lockObserver = observeAccountLockAttempts();

    // Le changement est lancé en premier. Attendre sa véritable tentative de verrou
    // garantit l'ordre sans dépendre de la vitesse du runner CI.
    const updateLockAttempt = lockObserver.waitForNextAccountLock();
    updatePromise = updateRequest.then(
      response => { updateSettled = true; return { response }; },
      error => { updateSettled = true; return { error }; }
    );
    await updateLockAttempt;
    assert.equal(updateSettled, false,
      'le changement de devise doit rester bloqué tant que le compte est verrouillé');

    // La création ne démarre qu'après que le changement a demandé le même verrou.
    const createLockAttempt = lockObserver.waitForNextAccountLock();
    createPromise = createRequest.then(
      response => { createSettled = true; return { response }; },
      error => { createSettled = true; return { error }; }
    );
    await createLockAttempt;
    assert.equal(createSettled, false,
      'la création doit attendre le changement de devise qui détient le verrou du compte');

    await lock.commit();
    lockHeld = false;
    const [updateResult, createResult] = await Promise.all([updatePromise, createPromise]);
    if (updateResult.error) throw updateResult.error;
    if (createResult.error) throw createResult.error;

    assert.equal(updateResult.response.status, 200, updateResult.response.text);
    assert.equal(createResult.response.status, 201, createResult.response.text);
    const [[account]] = await pool.query('SELECT devise FROM users WHERE id = ?', [company.userId]);
    assert.equal(account.devise, 'EUR');
    const stored = await getStoredDocument(createResult.response, company);
    assert.equal(stored.devise, 'EUR',
      'le document créé après le changement doit reprendre la devise verrouillée du compte');
    return createResult.response;
  } finally {
    if (lockHeld) await lock.rollback().catch(() => {});
    if (lockObserver) lockObserver.restore();
    lock.release();
    await Promise.allSettled([updatePromise, createPromise].filter(Boolean));
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


test('le changement de devise est sérialisé avec la création d’un achat fournisseur', async () => {
  const company = await createCompanyAndClient('currency-race-purchase');
  const supplier = await request(app)
    .post('/api/pro/suppliers')
    .set('Authorization', 'Bearer ' + company.token)
    .send({ nom: 'Fournisseur concurrent' });
  assert.equal(supplier.status, 201, supplier.text);

  const updateRequest = request(app)
    .put('/api/auth/entreprise')
    .set('Authorization', 'Bearer ' + company.token)
    .send(entrepriseProfile('EUR'));
  const createRequest = request(app)
    .post('/api/pro/purchase-orders')
    .set('Authorization', 'Bearer ' + company.token)
    .send({
      fournisseur_id: supplier.body.id,
      lignes: [{ designation: 'Matière première test', quantite: 1, prix_unitaire: 1000, tva: 0 }]
    });
  await assertHistoryCreationRace(company, updateRequest, createRequest, 'pro_commandes_fournisseurs', 'id');
});

test('un devis manuel lit la devise après le verrou du compte', async () => {
  const company = await createCompanyAndClient('currency-change-before-quote');
  const updateRequest = request(app)
    .put('/api/auth/entreprise')
    .set('Authorization', 'Bearer ' + company.token)
    .send(entrepriseProfile('EUR'));
  const createRequest = request(app)
    .post('/api/factures')
    .set('Authorization', 'Bearer ' + company.token)
    .send({
      client_id: company.clientId,
      type: 'devis',
      lignes: [{ designation: 'Devis en EUR', quantite: 1, prix_unitaire: 3500, tva: 0 }]
    });
  await runCurrencyChangeBeforeCreation(company, updateRequest, createRequest, async (response) => {
    const [[stored]] = await pool.query('SELECT devise FROM factures WHERE id = ? AND user_id = ?', [response.body.facture.id, company.userId]);
    return stored;
  });
});

test('une facture manuelle lit la devise après le verrou du compte et le quota', async () => {
  const company = await createCompanyAndClient('currency-change-before-invoice');
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
  const createRequest = request(app)
    .post('/api/factures')
    .set('Authorization', 'Bearer ' + company.token)
    .send({
      client_id: company.clientId,
      type: 'facture',
      lignes: [{ designation: 'Facture en EUR', quantite: 1, prix_unitaire: 4500, tva: 0 }]
    });
  await runCurrencyChangeBeforeCreation(company, updateRequest, createRequest, async (response) => {
    const [[stored]] = await pool.query('SELECT devise FROM factures WHERE id = ? AND user_id = ?', [response.body.facture.id, company.userId]);
    return stored;
  });
});

test('une facture créée par API lit la devise après le verrou du compte', async () => {
  const company = await createCompanyAndClient('currency-change-before-api-invoice');
  const key = await request(app)
    .post('/api/pro/integrations/api-keys')
    .set('Authorization', 'Bearer ' + company.token)
    .send({ nom: 'Clé API test concurrence', scopes: ['invoices:write'] });
  assert.equal(key.status, 201, key.text);

  const updateRequest = request(app)
    .put('/api/auth/entreprise')
    .set('Authorization', 'Bearer ' + company.token)
    .send(entrepriseProfile('EUR'));
  const createRequest = request(app)
    .post('/api/v1/invoices')
    .set('X-SamaFacture-Key', key.body.token)
    .send({
      client_id: company.clientId,
      lignes: [{ designation: 'Facture API en EUR', quantite: 1, prix_unitaire: 5500, tva: 0 }]
    });
  await runCurrencyChangeBeforeCreation(company, updateRequest, createRequest, async (response) => {
    const [[stored]] = await pool.query('SELECT devise FROM factures WHERE id = ? AND user_id = ?', [response.body.facture.id, company.userId]);
    return stored;
  });
});
