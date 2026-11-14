const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

// Couvre la personnalisation (couleurs/logo/police) côté PUT /api/auth/entreprise. Même schéma
// que entreprise-templates.test.js : nécessite une vraie base MySQL de test, donc non exécuté dans
// l'environnement de cette itération (voir RAPPORT_MODELES.md, section 4) — à lancer avec
// `npm test` dans le projet.
describe('Personnalisation des modèles — PUT /api/auth/entreprise', () => {
  let userId, token;
  const email = emailDeTest('personnalisation');

  before(async () => {
    await setupTestDatabase();
    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Perso', email, password: 'motdepasse123', entreprise_nom: 'Boutique Perso' , acceptTerms: true});
    userId = inscription.body.user.id;
    token = inscription.body.token;
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  test('une personnalisation valide s\'enregistre et est renvoyée déjà parsée (objet, pas une chaîne JSON)', async () => {
    const personnalisation = {
      couleur_principale: '#1a2b3c', couleur_secondaire: '#a1b2c3', couleur_texte: '#222222',
      police: 'serif', taille_texte: 'grand', epaisseur_texte: 'gras', logo_taille: 'petit'
    };
    const res = await request(app)
      .put('/api/auth/entreprise')
      .set('Authorization', `Bearer ${token}`)
      .send({ entreprise_nom: 'Boutique Perso', devise: 'FCFA', facture_personnalisation: personnalisation });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.user.facture_personnalisation, personnalisation);
  });

  // ⚠️ PUT /api/auth/entreprise remplace l'intégralité du profil entreprise à chaque appel (même
  // comportement que entreprise_logo, signature_default...) : ce n'est pas un PATCH partiel. Un
  // appel qui omet facture_personnalisation l'efface, exactement comme un appel qui omet
  // entreprise_logo efface le logo. Le frontend doit donc toujours renvoyer l'objet complet s'il
  // veut conserver la personnalisation existante — voir la mise à jour de public/parametres.html.

  test('une couleur invalide est refusée avec un message explicite (400), rien n\'est enregistré', async () => {
    const res = await request(app)
      .put('/api/auth/entreprise')
      .set('Authorization', `Bearer ${token}`)
      .send({ entreprise_nom: 'Boutique Perso', devise: 'FCFA', facture_personnalisation: { couleur_principale: 'pas-une-couleur' } });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /couleur_principale/i);
  });

  test('une police hors de la liste autorisée est refusée (400)', async () => {
    const res = await request(app)
      .put('/api/auth/entreprise')
      .set('Authorization', `Bearer ${token}`)
      .send({ entreprise_nom: 'Boutique Perso', devise: 'FCFA', facture_personnalisation: { police: 'comic-sans' } });

    assert.equal(res.status, 400);
  });

  test('envoyer facture_personnalisation: null efface la personnalisation existante', async () => {
    const res = await request(app)
      .put('/api/auth/entreprise')
      .set('Authorization', `Bearer ${token}`)
      .send({ entreprise_nom: 'Boutique Perso', devise: 'FCFA', facture_personnalisation: null });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.facture_personnalisation, null);
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
