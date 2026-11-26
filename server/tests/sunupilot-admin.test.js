const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');
const { hashVisitor, purgeOldPageviews, retentionDays } = require('../utils/sunupilot-analytics');

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
    analyticsHash = hashVisitor(sessionId);
    assert.match(analyticsHash, /^[a-f0-9]{64}$/);
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
    assert.ok(Array.isArray(response.body.revenue.by_plan_by_currency));
    assert.equal(response.body.revenue.recurring_metrics_available, false);
    assert.equal(JSON.stringify(response.body).includes(registeredEmail), false);
    assert.ok(response.body.summary.registered_accounts >= 1);
    assert.ok(response.body.summary.accounts_with_confirmed_subscription_payment >= 0);
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

  test('les routes admin sans authentification sont refusées et jamais mises en cache', async () => {
    const anonymous = await request(app).get('/api/admin/overview');
    assert.equal(anonymous.status, 401);
    assert.match(anonymous.headers['cache-control'] || '', /no-store/);
    process.env.SUNUPILOT_ADMIN_USER_IDS = String(userId);
    const authorized = await request(app).get('/api/admin/access')
      .set('Authorization', 'Bearer ' + token);
    assert.equal(authorized.status, 200);
    assert.match(authorized.headers['cache-control'] || '', /no-store/);
    assert.match(authorized.headers['x-robots-tag'] || '', /noindex/);
  });

  test('une liste d\'identifiants non numériques n\'ouvre aucun accès', async () => {
    process.env.SUNUPILOT_ADMIN_USER_IDS = 'abc, 0x1, , 1e3, -' + userId;
    const response = await request(app).get('/api/admin/access')
      .set('Authorization', 'Bearer ' + token);
    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'ADMIN_ACCESS_NOT_CONFIGURED');
  });

  test('la page d\'administration et les chemins inconnus ne sont pas mesurés', async () => {
    const sessionId = 'fedcba0987654321fedcba0987654321fedcba0987654321';
    for (const page_path of ['/admin.html', '/admin', '/api/admin/overview', '/login.html#x']) {
      const response = await request(app).post('/api/analytics/pageview')
        .send({ session_id: sessionId, page_path });
      assert.equal(response.status, 400, page_path);
    }
  });

  test('l\'empreinte est déterministe, distincte du session_id et séparée de la clé JWT', () => {
    const sessionId = '00112233445566778899aabbccddeeff00112233';
    const hash = hashVisitor(sessionId);
    assert.equal(hash, hashVisitor(sessionId));
    assert.notEqual(hash, sessionId);
    const changedSessionId = sessionId.slice(0, -1) + (sessionId.endsWith('1') ? '2' : '1');
    assert.notEqual(hash, hashVisitor(changedSessionId));
  });

  test('la purge supprime les vues expirées et conserve les vues récentes', async () => {
    const previous = process.env.SUNUPILOT_ANALYTICS_RETENTION_DAYS;
    process.env.SUNUPILOT_ANALYTICS_RETENTION_DAYS = '30';
    const oldHash = 'a'.repeat(63) + '1';
    const freshHash = 'b'.repeat(63) + '2';
    try {
      assert.equal(retentionDays(), 30);
      await pool.query(
        'INSERT INTO sunupilot_analytics_pageviews (visitor_hash, page_path, created_at) VALUES (?, ?, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)), (?, ?, UTC_TIMESTAMP())',
        [oldHash, '/', freshHash, '/']
      );
      await purgeOldPageviews();
      const [oldRows] = await pool.query('SELECT id FROM sunupilot_analytics_pageviews WHERE visitor_hash = ?', [oldHash]);
      const [freshRows] = await pool.query('SELECT id FROM sunupilot_analytics_pageviews WHERE visitor_hash = ?', [freshHash]);
      assert.equal(oldRows.length, 0);
      assert.equal(freshRows.length, 1);
    } finally {
      await pool.query('DELETE FROM sunupilot_analytics_pageviews WHERE visitor_hash IN (?, ?)', [oldHash, freshHash]);
      if (previous === undefined) delete process.env.SUNUPILOT_ANALYTICS_RETENTION_DAYS;
      else process.env.SUNUPILOT_ANALYTICS_RETENTION_DAYS = previous;
    }
  });

  test('la purge peut réutiliser la connexion déjà verrouillée sans reprendre le pool', async () => {
    const previous = process.env.SUNUPILOT_ANALYTICS_RETENTION_DAYS;
    process.env.SUNUPILOT_ANALYTICS_RETENTION_DAYS = '30';
    const calls = [];
    const connection = {
      async query(sql, values) {
        calls.push({ sql, values });
        return [{ affectedRows: 0 }];
      }
    };
    try {
      assert.equal(await purgeOldPageviews(connection), 0);
      assert.equal(calls.length, 1);
      assert.match(calls[0].sql, /DELETE FROM sunupilot_analytics_pageviews/);
      assert.deepEqual(calls[0].values, [30]);
    } finally {
      if (previous === undefined) delete process.env.SUNUPILOT_ANALYTICS_RETENTION_DAYS;
      else process.env.SUNUPILOT_ANALYTICS_RETENTION_DAYS = previous;
    }
  });

  test('la durée de conservation est bornée', () => {
    const previous = process.env.SUNUPILOT_ANALYTICS_RETENTION_DAYS;
    try {
      process.env.SUNUPILOT_ANALYTICS_RETENTION_DAYS = '1';
      assert.equal(retentionDays(), 30);
      process.env.SUNUPILOT_ANALYTICS_RETENTION_DAYS = '999999';
      assert.equal(retentionDays(), 825);
      process.env.SUNUPILOT_ANALYTICS_RETENTION_DAYS = 'n/a';
      assert.equal(retentionDays(), 395);
    } finally {
      if (previous === undefined) delete process.env.SUNUPILOT_ANALYTICS_RETENTION_DAYS;
      else process.env.SUNUPILOT_ANALYTICS_RETENTION_DAYS = previous;
    }
  });
});

// Ferme MySQL et le serveur HTTP après le nettoyage des données de test.
after(teardownTestEnvironment);
