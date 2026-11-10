const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const crypto = require('crypto');
const { pool } = require('../config/db');
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
      .send({ nom: 'Utilisateur Test', email, password, entreprise_nom: 'Boutique Test' });

    assert.equal(res.status, 201);
    assert.ok(res.body.token, 'un jeton JWT doit être renvoyé');
    assert.equal(res.body.user.email, email);
    assert.equal(res.body.user.password_hash, undefined, 'le mot de passe ne doit jamais être renvoyé');
    userId = res.body.user.id;
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

  test('la connexion avec les bons identifiants réussit', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
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

  test('la déconnexion révoque le JWT Bearer utilisé, pas seulement le cookie', async () => {
    const login = await request(app).post('/api/auth/login').send({ email, password });
    assert.equal(login.status, 200);
    const oldToken = login.body.token;

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${oldToken}`);
    assert.equal(logout.status, 204);

    const refused = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldToken}`);
    assert.equal(refused.status, 401);

    const newLogin = await request(app).post('/api/auth/login').send({ email, password });
    assert.equal(newLogin.status, 200);
    const accepted = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${newLogin.body.token}`);
    assert.equal(accepted.status, 200);
  });

  test('la réinitialisation du mot de passe révoque les sessions et consomme le lien une seule fois', async () => {
    const login = await request(app).post('/api/auth/login').send({ email, password });
    assert.equal(login.status, 200);
    const oldToken = login.body.token;

    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    await pool.query(
      'UPDATE users SET reset_token_hash = ?, reset_token_expires = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE id = ?',
      [tokenHash, userId]
    );

    const reset = await request(app)
      .post('/api/auth/reinitialiser-mot-de-passe')
      .send({ token: rawResetToken, password: 'nouveau-mot-de-passe-2026' });
    assert.equal(reset.status, 200, reset.text);

    const refused = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldToken}`);
    assert.equal(refused.status, 401);

    const reused = await request(app)
      .post('/api/auth/reinitialiser-mot-de-passe')
      .send({ token: rawResetToken, password: 'autre-mot-de-passe-2026' });
    assert.equal(reused.status, 400);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'nouveau-mot-de-passe-2026' });
    assert.equal(newLogin.status, 200);
    assert.ok(newLogin.body.token);
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
