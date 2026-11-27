'use strict';

process.env.AUDIT_LOG_HMAC_KEY = process.env.AUDIT_LOG_HMAC_KEY || 'test-only-audit-ledger-key-at-least-32-bytes';
process.env.AUDIT_LOG_HMAC_KEY_VERSION = process.env.AUDIT_LOG_HMAC_KEY_VERSION || '1';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
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

test('migration v25 : tables d’audit signées, triggers immuables et absence de FK vers users', async () => {
  const [tables] = await pool.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN ('pro_audit_events', 'pro_audit_chain_heads')`
  );
  assert.deepEqual(tables.map(row => row.TABLE_NAME).sort(), ['pro_audit_chain_heads', 'pro_audit_events']);

  const [triggers] = await pool.query(
    `SELECT TRIGGER_NAME FROM information_schema.TRIGGERS
     WHERE TRIGGER_SCHEMA = DATABASE()
       AND TRIGGER_NAME IN ('trg_pro_audit_events_block_update', 'trg_pro_audit_events_block_delete')`
  );
  assert.deepEqual(triggers.map(row => row.TRIGGER_NAME).sort(), [
    'trg_pro_audit_events_block_delete',
    'trg_pro_audit_events_block_update'
  ]);

  const [foreignKeys] = await pool.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pro_audit_events'
       AND REFERENCED_TABLE_NAME IS NOT NULL`
  );
  assert.equal(foreignKeys.length, 0, 'le cycle de vie d’un compte ne doit pas supprimer ses preuves d’audit');
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
      email: 'personne@example.test',
      iban: 'SN00TEST123456789',
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
  assert.equal(metadata.email, '[REDACTED]');
  assert.equal(metadata.iban, '[REDACTED]');
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

  // Un membre doté uniquement de audit.read peut consulter le registre mais ne peut pas exporter les données.
  await pool.query(
    'UPDATE pro_team_members SET permissions_json = ? WHERE owner_user_id = ? AND member_user_id = ?',
    [JSON.stringify(['audit.read']), ownerA, memberA]
  );
  const memberRead = await request(app)
    .get('/api/pro/audit-events')
    .set('Authorization', 'Bearer ' + memberAToken)
    .set('X-SF-Company-Owner', String(ownerA));
  assert.equal(memberRead.status, 200, memberRead.text);
  const memberExportDenied = await request(app)
    .get('/api/pro/audit-events/export.csv')
    .set('Authorization', 'Bearer ' + memberAToken)
    .set('X-SF-Company-Owner', String(ownerA));
  assert.equal(memberExportDenied.status, 403, memberExportDenied.text);

  const formulaValues = [
    { entityId: 'formula-first', userAgent: '=1+1' },
    { entityId: 'formula-space', userAgent: ' =2+2' },
    { entityId: 'formula-tab', userAgent: '\t=3+3' }
  ];
  for (const value of formulaValues) {
    const formulaEvent = await appendAuditEvent({
      tenantId: ownerA,
      actorUserId: ownerA,
      eventType: 'audit.test.export_formula',
      category: 'security',
      entityType: 'spreadsheet_formula_test',
      entityId: value.entityId,
      userAgent: value.userAgent,
      metadata: { note: 'CSV injection check' }
    });
    assert.ok(formulaEvent.id);
  }

  const csvExport = await request(app)
    .get('/api/pro/audit-events/export.csv?event_type=audit.test.export_formula')
    .set('Authorization', 'Bearer ' + ownerAToken);
  assert.equal(csvExport.status, 200, csvExport.text);
  assert.match(csvExport.headers['content-type'], /text\/csv/);
  assert.match(csvExport.headers['content-disposition'], /samafacture-registre-audit\.csv/);
  assert.equal(csvExport.headers['x-export-row-count'], '3');
  assert.ok(csvExport.text.includes("\"'=1+1\""), 'une formule en début de cellule doit être neutralisée');
  assert.ok(csvExport.text.includes("\"' =2+2\""), 'une formule précédée d’espaces doit être neutralisée');
  assert.ok(csvExport.text.includes("\"'\t=3+3\""), 'une formule précédée d’une tabulation doit être neutralisée');
  const allTenantExport = await request(app)
    .get('/api/pro/audit-events/export.csv')
    .set('Authorization', 'Bearer ' + ownerAToken);
  assert.equal(allTenantExport.status, 200, allTenantExport.text);
  assert.match(allTenantExport.text, /audit\.test\.export_formula/);
  assert.doesNotMatch(allTenantExport.text, /audit\.test\.tenant_b/,
    'l’export ne doit jamais inclure les événements d’une autre entreprise');

  const reversedDates = await request(app)
    .get('/api/pro/audit-events/export.csv?from=2026-11-27&to=2026-11-01')
    .set('Authorization', 'Bearer ' + ownerAToken);
  assert.equal(reversedDates.status, 400);

  const pdfExport = await request(app)
    .get('/api/pro/audit-events/export.pdf?event_type=audit.test.export_formula')
    .set('Authorization', 'Bearer ' + ownerAToken)
    .buffer(true)
    .parse((response, callback) => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => callback(null, Buffer.concat(chunks)));
    });
  assert.equal(pdfExport.status, 200, String(pdfExport.body || ''));
  assert.match(pdfExport.headers['content-type'], /application\/pdf/);
  assert.ok(Buffer.isBuffer(pdfExport.body));
  assert.equal(pdfExport.body.subarray(0, 5).toString('ascii'), '%PDF-');

  const [exportEvents] = await pool.query(
    "SELECT event_type, metadata_json FROM pro_audit_events WHERE tenant_scope_id = ? AND event_type = 'audit.events.exported'",
    [ownerA]
  );
  assert.ok(exportEvents.length >= 2, 'chaque export réussi doit être tracé');
  assert.equal(memberExportDenied.headers['content-disposition'], undefined);

  const memberLogout = await request(app)
    .post('/api/auth/logout')
    .set('Authorization', 'Bearer ' + memberAToken);
  assert.equal(memberLogout.status, 204, memberLogout.text);
  const [memberLogoutEvents] = await pool.query(
    "SELECT tenant_scope_id, actor_user_id FROM pro_audit_events WHERE event_type = 'auth.logout' AND actor_user_id = ?",
    [memberA]
  );
  assert.equal(memberLogoutEvents.length, 1);
  assert.equal(Number(memberLogoutEvents[0].tenant_scope_id), memberA,
    'la déconnexion doit rester rattachée au compte authentifié sur la route globale de session');
  
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

