'use strict';

process.env.AUDIT_LOG_HMAC_KEY = process.env.AUDIT_LOG_HMAC_KEY || 'test-only-audit-ledger-key-at-least-32-bytes';
process.env.AUDIT_LOG_HMAC_KEY_VERSION = process.env.AUDIT_LOG_HMAC_KEY_VERSION || '1';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { appendAuditEvent } = require('../utils/audit-ledger');
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
let ownerC;
let ownerCToken;
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
  const c = await createAccount('security-alert-owner-c');
  const member = await createAccount('security-alert-member-a');
  ownerA = a.id;
  ownerAToken = a.token;
  ownerB = b.id;
  ownerBToken = b.token;
  ownerC = c.id;
  ownerCToken = c.token;
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

  const refreshed = await request(app).get('/api/pro/security-alerts').set(auth(ownerAToken));
  assert.equal(refreshed.status, 200, refreshed.text);
  assert.equal(
    refreshed.body.alerts[0].evidence.attempts_in_window,
    6,
    'la preuve exposée par l’API doit être recalculée après la sixième tentative, pas rester figée à la création'
  );
});

test('une facture très supérieure à l’historique comparable déclenche un signal explicable', async () => {
  async function recordInvoiceAudit(index, total, currency = 'XOF', documentType = 'facture') {
    return appendAuditEvent({
      tenantId: ownerC,
      actorUserId: ownerC,
      eventType: documentType === 'facture' ? 'invoice.created' : 'quote.created',
      category: 'billing',
      severity: 'info',
      entityType: documentType,
      entityId: String(20000 + index),
      outcome: 'success',
      metadata: {
        invoice_id: 20000 + index,
        document_type: documentType,
        total,
        currency,
        line_count: 1
      }
    });
  }

  // Dix-neuf observations XOF et une facture EUR ne suffisent pas à établir une référence XOF.
  for (let index = 0; index < 19; index += 1) {
    await recordInvoiceAudit(index, 10000, 'XOF');
  }
  await recordInvoiceAudit(19, 1000000, 'EUR');
  // Un montant élevé en XOF ne doit pas utiliser la facture EUR pour compléter l'échantillon.
  await recordInvoiceAudit(20, 75000, 'XOF');
  const [[beforeMinimum]] = await pool.query(
    'SELECT COUNT(*) AS total FROM pro_security_alerts WHERE tenant_scope_id = ?',
    [ownerC]
  );
  assert.equal(Number(beforeMinimum.total), 0);

  // La vingtième facture XOF complète la référence, sans alerte sur un montant normal.
  await recordInvoiceAudit(21, 10000, 'XOF');
  // Un devis très élevé n'entre pas dans la référence des factures.
  await recordInvoiceAudit(22, 250000, 'XOF', 'devis');

  const unusual = await recordInvoiceAudit(23, 75000, 'XOF');
  assert.ok(unusual.id);

  const [alerts] = await pool.query(
    'SELECT id, rule_code, severity, status, source_event_id, occurrence_count FROM pro_security_alerts WHERE tenant_scope_id = ?',
    [ownerC]
  );
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].rule_code, 'billing.invoice.amount_outlier');
  assert.equal(alerts[0].severity, 'medium');
  assert.equal(alerts[0].status, 'open');
  assert.equal(Number(alerts[0].source_event_id), unusual.id);
  assert.equal(Number(alerts[0].occurrence_count), 1);

  const [signedAlerts] = await pool.query(
    `SELECT metadata_json FROM pro_audit_events
      WHERE tenant_scope_id = ? AND event_type = 'security.alert.created' AND entity_id = ?`,
    [ownerC, String(alerts[0].id)]
  );
  assert.equal(signedAlerts.length, 1);
  const evidence = typeof signedAlerts[0].metadata_json === 'string'
    ? JSON.parse(signedAlerts[0].metadata_json)
    : signedAlerts[0].metadata_json;
  assert.equal(evidence.rule_code, 'billing.invoice.amount_outlier');
  assert.equal(Number(evidence.observed_amount), 75000);
  assert.equal(Number(evidence.historical_median), 10000);
  assert.equal(evidence.currency, 'XOF');
  assert.equal(Number(evidence.sample_size), 21);
  assert.equal(Number(evidence.multiplier), 5);

  const createdCase = await request(app)
    .post('/api/pro/security-cases')
    .set(auth(ownerCToken))
    .send({ alert_id: Number(alerts[0].id) });
  assert.equal(createdCase.status, 201, createdCase.text);
  const [caseAuditRows] = await pool.query(
    `SELECT metadata_json FROM pro_audit_events
      WHERE tenant_scope_id = ? AND event_type = 'security.case.created' AND entity_id = ?`,
    [ownerC, String(createdCase.body.id)]
  );
  assert.equal(caseAuditRows.length, 1);
  const caseMetadata = typeof caseAuditRows[0].metadata_json === 'string'
    ? JSON.parse(caseAuditRows[0].metadata_json)
    : caseAuditRows[0].metadata_json;
  assert.equal(caseMetadata.source_event_type, 'invoice.created');
  assert.equal(caseMetadata.rule_code, 'billing.invoice.amount_outlier');

  const visible = await request(app).get('/api/pro/security-alerts').set(auth(ownerCToken));
  assert.equal(visible.status, 200, visible.text);
  assert.equal(visible.body.alerts.length, 1);
  assert.equal(visible.body.alerts[0].rule_code, 'billing.invoice.amount_outlier');
  assert.deepEqual(visible.body.alerts[0].evidence, {
    observed_amount: 75000,
    historical_median: 10000,
    currency: 'XOF',
    sample_size: 21,
    multiplier: 5
  });
});

