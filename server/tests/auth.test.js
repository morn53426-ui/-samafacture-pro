const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

describe('Authentification', () => {
  let userId;
  const email = emailDeTest('auth');
  const password = 'motdepasse123';

  before(async () => {
    await setupTestDatabase();
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  test('inscription avec des informations valides crée un compte et renvoie un jeton', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Utilisateur Test', email, password, entreprise_nom: 'Boutique Test', acceptTerms: true });

    assert.equal(res.status, 201);
    assert.ok(res.body.token, 'un jeton JWT doit être renvoyé');
    assert.equal(res.body.user.email, email);
    assert.equal(res.body.user.password_hash, undefined, 'le mot de passe ne doit jamais être renvoyé');
    userId = res.body.user.id;
  });

  test("l'inscription sans acceptation des documents est refusée", async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Sans Consentement', email: emailDeTest('sans-accord'), password, acceptTerms: false });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /accepter les conditions/i);
  });

  test("l'inscription avec un email déjà utilisé est refusée", async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Autre Utilisateur', email, password: 'autremotdepasse' });

    assert.equal(res.status, 409);
  });

  test('un mot de passe trop court est refusé à l\'inscription', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Test', email: emailDeTest('court'), password: '123' });

    assert.equal(res.status, 400);
  });

  test("l'acceptation des documents est enregistrée avec leurs versions", async () => {
    const [rows] = await require('../config/db').pool.query(
      'SELECT terms_accepted_at, terms_version, privacy_version FROM users WHERE email = ?',
      [email]
    );
    assert.ok(rows[0].terms_accepted_at);
    assert.equal(rows[0].terms_version, '2026-11-13');
    assert.equal(rows[0].privacy_version, '2026-11-13');
  });

  test('la connexion avec les bons identifiants réussit', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });

  test('un utilisateur ne peut pas attribuer lui-même un plan Starter, Pro ou Entreprise', async () => {
    const connexion = await request(app).post('/api/auth/login').send({ email, password });
    assert.equal(connexion.status, 200);
    const token = connexion.body.token;

    for (const plan of ['starter', 'pro', 'entreprise']) {
      const res = await request(app)
        .put('/api/auth/plan')
        .set('Authorization', `Bearer ${token}`)
        .send({ plan });
      assert.equal(res.status, 403, `le plan ${plan} doit exiger un paiement confirmé`);
      assert.equal(res.body.code, 'PAIEMENT_REQUIS');
    }

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.user.plan, 'gratuit');
  });

  test('le changement vers un plan inconnu est refusé', async () => {
    const connexion = await request(app).post('/api/auth/login').send({ email, password });
    const res = await request(app)
      .put('/api/auth/plan')
      .set('Authorization', `Bearer ${connexion.body.token}`)
      .send({ plan: 'enterprise-premium' });
    assert.equal(res.status, 400);
  });

  test('la connexion avec un mauvais mot de passe échoue', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'mauvais-mot-de-passe' });
    assert.equal(res.status, 401);
  });

  test('la connexion avec un email inconnu échoue (sans révéler que le compte n\'existe pas)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: emailDeTest('inconnu'), password: 'peu importe' });
    assert.equal(res.status, 401);
  });

  test('accéder à une route protégée sans jeton est refusé', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.equal(res.status, 401);
  });

  test('accéder à une route protégée avec un jeton invalide est refusé', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer un-jeton-invalide');
    assert.equal(res.status, 401);
  });

  test('accéder à /api/auth/me avec un jeton valide renvoie le bon utilisateur', async () => {
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, email);
  });

  test('les informations légales et bancaires de l’entreprise sont enregistrées et conservées', async () => {
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const token = login.body.token;
    const payload = {
      entreprise_nom: 'Entreprise Test',
      entreprise_adresse: 'Dakar',
      entreprise_telephone: '+221 77 000 00 00',
      entreprise_email: 'contact@test.sn',
      entreprise_ninea: '123456789',
      entreprise_rccm: 'SN-DKR-2026-B-1234',
      entreprise_site_web: 'https://entreprise-test.sn',
      entreprise_banque: 'Banque Test',
      entreprise_rib: 'SN00 1111 2222 3333',
      entreprise_conditions_reglement: 'Paiement à 30 jours.',
      entreprise_mentions_legales: 'SARL au capital de 1 000 000 FCFA.',
      devise: 'FCFA',
      facture_template: 'classique'
    };

    const saved = await request(app)
      .put('/api/auth/entreprise')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    assert.equal(saved.status, 200, saved.text);
    assert.equal(saved.body.user.entreprise_rccm, payload.entreprise_rccm);
    assert.equal(saved.body.user.entreprise_site_web, payload.entreprise_site_web);
    assert.equal(saved.body.user.entreprise_banque, payload.entreprise_banque);
    assert.equal(saved.body.user.entreprise_rib, payload.entreprise_rib);
    assert.equal(saved.body.user.entreprise_conditions_reglement, payload.entreprise_conditions_reglement);
    assert.equal(saved.body.user.entreprise_mentions_legales, payload.entreprise_mentions_legales);

    // Un ancien client peut encore envoyer le payload historique sans ces nouvelles propriétés :
    // les réglages ajoutés ne doivent pas être effacés lors d'une sauvegarde du profil.
    const legacy = { ...payload };
    delete legacy.entreprise_rccm;
    delete legacy.entreprise_site_web;
    delete legacy.entreprise_banque;
    delete legacy.entreprise_rib;
    delete legacy.entreprise_conditions_reglement;
    delete legacy.entreprise_mentions_legales;
    const savedAgain = await request(app)
      .put('/api/auth/entreprise')
      .set('Authorization', `Bearer ${token}`)
      .send(legacy);
    assert.equal(savedAgain.status, 200, savedAgain.text);
    assert.equal(savedAgain.body.user.entreprise_rccm, payload.entreprise_rccm);
    assert.equal(savedAgain.body.user.entreprise_rib, payload.entreprise_rib);
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
