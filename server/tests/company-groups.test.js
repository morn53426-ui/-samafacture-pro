const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { decryptEmailPayload } = require('../utils/email-outbox-crypto');
const { dispatchPendingEmails } = require('../email-outbox');
const {
  app,
  pool,
  setupTestDatabase,
  emailDeTest,
  nettoyerUtilisateur,
  teardownTestEnvironment
} = require('./setup');

let groupOwnerId;
let subsidiaryOwnerId;
let outsiderId;
let starterId;
let groupOwnerToken;
let subsidiaryToken;
let outsiderToken;
let starterToken;
let subsidiaryClientId;

async function register(prefix, companyName) {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      nom: companyName,
      email: emailDeTest(prefix),
      password: 'motdepasse123',
      entreprise_nom: companyName,
      acceptTerms: true
    });
  assert.equal(response.status, 201, response.text);
  return response.body;
}


function runMigrationInNewProcess() {
  const script = [
    "const { initDatabase, pool } = require('./config/db');",
    "initDatabase()",
    "  .then(() => pool.end())",
    "  .then(() => process.exit(0))",
    "  .catch((err) => { console.error(err); process.exit(1); });"
  ].join("\n");
  return spawnSync(process.execPath, ['-e', script], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'test' },
    encoding: 'utf8',
    timeout: 45000
  });
}


before(async () => {
  await setupTestDatabase();

  const groupOwner = await register('group-owner', 'Groupe Sénégal');
  groupOwnerId = groupOwner.user.id;
  groupOwnerToken = groupOwner.token;
  await pool.query("UPDATE users SET plan = 'entreprise' WHERE id = ?", [groupOwnerId]);

  const subsidiary = await register('group-subsidiary', 'Filiale Dakar');
  subsidiaryOwnerId = subsidiary.user.id;
  subsidiaryToken = subsidiary.token;

  const outsider = await register('group-outsider', 'Société extérieure');
  outsiderId = outsider.user.id;
  outsiderToken = outsider.token;

  const starter = await register('group-starter', 'Compte Starter');
  starterId = starter.user.id;
  starterToken = starter.token;
  await pool.query("UPDATE users SET plan = 'starter' WHERE id = ?", [starterId]);

  const client = await request(app)
    .post('/api/clients')
    .set('Authorization', 'Bearer ' + subsidiaryToken)
    .send({ nom: 'Client filiale Dakar' });
  assert.equal(client.status, 201, client.text);
  subsidiaryClientId = client.body.client.id;
});

test('une base existante en version 9 reçoit les migrations v10 et v11 des groupes et de l’outbox email', async () => {
  // Simule une installation déjà initialisée en v9 : seules les nouvelles tables
  // de la migration 006 sont absentes. Les tables historiques et leurs données restent intactes.
  await pool.query('DROP TABLE IF EXISTS email_outbox');
  await pool.query('DROP TABLE IF EXISTS pro_company_group_invitations');
  await pool.query('DROP TABLE IF EXISTS pro_company_group_companies');
  await pool.query('DROP TABLE IF EXISTS pro_company_groups');
  await pool.query('UPDATE _samafacture_schema_meta SET version = 9 WHERE id = 1');

  const child = runMigrationInNewProcess();
  assert.equal(child.error, undefined, child.error?.message);
  assert.equal(child.status, 0, child.stderr || child.stdout || 'La migration v9 → v10 a échoué.');

  const [[meta]] = await pool.query('SELECT version FROM _samafacture_schema_meta WHERE id = 1');
  assert.ok(Number(meta.version) >= 11, 'la version du schéma doit être avancée jusqu’à v11 après migration');

  const [tables] = await pool.query(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?, ?, ?)',
    ['pro_company_groups', 'pro_company_group_companies', 'pro_company_group_invitations', 'email_outbox']
  );
  assert.deepEqual(
    tables.map(row => row.TABLE_NAME).sort(),
    ['email_outbox', 'pro_company_group_companies', 'pro_company_group_invitations', 'pro_company_groups'],
    'les tables des migrations 006 et 007 doivent être recréées sur une base v9'
  );
});

