// Tests unitaires du middleware d'authentification : le pool MySQL est simulé pour vérifier
// les droits, la protection CSRF et la révocation sans démarrer de base de données.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-de-test-ne-jamais-utiliser-en-production';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createRequireAuth } = require('../middleware/auth');

function jetonValide(tokenVersion = 0) {
  return jwt.sign({
    id: 1, email: 'test@test.sn', role: 'user', nom: 'Test', token_version: tokenVersion
  }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function fauxeRequete({ method = 'GET', authorization = null, cookies = {}, xRequestedWith = null } = {}) {
  const headers = {};
  if (authorization) headers.authorization = authorization;
  if (xRequestedWith) headers['x-requested-with'] = xRequestedWith;
  return { method, headers, cookies };
}

function fauxeReponse() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

function poolVersion(version = 0, exists = true) {
  return {
    query: async () => [exists ? [{ token_version: version }] : []]
  };
}

describe('requireAuth — contrôle des sessions et Bearer', () => {
  test('un jeton Bearer valide authentifie normalement', async () => {
    const auth = createRequireAuth(poolVersion());
    const req = fauxeRequete({ method: 'POST', authorization: `Bearer ${jetonValide()}` });
    const res = fauxeReponse();
    let appele = false;
    await auth(req, res, () => { appele = true; });
    assert.equal(appele, true);
    assert.equal(req.user.email, 'test@test.sn');
    assert.equal(res.statusCode, null);
  });

  test('un JWT émis avec une ancienne version est immédiatement révoqué', async () => {
    const auth = createRequireAuth(poolVersion(1));
    const req = fauxeRequete({ authorization: `Bearer ${jetonValide(0)}` });
    const res = fauxeReponse();
    let appele = false;
    await auth(req, res, () => { appele = true; });
    assert.equal(appele, false);
    assert.equal(res.statusCode, 401);
  });

  test('un compte supprimé ne peut plus utiliser son JWT', async () => {
    const auth = createRequireAuth(poolVersion(0, false));
    const req = fauxeRequete({ authorization: `Bearer ${jetonValide()}` });
    const res = fauxeReponse();
    await auth(req, res, () => {});
    assert.equal(res.statusCode, 401);
  });

  test('aucun jeton ne donne pas accès', async () => {
    const auth = createRequireAuth(poolVersion());
    const req = fauxeRequete({});
    const res = fauxeReponse();
    await auth(req, res, () => {});
    assert.equal(res.statusCode, 401);
  });

  test('un jeton invalide ou expiré est refusé', async () => {
    const auth = createRequireAuth(poolVersion());
    const req = fauxeRequete({ authorization: 'Bearer ceci-nest-pas-un-jwt-valide' });
    const res = fauxeReponse();
    await auth(req, res, () => {});
    assert.equal(res.statusCode, 401);
  });
});

describe('requireAuth — cookie sf_token et protection CSRF', () => {
  test('GET via cookie seul fonctionne sans en-tête anti-CSRF', async () => {
    const auth = createRequireAuth(poolVersion());
    const req = fauxeRequete({ method: 'GET', cookies: { sf_token: jetonValide() } });
    const res = fauxeReponse();
    let appele = false;
    await auth(req, res, () => { appele = true; });
    assert.equal(appele, true);
  });

  test('POST via cookie seul sans en-tête anti-CSRF est refusé', async () => {
    const auth = createRequireAuth(poolVersion());
    const req = fauxeRequete({ method: 'POST', cookies: { sf_token: jetonValide() } });
    const res = fauxeReponse();
    let appele = false;
    await auth(req, res, () => { appele = true; });
    assert.equal(appele, false);
    assert.equal(res.statusCode, 403);
  });

  test('POST via cookie avec en-tête anti-CSRF est autorisé', async () => {
    const auth = createRequireAuth(poolVersion());
    const req = fauxeRequete({
      method: 'POST', cookies: { sf_token: jetonValide() }, xRequestedWith: 'SamaFacturePro'
    });
    const res = fauxeReponse();
    let appele = false;
    await auth(req, res, () => { appele = true; });
    assert.equal(appele, true);
  });

  test('Authorization Bearer reste prioritaire sur le cookie', async () => {
    const auth = createRequireAuth(poolVersion());
    const req = fauxeRequete({
      method: 'POST',
      authorization: `Bearer ${jetonValide()}`,
      cookies: { sf_token: 'jeton-cookie-invalide-sans-rapport' }
    });
    const res = fauxeReponse();
    let appele = false;
    await auth(req, res, () => { appele = true; });
    assert.equal(appele, true);
  });
});
