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
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
