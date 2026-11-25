// Régression : une configuration locale où ALLOWED_ORIGINS contient encore une ancienne
// valeur (ex: http://localhost:4100) ne doit plus empêcher l'application servie sur
// APP_URL (ex: http://localhost:4000) de s'inscrire ou d'écrire. L'origine de APP_URL est
// ajoutée automatiquement à la liste autorisée dès qu'une politique CORS s'applique.
//
// Ces variables doivent être posées AVANT le require de setup.js, qui charge app.js.
process.env.APP_URL = 'http://localhost:4000';
process.env.ALLOWED_ORIGINS = 'http://localhost:4100';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { app, teardownTestEnvironment } = require('./setup');

let server;
let baseUrl;

before(async () => {
  server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (server && server.listening) {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections?.();
    });
  }
  await teardownTestEnvironment();
});

function get(path, origin) {
  return new Promise((resolve, reject) => {
    const headers = origin ? { Origin: origin } : {};
    const req = http.get(`${baseUrl}${path}`, { headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
  });
}

test('autorise l’origine de APP_URL même absente de ALLOWED_ORIGINS', async () => {
  const res = await get('/api/health', 'http://localhost:4000');
  assert.equal(res.status, 200);
  assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:4000');
});

test('conserve les origines explicitement listées', async () => {
  const res = await get('/api/health', 'http://localhost:4100');
  assert.equal(res.status, 200);
  assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:4100');
});

test('refuse une origine inconnue avec un 403 explicite, pas un 500', async () => {
  const res = await get('/api/health', 'http://origine-inconnue.example');
  assert.equal(res.status, 403);
  assert.equal(res.headers['access-control-allow-origin'], undefined);
  assert.match(res.body, /Origine non autorisée par la politique CORS/);
});

test('laisse passer les requêtes sans en-tête Origin (same-origin, curl, mobile)', async () => {
  const res = await get('/api/health');
  assert.equal(res.status, 200);
});