test('le plan Entreprise permet de créer un groupe, inviter une société et lui déléguer un accès explicite', async () => {
  const denied = await request(app)
    .post('/api/pro/company-group')
    .set('Authorization', 'Bearer ' + starterToken)
    .send({ nom: 'Groupe non autorisé' });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.code, 'PLAN_ENTREPRISE_REQUIS');

  const created = await request(app)
    .post('/api/pro/company-group')
    .set('Authorization', 'Bearer ' + groupOwnerToken)
    .send({ nom: 'Groupe Sénégal' });
  assert.equal(created.status, 201, created.text);

  const duplicate = await request(app)
    .post('/api/pro/company-group')
    .set('Authorization', 'Bearer ' + groupOwnerToken)
    .send({ nom: 'Deuxième groupe' });
  assert.equal(duplicate.status, 409);

  const [[recipient]] = await pool.query('SELECT email FROM users WHERE id = ?', [subsidiaryOwnerId]);
  const invitationResponses = await Promise.all([
    request(app)
      .post('/api/pro/company-group/invitations')
      .set('Authorization', 'Bearer ' + groupOwnerToken)
      .send({ email: recipient.email }),
    request(app)
      .post('/api/pro/company-group/invitations')
      .set('Authorization', 'Bearer ' + groupOwnerToken)
      .send({ email: recipient.email })
  ]);
  assert.deepEqual(
    invitationResponses.map(response => response.status).sort((a, b) => a - b),
    [201, 409],
    'deux créations simultanées ne doivent produire qu’une invitation active'
  );
  const invitation = invitationResponses.find(response => response.status === 201);
  assert.ok(invitation, 'une invitation doit être créée');
  assert.equal(invitation.body.email_envoye, false, 'un email en file ne doit pas être présenté comme envoyé');
  assert.equal(invitation.body.email_en_file, true);
  assert.equal(invitation.body.email_statut, 'queued');
  assert.match(invitation.body.avertissement, /file d’envoi sécurisée/i);
  const token = new URL(invitation.body.invitation_url).searchParams.get('token');
  assert.match(token, /^[a-f0-9]{64}$/i);

  const [[queuedEmail]] = await pool.query(
    `SELECT id, statut, tentatives, payload_enc
     FROM email_outbox
     WHERE entity_type = 'company_group_invitation' AND entity_id = ?`,
    [invitation.body.id]
  );
  assert.ok(queuedEmail, 'l’invitation et le message email doivent être persistés ensemble');
  assert.equal(queuedEmail.statut, 'queued');
  assert.match(queuedEmail.payload_enc, /^v1:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/i);
  const decryptedEmail = decryptEmailPayload(queuedEmail.payload_enc);
  assert.equal(decryptedEmail.to, recipient.email);
  assert.match(decryptedEmail.text, new RegExp(token));
  assert.doesNotMatch(queuedEmail.payload_enc, new RegExp(token));

  // Simule un worker interrompu : son bail est expiré et une autre instance reprend la tâche.
  await pool.query(
    `UPDATE email_outbox
     SET statut = 'processing', tentatives = 0,
         verrouille_le = DATE_SUB(NOW(), INTERVAL 10 MINUTE),
         lock_token = '00000000-0000-4000-8000-000000000000'
     WHERE id = ?`,
    [queuedEmail.id]
  );
  const failedDelivery = await dispatchPendingEmails({
    batchSize: 1,
    sender: async () => {
      const error = new Error('SMTP diagnostic must not be persisted');
      error.code = 'ECONNECTION';
      throw error;
    }
  });
  assert.deepEqual(failedDelivery, { claimed: 1, sent: 0, retried: 1, failed: 0, cancelled: 0 });
  const [[retryRow]] = await pool.query(
    'SELECT statut, tentatives, dernier_code_erreur FROM email_outbox WHERE id = ?',
    [queuedEmail.id]
  );
  assert.equal(retryRow.statut, 'retry');
  assert.equal(Number(retryRow.tentatives), 1);
  assert.equal(retryRow.dernier_code_erreur, 'ECONNECTION');
  assert.notEqual(retryRow.dernier_code_erreur, 'SMTP diagnostic must not be persisted');

  await pool.query(
    'UPDATE email_outbox SET prochaine_tentative = DATE_SUB(NOW(), INTERVAL 1 SECOND) WHERE id = ?',
    [queuedEmail.id]
  );
  let deliveredPayload;
  const successfulDelivery = await dispatchPendingEmails({
    batchSize: 1,
    sender: async payload => {
      deliveredPayload = payload;
      return { sent: true };
    }
  });
  assert.deepEqual(successfulDelivery, { claimed: 1, sent: 1, retried: 0, failed: 0, cancelled: 0 });
  assert.equal(deliveredPayload.to, recipient.email);
  assert.match(deliveredPayload.text, new RegExp(token));
  const [[sentRow]] = await pool.query(
    'SELECT statut, tentatives, envoye_le FROM email_outbox WHERE id = ?',
    [queuedEmail.id]
  );
  assert.equal(sentRow.statut, 'sent');
  assert.equal(Number(sentRow.tentatives), 2);
  assert.ok(sentRow.envoye_le, 'la date d’envoi doit être enregistrée');

  // Un message expiré ne doit pas partir, même s'il est encore présent dans l'outbox.
  const [expiredInvite] = await pool.query(
    `INSERT INTO pro_company_group_invitations
      (group_id, invited_email, token_hash, statut, expire_at)
     VALUES (?, ?, ?, 'envoyee', DATE_SUB(NOW(), INTERVAL 1 DAY))`,
    [created.body.id, 'expired-invite@example.test', 'a'.repeat(64)]
  );
  await pool.query(
    `INSERT INTO email_outbox
      (owner_user_id, entity_type, entity_id, idempotency_key, payload_enc, statut, prochaine_tentative)
     VALUES (?, 'company_group_invitation', ?, ?, ?, 'queued', NOW())`,
    [groupOwnerId, expiredInvite.insertId, 'f'.repeat(64), queuedEmail.payload_enc]
  );
  let expiredEmailWasSent = false;
  const expiredDelivery = await dispatchPendingEmails({
    batchSize: 1,
    sender: async () => {
      expiredEmailWasSent = true;
      return { sent: true };
    }
  });
  assert.deepEqual(expiredDelivery, { claimed: 1, sent: 0, retried: 0, failed: 0, cancelled: 1 });
  assert.equal(expiredEmailWasSent, false, 'un lien expiré ne doit pas être envoyé');
  const [[expiredOutbox]] = await pool.query(
    'SELECT statut, dernier_code_erreur FROM email_outbox WHERE entity_id = ? AND entity_type = ?',
    [expiredInvite.insertId, 'company_group_invitation']
  );
  assert.equal(expiredOutbox.statut, 'cancelled');
  assert.equal(expiredOutbox.dernier_code_erreur, 'entity_inactive');

  // Un worker doit aussi abandonner une tâche devenue invalide avant sa remise SMTP.
  const [[outsider]] = await pool.query('SELECT email FROM users WHERE id = ?', [outsiderId]);
  const staleInvitation = await request(app)
    .post('/api/pro/company-group/invitations')
    .set('Authorization', 'Bearer ' + groupOwnerToken)
    .send({ email: outsiderRecipient.email });
  assert.equal(staleInvitation.status, 201, staleInvitation.text);
  const [[staleOutbox]] = await pool.query(
    "SELECT id FROM email_outbox WHERE entity_type = 'company_group_invitation' AND entity_id = ?",
    [staleInvitation.body.id]
  );
  await pool.query(
    "UPDATE pro_company_group_invitations SET statut = 'revoquee' WHERE id = ?",
    [staleInvitation.body.id]
  );
  let staleMessageSent = false;
  const staleDispatch = await dispatchPendingEmails({
    batchSize: 1,
    sender: async () => {
      staleMessageSent = true;
      return { sent: true };
    }
  });
  assert.deepEqual(staleDispatch, {
    claimed: 1, sent: 0, retried: 0, failed: 0, cancelled: 1
  });
  assert.equal(staleMessageSent, false);
  const [[staleCancelled]] = await pool.query(
    'SELECT statut FROM email_outbox WHERE id = ?',
    [staleOutbox.id]
  );
  assert.equal(staleCancelled.statut, 'cancelled');

  // L'API de révocation annule atomiquement un email qui n'a pas encore été réclamé.
  const revocableInvitation = await request(app)
    .post('/api/pro/company-group/invitations')
    .set('Authorization', 'Bearer ' + groupOwnerToken)
    .send({ email: outsider.email });
  assert.equal(revocableInvitation.status, 201, revocableInvitation.text);
  const [[revocableOutbox]] = await pool.query(
    "SELECT id FROM email_outbox WHERE entity_type = 'company_group_invitation' AND entity_id = ?",
    [revocableInvitation.body.id]
  );
  const revoked = await request(app)
    .delete('/api/pro/company-group/invitations/' + revocableInvitation.body.id)
    .set('Authorization', 'Bearer ' + groupOwnerToken);
  assert.equal(revoked.status, 200, revoked.text);
  assert.equal(revoked.body.email_annule, true);
  assert.equal(revoked.body.email_en_cours, false);
  const [[revokedOutbox]] = await pool.query(
    'SELECT statut FROM email_outbox WHERE id = ?',
    [revocableOutbox.id]
  );
  assert.equal(revokedOutbox.statut, 'cancelled');

  const wrongOwner = await request(app)
    .post('/api/pro/company-group/invitations/accept')
    .set('Authorization', 'Bearer ' + outsiderToken)
    .send({ token });
  assert.equal(wrongOwner.status, 403);

  // Simule une remise déjà réclamée, mais dont le worker a été interrompu
  // avant SMTP. L'acceptation ne doit pas falsifier son état en "annulé" :
  // le worker doit reprendre le bail, constater l'invitation acceptée, puis annuler.
  await pool.query(
    `UPDATE email_outbox
     SET statut = 'processing',
         verrouille_le = DATE_SUB(NOW(), INTERVAL 10 MINUTE),
         lock_token = '00000000-0000-4000-8000-000000000002'
     WHERE id = ?`,
    [queuedEmail.id]
  );

  const accepted = await request(app)
    .post('/api/pro/company-group/invitations/accept')
    .set('Authorization', 'Bearer ' + subsidiaryToken)
    .send({ token });
  assert.equal(accepted.status, 200, accepted.text);
  assert.equal(accepted.body.groupe_id, created.body.id);
  const [[outboxAfterAcceptance]] = await pool.query(
    'SELECT statut FROM email_outbox WHERE id = ?',
    [queuedEmail.id]
  );
  assert.equal(outboxAfterAcceptance.statut, 'processing', 'l’API ne doit pas annuler une remise SMTP déjà réclamée');

  let acceptedInvitationEmailSent = false;
  const acceptedInvitationDelivery = await dispatchPendingEmails({
    batchSize: 1,
    sender: async () => {
      acceptedInvitationEmailSent = true;
      return { sent: true };
    }
  });
  assert.deepEqual(acceptedInvitationDelivery, {
    claimed: 1, sent: 0, retried: 0, failed: 0, cancelled: 1
  });
  assert.equal(acceptedInvitationEmailSent, false, 'le worker ne doit pas transmettre un lien déjà accepté');
  const [[acceptedOutbox]] = await pool.query(
    'SELECT statut, dernier_code_erreur FROM email_outbox WHERE id = ?',
    [queuedEmail.id]
  );
  assert.equal(acceptedOutbox.statut, 'cancelled');
  assert.equal(acceptedOutbox.dernier_code_erreur, 'entity_inactive');

  const group = await request(app)
    .get('/api/pro/company-group')
    .set('Authorization', 'Bearer ' + groupOwnerToken);
  assert.equal(group.status, 200, group.text);
  assert.equal(group.body.societes.length, 2);
  assert.equal(group.body.societes.filter(company => Number(company.id) === Number(groupOwnerId)).length, 1);
  assert.equal(group.body.societes.filter(company => Number(company.id) === Number(subsidiaryOwnerId)).length, 1);

  const memberStatus = await request(app)
    .get('/api/pro/company-group/membership')
    .set('Authorization', 'Bearer ' + subsidiaryToken);
  assert.equal(memberStatus.status, 200);
  assert.equal(memberStatus.body.membre, true);
  assert.equal(memberStatus.body.groupe.actif, true);

  const switcher = await request(app)
    .get('/api/pro/team/companies')
    .set('Authorization', 'Bearer ' + groupOwnerToken);
  assert.equal(switcher.status, 200);
  assert.ok(switcher.body.entreprises.some(company => Number(company.id) === Number(subsidiaryOwnerId) && company.source === 'groupe'));

  const subsidiaryData = await request(app)
    .get('/api/clients')
    .set('Authorization', 'Bearer ' + groupOwnerToken)
    .set('X-SF-Company-Owner', String(subsidiaryOwnerId));
  assert.equal(subsidiaryData.status, 200, subsidiaryData.text);
  assert.ok(subsidiaryData.body.clients.some(client => Number(client.id) === Number(subsidiaryClientId)));

  const forbidden = await request(app)
    .get('/api/clients')
    .set('Authorization', 'Bearer ' + outsiderToken)
    .set('X-SF-Company-Owner', String(subsidiaryOwnerId));
  assert.equal(forbidden.status, 403);

  // Une facture annulée ne doit pas gonfler les totaux consolidés du groupe.
  await pool.query(
    `INSERT INTO factures
      (user_id, client_id, numero, type, date_emission, statut, total, montant_paye)
     VALUES
      (?, ?, ?, 'facture', '2026-11-16', 'en_attente', 1000, 250),
      (?, ?, ?, 'facture', '2026-11-16', 'annulee', 9000, 9000)`,
    [subsidiaryOwnerId, subsidiaryClientId, 'TEST-GROUPE-ACTIVE', subsidiaryOwnerId, subsidiaryClientId, 'TEST-GROUPE-ANNULEE']
  );

  const dashboard = await request(app)
    .get('/api/pro/company-group/dashboard')
    .set('Authorization', 'Bearer ' + groupOwnerToken);
  assert.equal(dashboard.status, 200, dashboard.text);
  assert.equal(dashboard.body.societes.length, 2);
  assert.ok(Array.isArray(dashboard.body.factures_par_devise));
  const subsidiary = dashboard.body.societes.find(company => Number(company.id) === Number(subsidiaryOwnerId));
  assert.ok(subsidiary, 'la filiale doit être présente dans le tableau de bord');
  assert.deepEqual(subsidiary.factures, [
    { devise: 'FCFA', nombre: 1, total: 1000, encaisse: 250 }
  ], 'la facture annulée doit être exclue du nombre, du total et des encaissements');
  assert.deepEqual(dashboard.body.factures_par_devise, [
    { devise: 'FCFA', nombre_factures: 1, total_facture: 1000, total_encaisse: 250 }
  ]);
  assert.match(dashboard.body.note, /aucune conversion de change/i);

  const [[outsiderRecipient]] = await pool.query('SELECT email FROM users WHERE id = ?', [outsiderId]);
  const secondInvitation = await request(app)
    .post('/api/pro/company-group/invitations')
    .set('Authorization', 'Bearer ' + groupOwnerToken)
    .send({ email: outsiderRecipient.email });
  assert.equal(secondInvitation.status, 201, secondInvitation.text);
  const [[secondOutbox]] = await pool.query(
    `SELECT id, statut FROM email_outbox
     WHERE entity_type = 'company_group_invitation' AND entity_id = ?`,
    [secondInvitation.body.id]
  );
  assert.equal(secondOutbox.statut, 'queued');
  const revokedQueued = await request(app)
    .delete('/api/pro/company-group/invitations/' + secondInvitation.body.id)
    .set('Authorization', 'Bearer ' + groupOwnerToken);
  assert.equal(revokedQueued.status, 200, revokedQueued.text);
  const [[revokedQueuedOutbox]] = await pool.query(
    'SELECT statut, dernier_code_erreur FROM email_outbox WHERE id = ?',
    [secondOutbox.id]
  );
  assert.equal(revokedQueuedOutbox.statut, 'cancelled');
  assert.equal(revokedQueuedOutbox.dernier_code_erreur, 'invitation_revoked');

  const leave = await request(app)
    .delete('/api/pro/company-group/leave')
    .set('Authorization', 'Bearer ' + subsidiaryToken);
  assert.equal(leave.status, 200, leave.text);

  const afterLeave = await request(app)
    .get('/api/clients')
    .set('Authorization', 'Bearer ' + groupOwnerToken)
    .set('X-SF-Company-Owner', String(subsidiaryOwnerId));
  assert.equal(afterLeave.status, 403);

  const groupAfterLeave = await request(app)
    .get('/api/pro/company-group')
    .set('Authorization', 'Bearer ' + groupOwnerToken);
  assert.equal(groupAfterLeave.status, 200);
  assert.equal(groupAfterLeave.body.societes.length, 1);
});

after(async () => {
  try {
    await nettoyerUtilisateur(groupOwnerId);
    await nettoyerUtilisateur(subsidiaryOwnerId);
    await nettoyerUtilisateur(outsiderId);
    await nettoyerUtilisateur(starterId);
  } finally {
    await teardownTestEnvironment();
  }
});