test('création, modification et suppression d’un client sont journalisées atomiquement', async () => {
  const created = await request(app)
    .post('/api/clients')
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({
      nom: 'Client cycle audit',
      email: 'contact-client-audit@example.test',
      telephone: '+221770000000'
    });
  assert.equal(created.status, 201, created.text);
  const clientId = Number(created.body.client.id);

  const updated = await request(app)
    .put('/api/clients/' + clientId)
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({ telephone: '+221780000000', notes: 'Mise à jour tracée' });
  assert.equal(updated.status, 200, updated.text);
  assert.equal(updated.body.client.telephone, '+221780000000');

  const deleted = await request(app)
    .delete('/api/clients/' + clientId)
    .set('Authorization', 'Bearer ' + ownerAToken);
  assert.equal(deleted.status, 200, deleted.text);

  const [events] = await pool.query(
    `SELECT event_type, entity_id, metadata_json
       FROM pro_audit_events
      WHERE tenant_scope_id = ? AND entity_type = 'client' AND entity_id = ?
      ORDER BY chain_sequence ASC`,
    [ownerA, String(clientId)]
  );
  assert.deepEqual(events.map(event => event.event_type), [
    'client.created', 'client.updated', 'client.deleted'
  ]);
  const updateMetadata = typeof events[1].metadata_json === 'string'
    ? JSON.parse(events[1].metadata_json)
    : events[1].metadata_json;
  assert.deepEqual(updateMetadata.changed_fields, ['telephone', 'notes']);
  assert.equal((await verifyAuditChain(ownerA)).valid, true);
});

