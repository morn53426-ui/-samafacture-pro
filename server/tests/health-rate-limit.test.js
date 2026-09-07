const { test, before, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, setupTestDatabase, teardownTestEnvironment } = require('./setup');

describe('/api/health — disponibilité sous charge', () => {
  before(async () => {
    await setupTestDatabase();
  });

  test('reste accessible au-delà du quota général de 300 requêtes/minute', async () => {
    for (let i = 0; i < 310; i++) {
      const res = await request(app).get('/api/health');
      assert.notEqual(res.status, 429, `appel ${i + 1}: /api/health ne doit pas être limité par le rate limiter général`);
      assert.equal(res.status, 200, `appel ${i + 1}: /api/health doit rester un endpoint de liveness sans dépendance DB`);
    }
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
