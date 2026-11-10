const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

describe('Factures : calcul et numérotation', () => {
  let userId;
  let token;
  let clientId;

  before(async () => {
    await setupTestDatabase();

    const email = emailDeTest('factures');
    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Factures', email, password: 'motdepasse123' });
    userId = inscription.body.user.id;
    token = inscription.body.token;
    // Ce scénario crée plus de 10 factures au total : utiliser Pro évite le quota
    // Gratuit de 10 factures/mois et teste bien la logique de calcul/numérotation.
    await require('../config/db').pool.query("UPDATE users SET plan = 'pro' WHERE id = ?", [userId]);

    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client de Test' });
    clientId = client.body.client.id;
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  test('le calcul de la TVA est correct sur une facture simple (sans remise)', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'facture',
        lignes: [{ designation: 'Article A', quantite: 10, prix_unitaire: 1000, tva: 18 }]
      });

    assert.equal(res.status, 201);
    const { facture } = res.body;
    assert.equal(facture.sous_total, 10000);
    assert.equal(facture.total_tva, 1800); // 10000 * 18%
    assert.equal(facture.total, 11800);
  });

  test('la remise réduit la base imposable avant calcul de la TVA (remise + livraison)', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'facture',
        remise: 1000,
        frais_livraison: 500,
        lignes: [{ designation: 'Article B', quantite: 10, prix_unitaire: 1000, tva: 18 }]
      });

    assert.equal(res.status, 201);
    const { facture } = res.body;
    assert.equal(facture.sous_total, 10000);
    // TVA calculée sur (10000 - 1000) = 9000, pas sur les 10000 bruts
    assert.equal(facture.total_tva, 1620);
    assert.equal(facture.total, 11120); // 10000 - 1000 + 1620 + 500
  });

  test('quantités, prix et TVA sont normalisés aux deux décimales MySQL avant calcul', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'facture',
        lignes: [{ designation: 'Ligne arrondie', quantite: 1.3333, prix_unitaire: 10.005, tva: 18.555 }]
      });
    assert.equal(res.status, 201, res.text);

    const detail = await request(app)
      .get(`/api/factures/${res.body.facture.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(detail.status, 200);
    const line = detail.body.lignes[0];
    assert.equal(Number(line.quantite), 1.33);
    assert.equal(Number(line.prix_unitaire), 10.01);
    assert.equal(Number(line.tva), 18.56);
    assert.equal(Number(detail.body.facture.sous_total), 13.31);
    assert.equal(Number(detail.body.facture.total), Number(line.total_ligne));
  });

  test('des frais de livraison négatifs ne sont ni calculés ni enregistrés', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'facture',
        frais_livraison: -5000,
        lignes: [{ designation: 'Livraison invalide', quantite: 1, prix_unitaire: 10000, tva: 0 }]
      });

    assert.equal(res.status, 201, res.text);
    assert.equal(Number(res.body.facture.frais_livraison), 0);
    assert.equal(Number(res.body.facture.total), 10000);
  });

  test('une remise supérieure au sous-total est plafonnée (pas de base imposable négative)', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'facture',
        remise: 99999,
        lignes: [{ designation: 'Article C', quantite: 1, prix_unitaire: 1000, tva: 0 }]
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.facture.total, 0); // remise plafonnée à 1000, donc 1000 - 1000 = 0
  });

  test('une quantité ou un prix négatif envoyé directement à l\'API est ramené à zéro', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'facture',
        lignes: [{ designation: 'Article négatif', quantite: -5, prix_unitaire: -1000, tva: 18 }]
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.facture.sous_total, 0);
    assert.equal(res.body.facture.total, 0);
  });

  test('une facture sans client est refusée', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'facture', lignes: [{ designation: 'X', quantite: 1, prix_unitaire: 100, tva: 0 }] });
    assert.equal(res.status, 400);
  });

  test('une facture sans aucune ligne est refusée', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [] });
    assert.equal(res.status, 400);
  });

  test('un devis conserve son objet, sa référence, sa validité et ses conditions', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'devis',
        date_validite: '2026-12-15',
        objet: 'Installation réseau',
        reference_externe: 'BC-CLIENT-014',
        conditions_reglement: 'Acompte de 40 % à la commande.',
        lignes: [{ designation: 'Installation', quantite: 1, prix_unitaire: 100000, tva: 18 }]
      });

    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.facture.objet, 'Installation réseau');
    assert.equal(res.body.facture.reference_externe, 'BC-CLIENT-014');
    assert.equal(String(res.body.facture.date_validite).slice(0, 10), '2026-12-15');
    assert.equal(res.body.facture.conditions_reglement, 'Acompte de 40 % à la commande.');

    const detail = await request(app)
      .get(`/api/factures/${res.body.facture.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.facture.objet, 'Installation réseau');
    assert.equal(detail.body.facture.reference_externe, 'BC-CLIENT-014');
  });

  test('la conversion d’un devis en facture conserve ses références et supprime la validité du devis', async () => {
    const quote = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'devis',
        date_validite: '2026-12-20',
        objet: 'Déploiement réseau',
        reference_externe: 'BC-CONVERSION-02',
        conditions_reglement: 'Paiement à 15 jours.',
        lignes: [{ designation: 'Installation', quantite: 1, prix_unitaire: 50000, tva: 18 }]
      });
    assert.equal(quote.status, 201, quote.text);

    const converted = await request(app)
      .post(`/api/factures/${quote.body.facture.id}/transformer-en-facture`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(converted.status, 200, converted.text);
    assert.equal(converted.body.facture.type, 'facture');
    assert.equal(converted.body.facture.date_validite, null);
    assert.equal(converted.body.facture.objet, 'Déploiement réseau');
    assert.equal(converted.body.facture.reference_externe, 'BC-CONVERSION-02');
    assert.equal(converted.body.facture.conditions_reglement, 'Paiement à 15 jours.');
  });

  test('la duplication d’un devis copie toutes les références et conditions', async () => {
    const quote = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'devis',
        date_validite: '2026-12-22',
        objet: 'Maintenance annuelle',
        reference_externe: 'BC-DUP-03',
        conditions_reglement: 'Offre valable après validation écrite.',
        lignes: [{ designation: 'Maintenance', quantite: 1, prix_unitaire: 25000, tva: 18 }]
      });
    assert.equal(quote.status, 201, quote.text);

    const duplicate = await request(app)
      .post(`/api/factures/${quote.body.facture.id}/dupliquer`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(duplicate.status, 201, duplicate.text);
    assert.equal(duplicate.body.facture.type, 'devis');
    assert.equal(duplicate.body.facture.date_validite, '2026-12-22');
    assert.equal(duplicate.body.facture.objet, 'Maintenance annuelle');
    assert.equal(duplicate.body.facture.reference_externe, 'BC-DUP-03');
    assert.equal(duplicate.body.facture.conditions_reglement, 'Offre valable après validation écrite.');
  });

  test('une date de validité invalide est refusée pour un devis', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'devis',
        date_validite: '15/12/2026',
        lignes: [{ designation: 'Article', quantite: 1, prix_unitaire: 1000, tva: 0 }]
      });
    assert.equal(res.status, 400);
  });

  test('un objet ou des conditions trop longs sont limités côté serveur', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'devis',
        objet: 'O'.repeat(250),
        reference_externe: 'R'.repeat(150),
        conditions_reglement: 'C'.repeat(6000),
        lignes: [{ designation: 'Article', quantite: 1, prix_unitaire: 1000, tva: 0 }]
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.facture.objet.length, 190);
    assert.equal(res.body.facture.reference_externe.length, 100);
    assert.equal(res.body.facture.conditions_reglement.length, 5000);
  });


  test('les numéros de facture sont attribués de façon séquentielle', async () => {
    const creer = () => request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Séquence', quantite: 1, prix_unitaire: 100, tva: 0 }] });

    const premiere = await creer();
    const deuxieme = await creer();

    const numeroPremiere = parseInt(premiere.body.facture.numero.split('-').pop(), 10);
    const numeroDeuxieme = parseInt(deuxieme.body.facture.numero.split('-').pop(), 10);
    assert.equal(numeroDeuxieme, numeroPremiere + 1);
  });

  test('créer plusieurs factures en même temps ne produit jamais de numéro en double (test de la correction anti-doublon)', async () => {
    const creer = () => request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Concurrence', quantite: 1, prix_unitaire: 100, tva: 0 }] });

    // Envoie 10 créations de facture strictement en parallèle : avant la correction basée sur
    // COUNT(*), plusieurs requêtes simultanées pouvaient recevoir le même numéro.
    const resultats = await Promise.all(Array.from({ length: 10 }, creer));

    resultats.forEach(r => assert.equal(r.status, 201));
    const numeros = resultats.map(r => r.body.facture.numero);
    const numerosUniques = new Set(numeros);
    assert.equal(numerosUniques.size, numeros.length, `numéros en double détectés : ${numeros.join(', ')}`);
  });

  test('une facture ne peut pas être déclarée payée sans encaissement complet enregistré', async () => {
    const created = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Statut payé sécurisé', quantite: 1, prix_unitaire: 1000, tva: 0 }] });
    assert.equal(created.status, 201, created.text);
    const factureId = created.body.facture.id;

    const paidWithoutCollection = await request(app)
      .put(`/api/factures/${factureId}/statut`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statut: 'payee' });
    assert.equal(paidWithoutCollection.status, 409, paidWithoutCollection.text);
    assert.equal(paidWithoutCollection.body.code, 'PAIEMENT_INCOMPLET');

    const partial = await request(app)
      .post(`/api/factures/${factureId}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ montant: 500, methode: 'Espèces' });
    assert.equal(partial.status, 201, partial.text);
    assert.equal(partial.body.facture.statut, 'en_attente');

    const paidWithPartialCollection = await request(app)
      .put(`/api/factures/${factureId}/statut`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statut: 'payee' });
    assert.equal(paidWithPartialCollection.status, 409, paidWithPartialCollection.text);

    const remaining = await request(app)
      .post(`/api/factures/${factureId}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ montant: 500, methode: 'Espèces' });
    assert.equal(remaining.status, 201, remaining.text);
    assert.equal(remaining.body.facture.statut, 'payee');
    assert.equal(Number(remaining.body.facture.montant_paye), 1000);
  });

  test('un paiement négatif ou nul est refusé', async () => {
    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Paiement', quantite: 1, prix_unitaire: 1000, tva: 0 }] });

    const paiementNegatif = await request(app)
      .post(`/api/factures/${facture.body.facture.id}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ montant: -100, methode: 'Espèces' });
    assert.equal(paiementNegatif.status, 400);

    const paiementValide = await request(app)
      .post(`/api/factures/${facture.body.facture.id}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ montant: 1000, methode: 'Espèces' });
    assert.equal(paiementValide.status, 201);
    assert.equal(paiementValide.body.facture.statut, 'payee');
  });

  test('un montant de paiement est arrondi au centime avant insertion et solde', async () => {
    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Arrondi', quantite: 1, prix_unitaire: 100, tva: 0 }] });
    assert.equal(facture.status, 201);

    const tooSmall = await request(app)
      .post(`/api/factures/${facture.body.facture.id}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ montant: 0.004, methode: 'Espèces' });
    assert.equal(tooSmall.status, 400);

    const rounded = await request(app)
      .post(`/api/factures/${facture.body.facture.id}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ montant: 10.005, methode: '  Espèces  ', reference: '  Caisse  ' });
    assert.equal(rounded.status, 201, rounded.text);
    assert.equal(Number(rounded.body.facture.montant_paye), 10.01);

    const detail = await request(app)
      .get(`/api/factures/${facture.body.facture.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(detail.status, 200);
    assert.equal(Number(detail.body.paiements[0].montant), 10.01);
    assert.equal(detail.body.paiements[0].methode, 'Espèces');
  });

  test('plusieurs paiements partiels simultanés sur la même facture ne se perdent jamais (correction de la race condition sur le solde)', async () => {
    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Paiements concurrents', quantite: 1, prix_unitaire: 10000, tva: 0 }] });

    const payer = (montant) => request(app)
      .post(`/api/factures/${facture.body.facture.id}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ montant, methode: 'Espèces' });

    // 5 paiements de 2000 envoyés strictement en parallèle = 10000 au total, montant exact
    // de la facture. Avant la correction (SELECT ... FOR UPDATE), le SELECT initial hors
    // transaction pouvait faire perdre des paiements simultanés dans montant_paye.
    const resultats = await Promise.all(Array.from({ length: 5 }, () => payer(2000)));
    resultats.forEach(r => assert.equal(r.status, 201));

    const detail = await request(app)
      .get(`/api/factures/${facture.body.facture.id}`)
      .set('Authorization', `Bearer ${token}`);

    assert.equal(Number(detail.body.facture.montant_paye), 10000, 'les 5 paiements simultanés doivent tous être comptabilisés');
    assert.equal(detail.body.paiements.length, 5);
    assert.equal(detail.body.facture.statut, 'payee');
  });
});

