// Deux inscriptions simultanées avec le même email : l'index unique uk_users_email garantit
// un seul compte (et donc un seul essai gratuit) ; les perdants doivent recevoir 409, pas 500.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

describe('Inscription concurrente avec le même email', () => {
  const ids = [];
  before(async () => { await setupTestDatabase(); });
  after(async () => { for (const id of ids) await nettoyerUtilisateur(id); });

  for (const [libelle, plan] of [['avec essai (plan pro)', 'pro'], ['sans plan (Gratuit)', undefined]]) {
    test(`4 inscriptions simultanées ${libelle} : un seul compte, une seule création, les autres en 409`, async () => {
      const email = emailDeTest('inscription-course');
      const corps = { nom: 'Course', email, password: 'motdepasse123', entreprise_nom: 'Course SARL', acceptTerms: true };
      if (plan) corps.plan = plan;

      const reponses = await Promise.all([1, 2, 3, 4].map(() => request(app).post('/api/auth/register').send(corps)));
      for (const r of reponses) if (r.body && r.body.user && r.body.user.id) ids.push(r.body.user.id);

      const statuts = reponses.map((r) => r.status).sort();
      assert.deepEqual(statuts, [201, 409, 409, 409], `statuts reçus : ${statuts.join(', ')}`);
      for (const r of reponses.filter((x) => x.status === 409)) {
        assert.match(r.body.error, /existe déjà/i);
        assert.equal(r.body.token, undefined, 'un refus ne doit jamais délivrer de jeton');
      }

      const [rows] = await pool.query('SELECT id, trial_status, trial_started_at, trial_ends_at FROM users WHERE email = ?', [email]);
      assert.equal(rows.length, 1, 'un seul compte doit exister pour cet email');
      if (plan) {
        assert.equal(rows[0].trial_status, 'trialing');
        assert.ok(rows[0].trial_started_at && rows[0].trial_ends_at, 'l’essai est démarré une seule fois');
      } else {
        assert.equal(rows[0].trial_status, 'not_started');
      }
    });
  }
});

after(teardownTestEnvironment);
