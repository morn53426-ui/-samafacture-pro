const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

// Le stock d'un produit doit se décompter automatiquement à la facturation (jamais pour un
// devis), et se restituer symétriquement en cas d'annulation ou de suppression — fonctionnalité
// absente à l'origine, ajoutée avec ces tests.
describe('Décompte et restitution automatique du stock', () => {
  let userId, token, clientId, produitId;

  before(async () => {
    await setupTestDatabase();
    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Stock', email: emailDeTest('stock'), password: 'motdepasse123' });
    userId = inscription.body.user.id;
    token = inscription.body.token;

    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client Stock' });
    clientId = client.body.client.id;
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  async function stockActuel() {
    const res = await request(app).get('/api/produits').set('Authorization', `Bearer ${token}`);
    return res.body.produits.find(p => p.id === produitId).stock;
  }

  test('créer une facture décompte le stock du produit lié', async () => {
    const produit = await request(app)
      .post('/api/produits')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Chaise', prix_ht: 5000, tva: 18, stock: 20 });
    produitId = produit.body.produit.id;

    await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Chaise', quantite: 3, prix_unitaire: 5000, tva: 18, produit_id: produitId }] });

    assert.equal(await stockActuel(), 17);
  });

  test('créer un devis (pas une facture) ne touche jamais le stock', async () => {
    const avant = await stockActuel();
    await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'devis', lignes: [{ designation: 'Chaise', quantite: 5, prix_unitaire: 5000, tva: 18, produit_id: produitId }] });
    assert.equal(await stockActuel(), avant);
  });

  test('annuler une facture restitue le stock, la ré-activer le redécompte', async () => {
    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Chaise', quantite: 2, prix_unitaire: 5000, tva: 18, produit_id: produitId }] });
    const avant = await stockActuel();

    await request(app)
      .put(`/api/factures/${facture.body.facture.id}/statut`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statut: 'annulee' });
    assert.equal(await stockActuel(), avant + 2, 'annuler doit restituer les 2 unités');

    await request(app)
      .put(`/api/factures/${facture.body.facture.id}/statut`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statut: 'en_attente' });
    assert.equal(await stockActuel(), avant, 'réactiver doit redécompter les 2 unités');
  });

  test('supprimer une facture active restitue le stock ; supprimer une facture déjà annulée ne le restitue pas deux fois', async () => {
    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Chaise', quantite: 4, prix_unitaire: 5000, tva: 18, produit_id: produitId }] });
    const avant = await stockActuel();

    await request(app)
      .delete(`/api/factures/${facture.body.facture.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(await stockActuel(), avant + 4);

    // Facture annulée puis supprimée : le stock avait déjà été restitué à l'annulation,
    // la suppression ne doit pas le restituer une seconde fois.
    const facture2 = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Chaise', quantite: 1, prix_unitaire: 5000, tva: 18, produit_id: produitId }] });
    await request(app)
      .put(`/api/factures/${facture2.body.facture.id}/statut`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statut: 'annulee' });
    const apresAnnulation = await stockActuel();

    await request(app)
      .delete(`/api/factures/${facture2.body.facture.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(await stockActuel(), apresAnnulation, 'pas de restitution en double');
  });

  test('supprimer le client restitue aussi le stock de ses factures actives', async () => {
    const client2 = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client à supprimer' });

    await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: client2.body.client.id, type: 'facture', lignes: [{ designation: 'Chaise', quantite: 6, prix_unitaire: 5000, tva: 18, produit_id: produitId }] });
    const avant = await stockActuel();

    await request(app)
      .delete(`/api/clients/${client2.body.client.id}`)
      .set('Authorization', `Bearer ${token}`);

    assert.equal(await stockActuel(), avant + 6);
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
