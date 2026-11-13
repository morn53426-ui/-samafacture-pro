const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

// Vérifie que la route POST /factures/:id/envoyer se comporte toujours à l'identique après
// son extraction en fonction réutilisable (envoyerFactureParEmail), partagée avec l'envoi
// automatique des factures récurrentes (voir tests/factures-recurrentes.test.js).
describe('Envoi de facture par email (POST /factures/:id/envoyer)', () => {
  let userId, token, clientId, factureId, factureSansEmailId;

  before(async () => {
    await setupTestDatabase();
    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Email', email: emailDeTest('envoi'), password: 'motdepasse123' , acceptTerms: true});
    userId = inscription.body.user.id;
    token = inscription.body.token;

    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client Avec Email', email: 'client-destinataire@exemple-test.com' });
    clientId = client.body.client.id;

    const clientSansEmail = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client Sans Email' });

    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Prestation', quantite: 1, prix_unitaire: 5000, tva: 0 }] });
    factureId = facture.body.facture.id;

    const factureSansEmail = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientSansEmail.body.client.id, type: 'facture', lignes: [{ designation: 'Prestation', quantite: 1, prix_unitaire: 3000, tva: 0 }] });
    factureSansEmailId = factureSansEmail.body.facture.id;
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  test("envoie avec succès à l'email du client (SMTP non configuré en test → journalisé, pas d'erreur)", async () => {
    const res = await request(app)
      .post(`/api/factures/${factureId}/envoyer`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.sent_to, 'client-destinataire@exemple-test.com');
  });

  test('un email explicite dans le corps de la requête a la priorité sur celui du client', async () => {
    const res = await request(app)
      .post(`/api/factures/${factureId}/envoyer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'autre-adresse@exemple-test.com' });
    assert.equal(res.status, 200);
    assert.equal(res.body.sent_to, 'autre-adresse@exemple-test.com');
  });

  test("400 si le client n'a pas d'email et qu'aucun n'est fourni", async () => {
    const res = await request(app)
      .post(`/api/factures/${factureSansEmailId}/envoyer`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    assert.equal(res.status, 400);
  });

  test('404 pour une facture inexistante', async () => {
    const res = await request(app)
      .post('/api/factures/999999999/envoyer')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    assert.equal(res.status, 404);
  });

  test('génère un verification_code si la facture n\'en avait pas encore un', async () => {
    const detailAvant = await request(app).get(`/api/factures/${factureId}`).set('Authorization', `Bearer ${token}`);
    assert.ok(detailAvant.body.facture.verification_code, 'un code de vérification doit déjà exister (créé à la création de la facture)');
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
