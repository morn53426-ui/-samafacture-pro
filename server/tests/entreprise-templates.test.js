const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

// Vérifie côté PUT /api/auth/entreprise que les modèles gratuits s'enregistrent et que
// les huit modèles Entreprise restent interdits hors du plan Entreprise.
describe('Nouveaux modèles de facture — PUT /api/auth/entreprise', () => {
  let userId, token;
  const email = emailDeTest('modeles');

  before(async () => {
    await setupTestDatabase();
    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Modèles', email, password: 'motdepasse123', entreprise_nom: 'Boutique Modèles' , acceptTerms: true});
    userId = inscription.body.user.id;
    token = inscription.body.token;
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  for (const template of ['epure', 'azur', 'circuit', 'atelier', 'saveurs', 'nova', 'nordique', 'luxe', 'tech', 'horizon']) {
    test(`le modèle gratuit "${template}" s'enregistre même sur le plan gratuit`, async () => {
      const res = await request(app)
        .put('/api/auth/entreprise')
        .set('Authorization', `Bearer ${token}`)
        .send({ entreprise_nom: 'Boutique Modèles', devise: 'FCFA', facture_template: template });

      assert.equal(res.status, 200);
      assert.equal(res.body.user.facture_template, template);
    });
  }

  const enterpriseTemplates = ['prestige', 'heritage', 'diamant', 'platine', 'executive', 'institution', 'signature', 'consolide'];

  for (const plan of ['gratuit', 'starter', 'pro']) {
    test(`les modèles Entreprise sont refusés sur le plan ${plan}`, async () => {
      await pool.query("UPDATE users SET plan = ? WHERE id = ?", [plan, userId]);
      for (const template of enterpriseTemplates) {
        const res = await request(app)
          .put('/api/auth/entreprise')
          .set('Authorization', `Bearer ${token}`)
          .send({ entreprise_nom: 'Boutique Modèles', devise: 'FCFA', facture_template: template });

        assert.equal(res.status, 403, `${template} doit être réservé au plan Entreprise`);
        assert.equal(res.body.code, 'FONCTIONNALITE_ENTREPRISE');
      }
    });
  }

  test('les huit modèles exclusifs s’enregistrent après le passage au plan Entreprise', async () => {
    await pool.query("UPDATE users SET plan = 'entreprise' WHERE id = ?", [userId]);
    for (const template of enterpriseTemplates) {
      const res = await request(app)
        .put('/api/auth/entreprise')
        .set('Authorization', `Bearer ${token}`)
        .send({ entreprise_nom: 'Boutique Modèles', devise: 'FCFA', facture_template: template });

      assert.equal(res.status, 200);
      assert.equal(res.body.user.facture_template, template);
    }
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
