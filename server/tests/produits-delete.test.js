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
      .send({ nom: 'Testeur Produits A', email: emailDeTest('produits-a'), password: 'motdepasse123' , acceptTerms: true});
    userIdA = a.body.user.id;
    tokenA = a.body.token;

    const b = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Produits B', email: emailDeTest('produits-b'), password: 'motdepasse123' , acceptTerms: true});
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
      .send({ nom: 'Table', prix_ht: 15000, tva: 18, stock: 0 });
    const produitId = produit.body.produit.id;

    const suppression = await request(app)
      .delete(`/api/produits/${produitId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(suppression.status, 200);

    const liste = await request(app).get('/api/produits').set('Authorization', `Bearer ${tokenA}`);
    assert.ok(!liste.body.produits.some(p => p.id === produitId), 'le produit supprimé ne doit plus apparaître dans la liste');
  });

  test('supprimer un produit avec stock positif est refusé et conserve la quantité', async () => {
    const produit = await request(app)
      .post('/api/produits')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'Produit stock actif', type_catalogue: 'produit', prix_ht: 1000, tva: 0, stock: 5 });
    assert.equal(produit.status, 201, produit.text);
    const deletion = await request(app)
      .delete(`/api/produits/${produit.body.produit.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(deletion.status, 409, deletion.text);
    assert.equal(deletion.body.code, 'PRODUIT_HISTORIQUE_PROTEGE');
    const list = await request(app).get('/api/produits').set('Authorization', `Bearer ${tokenA}`);
    const stored = list.body.produits.find(p => p.id === produit.body.produit.id);
    assert.ok(stored);
    assert.equal(Number(stored.stock), 5);
  });

  test('supprimer un produit sans stock mais avec mouvements est refusé', async () => {
    const produit = await request(app)
      .post('/api/produits')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'Produit mouvements historiques', type_catalogue: 'produit', prix_ht: 1000, tva: 0, stock: 5 });
    assert.equal(produit.status, 201, produit.text);
    const update = await request(app)
      .put(`/api/produits/${produit.body.produit.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ stock: 0 });
    assert.equal(update.status, 200, update.text);

    const deletion = await request(app)
      .delete(`/api/produits/${produit.body.produit.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(deletion.status, 409, deletion.text);
    assert.equal(deletion.body.code, 'PRODUIT_HISTORIQUE_PROTEGE');
    const [[movement]] = await require('./setup').pool.query(
      'SELECT COUNT(*) AS n FROM pro_mouvements_stock WHERE user_id = ? AND produit_id = ?',
      [userIdA, produit.body.produit.id]
    );
    assert.ok(Number(movement.n) > 0);
  });

  test('supprimer un produit déjà supprimé renvoie 404 (pas de double suppression silencieuse)', async () => {
    const produit = await request(app)
      .post('/api/produits')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'Chaise pliante', prix_ht: 8000, tva: 18, stock: 0 });
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

  test('supprimer un produit lié à une facture est refusé et conserve le lien et le stock', async () => {
    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'Client Produits' });

    const produit = await request(app)
      .post('/api/produits')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'Produit facturé', type_catalogue: 'produit', prix_ht: 2000, tva: 18, stock: 10 });
    const produitId = produit.body.produit.id;

    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        client_id: client.body.client.id,
        type: 'facture',
        lignes: [{ designation: 'Produit facturé', quantite: 2, prix_unitaire: 2000, tva: 18, produit_id: produitId }]
      });
    assert.equal(facture.status, 201, facture.text);

    const suppression = await request(app)
      .delete(`/api/produits/${produitId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(suppression.status, 409, suppression.text);
    assert.equal(suppression.body.code, 'PRODUIT_HISTORIQUE_PROTEGE');

    const factureApres = await request(app)
      .get(`/api/factures/${facture.body.facture.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(factureApres.status, 200);
    assert.equal(factureApres.body.lignes[0].produit_id, produitId, 'le lien catalogue doit rester');
    const liste = await request(app).get('/api/produits').set('Authorization', `Bearer ${tokenA}`);
    assert.ok(liste.body.produits.some(p => p.id === produitId), 'le produit doit rester dans le catalogue');
    assert.equal(Number(liste.body.produits.find(p => p.id === produitId).stock), 8, 'le stock vendu reste cohérent');
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
