// Test unitaire pur de server/middleware/auth.js : ne nécessite ni base de données ni serveur
// HTTP réel (contrairement à auth.test.js) — seulement `jsonwebtoken`, déjà une dépendance du
// projet. Non exécuté dans cet environnement (pas de node_modules ici, voir
// AUDIT_PRODUCTION.md §1.1) — à lancer avec `npm test` une fois `npm install` fait.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-de-test-ne-jamais-utiliser-en-production';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { requireAuth } = require('../middleware/auth');

function jetonValide() {
  return jwt.sign({ id: 1, email: 'test@test.sn', role: 'user', nom: 'Test' }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

/** Construit un faux req/res minimal, dans le même style que ce que Express passerait. */
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

describe('requireAuth — en-tête Authorization (comportement existant, inchangé)', () => {
  test('un jeton Bearer valide authentifie normalement, quelle que soit la méthode', () => {
    const req = fauxeRequete({ method: 'POST', authorization: `Bearer ${jetonValide()}` });
    const res = fauxeReponse();
    let appele = false;
    requireAuth(req, res, () => { appele = true; });
    assert.equal(appele, true);
    assert.equal(req.user.email, 'test@test.sn');
    assert.equal(res.statusCode, null); // next() a été appelé, aucune réponse d'erreur envoyée
  });

  test("aucun jeton (ni en-tête, ni cookie) → 401", () => {
    const req = fauxeRequete({});
    const res = fauxeReponse();
    let appele = false;
    requireAuth(req, res, () => { appele = true; });
    assert.equal(appele, false);
    assert.equal(res.statusCode, 401);
  });

  test('un jeton invalide/expiré → 401', () => {
    const req = fauxeRequete({ authorization: 'Bearer ceci-nest-pas-un-jwt-valide' });
    const res = fauxeReponse();
    requireAuth(req, res, () => {});
    assert.equal(res.statusCode, 401);
  });
});

describe('requireAuth — repli sur le cookie sf_token (migration progressive)', () => {
  test("GET via cookie seul (sans en-tête Authorization) fonctionne, sans exiger l'en-tête anti-CSRF", () => {
    const req = fauxeRequete({ method: 'GET', cookies: { sf_token: jetonValide() } });
    const res = fauxeReponse();
    let appele = false;
    requireAuth(req, res, () => { appele = true; });
    assert.equal(appele, true, 'GET ne modifie rien : pas besoin de protection CSRF');
  });

  test("POST via cookie seul, SANS l'en-tête anti-CSRF → refusé (403)", () => {
    const req = fauxeRequete({ method: 'POST', cookies: { sf_token: jetonValide() } });
    const res = fauxeReponse();
    let appele = false;
    requireAuth(req, res, () => { appele = true; });
    assert.equal(appele, false);
    assert.equal(res.statusCode, 403);
  });

  test("POST via cookie, AVEC l'en-tête anti-CSRF attendu → autorisé", () => {
    const req = fauxeRequete({ method: 'POST', cookies: { sf_token: jetonValide() }, xRequestedWith: 'SamaFacturePro' });
    const res = fauxeReponse();
    let appele = false;
    requireAuth(req, res, () => { appele = true; });
    assert.equal(appele, true);
  });

  test("un en-tête Authorization présent est TOUJOURS prioritaire sur le cookie (pas de vérif CSRF dans ce cas)", () => {
    // Si jamais le cookie contenait un jeton invalide/périmé mais que Authorization est valide,
    // le comportement actuel (celui de tout le frontend aujourd'hui) doit continuer à passer.
    const req = fauxeRequete({
      method: 'POST',
      authorization: `Bearer ${jetonValide()}`,
      cookies: { sf_token: 'jeton-cookie-invalide-sans-rapport' }
    });
    const res = fauxeReponse();
    let appele = false;
    requireAuth(req, res, () => { appele = true; });
    assert.equal(appele, true);
  });
});
