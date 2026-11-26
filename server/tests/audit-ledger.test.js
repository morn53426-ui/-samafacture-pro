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
const { appendAuditEvent, verifyAuditChain } = require('../utils/audit-ledger');

let ownerA;
let ownerB;
let memberA;
let ownerAToken;
let ownerBToken;
let ownerBEmail;
let memberAToken;
let firstEventId;
const createdUsers = [];

async function createAccount(prefix) {
  // Fixtures neutres : les tests de migration vérifient l'absence d'essais
  // rétroactifs dans toute la base. Ne pas créer ici d'essai public de 15 jours.
  const email = emailDeTest(prefix);
  const passwordHash = await bcrypt.hash('motdepasse123', 10);
  const [insert] = await pool.query(
    `INSERT INTO users (nom, email, password_hash, entreprise_nom, plan, trial_status)
     VALUES (?, ?, ?, ?, 'gratuit', 'not_started')`,
    ['Audit test', email, passwordHash, 'Entreprise audit ' + prefix]
  );
  const id = Number(insert.insertId);
  createdUsers.push(id);

  const login = await request(app).post('/api/auth/login').send({
    email,
    password: 'motdepasse123'
  });
  assert.equal(login.status, 200, login.text);
  return { id, token: login.body.token, email };
}

before(async () => {
  await setupTestDatabase();
  const a = await createAccount('audit-ledger-owner-a');
  const b = await createAccount('audit-ledger-owner-b');
  const member = await createAccount('audit-ledger-member-a');
  ownerA = a.id;
  ownerAToken = a.token;
  ownerB = b.id;
  ownerBToken = b.token;
  ownerBEmail = b.email;
  memberA = member.id;
  memberAToken = member.token;

  await pool.query(
    'INSERT INTO pro_team_members (owner_user_id, member_user_id, role, permissions_json, active) VALUES (?, ?, ?, ?, 1)',
    [ownerA, memberA, 'lecture_seule', JSON.stringify(['clients.read'])]
  );
});

test('journal signé : redaction des secrets, concurrence et intégrité de la chaîne', async () => {
  const pendingConnection = await pool.getConnection();
  let rolledBackId;
  try {
    await pendingConnection.beginTransaction();
    const pending = await appendAuditEvent({
      tenantId: ownerA,
      actorUserId: ownerA,
      eventType: 'audit.test.rolled_back',
      category: 'security',
      metadata: { transaction: 'rollback' }
    }, pendingConnection);
    rolledBackId = pending.id;
    await pendingConnection.rollback();
  } finally {
    pendingConnection.release();
  }
  const [rolledBackRows] = await pool.query('SELECT id FROM pro_audit_events WHERE id = ?', [rolledBackId]);
  assert.equal(rolledBackRows.length, 0, 'un rollback métier doit aussi annuler son événement d’audit');

  const first = await appendAuditEvent({
    tenantId: ownerA,
    actorUserId: ownerA,
    eventType: 'audit.test.created',
    category: 'security',
    severity: 'info',
    entityType: 'invoice',
    entityId: 'INV-AUDIT-1',
    metadata: {
      invoice_id: 42,
      password: 'ne-doit-pas-etre-stocke',
      apiKey: 'ne-doit-pas-etre-stocke',
      bearer_note: 'Bearer secret-value-ne-doit-pas-etre-stocke',
      reference: 'opération de test'
    }
  });
  firstEventId = first.id;

  const concurrent = await Promise.all(Array.from({ length: 6 }, (_, index) =>
    appendAuditEvent({
      tenantId: ownerA,
      actorUserId: ownerA,
      eventType: 'audit.test.concurrent',
      category: 'security',
      metadata: { index }
    })
  ));
  const sequences = [first.sequence, ...concurrent.map(item => item.sequence)].sort((a, b) => a - b);
  assert.deepEqual(sequences, [2, 3, 4, 5, 6, 7, 8], 'les écritures concurrentes doivent recevoir une séquence continue après l’événement d’inscription');

  const [storedRows] = await pool.query(
    'SELECT metadata_json FROM pro_audit_events WHERE id = ? AND tenant_scope_id = ?',
    [first.id, ownerA]
  );
  const metadata = typeof storedRows[0].metadata_json === 'string'
    ? JSON.parse(storedRows[0].metadata_json)
    : storedRows[0].metadata_json;
  assert.equal(metadata.password, '[REDACTED]');
  assert.equal(metadata.apiKey, '[REDACTED]');
  assert.equal(metadata.bearer_note, 'Bearer [REDACTED]');
  assert.equal(metadata.invoice_id, 42);

  const integrity = await verifyAuditChain(ownerA);
  assert.equal(integrity.valid, true, JSON.stringify(integrity));
  assert.equal(integrity.checked, 8);
});

test('les événements sont immuables au niveau SQL', async () => {
  assert.ok(firstEventId);
  await assert.rejects(
    () => pool.query('UPDATE pro_audit_events SET outcome = ? WHERE id = ?', ['failure', firstEventId]),
    err => /append-only/i.test(String(err.sqlMessage || err.message))
  );
  await assert.rejects(
    () => pool.query('DELETE FROM pro_audit_events WHERE id = ?', [firstEventId]),
    err => /append-only/i.test(String(err.sqlMessage || err.message))
  );
  const integrity = await verifyAuditChain(ownerA);
  assert.equal(integrity.valid, true, JSON.stringify(integrity));
});

