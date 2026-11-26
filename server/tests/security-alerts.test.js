'use strict';

process.env.AUDIT_LOG_HMAC_KEY = process.env.AUDIT_LOG_HMAC_KEY || 'test-only-security-alerts-key-at-least-32-bytes';
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
const { verifyAuditChain } = require('../utils/audit-ledger');

let ownerA;
let ownerB;
let memberA;
let ownerAToken;
let ownerAEmail;
let ownerBToken;
let memberAToken;
let alertId;
let investigationId;
const createdUsers = [];

async function createAccount(prefix) {
  const email = emailDeTest(prefix);
  const passwordHash = await bcrypt.hash('motdepasse123', 10);
  const [insert] = await pool.query(
    `INSERT INTO users (nom, email, password_hash, entreprise_nom, plan, trial_status)
     VALUES (?, ?, ?, ?, 'gratuit', 'not_started')`,
    ['Security test', email, passwordHash, 'Entreprise sécurité ' + prefix]
  );
  const id = Number(insert.insertId);
  createdUsers.push(id);
  const login = await request(app).post('/api/auth/login').send({ email, password: 'motdepasse123' });
  assert.equal(login.status, 200, login.text);
  return { id, email, token: login.body.token };
}

before(async () => {
  await setupTestDatabase();
  const a = await createAccount('security-alert-owner-a');
  const b = await createAccount('security-alert-owner-b');
  const member = await createAccount('security-alert-member-a');
  ownerA = a.id;
  ownerAToken = a.token;
  ownerAEmail = a.email;
  ownerB = b.id;
  ownerBToken = b.token;
  memberA = member.id;
  memberAToken = member.token;

  await pool.query(
    'INSERT INTO pro_team_members (owner_user_id, member_user_id, role, permissions_json, active) VALUES (?, ?, ?, ?, 1)',
    [ownerA, memberA, 'personnalise', JSON.stringify(['team.read', 'security.alerts.read', 'security.investigations.read'])]
  );
});

