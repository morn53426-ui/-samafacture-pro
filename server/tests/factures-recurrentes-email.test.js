const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');
const { verifierFacturesRecurrentes } = require('../config/scheduler');

// L'envoi automatique par email d'une facture récurrente générée est opt-in par modèle
// (envoi_auto_email, désactivé par défaut) — fonctionnalité absente à l'origine (les
// factures récurrentes étaient générées mais jamais notifiées au client).
describe('Envoi automatique optionnel des factures récurrentes', () => {
  let userId, token, clientId;

  before(async () => {
    await setupTestDatabase();
    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Auto-Email', email: emailDeTest('autoemail'), password: 'motdepasse123' , acceptTerms: true});
    userId = inscription.body.user.id;
    token = inscription.body.token;

    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client Auto-Email', email: 'client-recurrent@exemple-test.com' });
    clientId = client.body.client.id;
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  test("envoi_auto_email est désactivé par défaut si non fourni à la création", async () => {
    const modele = await request(app)
      .post('/api/factures-recurrentes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId, libelle: 'Abonnement sans auto-email', frequence: 'mensuelle',
        prochaine_date: new Date().toISOString().slice(0, 10),
        lignes: [{ designation: 'Service', quantite: 1, prix_unitaire: 10000, tva: 18 }]
      });
    assert.equal(modele.status, 201);
    assert.equal(Number(modele.body.recurrente.envoi_auto_email), 0);
  });

  test('le vérificateur périodique génère la facture même sans email automatique, sans erreur', async () => {
    // Le modèle précédent est déjà dû (prochaine_date = aujourd'hui) et actif=1 par défaut.
    await assert.doesNotReject(verifierFacturesRecurrentes());

    const factures = await request(app)
      .get('/api/factures?type=facture')
      .set('Authorization', `Bearer ${token}`);
    const generee = factures.body.factures.find(f => f.client_id === clientId);
    assert.ok(generee, 'la facture générée automatiquement doit exister');
  });

  test('envoi_auto_email=true déclenche bien un envoi (sans échouer) lors de la génération automatique', async () => {
    const modele = await request(app)
      .post('/api/factures-recurrentes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId, libelle: 'Abonnement avec auto-email', frequence: 'mensuelle',
        prochaine_date: new Date().toISOString().slice(0, 10),
        envoi_auto_email: true,
        lignes: [{ designation: 'Service', quantite: 1, prix_unitaire: 15000, tva: 18 }]
      });
    assert.equal(Number(modele.body.recurrente.envoi_auto_email), 1);

    // Pas de SMTP configuré en environnement de test : sendMail() se contente de logger
    // (voir config/mailer.js), donc ceci vérifie surtout que le flux ne plante jamais et
    // que la facture est bien générée, même quand l'envoi est demandé.
    await assert.doesNotReject(verifierFacturesRecurrentes());

    const [[recurrente]] = await pool.query(
      'SELECT factures_generees FROM factures_recurrentes WHERE id = ?',
      [modele.body.recurrente.id]
    );
    assert.equal(recurrente.factures_generees, 1);
  });

  test('activer/désactiver envoi_auto_email via PUT fonctionne', async () => {
    const modele = await request(app)
      .post('/api/factures-recurrentes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId, libelle: 'Abonnement à modifier', frequence: 'mensuelle',
        lignes: [{ designation: 'Service', quantite: 1, prix_unitaire: 5000, tva: 18 }]
      });

    const maj = await request(app)
      .put(`/api/factures-recurrentes/${modele.body.recurrente.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ envoi_auto_email: true });
    assert.equal(Number(maj.body.recurrente.envoi_auto_email), 1);
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
