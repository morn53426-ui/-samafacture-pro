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

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
