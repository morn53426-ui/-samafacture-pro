const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');
const { app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur } = require('./setup');

describe('Centre administrateur et mesure de fréquentation Sunupilot', () => {
  let userId;
  let token;
  let registeredEmail;
  let analyticsHash;
  const previousAdminIds = process.env.SUNUPILOT_ADMIN_USER_IDS;

  before(async () => {
    await setupTestDatabase();
    registeredEmail = emailDeTest('sunupilot-admin');
    const registration = await request(app).post('/api/auth/register').send({
      nom: 'Compte de test administrateur',
      email: registeredEmail,
      password: 'motdepasse123',
      acceptTerms: true
    });
    assert.equal(registration.status, 201, registration.text);
    userId = registration.body.user.id;
    assert.equal(registration.body.user.role, 'administrateur');
    token = registration.body.token;
  });

  after(async () => {
    if (analyticsHash) {
      await pool.query('DELETE FROM sunupilot_analytics_pageviews WHERE visitor_hash = ?', [analyticsHash]);
    }
    await nettoyerUtilisateur(userId);
    if (previousAdminIds === undefined) delete process.env.SUNUPILOT_ADMIN_USER_IDS;
    else process.env.SUNUPILOT_ADMIN_USER_IDS = previousAdminIds;
  });

  test('le rôle métier administrateur ne suffit pas à ouvrir le centre plateforme', async () => {
    delete process.env.SUNUPILOT_ADMIN_USER_IDS;
    const response = await request(app).get('/api/admin/overview')
      .set('Authorization', 'Bearer ' + token);
    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'ADMIN_ACCESS_NOT_CONFIGURED');
  });

  test('un compte hors liste blanche reçoit un refus explicite', async () => {
    process.env.SUNUPILOT_ADMIN_USER_IDS = String(Number(userId) + 999999);
    const response = await request(app).get('/api/admin/access')
      .set('Authorization', 'Bearer ' + token);
    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'ADMIN_ACCESS_DENIED');
  });

  test('la pageview stocke une empreinte et non le session_id brut', async () => {
    const sessionId = '1234567890abcdef1234567890abcdef1234567890abcdef';
    const response = await request(app).post('/api/analytics/pageview')
      .send({ session_id: sessionId, page_path: '/dashboard.html' });
    assert.equal(response.status, 202, response.text);
    const secret = process.env.SUNUPILOT_ANALYTICS_HASH_SECRET || process.env.JWT_SECRET;
    analyticsHash = crypto.createHmac('sha256', secret).update(sessionId).digest('hex');
    const [rows] = await pool.query(
      'SELECT visitor_hash, page_path FROM sunupilot_analytics_pageviews WHERE visitor_hash = ?',
      [analyticsHash]
    );
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].visitor_hash, sessionId);
    assert.equal(rows[0].page_path, '/dashboard.html');
  });

  test('les chemins sensibles, dynamiques ou avec paramètres sont refusés', async () => {
    const sessionId = 'abcdef1234567890abcdef1234567890abcdef1234567890';
    const response = await request(app).post('/api/analytics/pageview')
      .send({ session_id: sessionId, page_path: '/consulter/45/secret?email=personne@example.test' });
    assert.equal(response.status, 400);
  });

  test('un compte explicitement autorisé obtient des agrégats sans données personnelles', async () => {
    process.env.SUNUPILOT_ADMIN_USER_IDS = String(userId);
    const response = await request(app).get('/api/admin/overview?from=2026-01-01&to=2026-01-31')
      .set('Authorization', 'Bearer ' + token);
    assert.equal(response.status, 200, response.text);
    assert.ok(response.body.summary);
    assert.ok(response.body.revenue);
    assert.equal(response.body.revenue.recurring_metrics_available, false);
    assert.equal(JSON.stringify(response.body).includes(registeredEmail), false);
    assert.ok(response.body.summary.registered_accounts >= 1);
  });

  test('les périodes inversées et au mauvais format sont refusées', async () => {
    process.env.SUNUPILOT_ADMIN_USER_IDS = String(userId);
    const inverted = await request(app).get('/api/admin/overview?from=2026-02-01&to=2026-01-01')
      .set('Authorization', 'Bearer ' + token);
    assert.equal(inverted.status, 400);
    const badFormat = await request(app).get('/api/admin/overview?from=01-01-2026&to=2026-01-31')
      .set('Authorization', 'Bearer ' + token);
    assert.equal(badFormat.status, 400);
  });
});
