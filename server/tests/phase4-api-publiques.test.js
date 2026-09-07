const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

// Couvre les deux fuites corrigées en Phase 4 (voir AUDIT_PRODUCTION.md §2.1 et §2.2). Même
// schéma que les autres fichiers d'intégration : nécessite une vraie base MySQL, donc non
// exécuté dans cet environnement — à lancer avec `npm test`.
describe('Phase 4 — API publiques : plus de fuite de données internes', () => {
  let userId, token, clientId, factureId, factureCode;
  const email = emailDeTest('phase4');

  before(async () => {
    await setupTestDatabase();

    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Phase4', email, password: 'motdepasse123', entreprise_nom: 'Boutique Phase4' });
    userId = inscription.body.user.id;
    token = inscription.body.token;

    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client Public Test', email: 'client-public@exemple-test.com', telephone: '+221770000000', adresse: 'Dakar' });
    clientId = client.body.client.id;

    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'facture',
        date_emission: '2026-08-01',
        lignes: [{ designation: 'Prestation test', quantite: 1, prix_unitaire: 10000, tva: 18 }]
      });
    factureId = facture.body.facture.id;
    factureCode = facture.body.facture.verification_code;
    assert.ok(factureCode, 'la facture de test doit avoir un verification_code (généré à la création)');
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  test('GET /public/consulter/:id/:code ne renvoie plus verification_code, user_id ni client_id', async () => {
    const res = await request(app).get(`/api/public/consulter/${factureId}/${factureCode}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.facture.verification_code, undefined, 'verification_code ne doit plus apparaître dans la réponse publique');
    assert.equal(res.body.facture.user_id, undefined);
    assert.equal(res.body.facture.client_id, undefined);
    assert.equal(res.body.facture.id, undefined);
    assert.equal(res.body.facture.created_at, undefined);
    // Les champs réellement utilisés par public/consulter.html doivent, eux, toujours être là.
    assert.ok(res.body.facture.numero, 'numero doit toujours être présent');
    assert.ok(res.body.facture.client_nom, 'client_nom doit toujours être présent');
    assert.equal(res.body.facture.client_nom, 'Client Public Test');
    assert.equal(Number(res.body.facture.total), 11800);
    assert.equal(res.body.lignes.length, 1);
    assert.equal(res.body.lignes[0].designation, 'Prestation test');
    assert.equal(res.body.lignes[0].id, undefined, 'les colonnes id/facture_id des lignes ne sont plus exposées non plus');
  });

  test('GET /public/consulter avec un mauvais code renvoie toujours 404 (comportement inchangé)', async () => {
    const res = await request(app).get(`/api/public/consulter/${factureId}/mauvais-code`);
    assert.equal(res.status, 404);
  });

  test('GET /auth/me ne renvoie plus reset_token_hash ni reset_token_expires', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.reset_token_hash, undefined);
    assert.equal(res.body.user.reset_token_expires, undefined);
    assert.equal(res.body.user.password_hash, undefined, 'toujours absent, comportement déjà correct avant');
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