test('création de facture et encaissement : audit atomique avec les opérations métier', async () => {
  const client = await request(app)
    .post('/api/clients')
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({ nom: 'Client audit financier' });
  assert.equal(client.status, 201, client.text);
  const clientId = Number(client.body.client.id);

  const clientUpdate = await request(app)
    .put('/api/clients/' + clientId)
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({ nom: 'Client audit financier mis à jour' });
  assert.equal(clientUpdate.status, 200, clientUpdate.text);

  const removableClient = await request(app)
    .post('/api/clients')
    .set('Authorization', 'Bearer ' + ownerAToken)
    .send({ nom: 'Client sans historique à supprimer' });
  assert.equal(removableClient.status, 201, removableClient.text);
  const clientDelete = await request(app)
    .delete('/api/clients/' + removableClient.body.client.id)
    .set('Authorization', 'Bearer ' + ownerAToken);
  assert.equal(clientDelete.status, 200, clientDelete.text);

  const [clientEvents] = await pool.query(
    "SELECT event_type, entity_id, metadata_json FROM pro_audit_events WHERE tenant_scope_id = ? AND event_type IN ('client.created', 'client.updated', 'client.deleted')",
    [ownerA]
  );
  assert.ok(clientEvents.some(event => event.event_type === 'client.created' && event.entity_id === String(clientId)));
  const updatedClientEvent = clientEvents.find(event =>
    event.event_type === 'client.updated' && event.entity_id === String(clientId)
  );
  assert.ok(updatedClientEvent);
  const updatedMetadata = typeof updatedClientEvent.metadata_json === 'string'
    ? JSON.parse(updatedClientEvent.metadata_json)
    : updatedClientEvent.metadata_json;
  assert.deepEqual(updatedMetadata.changed_fields, ['nom']);
  assert.ok(clientEvents.some(event =>
    event.event_type === 'client.deleted' && event.entity_id === String(removableClient.body.client.id)
  ));

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



test('inscription et événement signé sont atomiques si le registre refuse une écriture', async () => {
  const email = emailDeTest('audit-register-atomic');
  const envKeys = ['NODE_ENV', 'AUDIT_LOG_HMAC_KEY', 'AUDIT_LOG_HMAC_KEY_VERSION', 'AUDIT_LOG_HMAC_KEYRING', 'DATA_ENCRYPTION_KEY'];
  const original = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.AUDIT_LOG_HMAC_KEY;
    delete process.env.AUDIT_LOG_HMAC_KEYRING;
    delete process.env.DATA_ENCRYPTION_KEY;
    process.env.AUDIT_LOG_HMAC_KEY_VERSION = '1';

    const refused = await request(app)
      .post('/api/auth/register')
      .send({
        nom: 'Compte audit atomique',
        email,
        password: 'motdepasse123',
        acceptTerms: true,
        plan: 'standard'
      });
    assert.equal(refused.status, 500, refused.text);

    const [afterFailure] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    assert.equal(afterFailure.length, 0,
      'un défaut de configuration HMAC doit annuler la création du compte');

    // Une clé valide permet ensuite à la même inscription d'être validée avec sa preuve.
    process.env.NODE_ENV = 'test';
    process.env.AUDIT_LOG_HMAC_KEY = 'test-only-audit-ledger-key-at-least-32-bytes';
    const accepted = await request(app)
      .post('/api/auth/register')
      .send({
        nom: 'Compte audit atomique',
        email,
        password: 'motdepasse123',
        acceptTerms: true,
        plan: 'standard'
      });
    assert.equal(accepted.status, 201, accepted.text);
    const userId = Number(accepted.body.user.id);
    createdUsers.push(userId);

    const [events] = await pool.query(
      `SELECT id, event_type, actor_user_id
         FROM pro_audit_events
        WHERE tenant_scope_id = ? AND event_type = 'auth.account.registered'`,
      [userId]
    );
    assert.equal(events.length, 1);
    assert.equal(Number(events[0].actor_user_id), userId);
    assert.equal((await verifyAuditChain(userId)).valid, true);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('réinitialisation du mot de passe : journal et consommation du jeton atomiques', async () => {
  const account = await createAccount('audit-password-reset');
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await pool.query(
    'UPDATE users SET reset_token_hash = ?, reset_token_expires = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE id = ?',
    [tokenHash, account.id]
  );

  const reset = await request(app)
    .post('/api/auth/reinitialiser-mot-de-passe')
    .send({ token: rawToken, password: 'nouveau-motdepasse-123' });
  assert.equal(reset.status, 200, reset.text);

  const oldSession = await request(app)
    .get('/api/auth/me')
    .set('Authorization', 'Bearer ' + account.token);
  assert.equal(oldSession.status, 401, 'les sessions précédentes doivent être révoquées');

  const replay = await request(app)
    .post('/api/auth/reinitialiser-mot-de-passe')
    .send({ token: rawToken, password: 'autre-motdepasse-123' });
  assert.equal(replay.status, 400, 'le jeton de réinitialisation ne peut être utilisé qu’une fois');

  const [events] = await pool.query(
    `SELECT actor_user_id, actor_kind, event_type, metadata_json
       FROM pro_audit_events
      WHERE tenant_scope_id = ? AND event_type = 'auth.password_reset.completed'`,
    [account.id]
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].actor_user_id, null);
  assert.equal(events[0].actor_kind, 'anonymous');
  const metadata = typeof events[0].metadata_json === 'string'
    ? JSON.parse(events[0].metadata_json)
    : events[0].metadata_json;
  assert.equal(metadata.reset_method, 'email_token');
  assert.equal(metadata.sessions_revoked, true);
  assert.equal(JSON.stringify(metadata).includes(rawToken), false);
  assert.equal(JSON.stringify(metadata).includes(tokenHash), false);

  const login = await request(app).post('/api/auth/login').send({
    email: account.email,
    password: 'nouveau-motdepasse-123'
  });
  assert.equal(login.status, 200, login.text);
  assert.equal((await verifyAuditChain(account.id)).valid, true);
});

test('conversion et duplication de devis : chaque opération crée une preuve dans sa transaction', async () => {
  const account = await createAccount('audit-invoice-lifecycle');
  const client = await request(app)
    .post('/api/clients')
    .set('Authorization', 'Bearer ' + account.token)
    .send({ nom: 'Client audit cycle devis' });
  assert.equal(client.status, 201, client.text);

  const quote = await request(app)
    .post('/api/factures')
    .set('Authorization', 'Bearer ' + account.token)
    .send({
      client_id: client.body.client.id,
      type: 'devis',
      lignes: [{ designation: 'Prestation convertie', quantite: 1, prix_unitaire: 1500, tva: 0 }]
    });
  assert.equal(quote.status, 201, quote.text);

  const converted = await request(app)
    .post('/api/factures/' + quote.body.facture.id + '/transformer-en-facture')
    .set('Authorization', 'Bearer ' + account.token)
    .send({});
  assert.equal(converted.status, 200, converted.text);
  assert.equal(converted.body.facture.type, 'facture');

  const quoteToDuplicate = await request(app)
    .post('/api/factures')
    .set('Authorization', 'Bearer ' + account.token)
    .send({
      client_id: client.body.client.id,
      type: 'devis',
      lignes: [{ designation: 'Prestation à dupliquer', quantite: 2, prix_unitaire: 900, tva: 0 }]
    });
  assert.equal(quoteToDuplicate.status, 201, quoteToDuplicate.text);

  const duplicated = await request(app)
    .post('/api/factures/' + quoteToDuplicate.body.facture.id + '/dupliquer')
    .set('Authorization', 'Bearer ' + account.token)
    .send({});
  assert.equal(duplicated.status, 201, duplicated.text);

  const [conversionEvents] = await pool.query(
    `SELECT event_type, entity_id, metadata_json
       FROM pro_audit_events
      WHERE tenant_scope_id = ? AND event_type = 'invoice.converted_from_quote'`,
    [account.id]
  );
  assert.equal(conversionEvents.length, 1);
  assert.equal(conversionEvents[0].entity_id, String(quote.body.facture.id));

  const [duplicateEvents] = await pool.query(
    `SELECT event_type, entity_id, metadata_json
       FROM pro_audit_events
      WHERE tenant_scope_id = ? AND event_type = 'quote.duplicated'`,
    [account.id]
  );
  assert.equal(duplicateEvents.length, 1);
  assert.equal(duplicateEvents[0].entity_id, String(duplicated.body.facture.id));
  const duplicateMetadata = typeof duplicateEvents[0].metadata_json === 'string'
    ? JSON.parse(duplicateEvents[0].metadata_json)
    : duplicateEvents[0].metadata_json;
  assert.equal(Number(duplicateMetadata.source_document_id), Number(quoteToDuplicate.body.facture.id));
  assert.equal(duplicateMetadata.document_type, 'devis');
  assert.equal((await verifyAuditChain(account.id)).valid, true);
});

after(async () => {
  for (const userId of createdUsers) {
    await nettoyerUtilisateur(userId);
  }
  await teardownTestEnvironment();
});
