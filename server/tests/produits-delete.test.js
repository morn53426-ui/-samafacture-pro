const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

// DELETE /api/produits/:id — non couvert jusqu'ici (création et modification l'étaient déjà
// dans validation-update.test.js / stock.test.js, jamais la suppression elle-même).
describe('Suppression de produit', () => {
  let userIdA, tokenA, userIdB, tokenB;

  before(async () => {
    await setupTestDatabase();
    const a = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Produits A', email: emailDeTest('produits-a'), password: 'motdepasse123' });
    userIdA = a.body.user.id;
    tokenA = a.body.token;

    const b = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Produits B', email: emailDeTest('produits-b'), password: 'motdepasse123' });
    userIdB = b.body.user.id;
    tokenB = b.body.token;
  });

  after(async () => {
    await nettoyerUtilisateur(userIdA);
    await nettoyerUtilisateur(userIdB);
  });

  test('supprimer son propre produit réussit et le retire de la liste', async () => {
    const produit = await request(app)
      .post('/api/produits')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'Table', prix_ht: 15000, tva: 18, stock: 5 });
    const produitId = produit.body.produit.id;

    const suppression = await request(app)
      .delete(`/api/produits/${produitId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(suppression.status, 200);

    const liste = await request(app).get('/api/produits').set('Authorization', `Bearer ${tokenA}`);
    assert.ok(!liste.body.produits.some(p => p.id === produitId), 'le produit supprimé ne doit plus apparaître dans la liste');
  });

  test('supprimer un produit déjà supprimé renvoie 404 (pas de double suppression silencieuse)', async () => {
    const produit = await request(app)
      .post('/api/produits')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'Chaise pliante', prix_ht: 8000, tva: 18, stock: 3 });
    const produitId = produit.body.produit.id;

    await request(app).delete(`/api/produits/${produitId}`).set('Authorization', `Bearer ${tokenA}`);
    const secondeSuppression = await request(app)
      .delete(`/api/produits/${produitId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(secondeSuppression.status, 404);
  });

  test("B ne peut pas supprimer un produit de A (404, isolation)", async () => {
    const produit = await request(app)
      .post('/api/produits')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'Produit de A', prix_ht: 1000, tva: 18, stock: 1 });
    const produitId = produit.body.produit.id;

    const tentative = await request(app)
      .delete(`/api/produits/${produitId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    assert.equal(tentative.status, 404);

    // Le produit de A doit toujours exister malgré la tentative de B.
    const liste = await request(app).get('/api/produits').set('Authorization', `Bearer ${tokenA}`);
    assert.ok(liste.body.produits.some(p => p.id === produitId));
  });

  test('supprimer un produit lié à une ligne de facture existante détache la ligne au lieu de bloquer (ou d\'effacer l\'historique)', async () => {
    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'Client Produits' });

    const produit = await request(app)
      .post('/api/produits')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'Produit facturé', prix_ht: 2000, tva: 18, stock: 10 });
    const produitId = produit.body.produit.id;

    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        client_id: client.body.client.id,
        type: 'facture',
        lignes: [{ designation: 'Produit facturé', quantite: 2, prix_unitaire: 2000, tva: 18, produit_id: produitId }]
      });

    const suppression = await request(app)
      .delete(`/api/produits/${produitId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(suppression.status, 200, 'la suppression ne doit pas être bloquée par la contrainte de clé étrangère');

    // La facture existante doit rester consultable (ligne détachée, pas de perte de l'historique).
    const factureApres = await request(app)
      .get(`/api/factures/${facture.body.facture.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(factureApres.status, 200);
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