describe('Factures : idempotence des créations', () => {
  let userId;
  let token;
  let clientId;

  before(async () => {
    await setupTestDatabase();
    const email = emailDeTest('factures-idem');
    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Idempotence', email, password: 'motdepasse123' });
    userId = inscription.body.user.id;
    token = inscription.body.token;
    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client Idempotence' });
    clientId = client.body.client.id;
  });

  after(async () => { await nettoyerUtilisateur(userId); });

  test('une même Idempotency-Key ne crée pas deux devis', async () => {
    const key = `idem-${Date.now()}-devis`;
    const payload = {
      client_id: clientId,
      type: 'devis',
      lignes: [{ designation: 'Article idempotent', quantite: 1, prix_unitaire: 1000, tva: 0 }]
    };
    const [a, b] = await Promise.all([
      request(app).post('/api/factures').set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key).send(payload),
      request(app).post('/api/factures').set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key).send(payload)
    ]);
    assert.ok([200, 201].includes(a.status));
    assert.ok([200, 201].includes(b.status));
    assert.equal(a.body.facture.id, b.body.facture.id);
    const [[{ n }]] = await require('../config/db').pool.query(
      'SELECT COUNT(*) AS n FROM factures WHERE user_id = ? AND idempotency_key = ?', [userId, key]
    );
    assert.equal(Number(n), 1);
  });

  test('une Idempotency-Key trop courte est refusée', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'short')
      .send({ client_id: clientId, type: 'devis', lignes: [{ designation: 'X', quantite: 1, prix_unitaire: 100, tva: 0 }] });
    assert.equal(res.status, 400);
  });
});