test('API des alertes : permissions, cache et isolation stricte des tenants', async () => {
  const own = await request(app).get('/api/pro/security-alerts').set(auth(ownerAToken));
  assert.equal(own.status, 200, own.text);
  assert.equal(own.headers['cache-control'], 'no-store, max-age=0');
  assert.equal(own.body.alerts.length, 1);
  assert.equal(Number(own.body.alerts[0].id), alertId);
  assert.equal(own.body.alerts[0].case_id, null);
  assert.equal(own.body.alerts[0].evidence.attempts_in_window, 6);
  assert.deepEqual(Object.keys(own.body.alerts[0].evidence), ['attempts_in_window']);

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

test('un dossier ne peut pas être ouvert sur une alerte résolue ou écartée', async () => {
  for (const [index, status, resolutionCode] of [
    [1, 'resolved', 'mitigated'],
    [2, 'dismissed', 'false_positive']
  ]) {
    const fingerprint = String(index).repeat(64);
    const [insert] = await pool.query(
      `INSERT INTO pro_security_alerts
        (tenant_scope_id, tenant_id, rule_code, fingerprint, severity, status, title, summary,
         source_event_type, first_seen_at, last_seen_at, occurrence_count)
       VALUES (?, ?, 'auth.login.failed.threshold', ?, 'high', 'open', ?, ?, 'auth.login.failed',
               UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 5)`,
      [ownerB, ownerB, fingerprint, 'Alerte de test ' + status, 'Alerte synthétique de test']
    );
    const closedAlertId = Number(insert.insertId);

    const closed = await request(app)
      .put('/api/pro/security-alerts/' + closedAlertId + '/status')
      .set(auth(ownerBToken))
      .send({ status, resolution_code: resolutionCode });
    assert.equal(closed.status, 200, closed.text);
    assert.equal(closed.body.status, status);

    const attemptedCase = await request(app)
      .post('/api/pro/security-cases')
      .set(auth(ownerBToken))
      .send({ alert_id: closedAlertId });
    assert.equal(attemptedCase.status, 409, attemptedCase.text);
    assert.match(attemptedCase.body.error, /alerte résolue ou écartée/i);

    const [[storedAlert]] = await pool.query(
      'SELECT status FROM pro_security_alerts WHERE id = ? AND tenant_scope_id = ?',
      [closedAlertId, ownerB]
    );
    assert.equal(storedAlert.status, status, 'la création du dossier ne doit pas rouvrir implicitement l’alerte');

    const [[caseCount]] = await pool.query(
      'SELECT COUNT(*) AS total FROM pro_security_cases WHERE tenant_scope_id = ? AND source_alert_id = ?',
      [ownerB, closedAlertId]
    );
    assert.equal(Number(caseCount.total), 0);
  }
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

  const resetAlertWhileCaseActive = await request(app)
    .put('/api/pro/security-alerts/' + alertId + '/status')
    .set(auth(ownerAToken))
    .send({ status: 'open' });
  assert.equal(resetAlertWhileCaseActive.status, 409, resetAlertWhileCaseActive.text);
  assert.match(resetAlertWhileCaseActive.body.error, /dossier d’investigation actif/i);
  const alertStillInvestigating = await request(app)
    .get('/api/pro/security-alerts')
    .set(auth(ownerAToken));
  assert.equal(alertStillInvestigating.body.alerts[0].status, 'investigating');

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
  const [[resolvedAlertRecord]] = await pool.query(
    'SELECT status, resolution_code FROM pro_security_alerts WHERE id = ? AND tenant_scope_id = ?',
    [alertId, ownerA]
  );
  assert.equal(resolvedAlertRecord.status, 'resolved');
  assert.equal(resolvedAlertRecord.resolution_code, 'mitigated');

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

  const missingResolutionCode = await request(app)
    .put('/api/pro/security-alerts/' + alertId + '/status')
    .set(auth(ownerAToken))
    .send({ status: 'dismissed' });
  assert.equal(missingResolutionCode.status, 400, missingResolutionCode.text);

  const manualReopen = await request(app)
    .put('/api/pro/security-alerts/' + alertId + '/status')
    .set(auth(ownerAToken))
    .send({ status: 'open' });
  assert.equal(manualReopen.status, 409, manualReopen.text);

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

  // Un nouveau signal après résolution doit rouvrir l'alerte et le dossier associé.
  await appendAuditEvent({
    tenantId: ownerA,
    actorUserId: null,
    actorKind: 'anonymous',
    eventType: 'auth.login.failed',
    category: 'security',
    severity: 'medium',
    entityType: 'account',
    entityId: String(ownerA),
    outcome: 'failure',
    metadata: { auth_method: 'password', reason: 'invalid_credentials' }
  });

  const reopenedAlert = await request(app).get('/api/pro/security-alerts').set(auth(ownerAToken));
  assert.equal(reopenedAlert.status, 200, reopenedAlert.text);
  assert.equal(reopenedAlert.body.alerts[0].status, 'open');
  assert.equal(Number(reopenedAlert.body.alerts[0].occurrence_count), 7);
  assert.equal(Number(reopenedAlert.body.alerts[0].case_id), caseId);

  const reopenedCase = await request(app).get('/api/pro/security-cases').set(auth(ownerAToken));
  assert.equal(reopenedCase.status, 200, reopenedCase.text);
  assert.equal(reopenedCase.body.cases[0].status, 'open');

  const reopenedTimeline = await request(app)
    .get('/api/pro/security-cases/' + caseId + '/events')
    .set(auth(ownerAToken));
  assert.equal(reopenedTimeline.status, 200, reopenedTimeline.text);
  assert.equal(reopenedTimeline.body.events.at(-1).event_type, 'case.reopened');
  assert.equal(reopenedTimeline.body.events.at(-1).from_status, 'resolved');
  assert.equal(reopenedTimeline.body.events.at(-1).to_status, 'open');

  const [reopenAuditEvents] = await pool.query(
    `SELECT metadata_json FROM pro_audit_events
      WHERE tenant_scope_id = ? AND event_type = 'security.alert.reopened' AND entity_id = ?`,
    [ownerA, String(alertId)]
  );
  assert.equal(reopenAuditEvents.length, 1);
  const reopenMetadata = typeof reopenAuditEvents[0].metadata_json === 'string'
    ? JSON.parse(reopenAuditEvents[0].metadata_json)
    : reopenAuditEvents[0].metadata_json;
  assert.equal(Number(reopenMetadata.case_id), caseId);
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
