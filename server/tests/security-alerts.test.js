'use strict';

process.env.AUDIT_LOG_HMAC_KEY = process.env.AUDIT_LOG_HMAC_KEY || 'test-only-audit-ledger-key-at-least-32-bytes';
process.env.AUDIT_LOG_HMAC_KEY_VERSION = process.env.AUDIT_LOG_HMAC_KEY_VERSION || '1';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const {
  app,
  pool,
  setupTestDatabase,
  emailDeTest,
  nettoyerUtilisateur,
  teardownTestEnvironment
} = require('./setup');

const createdUsers = [];
let ownerA;
let ownerAToken;
let ownerB;
let ownerBToken;
let memberA;
let memberAToken;
let alertId;
let caseId;

async function createAccount(prefix) {
  const email = emailDeTest(prefix);
  const passwordHash = await bcrypt.hash('motdepasse123', 10);
  const [insert] = await pool.query(
    `INSERT INTO users (nom, email, password_hash, entreprise_nom, plan, trial_status)
     VALUES (?, ?, ?, ?, 'gratuit', 'not_started')`,
    ['Security test', email, passwordHash, 'Entreprise security ' + prefix]
  );
  const id = Number(insert.insertId);
  createdUsers.push(id);
  const login = await request(app).post('/api/auth/login').send({ email, password: 'motdepasse123' });
  assert.equal(login.status, 200, login.text);
  return { id, email, token: login.body.token };
}

function auth(token) {
  return { Authorization: 'Bearer ' + token };
}

before(async () => {
  await setupTestDatabase();
  const a = await createAccount('security-alert-owner-a');
  const b = await createAccount('security-alert-owner-b');
  const member = await createAccount('security-alert-member-a');
  ownerA = a.id;
  ownerAToken = a.token;
  ownerB = b.id;
  ownerBToken = b.token;
  memberA = member.id;
  memberAToken = member.token;
  await pool.query(
    'INSERT INTO pro_team_members (owner_user_id, member_user_id, role, permissions_json, active) VALUES (?, ?, ?, ?, 1)',
    [ownerA, memberA, 'lecture_seule', JSON.stringify(['clients.read'])]
  );
});

after(async () => {
  for (const userId of createdUsers) {
    await nettoyerUtilisateur(userId);
  }
  await teardownTestEnvironment();
});

test('migration v26 : tables d’alertes et d’investigation avec historique append-only', async () => {
  const [tables] = await pool.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('pro_security_alerts', 'pro_security_cases', 'pro_security_case_events')`
  );
  assert.deepEqual(tables.map(row => row.TABLE_NAME).sort(), [
    'pro_security_alerts', 'pro_security_case_events', 'pro_security_cases'
  ]);
  const [triggers] = await pool.query(
    `SELECT TRIGGER_NAME FROM information_schema.TRIGGERS
      WHERE TRIGGER_SCHEMA = DATABASE()
        AND TRIGGER_NAME IN ('trg_pro_security_case_events_block_update', 'trg_pro_security_case_events_block_delete')`
  );
  assert.deepEqual(triggers.map(row => row.TRIGGER_NAME).sort(), [
    'trg_pro_security_case_events_block_delete', 'trg_pro_security_case_events_block_update'
  ]);
  const [foreignKeys] = await pool.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('pro_security_alerts', 'pro_security_cases', 'pro_security_case_events')
        AND REFERENCED_TABLE_NAME IS NOT NULL`
  );
  assert.equal(foreignKeys.length, 0, 'le cycle de vie des comptes ne doit pas effacer les alertes ou l’historique');
  const [[meta]] = await pool.query('SELECT version FROM _samafacture_schema_meta WHERE id = 1');
  assert.equal(Number(meta.version), 26);
});

test('cinq échecs de connexion sur quinze minutes créent une seule alerte tenant-scoped', async () => {
  const unknownAccount = await request(app).post('/api/auth/login').send({
    email: emailDeTest('security-alert-unknown'),
    password: 'incorrect'
  });
  // Une adresse inconnue n'est pas rattachée à un tenant : elle ne doit pas
  // créer de fausse alerte dans le dossier d'un compte existant.
  assert.equal(unknownAccount.status, 401);

  const [beforeKnownAccount] = await pool.query(
    'SELECT id FROM pro_security_alerts WHERE tenant_scope_id = ?',
    [ownerA]
  );
  assert.equal(beforeKnownAccount.length, 0);

  const [[account]] = await pool.query('SELECT email FROM users WHERE id = ?', [ownerA]);
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = await request(app).post('/api/auth/login').send({
      email: account.email,
      password: 'mauvais-mot-de-passe'
    });
    assert.equal(result.status, 401);
  }

  const [alerts] = await pool.query(
    'SELECT id, status, severity, occurrence_count, rule_code FROM pro_security_alerts WHERE tenant_scope_id = ?',
    [ownerA]
  );
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].status, 'open');
  assert.equal(alerts[0].severity, 'high');
  assert.equal(Number(alerts[0].occurrence_count), 5);
  assert.equal(alerts[0].rule_code, 'auth.login.failed.threshold');
  alertId = Number(alerts[0].id);

  const [createdEvents] = await pool.query(
    `SELECT id FROM pro_audit_events
      WHERE tenant_scope_id = ? AND event_type = 'security.alert.created' AND entity_id = ?`,
    [ownerA, String(alertId)]
  );
  assert.equal(createdEvents.length, 1, 'la création de l’alerte est journalisée une seule fois');

  const sixth = await request(app).post('/api/auth/login').send({
    email: account.email,
    password: 'toujours-faux'
  });
  assert.equal(sixth.status, 401);
  const [[updated]] = await pool.query(
    'SELECT occurrence_count FROM pro_security_alerts WHERE id = ? AND tenant_scope_id = ?',
    [alertId, ownerA]
  );
  assert.equal(Number(updated.occurrence_count), 6, 'les nouvelles tentatives enrichissent l’alerte existante');
});