test('API audit : pagination, filtres, vérification et isolation stricte des tenants', async () => {
  const filtered = await request(app)
    .get('/api/pro/audit-events?event_type=audit.test.created&limit=10')
    .set('Authorization', 'Bearer ' + ownerAToken);
  assert.equal(filtered.status, 200, filtered.text);
  assert.equal(filtered.body.pagination.total, 1);
  assert.equal(filtered.body.events[0].event_type, 'audit.test.created');
  assert.equal(filtered.body.events[0].metadata.password, '[REDACTED]');

  const invalid = await request(app)
    .get('/api/pro/audit-events?page=0&limit=1000')
    .set('Authorization', 'Bearer ' + ownerAToken);
  assert.equal(invalid.status, 400);

  const integrity = await request(app)
    .get('/api/pro/audit-events/integrity')
    .set('Authorization', 'Bearer ' + ownerAToken);
  assert.equal(integrity.status, 200, integrity.text);
  assert.equal(integrity.body.valid, true);
  assert.ok(integrity.body.checked >= 10);

  const memberForbidden = await request(app)
    .get('/api/pro/audit-events')
    .set('Authorization', 'Bearer ' + memberAToken)
    .set('X-SF-Company-Owner', String(ownerA));
  assert.equal(memberForbidden.status, 403, memberForbidden.text);

  const tenantB = await appendAuditEvent({
    tenantId: ownerB,
    actorUserId: ownerB,
    eventType: 'audit.test.tenant_b',
    category: 'security'
  });
  assert.ok(tenantB.id);
  const tenantBRead = await request(app)
    .get('/api/pro/audit-events')
    .set('Authorization', 'Bearer ' + ownerBToken);
  assert.equal(tenantBRead.status, 200, tenantBRead.text);
  assert.ok(tenantBRead.body.events.some(event => event.event_type === 'audit.test.tenant_b'));
  assert.equal(tenantBRead.body.events.some(event => event.event_type === 'audit.test.created'), false);

  const failedLogin = await request(app).post('/api/auth/login').send({
    email: ownerBEmail,
    password: 'mot-de-passe-volontairement-incorrect'
  });
  assert.equal(failedLogin.status, 401);

  const successfulLogin = await request(app).post('/api/auth/login').send({
    email: ownerBEmail,
    password: 'motdepasse123'
  });
  assert.equal(successfulLogin.status, 200, successfulLogin.text);
  const logout = await request(app)
    .post('/api/auth/logout')
    .set('Authorization', 'Bearer ' + successfulLogin.body.token);
  assert.equal(logout.status, 204, logout.text);

  const [authEvents] = await pool.query(
    'SELECT event_type, outcome FROM pro_audit_events WHERE tenant_scope_id = ? ORDER BY chain_sequence',
    [ownerB]
  );
  assert.ok(authEvents.some(event => event.event_type === 'auth.login.failed' && event.outcome === 'failure'));
  assert.ok(authEvents.some(event => event.event_type === 'auth.login.succeeded' && event.outcome === 'success'));
  assert.ok(authEvents.some(event => event.event_type === 'auth.logout' && event.outcome === 'success'));
  const tenantBIntegrity = await verifyAuditChain(ownerB);
  assert.equal(tenantBIntegrity.valid, true, JSON.stringify(tenantBIntegrity));
});

test('création de facture et encaissement : audit atomique avec les opérations métier', async () => {
  const client = await request(app)
    .post('/api/clients')
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({ nom: 'Client audit financier' });
  assert.equal(client.status, 201, client.text);

  const created = await request(app)
    .post('/api/factures')
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({
      client_id: client.body.client.id,
      type: 'facture',
      lignes: [{ designation: 'Prestation audit', quantite: 1, prix_unitaire: 1250, tva: 0 }]
    });
  assert.equal(created.status, 201, created.text);
  const invoice = created.body.facture;
  assert.ok(invoice.id);

  const [createdEvents] = await pool.query(
    'SELECT event_type, entity_id, metadata_json FROM pro_audit_events WHERE tenant_scope_id = ? AND entity_id = ?',
    [ownerA, String(invoice.id)]
  );
  assert.ok(createdEvents.some(event => event.event_type === 'invoice.created'));

  const payment = await request(app)
    .post('/api/factures/' + invoice.id + '/paiements')
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({ montant: invoice.total, methode: 'Espèces', reference: 'audit-ledger-test' });
  assert.equal(payment.status, 201, payment.text);

  const [paymentEvents] = await pool.query(
    "SELECT event_type, entity_id FROM pro_audit_events WHERE tenant_scope_id = ? AND event_type = 'payment.received'",
    [ownerA]
  );
  assert.equal(paymentEvents.length, 1);
  const integrity = await verifyAuditChain(ownerA);
  assert.equal(integrity.valid, true, JSON.stringify(integrity));
});

after(async () => {
  for (const userId of createdUsers) {
    await nettoyerUtilisateur(userId);
  }
  await teardownTestEnvironment();
});
