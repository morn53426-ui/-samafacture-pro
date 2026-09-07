const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

// Couvre les nouveaux modèles ajoutés au lot 2026-08 (voir public/js/facture-templates.js et
// RAPPORT_MODELES.md) côté PUT /api/auth/entreprise : un modèle gratuit doit s'enregistrer
// pour n'importe quel plan, et le modèle "platine" (exclusif Entreprise, comme
// prestige/heritage/diamant) doit suivre exactement la même règle qu'eux.
describe('Nouveaux modèles de facture — PUT /api/auth/entreprise', () => {
  let userId, token;
  const email = emailDeTest('modeles');

  before(async () => {
    await setupTestDatabase();
    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Modèles', email, password: 'motdepasse123', entreprise_nom: 'Boutique Modèles' });
    userId = inscription.body.user.id;
    token = inscription.body.token;
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  for (const template of ['epure', 'azur', 'circuit', 'atelier', 'saveurs']) {
    test(`le modèle gratuit "${template}" s'enregistre même sur le plan gratuit`, async () => {
      const res = await request(app)
        .put('/api/auth/entreprise')
        .set('Authorization', `Bearer ${token}`)
        .send({ entreprise_nom: 'Boutique Modèles', devise: 'FCFA', facture_template: template });

      assert.equal(res.status, 200);
      assert.equal(res.body.user.facture_template, template);
    });
  }

  test('le modèle "platine" est refusé (403) sur le plan gratuit, avec le même code que prestige/heritage/diamant', async () => {
    const res = await request(app)
      .put('/api/auth/entreprise')
      .set('Authorization', `Bearer ${token}`)
      .send({ entreprise_nom: 'Boutique Modèles', devise: 'FCFA', facture_template: 'platine' });

    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'FONCTIONNALITE_ENTREPRISE');
  });

  test('le modèle "platine" s\'enregistre une fois le compte passé au plan Entreprise', async () => {
    await pool.query("UPDATE users SET plan = 'entreprise' WHERE id = ?", [userId]);
    const res = await request(app)
      .put('/api/auth/entreprise')
      .set('Authorization', `Bearer ${token}`)
      .send({ entreprise_nom: 'Boutique Modèles', devise: 'FCFA', facture_template: 'platine' });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.facture_template, 'platine');
  });

  test('un identifiant de modèle invalide retombe sur "classique" plutôt que de faire échouer la requête', async () => {
    const res = await request(app)
      .put('/api/auth/entreprise')
      .set('Authorization', `Bearer ${token}`)
      .send({ entreprise_nom: 'Boutique Modèles', devise: 'FCFA', facture_template: 'ce-modele-nexiste-pas' });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.facture_template, 'classique');
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