test('API des alertes : permissions, cache et isolation stricte des tenants', async () => {
  const own = await request(app).get('/api/pro/security-alerts').set(auth(ownerAToken));
  assert.equal(own.status, 200, own.text);
  assert.equal(own.headers['cache-control'], 'no-store, max-age=0');
  assert.equal(own.body.alerts.length, 1);
  assert.equal(Number(own.body.alerts[0].id), alertId);
  assert.equal(own.body.alerts[0].case_id, null);

  const filtered = await request(app)
    .get('/api/pro/security-alerts?status=resolved')
    .set(auth(ownerAToken));
  assert.equal(filtered.status, 200, filtered.text);
  assert.equal(filtered.body.alerts.length, 0);

  const invalid = await request(app)
    .get('/api/pro/security-alerts?status=unknown')
    .set(auth(ownerAToken));
  assert.equal(invalid.status, 400);

  const otherTenant = await request(app).get('/api/pro/security-alerts').set(auth(ownerBToken));
  assert.equal(otherTenant.status, 200, otherTenant.text);
  assert.equal(otherTenant.body.alerts.length, 0);

  const denied = await request(app)
    .get('/api/pro/security-alerts')
    .set(auth(memberAToken))
    .set('X-SF-Company-Owner', String(ownerA));
  assert.equal(denied.status, 403, denied.text);
});

test('dossier d’investigation : création idempotente, transitions et historique immuable', async () => {
  const created = await request(app)
    .post('/api/pro/security-cases')
    .set(auth(ownerAToken))
    .send({ alert_id: alertId });
  assert.equal(created.status, 201, created.text);
  caseId = Number(created.body.id);
  assert.ok(caseId);
  assert.equal(created.body.status, 'open');

  const duplicate = await request(app)
    .post('/api/pro/security-cases')
    .set(auth(ownerAToken))
    .send({ alert_id: alertId });
  assert.equal(duplicate.status, 409, duplicate.text);
  assert.equal(Number(duplicate.body.case_id), caseId);

  const alertAfterCreate = await request(app)
    .get('/api/pro/security-alerts')
    .set(auth(ownerAToken));
  assert.equal(alertAfterCreate.body.alerts[0].status, 'investigating');
  assert.equal(Number(alertAfterCreate.body.alerts[0].case_id), caseId);

  const transition = await request(app)
    .put('/api/pro/security-cases/' + caseId + '/status')
    .set(auth(ownerAToken))
    .send({ status: 'investigating' });
  assert.equal(transition.status, 200, transition.text);
  assert.equal(transition.body.status, 'investigating');

  const resolved = await request(app)
    .put('/api/pro/security-cases/' + caseId + '/status')
    .set(auth(ownerAToken))
    .send({ status: 'resolved' });
  assert.equal(resolved.status, 200, resolved.text);
  assert.equal(resolved.body.status, 'resolved');

  const cases = await request(app).get('/api/pro/security-cases').set(auth(ownerAToken));
  assert.equal(cases.status, 200, cases.text);
  assert.equal(cases.body.cases.length, 1);
  assert.equal(cases.body.cases[0].status, 'resolved');

  const timeline = await request(app)
    .get('/api/pro/security-cases/' + caseId + '/events')
    .set(auth(ownerAToken));
  assert.equal(timeline.status, 200, timeline.text);
  assert.deepEqual(timeline.body.events.map(event => event.event_type), [
    'case.created', 'case.status_changed', 'case.status_changed'
  ]);
  assert.deepEqual(timeline.body.events.map(event => event.to_status), ['open', 'investigating', 'resolved']);

  const alertResolved = await request(app).get('/api/pro/security-alerts').set(auth(ownerAToken));
  assert.equal(alertResolved.body.alerts[0].status, 'resolved');

  const [historyRows] = await pool.query(
    'SELECT id FROM pro_security_case_events WHERE tenant_scope_id = ? AND case_id = ?',
    [ownerA, caseId]
  );
  assert.equal(historyRows.length, 3);
  await assert.rejects(
    () => pool.query('UPDATE pro_security_case_events SET to_status = ? WHERE id = ?', ['open', historyRows[0].id]),
    error => /append-only/i.test(String(error.sqlMessage || error.message))
  );
  await assert.rejects(
    () => pool.query('DELETE FROM pro_security_case_events WHERE id = ?', [historyRows[0].id]),
    error => /append-only/i.test(String(error.sqlMessage || error.message))
  );
});

test('les dossiers et leur historique restent invisibles hors du tenant propriétaire', async () => {
  const hiddenCase = await request(app)
    .get('/api/pro/security-cases')
    .set(auth(ownerBToken));
  assert.equal(hiddenCase.status, 200, hiddenCase.text);
  assert.equal(hiddenCase.body.cases.length, 0);

  const hiddenTimeline = await request(app)
    .get('/api/pro/security-cases/' + caseId + '/events')
    .set(auth(ownerBToken));
  assert.equal(hiddenTimeline.status, 404, hiddenTimeline.text);

  const forbiddenChange = await request(app)
    .put('/api/pro/security-alerts/' + alertId + '/status')
    .set(auth(memberAToken))
    .set('X-SF-Company-Owner', String(ownerA))
    .send({ status: 'dismissed', resolution_code: 'false_positive' });
  assert.equal(forbiddenChange.status, 403, forbiddenChange.text);
});
