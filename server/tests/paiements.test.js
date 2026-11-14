const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

// Ces tests couvrent la logique interne des paiements (idempotence, vérification du
// montant, expiration) sans appeler les vraies API Wave/PayDunya (non joignables en test).
// La vérification de signature/hash est couverte séparément (tests unitaires purs, sans DB).
describe("Paiements d'abonnement", () => {
  let userId, token, paiementId;

  before(async () => {
    await setupTestDatabase();
    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Utilisateur Paiement', email: emailDeTest('pay'), password: 'motdepasse123' , acceptTerms: true});
    userId = inscription.body.user.id;
    token = inscription.body.token;
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  test('les tarifs et les conditions de paiement sont explicites côté serveur', async () => {
    const res = await request(app)
      .get('/api/abonnement/moyens-disponibles')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.tarifs, { starter: 5000, pro: 15000, entreprise: 35000 });
    assert.deepEqual(res.body.facturation, {
      mode: 'paiement_unique',
      renouvellement_automatique: false,
      expiration_automatique: false,
      acces_jusqua_changement_manuel: true,
      activation: 'apres_confirmation'
    });
  });

  test('un plan invalide est refusé avant toute création de session', async () => {
    const res = await request(app)
      .post('/api/abonnement/payer')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'plan-qui-nexiste-pas', fournisseur: 'wave' });
    assert.equal(res.status, 400);
  });

  test('un fournisseur non configuré (pas de clés en .env de test) répond 503, pas une erreur 500 opaque', async () => {
    const res = await request(app)
      .post('/api/abonnement/payer')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'starter', fournisseur: 'wave' });
    // Selon que WAVE_API_KEY est défini dans l'environnement de test ou non, on accepte
    // soit un rejet propre (503) soit un succès — mais jamais un crash serveur (500).
    assert.ok([200, 503].includes(res.status), `statut inattendu : ${res.status}`);
  });

  test("le statut d'un paiement inexistant renvoie 404", async () => {
    const res = await request(app)
      .get('/api/abonnement/statut/reference-inexistante')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 404);
  });

  test("confirmerPaiement est idempotent : deux confirmations simultanées ne créditent qu'une fois", async () => {
    const reference = `test-idem-${Date.now()}`;
    const [insert] = await pool.query(
      `INSERT INTO abonnement_paiements (user_id, plan, montant, devise, fournisseur, reference, internal_reference, statut)
       VALUES (?, 'starter', 5000, 'XOF', 'wave', ?, ?, 'en_attente')`,
      [userId, reference, reference]
    );
    paiementId = insert.insertId;

    const { confirmerPaiementPourTests } = require('../routes/abonnement');
    const [[avant]] = await pool.query('SELECT * FROM abonnement_paiements WHERE id = ?', [paiementId]);

    // Deux appels "concurrents" avec le bon montant : un seul doit réellement passer le
    // statut à "payee" (l'autre est un no-op protégé par `AND statut != 'payee'`).
    await Promise.all([
      confirmerPaiementPourTests(avant, 5000),
      confirmerPaiementPourTests(avant, 5000)
    ]);

    const [[apres]] = await pool.query('SELECT statut FROM abonnement_paiements WHERE id = ?', [paiementId]);
    assert.equal(apres.statut, 'payee');

    const [[utilisateur]] = await pool.query('SELECT plan FROM users WHERE id = ?', [userId]);
    assert.equal(utilisateur.plan, 'starter');
  });

  test('un montant confirmé différent du montant attendu est refusé (pas de crédit)', async () => {
    const reference = `test-montant-${Date.now()}`;
    const [insert] = await pool.query(
      `INSERT INTO abonnement_paiements (user_id, plan, montant, devise, fournisseur, reference, internal_reference, statut)
       VALUES (?, 'pro', 15000, 'XOF', 'paydunya', ?, ?, 'en_attente')`,
      [userId, reference, reference]
    );
    const { confirmerPaiementPourTests } = require('../routes/abonnement');
    const [[paiement]] = await pool.query('SELECT * FROM abonnement_paiements WHERE id = ?', [insert.insertId]);

    await confirmerPaiementPourTests(paiement, 100); // montant falsifié, très inférieur au vrai prix

    const [[apres]] = await pool.query('SELECT statut FROM abonnement_paiements WHERE id = ?', [insert.insertId]);
    assert.equal(apres.statut, 'en_attente', 'le paiement ne doit pas être crédité si le montant ne correspond pas');
  });

  test('un renouvellement du plan déjà actif est confirmé sans faux échec SQL', async () => {
    await pool.query("UPDATE users SET plan = 'pro' WHERE id = ?", [userId]);
    const reference = `test-renouvellement-${Date.now()}`;
    const [insert] = await pool.query(
      `INSERT INTO abonnement_paiements (user_id, plan, montant, devise, fournisseur, reference, internal_reference, statut)
       VALUES (?, 'pro', 15000, 'XOF', 'wave', ?, ?, 'en_attente')`,
      [userId, reference, reference]
    );
    const { confirmerPaiementPourTests } = require('../routes/abonnement');
    const [[paiement]] = await pool.query('SELECT * FROM abonnement_paiements WHERE id = ?', [insert.insertId]);

    assert.equal(await confirmerPaiementPourTests(paiement, 15000), true);
    const [[apres]] = await pool.query('SELECT statut FROM abonnement_paiements WHERE id = ?', [insert.insertId]);
    const [[utilisateur]] = await pool.query('SELECT plan FROM users WHERE id = ?', [userId]);
    assert.equal(apres.statut, 'payee');
    assert.equal(utilisateur.plan, 'pro');
  });

  test('une confirmation sans montant fourni par le prestataire ne peut pas activer un plan', async () => {
    // Le test d'idempotence précédent active Starter sur ce même utilisateur.
    // On repart explicitement du plan Gratuit pour tester l'absence de rétrogradation.
    await pool.query("UPDATE users SET plan = 'gratuit' WHERE id = ?", [userId]);
    const reference = `test-montant-absent-${Date.now()}`;
    const [insert] = await pool.query(
      `INSERT INTO abonnement_paiements (user_id, plan, montant, devise, fournisseur, reference, internal_reference, statut)
       VALUES (?, 'pro', 15000, 'XOF', 'wave', ?, ?, 'en_attente')`,
      [userId, reference, reference]
    );
    const { confirmerPaiementPourTests } = require('../routes/abonnement');
    const [[paiement]] = await pool.query('SELECT * FROM abonnement_paiements WHERE id = ?', [insert.insertId]);

    const confirme = await confirmerPaiementPourTests(paiement, undefined);
    assert.equal(confirme, false);
    const [[apres]] = await pool.query('SELECT statut FROM abonnement_paiements WHERE id = ?', [insert.insertId]);
    const [[utilisateur]] = await pool.query('SELECT plan FROM users WHERE id = ?', [userId]);
    assert.equal(apres.statut, 'en_attente');
    assert.equal(utilisateur.plan, 'gratuit');
  });

  test('un callback fournisseur vérifié en retard peut confirmer une tentative déjà expirée', async () => {
    await pool.query("UPDATE users SET plan = 'gratuit' WHERE id = ?", [userId]);
    const reference = `test-expire-callback-${Date.now()}`;
    const [insert] = await pool.query(
      `INSERT INTO abonnement_paiements (user_id, plan, montant, devise, fournisseur, reference, internal_reference, statut)
       VALUES (?, 'pro', 15000, 'XOF', 'wave', ?, ?, 'expiree')`,
      [userId, reference, reference]
    );
    const { confirmerPaiementPourTests } = require('../routes/abonnement');
    const [[paiement]] = await pool.query('SELECT * FROM abonnement_paiements WHERE id = ?', [insert.insertId]);

    assert.equal(await confirmerPaiementPourTests(paiement, 15000), true);
    const [[apres]] = await pool.query('SELECT statut FROM abonnement_paiements WHERE id = ?', [insert.insertId]);
    const [[utilisateur]] = await pool.query('SELECT plan FROM users WHERE id = ?', [userId]);
    assert.equal(apres.statut, 'payee');
    assert.equal(utilisateur.plan, 'pro');
  });

  test('un paiement en_attente ancien est marqué "expiree" par la tâche planifiée', async () => {
    const reference = `test-expire-${Date.now()}`;
    const [insert] = await pool.query(
      `INSERT INTO abonnement_paiements (user_id, plan, montant, devise, fournisseur, reference, internal_reference, statut, created_at)
       VALUES (?, 'starter', 5000, 'XOF', 'wave', ?, ?, 'en_attente', DATE_SUB(NOW(), INTERVAL 48 HOUR))`,
      [userId, reference, reference]
    );
    const { expirerPaiementsAbonnementEnAttente } = require('../config/scheduler');
    await expirerPaiementsAbonnementEnAttente();

    const [[apres]] = await pool.query('SELECT statut FROM abonnement_paiements WHERE id = ?', [insert.insertId]);
    assert.equal(apres.statut, 'expiree');
  });

  test("un paiement 'payee' n'est jamais rétrogradé par la tâche d'expiration", async () => {
    const reference = `test-payee-ancien-${Date.now()}`;
    const [insert] = await pool.query(
      `INSERT INTO abonnement_paiements (user_id, plan, montant, devise, fournisseur, reference, internal_reference, statut, created_at, paid_at)
       VALUES (?, 'starter', 5000, 'XOF', 'wave', ?, ?, 'payee', DATE_SUB(NOW(), INTERVAL 48 HOUR), NOW())`,
      [userId, reference, reference]
    );
    const { expirerPaiementsAbonnementEnAttente } = require('../config/scheduler');
    await expirerPaiementsAbonnementEnAttente();

    const [[apres]] = await pool.query('SELECT statut FROM abonnement_paiements WHERE id = ?', [insert.insertId]);
    assert.equal(apres.statut, 'payee');
  });
});

