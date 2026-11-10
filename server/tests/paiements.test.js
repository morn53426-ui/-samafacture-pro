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
      .send({ nom: 'Utilisateur Paiement', email: emailDeTest('pay'), password: 'motdepasse123' });
    userId = inscription.body.user.id;
    token = inscription.body.token;
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
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

  test("un échec de mise à jour du plan annule aussi la confirmation du paiement", async () => {
    const reference = `test-atomic-${Date.now()}`;
    const [insert] = await pool.query(
      `INSERT INTO abonnement_paiements (user_id, plan, montant, devise, fournisseur, reference, internal_reference, statut)
       VALUES (?, 'pro', 15000, 'XOF', 'paydunya', ?, ?, 'en_attente')`,
      [userId, reference, reference]
    );
    const triggerName = 'trg_sf_test_fail_plan_upgrade';
    await pool.query(`
      CREATE TRIGGER ${triggerName}
      BEFORE UPDATE ON users
      FOR EACH ROW
      BEGIN
        IF NEW.id = ${Number(userId)} AND NEW.plan = 'pro' THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced plan update failure';
        END IF;
      END
    `);

    try {
      const { confirmerPaiementPourTests } = require('../routes/abonnement');
      const [[payment]] = await pool.query('SELECT * FROM abonnement_paiements WHERE id = ?', [insert.insertId]);
      await assert.rejects(
        confirmerPaiementPourTests(payment, 15000),
        /forced plan update failure/i
      );

      const [[afterPayment]] = await pool.query(
        'SELECT statut, paid_at FROM abonnement_paiements WHERE id = ?',
        [insert.insertId]
      );
      assert.equal(afterPayment.statut, 'en_attente');
      assert.equal(afterPayment.paid_at, null);

      const [[user]] = await pool.query('SELECT plan FROM users WHERE id = ?', [userId]);
      assert.equal(user.plan, 'starter');
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${triggerName}`);
    }

    // Après correction de la panne, le même webhook peut être rejoué : le paiement
    // passe alors à payee et le plan est activé dans la même transaction.
    const { confirmerPaiementPourTests } = require('../routes/abonnement');
    const [[retryPayment]] = await pool.query(
      'SELECT * FROM abonnement_paiements WHERE id = ?',
      [insert.insertId]
    );
    await confirmerPaiementPourTests(retryPayment, 15000);
    const [[afterRetry]] = await pool.query(
      'SELECT statut FROM abonnement_paiements WHERE id = ?',
      [insert.insertId]
    );
    const [[userAfterRetry]] = await pool.query('SELECT plan FROM users WHERE id = ?', [userId]);
    assert.equal(afterRetry.statut, 'payee');
    assert.equal(userAfterRetry.plan, 'pro');
  });

  test("un ancien webhook payé après un paiement plus récent ne rétrograde pas le plan", async () => {
    const oldReference = `test-old-${Date.now()}`;
    const newReference = `test-new-${Date.now()}`;
    const [oldInsert] = await pool.query(
      `INSERT INTO abonnement_paiements (user_id, plan, montant, devise, fournisseur, reference, internal_reference, statut, created_at)
       VALUES (?, 'starter', 5000, 'XOF', 'wave', ?, ?, 'en_attente', DATE_SUB(NOW(), INTERVAL 1 DAY))`,
      [userId, oldReference, oldReference]
    );
    const [newInsert] = await pool.query(
      `INSERT INTO abonnement_paiements (user_id, plan, montant, devise, fournisseur, reference, internal_reference, statut)
       VALUES (?, 'pro', 15000, 'XOF', 'wave', ?, ?, 'en_attente')`,
      [userId, newReference, newReference]
    );

    const { confirmerPaiementPourTests } = require('../routes/abonnement');
    const [[newer]] = await pool.query('SELECT * FROM abonnement_paiements WHERE id = ?', [newInsert.insertId]);
    const [[older]] = await pool.query('SELECT * FROM abonnement_paiements WHERE id = ?', [oldInsert.insertId]);

    await confirmerPaiementPourTests(newer, 15000);
    await confirmerPaiementPourTests(older, 5000);

    const [[user]] = await pool.query('SELECT plan FROM users WHERE id = ?', [userId]);
    assert.equal(user.plan, 'pro');

    const [[oldAfter]] = await pool.query('SELECT statut FROM abonnement_paiements WHERE id = ?', [oldInsert.insertId]);
    assert.equal(oldAfter.statut, 'payee');
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
  let userId, token, clientId, factureId, devisId, factureAnnuleeId, factureAvecPaiementId;

  before(async () => {
    await setupTestDatabase();
    const email = emailDeTest('payfact-idem');
    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Paiement Idempotent', email, password: 'motdepasse123' });
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

    const devis = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'devis', lignes: [{ designation: 'Devis non encaissable', quantite: 1, prix_unitaire: 2500, tva: 0 }] });
    assert.equal(devis.status, 201, devis.text);
    devisId = devis.body.facture.id;

    const annulee = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Facture annulée', quantite: 1, prix_unitaire: 3000, tva: 0 }] });
    assert.equal(annulee.status, 201, annulee.text);
    factureAnnuleeId = annulee.body.facture.id;

    const cancellation = await request(app)
      .put(`/api/factures/${factureAnnuleeId}/statut`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statut: 'annulee' });
    assert.equal(cancellation.status, 200, cancellation.text);

    const paidDocument = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Facture avec acompte', quantite: 1, prix_unitaire: 2000, tva: 0 }] });
    assert.equal(paidDocument.status, 201, paidDocument.text);
    factureAvecPaiementId = paidDocument.body.facture.id;
  });

  after(async () => { await nettoyerUtilisateur(userId); });

  test('une facture avec un paiement partiel ne peut pas être supprimée ni perdre son historique', async () => {
    const payment = await request(app)
      .post(`/api/factures/${factureAvecPaiementId}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ montant: 500, methode: 'espèces' });
    assert.equal(payment.status, 201, payment.text);

    const deletion = await request(app)
      .delete(`/api/factures/${factureAvecPaiementId}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(deletion.status, 409, deletion.text);

    const [[invoice]] = await pool.query(
      'SELECT montant_paye, statut FROM factures WHERE id = ? AND user_id = ?',
      [factureAvecPaiementId, userId]
    );
    assert.equal(Number(invoice.montant_paye), 500);
    assert.equal(invoice.statut, 'en_attente');

    const [[paymentCount]] = await pool.query(
      'SELECT COUNT(*) AS total FROM paiements WHERE facture_id = ? AND user_id = ?',
      [factureAvecPaiementId, userId]
    );
    assert.equal(Number(paymentCount.total), 1);
  });

  test('un devis et une facture annulée refusent tout nouveau paiement', async () => {
    const quotePayment = await request(app)
      .post(`/api/factures/${devisId}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ montant: 1000, methode: 'espèces' });
    assert.equal(quotePayment.status, 409, quotePayment.text);
    assert.match(quotePayment.body.error, /devis/i);

    const cancelledPayment = await request(app)
      .post(`/api/factures/${factureAnnuleeId}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ montant: 1000, methode: 'espèces' });
    assert.equal(cancelledPayment.status, 409, cancelledPayment.text);
    assert.match(cancelledPayment.body.error, /annulée/i);

    const [[counts]] = await pool.query(
      'SELECT COUNT(*) AS total FROM paiements WHERE user_id = ? AND facture_id IN (?, ?)',
      [userId, devisId, factureAnnuleeId]
    );
    assert.equal(Number(counts.total), 0, 'aucun paiement ne doit être écrit pour le devis ou la facture annulée');
  });

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