test('migration v26 : tables d’alertes, investigations et activité append-only', async () => {
  const expected = [
    'pro_security_alerts',
    'pro_security_investigations',
    'pro_security_case_activity'
  ];
  const [tables] = await pool.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?, ?)`,
    expected
  );
  assert.deepEqual(tables.map(row => row.TABLE_NAME).sort(), [...expected].sort());

  const [triggers] = await pool.query(
    `SELECT TRIGGER_NAME FROM information_schema.TRIGGERS
      WHERE TRIGGER_SCHEMA = DATABASE()
        AND TRIGGER_NAME IN ('trg_pro_security_case_activity_block_update', 'trg_pro_security_case_activity_block_delete')`
  );
  assert.deepEqual(triggers.map(row => row.TRIGGER_NAME).sort(), [
    'trg_pro_security_case_activity_block_delete',
    'trg_pro_security_case_activity_block_update'
  ]);

  const [foreignKeys] = await pool.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (?, ?, ?)
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
    expected
  );
  assert.equal(foreignKeys.length, 0, 'les preuves de sécurité doivent survivre au cycle de vie des comptes');
});

test('cinq échecs de connexion en quinze minutes créent une alerte dédupliquée', async () => {
  for (let i = 0; i < 5; i++) {
    const failed = await request(app).post('/api/auth/login').send({
      email: ownerAEmail,
      password: 'mot-de-passe-incorrect'
    });
    assert.equal(failed.status, 401, failed.text);
  }

  let [rows] = await pool.query(
    "SELECT id, severity, status, occurrences, alert_type FROM pro_security_alerts WHERE tenant_scope_id = ? AND alert_type = 'auth.failed_login_burst'",
    [ownerA]
  );
  assert.equal(rows.length, 1);
  alertId = Number(rows[0].id);
  assert.equal(rows[0].severity, 'high');
  assert.equal(rows[0].status, 'open');
  assert.equal(Number(rows[0].occurrences), 1);

  const sixth = await request(app).post('/api/auth/login').send({
    email: ownerAEmail,
    password: 'mot-de-passe-incorrect'
  });
  assert.equal(sixth.status, 401, sixth.text);
  [rows] = await pool.query(
    'SELECT id, occurrences FROM pro_security_alerts WHERE tenant_scope_id = ? AND id = ?',
    [ownerA, alertId]
  );
  assert.equal(Number(rows[0].occurrences), 2, 'les signaux récurrents doivent mettre à jour l’alerte existante');
});

test('API alertes : isolation tenant, lecture membre et triage autorisé', async () => {
  const list = await request(app)
    .get('/api/pro/security/alerts?limit=20')
    .set('Authorization', 'Bearer ' + ownerAToken);
  assert.equal(list.status, 200, list.text);
  assert.ok(list.body.alerts.some(alert => Number(alert.id) === alertId));

  const tenantBList = await request(app)
    .get('/api/pro/security/alerts')
    .set('Authorization', 'Bearer ' + ownerBToken);
  assert.equal(tenantBList.status, 200, tenantBList.text);
  assert.equal(tenantBList.body.alerts.length, 0);

  const crossTenantDetail = await request(app)
    .get('/api/pro/security/alerts/' + alertId)
    .set('Authorization', 'Bearer ' + ownerBToken);
  assert.equal(crossTenantDetail.status, 404);

  const invalidAlertId = await request(app)
    .get('/api/pro/security/alerts/not-a-number')
    .set('Authorization', 'Bearer ' + ownerAToken);
  assert.equal(invalidAlertId.status, 400);

  const memberHeaders = {
    Authorization: 'Bearer ' + memberAToken,
    'X-SF-Company-Owner': String(ownerA)
  };
  const assigneeList = await request(app)
    .get('/api/pro/security/assignees')
    .set(memberHeaders);
  assert.equal(assigneeList.status, 200, assigneeList.text);
  assert.ok(assigneeList.body.assignees.some(person => Number(person.id) === ownerA));
  assert.ok(assigneeList.body.assignees.some(person => Number(person.id) === memberA));
  assert.equal(assigneeList.body.assignees.some(person => Number(person.id) === ownerB), false,
    'la liste des responsables ne doit pas divulguer les membres d’un autre tenant');
  const resolveWithoutNote = await request(app)
    .post('/api/pro/security/alerts/' + alertId + '/resolve')
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({});
  assert.equal(resolveWithoutNote.status, 400, resolveWithoutNote.text);
  const memberTeamRead = await request(app)
    .get('/api/pro/team')
    .set(memberHeaders);
  assert.equal(memberTeamRead.status, 200, memberTeamRead.text,
    'le routeur sécurité ne doit pas bloquer les autres routes professionnelles');

  const memberRead = await request(app).get('/api/pro/security/alerts').set(memberHeaders);
  assert.equal(memberRead.status, 200, memberRead.text);
  const memberMutation = await request(app)
    .post('/api/pro/security/alerts/' + alertId + '/acknowledge')
    .set(memberHeaders)
    .send({});
  assert.equal(memberMutation.status, 403, memberMutation.text);

  const foreignAssignee = await request(app)
    .post('/api/pro/security/alerts/' + alertId + '/assign')
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({ assigned_to_user_id: ownerB });
  assert.equal(foreignAssignee.status, 400, foreignAssignee.text);

  const acknowledged = await request(app)
    .post('/api/pro/security/alerts/' + alertId + '/acknowledge')
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({});
  assert.equal(acknowledged.status, 200, acknowledged.text);
  assert.equal(acknowledged.body.alert.status, 'acknowledged');

  const assigned = await request(app)
    .post('/api/pro/security/alerts/' + alertId + '/assign')
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({ assigned_to_user_id: memberA });
  assert.equal(assigned.status, 200, assigned.text);
  assert.equal(Number(assigned.body.alert.assigned_to_user_id), memberA);
});

test('investigation : création liée, notes filtrées, changement de statut et clôture tracée', async () => {
  const created = await request(app)
    .post('/api/pro/security/investigations')
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({
      alert_id: alertId,
      title: 'Analyse des échecs répétés',
      description: 'Vérifier l’activité et confirmer l’origine des tentatives.',
      priority: 'high',
      assigned_to_user_id: memberA
    });
  assert.equal(created.status, 201, created.text);
  investigationId = Number(created.body.investigation.id);
  assert.match(created.body.investigation.reference, /^INV-\d{4}-[A-F0-9]{8}$/);
  assert.equal(created.body.investigation.status, 'open');
  assert.equal(Number(created.body.investigation.assigned_to_user_id), memberA);

  const prematureAlertClose = await request(app)
    .post('/api/pro/security/alerts/' + alertId + '/resolve')
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({ resolution_note: 'Clôture prématurée du dossier test.' });
  assert.equal(prematureAlertClose.status, 409, prematureAlertClose.text);

  const reassigned = await request(app)
    .patch('/api/pro/security/investigations/' + investigationId)
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({ assigned_to_user_id: ownerA });
  assert.equal(reassigned.status, 200, reassigned.text);
  assert.equal(Number(reassigned.body.investigation.assigned_to_user_id), ownerA);

  const duplicate = await request(app)
    .post('/api/pro/security/investigations')
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({ alert_id: alertId, title: 'Deuxième dossier' });
  assert.equal(duplicate.status, 409);

  const [alertRows] = await pool.query(
    'SELECT status FROM pro_security_alerts WHERE tenant_scope_id = ? AND id = ?',
    [ownerA, alertId]
  );
  assert.equal(alertRows[0].status, 'investigating');

  const note = await request(app)
    .post('/api/pro/security/investigations/' + investigationId + '/notes')
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({ note: 'Analyse réalisée avec contact test@example.test, IBAN SN12345678901234567890, jeton Bearer abc.def_ghi et carte 4111111111111111.' });
  assert.equal(note.status, 201, note.text);
  assert.match(note.body.activity.details.note, /\[EMAIL MASQUÉ\]/);
  assert.match(note.body.activity.details.note, /\[IBAN MASQUÉ\]/);
  assert.match(note.body.activity.details.note, /\[JETON MASQUÉ\]/);
  assert.match(note.body.activity.details.note, /\[NUMÉRO DE CARTE MASQUÉ\]/);

  const invalidAssignee = await request(app)
    .patch('/api/pro/security/investigations/' + investigationId)
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({ assigned_to_user_id: 0 });
  assert.equal(invalidAssignee.status, 400, invalidAssignee.text);

  const updated = await request(app)
    .patch('/api/pro/security/investigations/' + investigationId)
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({ status: 'in_progress', priority: 'critical' });
  assert.equal(updated.status, 200, updated.text);
  assert.equal(updated.body.investigation.status, 'in_progress');
  assert.equal(updated.body.investigation.priority, 'critical');

  const invalidClose = await request(app)
    .patch('/api/pro/security/investigations/' + investigationId)
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({ status: 'closed' });
  assert.equal(invalidClose.status, 400);

  const closed = await request(app)
    .patch('/api/pro/security/investigations/' + investigationId)
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({ status: 'closed', resolution_note: 'Les échecs répétés ont été examinés et les accès contrôlés.' });
  assert.equal(closed.status, 200, closed.text);
  assert.equal(closed.body.investigation.status, 'closed');

  const [activities] = await pool.query(
    'SELECT activity_type FROM pro_security_case_activity WHERE tenant_scope_id = ? AND investigation_id = ? ORDER BY id',
    [ownerA, investigationId]
  );
  assert.ok(activities.some(item => item.activity_type === 'investigation.created'));
  assert.ok(activities.some(item => item.activity_type === 'investigation.note_added'));
  assert.ok(activities.some(item => item.activity_type === 'investigation.updated'));

  const [resolvedAlert] = await pool.query(
    'SELECT status FROM pro_security_alerts WHERE tenant_scope_id = ? AND id = ?',
    [ownerA, alertId]
  );
  assert.equal(resolvedAlert[0].status, 'resolved');

  await assert.rejects(
    pool.query('UPDATE pro_security_case_activity SET activity_type = activity_type WHERE id = (SELECT id FROM (SELECT id FROM pro_security_case_activity WHERE investigation_id = ? LIMIT 1) AS activity)', [investigationId]),
    /append-only/
  );

  const detail = await request(app)
    .get('/api/pro/security/investigations/' + investigationId)
    .set('Authorization', 'Bearer ' + ownerAToken);
  assert.equal(detail.status, 200, detail.text);
  assert.ok(detail.body.activity.length >= 3);

  const integrity = await verifyAuditChain(ownerA);
  assert.equal(integrity.valid, true, JSON.stringify(integrity));
});

after(async () => {
  for (const userId of createdUsers) {
    await nettoyerUtilisateur(userId);
  }
  await teardownTestEnvironment();
});