describe('Factures : quota du plan Gratuit', () => {
  let userId;
  let token;
  let clientId;

  before(async () => {
    await setupTestDatabase();
    const email = emailDeTest('quota-factures');
    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Compte quota', email, password: 'motdepasse123' });
    userId = inscription.body.user.id;
    token = inscription.body.token;
    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client quota' });
    clientId = client.body.client.id;
  });

  after(async () => { await nettoyerUtilisateur(userId); });

  test("une ancienne date d'émission ne contourne pas le quota et les créations concurrentes sont sérialisées", async () => {
    const { FREE_MONTHLY_INVOICE_LIMIT } = require('../utils/plans');
    const creer = () => request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'facture',
        date_emission: '2000-01-01',
        lignes: [{ designation: 'Facture quota', quantite: 1, prix_unitaire: 100, tva: 0 }]
      });

    for (let i = 0; i < FREE_MONTHLY_INVOICE_LIMIT - 1; i++) {
      const result = await creer();
      assert.equal(result.status, 201, result.text);
    }

    const concurrent = await Promise.all(Array.from({ length: 4 }, creer));
    assert.equal(concurrent.filter(r => r.status === 201).length, 1);
    assert.equal(concurrent.filter(r => r.status === 403 && r.body.code === 'QUOTA_DEPASSE').length, 3);

    const [[row]] = await require('../config/db').pool.query(
      "SELECT COUNT(*) AS n FROM factures WHERE user_id = ? AND type = 'facture' AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')",
      [userId]
    );
    assert.equal(Number(row.n), FREE_MONTHLY_INVOICE_LIMIT);
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