describe("Paiements de facture : idempotence HTTP", () => {
  let userId, token, clientId, factureId;

  before(async () => {
    await setupTestDatabase();
    const email = emailDeTest('payfact-idem');
    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Paiement Idempotent', email, password: 'motdepasse123' , acceptTerms: true});
    userId = inscription.body.user.id;
    token = inscription.body.token;
    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client Paiement Idempotent' });
    clientId = client.body.client.id;
    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'devis', lignes: [{ designation: 'Service', quantite: 1, prix_unitaire: 1000, tva: 0 }] });
    // Le endpoint de paiement exige une facture : convertir le devis pour obtenir une vraie facture.
    const converted = await request(app)
      .post(`/api/factures/${facture.body.facture.id}/transformer-en-facture`)
      .set('Authorization', `Bearer ${token}`);
    assert.ok([200, 201].includes(converted.status));
    factureId = converted.body.facture.id;
  });

  after(async () => { await nettoyerUtilisateur(userId); });

  test('deux requêtes concurrentes avec la même Idempotency-Key n enregistrent qu un paiement', async () => {
    const key = `idem-${Date.now()}-payment`;
    const payload = { montant: 1000, methode: 'especes' };
    const [a, b] = await Promise.all([
      request(app).post(`/api/factures/${factureId}/paiements`).set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key).send(payload),
      request(app).post(`/api/factures/${factureId}/paiements`).set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key).send(payload)
    ]);
    assert.ok([200, 201].includes(a.status));
    assert.ok([200, 201].includes(b.status));
    assert.equal(a.body.facture.id, factureId);
    assert.equal(b.body.facture.id, factureId);
    const { pool } = require('../config/db');
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM paiements WHERE user_id = ? AND idempotency_key = ?', [userId, key]);
    assert.equal(Number(n), 1);
    const [[facture]] = await pool.query('SELECT montant_paye FROM factures WHERE id = ? AND user_id = ?', [factureId, userId]);
    assert.equal(Number(facture.montant_paye), 1000);
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
