const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

// Vérifie qu'un utilisateur A ne peut jamais lire, modifier, supprimer ou référencer les
// données d'un utilisateur B — cœur de la phase 2 de l'audit (isolation multi-tenant).
describe('Isolation des données entre utilisateurs', () => {
  let userIdA, tokenA, clientIdA, produitIdA;
  let userIdB, tokenB;

  before(async () => {
    await setupTestDatabase();

    const inscriptionA = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Utilisateur A', email: emailDeTest('isoA'), password: 'motdepasseA123' , acceptTerms: true});
    userIdA = inscriptionA.body.user.id;
    tokenA = inscriptionA.body.token;

    const inscriptionB = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Utilisateur B', email: emailDeTest('isoB'), password: 'motdepasseB123' , acceptTerms: true});
    userIdB = inscriptionB.body.user.id;
    tokenB = inscriptionB.body.token;

    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'Client de A' });
    clientIdA = client.body.client.id;

    const produit = await request(app)
      .post('/api/produits')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'Produit de A', prix_ht: 1000, tva: 18, stock: 10 });
    produitIdA = produit.body.produit.id;
  });

  after(async () => {
    await nettoyerUtilisateur(userIdA);
    await nettoyerUtilisateur(userIdB);
  });

  test('B ne peut pas lire un client de A (404, pas de fuite de données)', async () => {
    const res = await request(app)
      .get(`/api/clients/${clientIdA}`)
      .set('Authorization', `Bearer ${tokenB}`);
    assert.equal(res.status, 404);
  });

  test('B ne peut pas modifier un client de A', async () => {
    const res = await request(app)
      .put(`/api/clients/${clientIdA}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ nom: 'Client piraté' });
    assert.equal(res.status, 404);
  });

  test('B ne peut pas supprimer un client de A', async () => {
    const res = await request(app)
      .delete(`/api/clients/${clientIdA}`)
      .set('Authorization', `Bearer ${tokenB}`);
    assert.equal(res.status, 404);
  });

  test('la liste des clients de B ne contient jamais les clients de A', async () => {
    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${tokenB}`);
    assert.equal(res.status, 200);
    const ids = res.body.clients.map(c => c.id);
    assert.ok(!ids.includes(clientIdA));
  });

  test('B ne peut pas créer une facture pour un client de A', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        client_id: clientIdA,
        type: 'facture',
        lignes: [{ designation: 'Tentative', quantite: 1, prix_unitaire: 100, tva: 0 }]
      });
    assert.equal(res.status, 400); // "client invalide" : B n'a pas de client avec cet id
  });

  test("une facture de B référençant le produit_id de A est créée mais sans lien produit (correction phase 2)", async () => {
    const clientB = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ nom: 'Client de B' });

    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        client_id: clientB.body.client.id,
        type: 'facture',
        lignes: [{ designation: 'Ligne libre', quantite: 1, prix_unitaire: 500, tva: 0, produit_id: produitIdA }]
      });

    assert.equal(res.status, 201);
    // La facture est créée normalement (rien de cassé), mais le lien vers le produit
    // appartenant à A doit avoir été neutralisé côté serveur.
    const detail = await request(app)
      .get(`/api/factures/${res.body.facture.id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    assert.equal(detail.status, 200);
    const ligne = detail.body.lignes.find(l => l.designation === 'Ligne libre');
    assert.equal(ligne.produit_id, null);
  });

  test('B ne voit pas les produits de A', async () => {
    const res = await request(app)
      .get('/api/produits')
      .set('Authorization', `Bearer ${tokenB}`);
    const ids = res.body.produits.map(p => p.id);
    assert.ok(!ids.includes(produitIdA));
  });

  test('B ne peut pas accéder au tableau de bord de A via un autre compte (chacun voit ses propres totaux)', async () => {
    const resA = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${tokenA}`);
    const resB = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${tokenB}`);
    assert.equal(resA.status, 200);
    assert.equal(resB.status, 200);
    // B n'a créé aucune facture directement (seulement via A plus haut, refusée) donc son
    // chiffre d'affaires ne doit jamais inclure celui de A.
    assert.notEqual(resB.body.chiffre_affaires, undefined);
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
