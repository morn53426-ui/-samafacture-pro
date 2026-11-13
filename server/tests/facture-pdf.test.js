const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

// GET /api/factures/:id/pdf (génération via Puppeteer, utils/pdf.js) n'était pas testé.
// Nécessite un Chromium installé/téléchargeable (voir npm postinstall de puppeteer) — pas
// exécutable dans un environnement sans accès réseau, mais doit passer en CI/local normal.
describe('Génération PDF de facture', () => {
  let userIdA, tokenA, userIdB, tokenB, factureId;

  before(async () => {
    await setupTestDatabase();
    const a = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur PDF A', email: emailDeTest('pdf-a'), password: 'motdepasse123' , acceptTerms: true});
    userIdA = a.body.user.id;
    tokenA = a.body.token;

    const b = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur PDF B', email: emailDeTest('pdf-b'), password: 'motdepasse123' , acceptTerms: true});
    userIdB = b.body.user.id;
    tokenB = b.body.token;

    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'Client PDF' });

    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ client_id: client.body.client.id, type: 'facture', lignes: [{ designation: 'Service', quantite: 1, prix_unitaire: 10000, tva: 18 }] });
    factureId = facture.body.facture.id;
  });

  after(async () => {
    await nettoyerUtilisateur(userIdA);
    await nettoyerUtilisateur(userIdB);
  });

  test('télécharge un vrai PDF pour une facture existante', async () => {
    const res = await request(app)
      .get(`/api/factures/${factureId}/pdf`)
      .set('Authorization', `Bearer ${tokenA}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'] === 'application/pdf' || res.headers['content-type'].startsWith('application/pdf;'), 'le fichier doit être servi en application/pdf');
    assert.match(res.headers['content-disposition'], /^attachment; filename="facture-/);
    // Un fichier PDF valide commence toujours par la signature "%PDF-".
    assert.equal(res.body.slice(0, 5).toString('latin1'), '%PDF-');
  });

  test("B ne peut pas télécharger le PDF d'une facture de A (404, pas de fuite de document)", async () => {
    const res = await request(app)
      .get(`/api/factures/${factureId}/pdf`)
      .set('Authorization', `Bearer ${tokenB}`);
    assert.equal(res.status, 404);
  });

  test("un devis (pas une facture) télécharge un PDF nommé 'devis-...'", async () => {
    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'Client Devis PDF' });
    const devis = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ client_id: client.body.client.id, type: 'devis', lignes: [{ designation: 'Étude', quantite: 1, prix_unitaire: 5000, tva: 18 }] });

    const res = await request(app)
      .get(`/api/factures/${devis.body.facture.id}/pdf`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(res.status, 200);
    assert.match(res.headers['content-disposition'], /^attachment; filename="devis-/);
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
