const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const crypto = require('node:crypto');
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
let teamRecipientId;
let teamConcurrentRecipientId;

function getVerificationTokens(verificationUrl) {
  const url = new URL(verificationUrl);
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
  assert.equal(url.searchParams.has('token'), false, 'le jeton d’invitation ne doit pas être transmis dans la requête GET');
  assert.equal(url.searchParams.has('verification_token'), false, 'le jeton de preuve ne doit pas être transmis dans la requête GET');
  return {
    token: fragment.get('token'),
    verificationToken: fragment.get('verification_token')
  };
}

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

test('une base v8 reçoit les migrations v9 à v14 sans perdre les données existantes', async () => {
  // Simule strictement l'état de main : schéma v8 sans colonne/index v9-v10,
  // ni tables multi-sociétés v11, outbox v12, preuve groupe v13 et preuve équipe v14.
  await pool.query('DROP TABLE IF EXISTS email_outbox');
  await pool.query('DROP TABLE IF EXISTS pro_team_invitation_verifications');
  await pool.query('DROP TABLE IF EXISTS pro_company_group_invitation_verifications');
  await pool.query('DROP TABLE IF EXISTS pro_company_group_invitations');
  await pool.query('DROP TABLE IF EXISTS pro_company_group_companies');
  await pool.query('DROP TABLE IF EXISTS pro_company_groups');

  const [existingDueIndex] = await pool.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'factures_recurrentes'
       AND INDEX_NAME = 'idx_factures_recurrentes_active_due'`
  );
  if (existingDueIndex.length) {
    await pool.query('ALTER TABLE factures_recurrentes DROP INDEX idx_factures_recurrentes_active_due');
  }
  const [existingAnchor] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'factures_recurrentes'
       AND COLUMN_NAME = 'jour_ancre'`
  );
  if (existingAnchor.length) {
    await pool.query('ALTER TABLE factures_recurrentes DROP COLUMN jour_ancre');
  }

  const [[beforeUser]] = await pool.query(
    'SELECT id, email FROM users WHERE id = ? LIMIT 1',
    [groupOwnerId]
  );
  assert.ok(beforeUser, 'le compte de test doit exister avant la migration');
  await pool.query('UPDATE _samafacture_schema_meta SET version = 8 WHERE id = 1');

  const child = runMigrationInNewProcess();
  assert.equal(child.error, undefined, child.error?.message);
  assert.equal(child.status, 0, child.stderr || child.stdout || 'La migration v8 → v14 a échoué.');

  const [[meta]] = await pool.query('SELECT version FROM _samafacture_schema_meta WHERE id = 1');
  assert.equal(Number(meta.version), 14, 'la version doit suivre la séquence v8 → v9 → v10 → v11 → v12 → v13 → v14');

  const [[afterUser]] = await pool.query(
    'SELECT id, email FROM users WHERE id = ? LIMIT 1',
    [groupOwnerId]
  );
  assert.deepEqual(afterUser, beforeUser, 'les comptes existants doivent rester intacts');

  const [anchorColumns] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'factures_recurrentes'
       AND COLUMN_NAME = 'jour_ancre'`
  );
  assert.equal(anchorColumns.length, 1, 'la colonne jour_ancre de la migration v9 doit être créée');

  const [dueIndexes] = await pool.query(
    `SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'factures_recurrentes'
       AND INDEX_NAME = 'idx_factures_recurrentes_active_due'`
  );
  assert.equal(dueIndexes.length, 1, 'l’index d’échéances actives de la migration v10 doit être créé');

  const [tables] = await pool.query(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?, ?, ?, ?, ?)',
    ['pro_company_groups', 'pro_company_group_companies', 'pro_company_group_invitations', 'email_outbox', 'pro_company_group_invitation_verifications', 'pro_team_invitation_verifications']
  );
  assert.deepEqual(
    tables.map(row => row.TABLE_NAME).sort(),
    ['email_outbox', 'pro_company_group_companies', 'pro_company_group_invitation_verifications', 'pro_company_group_invitations', 'pro_company_groups', 'pro_team_invitation_verifications'],
    'les tables de groupes v11, de l’outbox v12 et de preuves email v13-v14 doivent être créées'
  );
});


test('les invitations classiques exigent une preuve email, un envoi outbox et une acceptation atomique', async () => {
  const teamRecipient = await register('team-recipient', 'Compte invité équipe');
  teamRecipientId = teamRecipient.user.id;
  const teamRecipientEmail = teamRecipient.user.email;

  const invitation = await request(app)
    .post('/api/pro/team/invitations')
    .set('Authorization', 'Bearer ' + groupOwnerToken)
    .send({ email: teamRecipientEmail, role: 'employe' });
  assert.equal(invitation.status, 201, invitation.text);
  assert.equal(invitation.body.email_en_file, true);
  assert.equal(invitation.body.invitation_url, undefined, 'le lien brut ne doit pas être renvoyé au propriétaire');
  assert.equal(invitation.body.email_envoye, undefined, 'la mise en file ne doit pas être présentée comme une livraison SMTP');

  const [[inviteRow]] = await pool.query('SELECT id, token_hash FROM pro_team_invitations WHERE id = ?', [invitation.body.id]);
  const [[inviteOutbox]] = await pool.query(
    "SELECT statut, payload_enc FROM email_outbox WHERE entity_type = 'team_invitation' AND entity_id = ?",
    [inviteRow.id]
  );
  assert.equal(inviteOutbox.statut, 'queued');
  const inviteMessage = decryptEmailPayload(inviteOutbox.payload_enc);
  assert.equal(inviteMessage.to, teamRecipientEmail);
  const token = getVerificationTokens(inviteMessage.invitation_url).token;
  assert.match(token || '', /^[a-f0-9]{64}$/i);
  assert.equal(inviteRow.token_hash, crypto.createHash('sha256').update(token).digest('hex'));
  assert.doesNotMatch(inviteOutbox.payload_enc, new RegExp(token));

  const sentInvitationMessages = [];
  const invitationDelivery = await dispatchPendingEmails({
    sender: async message => { sentInvitationMessages.push(message); return { sent: true }; },
    batchSize: 10
  });
  assert.equal(invitationDelivery.sent, 1);
  assert.equal(sentInvitationMessages.length, 1);
  assert.equal(sentInvitationMessages[0].to, teamRecipientEmail);

  const wrongAccount = await request(app)
    .post('/api/pro/team/invitations/accept')
    .set('Authorization', 'Bearer ' + subsidiaryToken)
    .send({ token });
  assert.equal(wrongAccount.status, 403);

  const challenge = await request(app)
    .post('/api/pro/team/invitations/accept')
    .set('Authorization', 'Bearer ' + teamRecipient.token)
    .send({ token });
  assert.equal(challenge.status, 202, challenge.text);
  assert.equal(challenge.body.verification_required, true);
  assert.match(challenge.headers['cache-control'] || '', /no-store/i);

  const cooldown = await request(app)
    .post('/api/pro/team/invitations/accept')
    .set('Authorization', 'Bearer ' + teamRecipient.token)
    .send({ token });
  assert.equal(cooldown.status, 202);
  const [[proofCount]] = await pool.query(
    "SELECT COUNT(*) AS total FROM email_outbox WHERE entity_type = 'team_invitation_verification' AND entity_id = (SELECT id FROM pro_team_invitation_verifications WHERE invitation_id = ?)",
    [inviteRow.id]
  );
  assert.equal(Number(proofCount.total), 1);

  const [[proofRow]] = await pool.query(
    'SELECT id, token_hash, used_at FROM pro_team_invitation_verifications WHERE invitation_id = ?',
    [inviteRow.id]
  );
  assert.ok(proofRow);
  assert.equal(proofRow.used_at, null);
  const [[proofOutbox]] = await pool.query(
    "SELECT statut, payload_enc FROM email_outbox WHERE entity_type = 'team_invitation_verification' AND entity_id = ?",
    [proofRow.id]
  );
  assert.equal(proofOutbox.statut, 'queued');
  const proofMessage = decryptEmailPayload(proofOutbox.payload_enc);
  assert.equal(proofMessage.to, teamRecipientEmail);
  const proofTokens = getVerificationTokens(proofMessage.verification_url);
  assert.equal(proofTokens.token, token);
  const verificationToken = proofTokens.verificationToken;
  assert.match(verificationToken || '', /^[a-f0-9]{64}$/i);
  assert.equal(proofRow.token_hash, crypto.createHash('sha256').update(verificationToken).digest('hex'));
  assert.doesNotMatch(proofOutbox.payload_enc, new RegExp(verificationToken));

  const [[membershipBeforeProof]] = await pool.query(
    'SELECT id FROM pro_team_members WHERE owner_user_id = ? AND member_user_id = ? AND active = 1',
    [groupOwnerId, teamRecipientId]
  );
  assert.equal(membershipBeforeProof, undefined);

  const wrongProof = await request(app)
    .post('/api/pro/team/invitations/accept/verify')
    .set('Authorization', 'Bearer ' + teamRecipient.token)
    .send({ token, verification_token: '0'.repeat(64) });
  assert.equal(wrongProof.status, 404);

  const sentProofMessages = [];
  const proofDelivery = await dispatchPendingEmails({
    sender: async message => { sentProofMessages.push(message); return { sent: true }; },
    batchSize: 10
  });
  assert.equal(proofDelivery.sent, 1);
  assert.equal(sentProofMessages.length, 1);
  assert.equal(sentProofMessages[0].to, teamRecipientEmail);

  const accepted = await request(app)
    .post('/api/pro/team/invitations/accept/verify')
    .set('Authorization', 'Bearer ' + teamRecipient.token)
    .send({ token, verification_token: verificationToken });
  assert.equal(accepted.status, 200, accepted.text);
  assert.equal(accepted.body.success, true);
  assert.match(accepted.headers['cache-control'] || '', /no-store/i);

  const replay = await request(app)
    .post('/api/pro/team/invitations/accept/verify')
    .set('Authorization', 'Bearer ' + teamRecipient.token)
    .send({ token, verification_token: verificationToken });
  assert.equal(replay.status, 404);

  const [[membershipAfterProof]] = await pool.query(
    'SELECT id, role, active FROM pro_team_members WHERE owner_user_id = ? AND member_user_id = ?',
    [groupOwnerId, teamRecipientId]
  );
  assert.ok(membershipAfterProof);
  assert.equal(membershipAfterProof.role, 'employe');
  assert.equal(Number(membershipAfterProof.active), 1);
  const [[acceptedInvite]] = await pool.query(
    'SELECT statut, accepted_user_id, accepted_at FROM pro_team_invitations WHERE id = ?', [inviteRow.id]
  );
  assert.equal(acceptedInvite.statut, 'acceptee');
  assert.equal(Number(acceptedInvite.accepted_user_id), teamRecipientId);
  assert.ok(acceptedInvite.accepted_at);
  const [[usedProof]] = await pool.query('SELECT used_at FROM pro_team_invitation_verifications WHERE id = ?', [proofRow.id]);
  assert.ok(usedProof.used_at);

  const concurrentRecipient = await register('team-concurrent', 'Compte invité concurrent');
  teamConcurrentRecipientId = concurrentRecipient.user.id;
  const secondInvitation = await request(app)
    .post('/api/pro/team/invitations')
    .set('Authorization', 'Bearer ' + groupOwnerToken)
    .send({ email: concurrentRecipient.user.email, role: 'comptable' });
  assert.equal(secondInvitation.status, 201, secondInvitation.text);
  const [[secondInviteOutbox]] = await pool.query(
    "SELECT payload_enc FROM email_outbox WHERE entity_type = 'team_invitation' AND entity_id = ?",
    [secondInvitation.body.id]
  );
  const secondToken = getVerificationTokens(decryptEmailPayload(secondInviteOutbox.payload_enc).invitation_url).token;
  const secondChallenge = await request(app)
    .post('/api/pro/team/invitations/accept')
    .set('Authorization', 'Bearer ' + concurrentRecipient.token)
    .send({ token: secondToken });
  assert.equal(secondChallenge.status, 202, secondChallenge.text);
  const [[secondProof]] = await pool.query(
    'SELECT id FROM pro_team_invitation_verifications WHERE invitation_id = ?', [secondInvitation.body.id]
  );
  const [[secondProofOutbox]] = await pool.query(
    "SELECT payload_enc FROM email_outbox WHERE entity_type = 'team_invitation_verification' AND entity_id = ?",
    [secondProof.id]
  );
  const secondVerificationToken = getVerificationTokens(decryptEmailPayload(secondProofOutbox.payload_enc).verification_url).verificationToken;
  const concurrentAcceptances = await Promise.all([
    request(app).post('/api/pro/team/invitations/accept/verify').set('Authorization', 'Bearer ' + concurrentRecipient.token)
      .send({ token: secondToken, verification_token: secondVerificationToken }),
    request(app).post('/api/pro/team/invitations/accept/verify').set('Authorization', 'Bearer ' + concurrentRecipient.token)
      .send({ token: secondToken, verification_token: secondVerificationToken })
  ]);
  assert.deepEqual(concurrentAcceptances.map(result => result.status).sort((a, b) => a - b), [200, 404]);
  const [[secondMembership]] = await pool.query(
    'SELECT COUNT(*) AS total FROM pro_team_members WHERE owner_user_id = ? AND member_user_id = ? AND active = 1',
    [groupOwnerId, teamConcurrentRecipientId]
  );
  assert.equal(Number(secondMembership.total), 1);
  const [cancelledEmails] = await pool.query(
    "SELECT entity_type, statut FROM email_outbox WHERE (entity_type = 'team_invitation' AND entity_id = ?) OR (entity_type = 'team_invitation_verification' AND entity_id = ?)",
    [secondInvitation.body.id, secondProof.id]
  );
  assert.equal(cancelledEmails.length, 2);
  assert.ok(cancelledEmails.every(row => row.statut === 'cancelled'));
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
  assert.match(invitation.headers['cache-control'] || '', /no-store/i);
  assert.equal(invitation.headers.pragma, 'no-cache');
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
  assert.equal(decryptedEmail.invitation_url, invitation.body.invitation_url);
  assert.doesNotMatch(queuedEmail.payload_enc, new RegExp(token));

  const recoveredLink = await request(app)
    .get('/api/pro/company-group/invitations/' + invitation.body.id + '/link')
    .set('Authorization', 'Bearer ' + groupOwnerToken);
  assert.equal(recoveredLink.status, 200, recoveredLink.text);
  assert.match(recoveredLink.headers['cache-control'] || '', /no-store/i);
  assert.equal(recoveredLink.headers.pragma, 'no-cache');
  assert.equal(recoveredLink.body.invitation_url, invitation.body.invitation_url);
  const forbiddenLink = await request(app)
    .get('/api/pro/company-group/invitations/' + invitation.body.id + '/link')
    .set('Authorization', 'Bearer ' + outsiderToken);
  assert.equal(forbiddenLink.status, 403);

  // Un propriétaire peut relancer un email définitivement échoué tant que le lien est actif.
  const retryRecipient = emailDeTest('group-email-retry');
  const retryInvitation = await request(app)
    .post('/api/pro/company-group/invitations')
    .set('Authorization', 'Bearer ' + groupOwnerToken)
    .send({ email: retryRecipient });
  assert.equal(retryInvitation.status, 201, retryInvitation.text);
  const [[retryOutboxBefore]] = await pool.query(
    `SELECT id FROM email_outbox
     WHERE entity_type = 'company_group_invitation' AND entity_id = ?`,
    [retryInvitation.body.id]
  );
  await pool.query(
    `UPDATE email_outbox
     SET statut = 'failed', tentatives = 8, dernier_code_erreur = 'ECONNECTION'
     WHERE id = ?`,
    [retryOutboxBefore.id]
  );
  const retryResponse = await request(app)
    .post('/api/pro/company-group/invitations/' + retryInvitation.body.id + '/retry-email')
    .set('Authorization', 'Bearer ' + groupOwnerToken);
  assert.equal(retryResponse.status, 202, retryResponse.text);
  assert.equal(retryResponse.body.email_statut, 'queued');
  const [[retryQueued]] = await pool.query(
    'SELECT statut, tentatives, dernier_code_erreur FROM email_outbox WHERE id = ?',
    [retryOutboxBefore.id]
  );
  assert.equal(retryQueued.statut, 'queued');
  assert.equal(Number(retryQueued.tentatives), 0);
  assert.equal(retryQueued.dernier_code_erreur, null);

  // L'invitation initiale reste volontairement en file jusqu'au scénario de reprise
  // qui suit ; la différer ici isole ce test de la tâche historique de plus petit ID.
  await pool.query(
    `UPDATE email_outbox
     SET prochaine_tentative = DATE_ADD(NOW(), INTERVAL 1 HOUR)
     WHERE id = ? AND statut IN ('queued', 'retry')`,
    [queuedEmail.id]
  );

  const retrySent = await dispatchPendingEmails({
    batchSize: 1,
    sender: async payload => {
      assert.equal(payload.to, retryRecipient);
      return { sent: true };
    }
  });
  assert.deepEqual(retrySent, { claimed: 1, sent: 1, retried: 0, failed: 0, cancelled: 0 });

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

  const invitationListAfterExpiry = await request(app)
    .get('/api/pro/company-group')
    .set('Authorization', 'Bearer ' + groupOwnerToken);
  assert.equal(invitationListAfterExpiry.status, 200, invitationListAfterExpiry.text);
  assert.equal(
    invitationListAfterExpiry.body.invitations.some(item => Number(item.id) === Number(expiredInvite.insertId)),
    false,
    'une invitation expirée ne doit plus apparaître dans la liste des actions disponibles'
  );

  // Un crash lors de la huitième tentative ne doit pas provoquer une neuvième remise.
  const [exhaustedInvite] = await pool.query(
    `INSERT INTO pro_company_group_invitations
      (group_id, invited_email, token_hash, statut, expire_at)
     VALUES (?, ?, ?, 'envoyee', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
    [created.body.id, 'max-attempt@example.test', 'b'.repeat(64)]
  );
  const [exhaustedOutboxInsert] = await pool.query(
    `INSERT INTO email_outbox
      (owner_user_id, entity_type, entity_id, idempotency_key, payload_enc,
       statut, tentatives, prochaine_tentative, verrouille_le, lock_token)
     VALUES (?, 'company_group_invitation', ?, ?, ?, 'processing', 8, NOW(),
             DATE_SUB(NOW(), INTERVAL 10 MINUTE),
             '00000000-0000-4000-8000-000000000008')`,
    [groupOwnerId, exhaustedInvite.insertId, 'e'.repeat(64), queuedEmail.payload_enc]
  );
  let exhaustedEmailWasSent = false;
  const exhaustedDelivery = await dispatchPendingEmails({
    batchSize: 1,
    sender: async () => {
      exhaustedEmailWasSent = true;
      return { sent: true };
    }
  });
  assert.deepEqual(exhaustedDelivery, {
    claimed: 1, sent: 0, retried: 0, failed: 1, cancelled: 0
  });
  assert.equal(exhaustedEmailWasSent, false, 'le plafond de tentatives doit empêcher la neuvième remise SMTP');
  const [[exhaustedOutbox]] = await pool.query(
    'SELECT statut, tentatives, dernier_code_erreur FROM email_outbox WHERE id = ?',
    [exhaustedOutboxInsert.insertId]
  );
  assert.equal(exhaustedOutbox.statut, 'failed');
  assert.equal(Number(exhaustedOutbox.tentatives), 9);
  assert.equal(exhaustedOutbox.dernier_code_erreur, 'max_attempts_exceeded');

  // Un worker doit aussi abandonner une tâche devenue invalide avant sa remise SMTP.
  const [[outsider]] = await pool.query('SELECT email FROM users WHERE id = ?', [outsiderId]);
  const staleInvitation = await request(app)
    .post('/api/pro/company-group/invitations')
    .set('Authorization', 'Bearer ' + groupOwnerToken)
    .send({ email: outsider.email });
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

  // Un JWT conservé après changement d'adresse ne doit pas suffire : l'API relit l'email courant en base.
  const changedAccountEmail = emailDeTest('group-email-changed');
  await pool.query('UPDATE users SET email = ? WHERE id = ?', [changedAccountEmail, subsidiaryOwnerId]);
  const staleSessionChallenge = await request(app)
    .post('/api/pro/company-group/invitations/accept')
    .set('Authorization', 'Bearer ' + subsidiaryToken)
    .send({ token });
  assert.equal(staleSessionChallenge.status, 403, 'une ancienne adresse présente dans le JWT ne doit pas autoriser une invitation');
  await pool.query('UPDATE users SET email = ? WHERE id = ?', [recipient.email, subsidiaryOwnerId]);

  // Le lien d'invitation seul ne suffit plus : une preuve indépendante est envoyée à la boîte invitée.
  const pendingAcceptance = await request(app)
    .post('/api/pro/company-group/invitations/accept')
    .set('Authorization', 'Bearer ' + subsidiaryToken)
    .send({ token });
  assert.equal(pendingAcceptance.status, 202, pendingAcceptance.text);
  assert.equal(pendingAcceptance.body.verification_required, true);
  assert.match(pendingAcceptance.headers['cache-control'] || '', /no-store/i);

  const [[proofRow]] = await pool.query(
    'SELECT id, token_hash, expires_at, used_at FROM pro_company_group_invitation_verifications WHERE invitation_id = ?',
    [invitation.body.id]
  );
  assert.ok(proofRow);
  assert.ok(!proofRow.used_at);
  const [[proofOutbox]] = await pool.query(
    "SELECT id, statut, payload_enc FROM email_outbox WHERE entity_type = 'company_group_invitation_verification' AND entity_id = ?",
    [proofRow.id]
  );
  assert.equal(proofOutbox.statut, 'queued');
  let proofEmail = decryptEmailPayload(proofOutbox.payload_enc);
  assert.equal(proofEmail.to, recipient.email);
  const verificationTokens = getVerificationTokens(proofEmail.verification_url);
  assert.equal(verificationTokens.token, token, 'le jeton d’invitation est conservé dans le fragment');
  let verificationToken = verificationTokens.verificationToken;
  assert.match(verificationToken || '', /^[a-f0-9]{64}$/i);
  assert.equal(proofRow.token_hash, crypto.createHash('sha256').update(verificationToken).digest('hex'), 'la base doit stocker le SHA-256 du jeton, jamais sa valeur brute');
  assert.doesNotMatch(proofOutbox.payload_enc, new RegExp(verificationToken));

  const [[membershipBeforeProof]] = await pool.query(
    'SELECT id FROM pro_company_group_companies WHERE company_owner_id = ?',
    [subsidiaryOwnerId]
  );
  assert.equal(membershipBeforeProof, undefined, 'aucun rattachement ne doit exister avant la preuve email');

  const wrongProof = await request(app)
    .post('/api/pro/company-group/invitations/accept/verify')
    .set('Authorization', 'Bearer ' + subsidiaryToken)
    .send({ token, verification_token: '0'.repeat(64) });
  assert.equal(wrongProof.status, 404);

  const cooldown = await request(app)
    .post('/api/pro/company-group/invitations/accept')
    .set('Authorization', 'Bearer ' + subsidiaryToken)
    .send({ token });
  assert.equal(cooldown.status, 202);
  const [[proofOutboxCount]] = await pool.query(
    "SELECT COUNT(*) AS total FROM email_outbox WHERE entity_type = 'company_group_invitation_verification' AND entity_id = ?",
    [proofRow.id]
  );
  assert.equal(Number(proofOutboxCount.total), 1, 'un nouvel email ne doit pas être créé pendant le délai anti-abus');

  // Après le délai anti-abus, un nouveau lien remplace l'ancien sans créer de doublon d'outbox.
  const originalProofHash = proofRow.token_hash;
  await pool.query(
    'UPDATE pro_company_group_invitation_verifications SET sent_at = DATE_SUB(NOW(), INTERVAL 2 MINUTE) WHERE id = ?',
    [proofRow.id]
  );
  const resentChallenge = await request(app)
    .post('/api/pro/company-group/invitations/accept')
    .set('Authorization', 'Bearer ' + subsidiaryToken)
    .send({ token });
  assert.equal(resentChallenge.status, 202, resentChallenge.text);
  const [[rotatedProof]] = await pool.query(
    'SELECT token_hash FROM pro_company_group_invitation_verifications WHERE id = ?',
    [proofRow.id]
  );
  assert.notEqual(rotatedProof.token_hash, originalProofHash, 'le renvoi doit invalider le précédent jeton');
  const [[rotatedOutbox]] = await pool.query(
    "SELECT id, payload_enc FROM email_outbox WHERE entity_type = 'company_group_invitation_verification' AND entity_id = ?",
    [proofRow.id]
  );
  assert.equal(rotatedOutbox.id, proofOutbox.id, 'le renvoi doit réutiliser la ligne outbox de l’invitation');
  proofEmail = decryptEmailPayload(rotatedOutbox.payload_enc);
  const rotatedVerificationToken = getVerificationTokens(proofEmail.verification_url).verificationToken;
  assert.match(rotatedVerificationToken || '', /^[a-f0-9]{64}$/i);
  assert.notEqual(rotatedVerificationToken, verificationToken);
  const oldProofReplay = await request(app)
    .post('/api/pro/company-group/invitations/accept/verify')
    .set('Authorization', 'Bearer ' + subsidiaryToken)
    .send({ token, verification_token: verificationToken });
  assert.equal(oldProofReplay.status, 404);
  verificationToken = rotatedVerificationToken;

  let deliveredVerificationPayload;
  const verificationDelivery = await dispatchPendingEmails({
    batchSize: 1,
    sender: async payload => {
      deliveredVerificationPayload = payload;
      return { sent: true };
    }
  });
  assert.deepEqual(verificationDelivery, { claimed: 1, sent: 1, retried: 0, failed: 0, cancelled: 0 });
  assert.equal(deliveredVerificationPayload.to, recipient.email);
  assert.equal(deliveredVerificationPayload.verification_url, proofEmail.verification_url);
  const [[proofSent]] = await pool.query('SELECT statut FROM email_outbox WHERE id = ?', [proofOutbox.id]);
  assert.equal(proofSent.statut, 'sent');

  const wrongAccountProof = await request(app)
    .post('/api/pro/company-group/invitations/accept/verify')
    .set('Authorization', 'Bearer ' + outsiderToken)
    .send({ token, verification_token: verificationToken });
  assert.equal(wrongAccountProof.status, 403);

  // Un changement d'adresse après l'envoi invalide aussi un JWT encore signé avec l'ancienne adresse.
  await pool.query('UPDATE users SET email = ? WHERE id = ?', [changedAccountEmail, subsidiaryOwnerId]);
  const staleSessionProof = await request(app)
    .post('/api/pro/company-group/invitations/accept/verify')
    .set('Authorization', 'Bearer ' + subsidiaryToken)
    .send({ token, verification_token: verificationToken });
  assert.equal(staleSessionProof.status, 403, 'une preuve email ne doit pas rattacher un compte qui a changé d’adresse');
  await pool.query('UPDATE users SET email = ? WHERE id = ?', [recipient.email, subsidiaryOwnerId]);

  // Simule une remise initiale déjà réclamée puis interrompue. Après acceptation vérifiée,
  // le worker doit reprendre le bail, constater l'invitation acceptée et annuler l'ancien email.
  await pool.query(
    `UPDATE email_outbox
     SET statut = 'processing',
         verrouille_le = DATE_SUB(NOW(), INTERVAL 10 MINUTE),
         lock_token = '00000000-0000-4000-8000-000000000002'
     WHERE id = ?`,
    [queuedEmail.id]
  );

  const accepted = await request(app)
    .post('/api/pro/company-group/invitations/accept/verify')
    .set('Authorization', 'Bearer ' + subsidiaryToken)
    .send({ token, verification_token: verificationToken });
  assert.equal(accepted.status, 200, accepted.text);
  assert.equal(accepted.body.groupe_id, created.body.id);
  assert.match(accepted.body.message, /Adresse email confirmée/i);

  const replay = await request(app)
    .post('/api/pro/company-group/invitations/accept/verify')
    .set('Authorization', 'Bearer ' + subsidiaryToken)
    .send({ token, verification_token: verificationToken });
  assert.equal(replay.status, 404, 'une preuve consommée ne doit jamais être réutilisable');

  const [[proofUsed]] = await pool.query(
    'SELECT used_at FROM pro_company_group_invitation_verifications WHERE id = ?',
    [proofRow.id]
  );
  assert.ok(proofUsed.used_at, 'la preuve doit être consommée au moment du rattachement');

  const [[outboxAfterAcceptance]] = await pool.query(
    'SELECT statut FROM email_outbox WHERE id = ?',
    [queuedEmail.id]
  );
  assert.equal(outboxAfterAcceptance.statut, 'processing', 'l’API ne doit pas falsifier une remise SMTP déjà réclamée');

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
  assert.equal(acceptedInvitationEmailSent, false, 'le worker ne doit pas transmettre un lien d’invitation déjà accepté');
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
      (user_id, client_id, numero, type, date_emission, date_echeance, statut, total, montant_paye)
     VALUES
      (?, ?, ?, 'facture', CURDATE(), DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'en_attente', 1000, 250),
      (?, ?, ?, 'facture', CURDATE(), NULL, 'annulee', 9000, 9000)`,
    [subsidiaryOwnerId, subsidiaryClientId, 'TEST-GROUPE-ACTIVE', subsidiaryOwnerId, subsidiaryClientId, 'TEST-GROUPE-ANNULEE']
  );

  // Trois produits couvrent le stock faible, la rupture et le coût d’achat manquant.
  await pool.query(
    `INSERT INTO produits (user_id, nom, prix_ht, prix_achat, tva, stock, stock_minimum)
     VALUES
       (?, 'TEST-GROUPE-STOCK-FAIBLE', 500, 200, 18, 2, 5),
       (?, 'TEST-GROUPE-RUPTURE', 500, 100, 18, 0, 0),
       (?, 'TEST-GROUPE-COUT-MANQUANT', 500, 0, 18, 4, 0)`,
    [subsidiaryOwnerId, subsidiaryOwnerId, subsidiaryOwnerId]
  );
  const [stockProducts] = await pool.query(
    'SELECT id, nom FROM produits WHERE user_id = ? AND nom LIKE ? ORDER BY nom',
    [subsidiaryOwnerId, 'TEST-GROUPE-%']
  );
  const lowProduct = stockProducts.find(row => row.nom === 'TEST-GROUPE-STOCK-FAIBLE');
  const missingCostProduct = stockProducts.find(row => row.nom === 'TEST-GROUPE-COUT-MANQUANT');
  assert.equal(stockProducts.length, 3);

  const [warehouseA] = await pool.query(
    'INSERT INTO pro_entrepots (user_id, code, nom, par_defaut) VALUES (?, ?, ?, 1)',
    [subsidiaryOwnerId, 'TEST-A', 'Entrepôt test A']
  );
  const [warehouseB] = await pool.query(
    'INSERT INTO pro_entrepots (user_id, code, nom) VALUES (?, ?, ?)',
    [subsidiaryOwnerId, 'TEST-B', 'Entrepôt test B']
  );
  await pool.query(
    'INSERT INTO pro_stocks_entrepots (user_id, entrepot_id, produit_id, quantite) VALUES (?, ?, ?, 1), (?, ?, ?, 1), (?, ?, ?, 4)',
    [
      subsidiaryOwnerId, warehouseA.insertId, lowProduct.id,
      subsidiaryOwnerId, warehouseB.insertId, lowProduct.id,
      subsidiaryOwnerId, warehouseA.insertId, missingCostProduct.id
    ]
  );

  // Les soldes de caisse incluent les entrées et sorties, mais pas les caisses inactives.
  const [cashRegister] = await pool.query(
    'INSERT INTO pro_caisses (user_id, nom, devise, solde_initial) VALUES (?, ?, ?, ?)',
    [subsidiaryOwnerId, 'Caisse test filiale', 'FCFA', 10000]
  );
  await pool.query(
    'INSERT INTO pro_caisse_operations (user_id, caisse_id, type, montant, motif) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)',
    [subsidiaryOwnerId, cashRegister.insertId, 'entree', 1500, 'Entrée test',
     subsidiaryOwnerId, cashRegister.insertId, 'sortie', 2000, 'Sortie test']
  );

  await pool.query(
    'INSERT INTO pro_caisses (user_id, nom, devise, solde_initial, active) VALUES (?, ?, ?, ?, 0)',
    [subsidiaryOwnerId, 'Caisse inactive filiale', 'FCFA', 50000]
  );
  await pool.query(
    'INSERT INTO depenses (user_id, libelle, montant, categorie, date_depense) VALUES (?, ?, ?, ?, CURDATE())',
    [subsidiaryOwnerId, 'Dépense test filiale', 3000, 'test']
  );

  // Des montants élevés dans une société extérieure ne doivent jamais être consolidés.
  await pool.query(
    `INSERT INTO depenses (user_id, libelle, montant, categorie, date_depense)
     VALUES (?, 'Dépense extérieure', 99999, 'test', CURDATE())`,
    [outsiderId]
  );
  await pool.query(
    `INSERT INTO pro_caisses (user_id, nom, devise, solde_initial)
     VALUES (?, 'Caisse extérieure', 'FCFA', 99999)`,
    [outsiderId]
  );
  await pool.query(
    `INSERT INTO produits (user_id, nom, prix_ht, prix_achat, tva, stock, stock_minimum)
     VALUES (?, 'Produit extérieur', 500, 100, 18, 99, 1)`,
    [outsiderId]
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
    { devise: 'FCFA', nombre: 1, total: 1000, encaisse: 250, impaye: 750, nombre_impayees: 1, en_retard: 750, nombre_en_retard: 1 }
  ], 'la facture annulée est exclue ; le restant dû et le retard sont calculés');
  assert.deepEqual(dashboard.body.factures_par_devise, [
    { devise: 'FCFA', nombre_factures: 1, total_facture: 1000, total_encaisse: 250, total_impaye: 750, nombre_impayees: 1, total_en_retard: 750, nombre_en_retard: 1 }
  ]);
  assert.deepEqual(dashboard.body.depenses_par_devise, [
    { devise: 'FCFA', nombre_depenses: 1, total_depenses: 3000 }
  ], 'les dépenses d’une société extérieure ne sont pas consolidées');
  assert.deepEqual(subsidiary.caisses, [
    { devise: 'FCFA', nombre: 1, solde: 9500 }
  ], 'le solde est calculé avec les entrées et sorties de la caisse rattachée');
  assert.deepEqual(dashboard.body.caisses_par_devise, [
    { devise: 'FCFA', nombre_caisses: 1, solde_total: 9500 }
  ], 'la caisse extérieure ne doit pas être visible dans les totaux du groupe');
  assert.deepEqual(subsidiary.stock, [
    { devise: 'FCFA', nombre_produits: 3, ruptures: 1, stocks_faibles: 1, valeur_estimee: 400, produits_sans_cout: 1 }
  ], 'les stocks de plusieurs entrepôts sont agrégés et les coûts manquants sont signalés');
  assert.deepEqual(dashboard.body.stocks_par_devise, [
    { devise: 'FCFA', nombre_produits: 3, ruptures_stock: 1, stocks_faibles: 1, valeur_stock_estimee: 400, produits_sans_cout: 1 }
  ], 'le produit d’une société extérieure est exclu');
  assert.ok(dashboard.body.performance_mensuelle.some(row => row.devise === 'FCFA' && row.total_facture === 1000), 'la tendance inclut la facture de la période');
  assert.ok(dashboard.body.alertes.some(row => row.type === 'factures_en_retard' && Number(row.societe_id) === Number(subsidiaryOwnerId)), 'une facture échue doit produire une alerte');
  assert.ok(dashboard.body.alertes.some(row => row.type === 'stocks_a_surveiller' && Number(row.societe_id) === Number(subsidiaryOwnerId)), 'un stock faible ou en rupture doit produire une alerte');
  assert.match(dashboard.body.note, /aucune conversion de change/i);

  // Un jeton expiré doit être rejeté par l'API et par le worker email.
  const [[starterRecipient]] = await pool.query('SELECT email FROM users WHERE id = ?', [starterId]);
  const expiryInvitation = await request(app)
    .post('/api/pro/company-group/invitations')
    .set('Authorization', 'Bearer ' + groupOwnerToken)
    .send({ email: starterRecipient.email });
  assert.equal(expiryInvitation.status, 201, expiryInvitation.text);
  const expiryInviteToken = new URL(expiryInvitation.body.invitation_url).searchParams.get('token');
  const expiryChallenge = await request(app)
    .post('/api/pro/company-group/invitations/accept')
    .set('Authorization', 'Bearer ' + starterToken)
    .send({ token: expiryInviteToken });
  assert.equal(expiryChallenge.status, 202, expiryChallenge.text);
  const [[expiryProof]] = await pool.query(
    'SELECT id FROM pro_company_group_invitation_verifications WHERE invitation_id = ?',
    [expiryInvitation.body.id]
  );
  const [[expiryProofOutbox]] = await pool.query(
    "SELECT id, payload_enc FROM email_outbox WHERE entity_type = 'company_group_invitation_verification' AND entity_id = ?",
    [expiryProof.id]
  );
  const expiryProofEmail = decryptEmailPayload(expiryProofOutbox.payload_enc);
  const expiryVerificationToken = getVerificationTokens(expiryProofEmail.verification_url).verificationToken;
  await pool.query(
    'UPDATE email_outbox SET statut = \'sent\' WHERE entity_type = ? AND entity_id = ?',
    ['company_group_invitation', expiryInvitation.body.id]
  );
  await pool.query(
    'UPDATE pro_company_group_invitation_verifications SET expires_at = DATE_SUB(NOW(), INTERVAL 1 SECOND) WHERE id = ?',
    [expiryProof.id]
  );
  const expiredProof = await request(app)
    .post('/api/pro/company-group/invitations/accept/verify')
    .set('Authorization', 'Bearer ' + starterToken)
    .send({ token: expiryInviteToken, verification_token: expiryVerificationToken });
  assert.equal(expiredProof.status, 404, 'un jeton expiré ne doit pas rattacher la société');
  const expiredProofDelivery = await dispatchPendingEmails({
    batchSize: 1,
    sender: async () => ({ sent: true })
  });
  assert.deepEqual(expiredProofDelivery, { claimed: 1, sent: 0, retried: 0, failed: 0, cancelled: 1 });
  const [[expiredProofOutboxState]] = await pool.query(
    'SELECT statut FROM email_outbox WHERE id = ?',
    [expiryProofOutbox.id]
  );
  assert.equal(expiredProofOutboxState.statut, 'cancelled');

  // Le worker ne doit pas envoyer une preuve à l'ancienne adresse après un changement de compte.
  const freshChallenge = await request(app)
    .post('/api/pro/company-group/invitations/accept')
    .set('Authorization', 'Bearer ' + starterToken)
    .send({ token: expiryInviteToken });
  assert.equal(freshChallenge.status, 202, freshChallenge.text);
  const [[freshProof]] = await pool.query(
    'SELECT id FROM pro_company_group_invitation_verifications WHERE invitation_id = ?',
    [expiryInvitation.body.id]
  );
  const [[freshProofOutbox]] = await pool.query(
    "SELECT id FROM email_outbox WHERE entity_type = 'company_group_invitation_verification' AND entity_id = ?",
    [freshProof.id]
  );
  const changedStarterEmail = emailDeTest('group-starter-email-changed');
  await pool.query('UPDATE users SET email = ? WHERE id = ?', [changedStarterEmail, starterId]);
  const changedAddressDelivery = await dispatchPendingEmails({
    batchSize: 1,
    sender: async () => ({ sent: true })
  });
  assert.deepEqual(changedAddressDelivery, { claimed: 1, sent: 0, retried: 0, failed: 0, cancelled: 1 });
  const [[changedAddressOutbox]] = await pool.query(
    'SELECT statut FROM email_outbox WHERE id = ?',
    [freshProofOutbox.id]
  );
  assert.equal(changedAddressOutbox.statut, 'cancelled');
  await pool.query('UPDATE users SET email = ? WHERE id = ?', [starterRecipient.email, starterId]);

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

  // Deux confirmations simultanées avec le même jeton ne doivent créer qu'un seul rattachement.
  const concurrentInvitation = await request(app)
    .post('/api/pro/company-group/invitations')
    .set('Authorization', 'Bearer ' + groupOwnerToken)
    .send({ email: outsider.email });
  assert.equal(concurrentInvitation.status, 201, concurrentInvitation.text);
  const concurrentInviteToken = new URL(concurrentInvitation.body.invitation_url).searchParams.get('token');
  const concurrentChallenge = await request(app)
    .post('/api/pro/company-group/invitations/accept')
    .set('Authorization', 'Bearer ' + outsiderToken)
    .send({ token: concurrentInviteToken });
  assert.equal(concurrentChallenge.status, 202, concurrentChallenge.text);
  const [[concurrentProof]] = await pool.query(
    'SELECT id FROM pro_company_group_invitation_verifications WHERE invitation_id = ?',
    [concurrentInvitation.body.id]
  );
  const [[concurrentOutbox]] = await pool.query(
    "SELECT payload_enc FROM email_outbox WHERE entity_type = 'company_group_invitation_verification' AND entity_id = ?",
    [concurrentProof.id]
  );
  const concurrentVerificationTokens = getVerificationTokens(decryptEmailPayload(concurrentOutbox.payload_enc).verification_url);
  const concurrentVerificationToken = concurrentVerificationTokens.verificationToken;
  assert.match(concurrentVerificationToken || '', /^[a-f0-9]{64}$/i);
  const concurrentAcceptances = await Promise.all([
    request(app)
      .post('/api/pro/company-group/invitations/accept/verify')
      .set('Authorization', 'Bearer ' + outsiderToken)
      .send({ token: concurrentInviteToken, verification_token: concurrentVerificationToken }),
    request(app)
      .post('/api/pro/company-group/invitations/accept/verify')
      .set('Authorization', 'Bearer ' + outsiderToken)
      .send({ token: concurrentInviteToken, verification_token: concurrentVerificationToken })
  ]);
  assert.deepEqual(
    concurrentAcceptances.map(result => result.status).sort((a, b) => a - b),
    [200, 404],
    'une seule requête concurrente peut accepter et consommer le jeton'
  );
  const [[concurrentMembershipCount]] = await pool.query(
    'SELECT COUNT(*) AS total FROM pro_company_group_companies WHERE company_owner_id = ?',
    [outsiderId]
  );
  assert.equal(Number(concurrentMembershipCount.total), 1, 'une seule ligne de rattachement doit exister');
  const leaveConcurrent = await request(app)
    .delete('/api/pro/company-group/leave')
    .set('Authorization', 'Bearer ' + outsiderToken);
  assert.equal(leaveConcurrent.status, 200, leaveConcurrent.text);
});

after(async () => {
  try {
    await nettoyerUtilisateur(groupOwnerId);
    await nettoyerUtilisateur(subsidiaryOwnerId);
    await nettoyerUtilisateur(outsiderId);
    await nettoyerUtilisateur(starterId);
    await nettoyerUtilisateur(teamRecipientId);
    await nettoyerUtilisateur(teamConcurrentRecipientId);
  } finally {
    await teardownTestEnvironment();
  }
});
