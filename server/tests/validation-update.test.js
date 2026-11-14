const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

// Un champ obligatoire à la création (nom, libellé) doit le rester à la mise à jour.
// Bug trouvé lors d'une re-vérification : `{ nom: "" }` sur PUT passait `nom ?? existing.nom`,
// qui ne bloque que null/undefined — une chaîne vide explicite écrasait silencieusement la
// valeur existante, sans jamais déclencher l'erreur 400 pourtant appliquée à la création.
describe('Les champs obligatoires ne peuvent pas être vidés via PUT', () => {
  let userId, token, clientId, produitId, depenseId;

  before(async () => {
    await setupTestDatabase();
    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Validation', email: emailDeTest('validation'), password: 'motdepasse123' , acceptTerms: true});
    userId = inscription.body.user.id;
    token = inscription.body.token;

    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client Original' });
    clientId = client.body.client.id;

    const produit = await request(app)
      .post('/api/produits')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Produit Original', prix_ht: 1000, tva: 18 });
    produitId = produit.body.produit.id;

    const depense = await request(app)
      .post('/api/depenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ libelle: 'Dépense Originale', montant: 500 });
    depenseId = depense.body.depense.id;
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  test('PUT /clients/:id avec nom vide est refusé (400), le nom existant est conservé', async () => {
    const res = await request(app)
      .put(`/api/clients/${clientId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: '' });
    assert.equal(res.status, 400);

    const detail = await request(app).get(`/api/clients/${clientId}`).set('Authorization', `Bearer ${token}`);
    assert.equal(detail.body.client.nom, 'Client Original');
  });

  test('PUT /produits/:id avec nom vide est refusé (400), le nom existant est conservé', async () => {
    const res = await request(app)
      .put(`/api/produits/${produitId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: '' });
    assert.equal(res.status, 400);

    const detail = await request(app).get('/api/produits').set('Authorization', `Bearer ${token}`);
    const produit = detail.body.produits.find(p => p.id === produitId);
    assert.equal(produit.nom, 'Produit Original');
  });

  test('PUT /depenses/:id avec libellé vide est refusé (400), le libellé existant est conservé', async () => {
    const res = await request(app)
      .put(`/api/depenses/${depenseId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ libelle: '' });
    assert.equal(res.status, 400);

    const [rows] = await pool.query('SELECT libelle FROM depenses WHERE id = ?', [depenseId]);
    assert.equal(rows[0].libelle, 'Dépense Originale');
  });

  test('en revanche, omettre le champ (ne pas le fournir) laisse la valeur existante intacte, sans erreur', async () => {
    const res = await request(app)
      .put(`/api/clients/${clientId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'nouveau@exemple.com' }); // nom omis, pas vide
    assert.equal(res.status, 200);
    assert.equal(res.body.client.nom, 'Client Original');
    assert.equal(res.body.client.email, 'nouveau@exemple.com');
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
