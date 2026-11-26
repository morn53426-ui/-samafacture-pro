/**
 * Module "team" — extrait depuis routes/professionnel.js (Phase 3b, chunkage par route).
 */
const router = require('express').Router();

const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { pool } = require('../../config/db');
const { requireAuth } = require('../../middleware/auth');
const { resolveTenant, requirePermission, ROLE_PERMISSIONS } = require('../../middleware/tenant');
const { sendMail, isSmtpConfigured } = require('../../config/mailer');
const { encryptSecret, decryptSecret, queueWebhookEvent } = require('../../utils/pro-webhooks');
const { waveConfigured, paydunyaConfigured, creerSessionWave, creerFacturePaydunya } = require('../../config/payments');
const net = require('net');
const { SUPPORTED_COUNTRIES, SUPPORTED_CURRENCIES, SUPPORTED_TIMEZONES } = require('../../config/localization');
const { localDateString } = require('../../utils/local-date');
const { formatAmountWithCurrency, normalizeCurrency } = require('../../utils/money-format');
const { isEnterprisePlan } = require('../../utils/plans');
const { encryptEmailPayload, decryptEmailPayload } = require('../../utils/email-outbox-crypto');
const { optionalText, optionalIsoDate } = require('../../utils/optional-fields');
const { htmlEscape } = require('../../utils/professionnel');
const {
  ensureDefaultWarehouse,
  ensureAccountingDefaults,
  normalizeAccountingCategoryKey,
  buildInvoiceAccountingLines,
  requireExpenseCorrespondence,
  ACCOUNTING_SALE_MAPPING_KEYS,
  postSystemEntry
} = require('./misc');


const owner = (req) => Number(req.tenantId);
const actor = (req) => Number(req.actorId || req.user.id);
const idOk = (value) => /^\d+$/.test(String(value || '')) && Number(value) > 0;
const money = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999999) return null;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

function paymentTreasuryAccount(method) {
  const normalized = String(method || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const bankMethods = new Set([
    'wave', 'orange money', 'paydunya', 'virement bancaire', 'virement',
    'cheque', 'carte bancaire', 'carte'
  ]);
  if (bankMethods.has(normalized)) return '521';
  if (['especes', 'cash'].includes(normalized)) return '571';
  return null;
}

async function safeDateForUser(value, userId) {
  const valid = optionalIsoDate(value);
  if (valid) return valid;
  const [accounts] = await pool.query(
    'SELECT fuseau_horaire FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  return localDateString(accounts?.[0]?.fuseau_horaire || 'Africa/Dakar');
}

const randomRef = (prefix) => prefix + '-' + new Date().getFullYear() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
const parseJson = (value, fallback) => {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return fallback; }
};

async function audit(req, action, entity, entityId, details) {
  try {
    await pool.query(
      'INSERT INTO pro_audit_logs (user_id, acteur_user_id, action, entite, entite_id, details_json, adresse_ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [owner(req), actor(req), action, entity, entityId == null ? null : String(entityId), details ? JSON.stringify(details) : null, req.ip || null]
    );
  } catch (err) {
    console.error('Écriture du journal professionnel impossible :', err.message);
  }
}

async function clientOwned(userId, clientId) {
  const [rows] = await pool.query('SELECT * FROM clients WHERE id = ? AND user_id = ? LIMIT 1', [clientId, userId]);
  return rows[0] || null;
}
async function invoiceOwned(userId, invoiceId) {
  const [rows] = await pool.query('SELECT * FROM factures WHERE id = ? AND user_id = ? LIMIT 1', [invoiceId, userId]);
  return rows[0] || null;
}


function parseCompanyGroupPagination(query) {
  const requested = query.page !== undefined || query.limit !== undefined;
  if (!requested) return null;
  const rawPage = query.page === undefined ? '1' : query.page;
  const rawLimit = query.limit === undefined ? '20' : query.limit;
  if (Array.isArray(rawPage) || Array.isArray(rawLimit) ||
      !/^\d+$/.test(String(rawPage)) || !/^\d+$/.test(String(rawLimit))) {
    return { error: 'Paramètres de pagination invalides.' };
  }
  const page = Number(rawPage);
  const limit = Number(rawLimit);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
    return { error: 'La page doit être positive et la limite comprise entre 1 et 50.' };
  }
  return { page, limit, offset: (page - 1) * limit };
}

function companyGroupPaginationMeta(total, pagination) {
  if (!pagination) return undefined;
  const totalPages = Math.ceil(total / pagination.limit);
  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages,
    from: total ? pagination.offset + 1 : 0,
    to: Math.min(pagination.offset + pagination.limit, total),
    hasPrevious: pagination.page > 1 && totalPages > 0,
    hasNext: pagination.page < totalPages
  };
}

async function assertEnterpriseGroupOwner(req, res) {
  // Le groupe appartient toujours au compte de connexion (actor), même si l'utilisateur
  // a actuellement sélectionné une filiale via X-SF-Company-Owner.
  const [rows] = await pool.query('SELECT plan FROM users WHERE id = ? LIMIT 1', [actor(req)]);
  if (!rows.length || !isEnterprisePlan(rows[0].plan)) {
    res.status(403).json({
      error: 'La gestion multi-sociétés est réservée à la formule Entreprise.',
      code: 'PLAN_ENTREPRISE_REQUIS'
    });
    return false;
  }
  return true;
}

/* ----------------------------- VENTES ---------------------------------- */

router.get('/team', async (req, res, next) => {
  try {
    const [members] = await pool.query('SELECT m.id, m.member_user_id, m.role, m.permissions_json, m.active, m.created_at, u.nom, u.email FROM pro_team_members m JOIN users u ON u.id = m.member_user_id WHERE m.owner_user_id = ? ORDER BY m.created_at DESC', [owner(req)]);
    const [invites] = await pool.query('SELECT id, email, role, statut, expire_at, created_at FROM pro_team_invitations WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [owner(req)]);
    const [roles] = await pool.query('SELECT id, nom, permissions_json, created_at FROM pro_team_roles WHERE user_id = ? ORDER BY nom', [owner(req)]);
    res.json({ membres: members.map(m => ({ ...m, permissions: parseJson(m.permissions_json, []) })), invitations: invites, roles: roles.map(r => ({ ...r, permissions: parseJson(r.permissions_json, []) })) });
  } catch (err) { next(err); }
});

router.post('/team/roles', async (req, res, next) => {
  try {
    const nom = String(req.body.nom || '').trim().slice(0, 100);
    const allowed = ['dashboard.read','clients.read','clients.write','products.read','products.write','invoices.read','invoices.write','payments.read','payments.write','expenses.read','expenses.write','reports.read','documents.read','documents.write','sales.read','sales.write','cash.read','cash.write','team.read','team.manage','integrations.read','integrations.manage','automations.read','automations.manage','purchasing.read','purchasing.write','inventory.read','inventory.write','accounting.read','accounting.write','crm.read','crm.write','localization.read','localization.write','audit.read'];
    const permissions = Array.isArray(req.body.permissions) ? [...new Set(req.body.permissions.filter(p => allowed.includes(p)))] : [];
    if (!nom || !permissions.length) return res.status(400).json({ error: 'Nom et au moins une permission valide obligatoires.' });
    const [result] = await pool.query('INSERT INTO pro_team_roles (user_id, nom, permissions_json) VALUES (?, ?, ?)', [owner(req), nom, JSON.stringify(permissions)]);
    await audit(req, 'equipe.role_cree', 'role', result.insertId, { nom, permissions });
    res.status(201).json({ id: result.insertId, nom, permissions });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ce rôle existe déjà.' });
    next(err);
  }
});

router.post('/team/invitations', async (req, res, next) => {
  let conn;
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const role = String(req.body.role || 'employe').trim();
    const allowedRoles = ['administrateur','manager','comptable','commercial','caissier','employe','lecture_seule'];
    const allowedPermissions = ['dashboard.read','clients.read','clients.write','products.read','products.write','invoices.read','invoices.write','payments.read','payments.write','expenses.read','expenses.write','reports.read','documents.read','documents.write','sales.read','sales.write','cash.read','cash.write','team.read','team.manage','integrations.read','integrations.manage','automations.read','automations.manage','purchasing.read','purchasing.write','inventory.read','inventory.write','accounting.read','accounting.write','crm.read','crm.write','localization.read','localization.write','audit.read'];
    let permissions = ROLE_PERMISSIONS[role];
    if (role === 'personnalise') permissions = Array.isArray(req.body.permissions) ? [...new Set(req.body.permissions.filter(p => allowedPermissions.includes(p)))] : [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (!allowedRoles.includes(role) && role !== 'personnalise')) {
      return res.status(400).json({ error: 'Adresse email ou rôle invalide.' });
    }
    if (!Array.isArray(permissions) || !permissions.length || permissions.length > 30) {
      return res.status(400).json({ error: 'Les permissions du rôle sont invalides.' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [[ownerAccount]] = await conn.query('SELECT id, email FROM users WHERE id = ? LIMIT 1 FOR UPDATE', [owner(req)]);
    if (!ownerAccount) {
      await conn.rollback();
      return res.status(404).json({ error: 'Compte propriétaire introuvable.' });
    }
    if (String(ownerAccount.email || '').toLowerCase() === email) {
      await conn.rollback();
      return res.status(400).json({ error: 'Vous ne pouvez pas vous inviter vous-même.' });
    }
    const [already] = await conn.query(
      'SELECT id FROM pro_team_members WHERE owner_user_id = ? AND active = 1 AND member_user_id IN (SELECT id FROM users WHERE LOWER(email) = LOWER(?)) LIMIT 1',
      [owner(req), email]
    );
    if (already.length) {
      await conn.rollback();
      return res.status(409).json({ error: 'Cet utilisateur est déjà membre de votre équipe.' });
    }
    const [pending] = await conn.query(
      "SELECT id FROM pro_team_invitations WHERE user_id = ? AND LOWER(email) = LOWER(?) AND statut = 'envoyee' AND expire_at > NOW() LIMIT 1 FOR UPDATE",
      [owner(req), email]
    );
    if (pending.length) {
      await conn.rollback();
      return res.status(409).json({ error: 'Une invitation active existe déjà pour cette adresse email.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const expires = new Date(Date.now() + 7 * 86400000);
    const [result] = await conn.query(
      'INSERT INTO pro_team_invitations (user_id, email, role, permissions_json, token_hash, expire_at) VALUES (?, ?, ?, ?, ?, ?)',
      [owner(req), email, role, JSON.stringify(permissions), hash, expires]
    );
    const base = (process.env.APP_URL || (req.protocol + '://' + req.get('host'))).replace(/\/$/, '');
    const inviteUrl = base + '/invitation.html?type=team#token=' + encodeURIComponent(token);
    const subject = 'Invitation à rejoindre SamaFacture Pro';
    const text = 'Vous êtes invité à rejoindre un espace SamaFacture Pro. Connectez-vous ou créez un compte avec cette adresse email, puis ouvrez ce lien pour commencer la vérification : ' +
      inviteUrl + '\n\nLe rattachement à l’équipe ne sera effectué qu’après une confirmation supplémentaire envoyée à cette même adresse email. Ce lien expire dans 7 jours.';
    const payloadEnc = encryptEmailPayload({ to: email, subject, text, invitation_url: inviteUrl });
    const idempotencyKey = crypto.createHash('sha256').update('team-invitation:' + result.insertId).digest('hex');
    await conn.query(
      "INSERT INTO email_outbox (owner_user_id, entity_type, entity_id, idempotency_key, payload_enc, statut, tentatives, prochaine_tentative) " +
      "VALUES (?, 'team_invitation', ?, ?, ?, 'queued', 0, NOW())",
      [owner(req), result.insertId, idempotencyKey, payloadEnc]
    );
    await conn.query(
      'INSERT INTO pro_audit_logs (user_id, acteur_user_id, action, entite, entite_id, details_json, adresse_ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [owner(req), actor(req), 'equipe.invitation_creee', 'invitation', String(result.insertId), JSON.stringify({ email, role, email_queued: true }), req.ip || null]
    );
    await conn.commit();
    res.status(201).json({
      id: result.insertId, email, role, email_en_file: true, email_statut: 'queued',
      message: 'Invitation créée. Le lien a été placé dans la file d’envoi sécurisée.'
    });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Une invitation ou un membre existe déjà pour cette adresse email.' });
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.post('/team/invitations/accept', async (req, res, next) => {
  let conn;
  try {
    const token = String(req.body.token || '');
    if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(400).json({ error: 'Jeton d’invitation invalide.' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [[currentAccount]] = await conn.query(
      'SELECT id, email FROM users WHERE id = ? LIMIT 1 FOR UPDATE', [actor(req)]
    );
    if (!currentAccount?.email) {
      await conn.rollback();
      return res.status(403).json({ error: 'Le compte connecté doit disposer d’une adresse email.' });
    }
    const [invites] = await conn.query(
      "SELECT * FROM pro_team_invitations WHERE token_hash = ? AND statut = 'envoyee' AND expire_at > NOW() LIMIT 1 FOR UPDATE",
      [tokenHash]
    );
    const invite = invites[0];
    if (!invite) {
      await conn.rollback();
      return res.status(404).json({ error: 'Invitation expirée, révoquée ou déjà utilisée.' });
    }
    if (Number(invite.user_id) === actor(req)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Le propriétaire ne peut pas accepter sa propre invitation.' });
    }
    if (String(invite.email).toLowerCase() !== String(currentAccount.email).toLowerCase()) {
      await conn.rollback();
      return res.status(403).json({ error: 'Connectez-vous avec l’adresse email qui a reçu cette invitation.' });
    }
    const [[alreadyMember]] = await conn.query(
      'SELECT id FROM pro_team_members WHERE owner_user_id = ? AND member_user_id = ? AND active = 1 LIMIT 1 FOR UPDATE',
      [invite.user_id, actor(req)]
    );
    if (alreadyMember) {
      await conn.rollback();
      return res.status(409).json({ error: 'Vous êtes déjà membre de cette équipe.' });
    }
    const [[existingProof]] = await conn.query(
      "SELECT id, used_at, (expires_at > NOW()) AS is_active, (sent_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)) AS recently_sent " +
      "FROM pro_team_invitation_verifications WHERE invitation_id = ? LIMIT 1 FOR UPDATE",
      [invite.id]
    );
    if (existingProof && !existingProof.used_at && Number(existingProof.is_active) === 1 &&
        Number(existingProof.recently_sent) === 1) {
      const [[outbox]] = await conn.query(
        "SELECT statut FROM email_outbox WHERE entity_type = 'team_invitation_verification' AND entity_id = ? LIMIT 1",
        [existingProof.id]
      );
      await conn.commit();
      res.set('Cache-Control', 'no-store, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      return res.status(202).json({
        verification_required: true, email_en_file: true, email_statut: outbox?.statut || 'queued',
        message: 'Un lien de confirmation a déjà été demandé récemment. Consultez la boîte de réception de cette adresse avant de demander un nouvel envoi.'
      });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const expires = new Date(Date.now() + 20 * 60 * 1000);
    await conn.query(
      "INSERT INTO pro_team_invitation_verifications (invitation_id, member_user_id, token_hash, expires_at, sent_at, used_at) " +
      "VALUES (?, ?, ?, ?, NOW(), NULL) ON DUPLICATE KEY UPDATE member_user_id = VALUES(member_user_id), " +
      "token_hash = VALUES(token_hash), expires_at = VALUES(expires_at), sent_at = NOW(), used_at = NULL",
      [invite.id, actor(req), verificationHash, expires]
    );
    const [[proof]] = await conn.query(
      'SELECT id FROM pro_team_invitation_verifications WHERE invitation_id = ? LIMIT 1', [invite.id]
    );
    const base = (process.env.APP_URL || (req.protocol + '://' + req.get('host'))).replace(/\/$/, '');
    const verificationUrl = base + '/invitation.html?type=team#token=' +
      encodeURIComponent(token) + '&verification_token=' + encodeURIComponent(verificationToken);
    const subject = 'Confirmez votre adresse email pour rejoindre SamaFacture Pro';
    const text = 'Une demande a été faite pour rejoindre une équipe SamaFacture Pro. Pour confirmer que vous contrôlez cette adresse email et autoriser le rattachement, ouvrez ce lien valable 20 minutes : ' +
      verificationUrl + '\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez ce message. Aucun accès à l’équipe ne sera accordé sans cette confirmation.';
    const payloadEnc = encryptEmailPayload({ to: invite.email, subject, text, verification_url: verificationUrl });
    const idempotencyKey = crypto.createHash('sha256').update('team-invitation-verification:' + proof.id).digest('hex');
    await conn.query(
      "INSERT INTO email_outbox (owner_user_id, entity_type, entity_id, idempotency_key, payload_enc, statut, tentatives, prochaine_tentative) " +
      "VALUES (?, 'team_invitation_verification', ?, ?, ?, 'queued', 0, NOW()) " +
      "ON DUPLICATE KEY UPDATE payload_enc = VALUES(payload_enc), statut = 'queued', tentatives = 0, " +
      "prochaine_tentative = NOW(), verrouille_le = NULL, lock_token = NULL, dernier_code_erreur = NULL, envoye_le = NULL, updated_at = NOW()",
      [invite.user_id, proof.id, idempotencyKey, payloadEnc]
    );
    await conn.query(
      'INSERT INTO pro_audit_logs (user_id, acteur_user_id, action, entite, entite_id, details_json, adresse_ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [invite.user_id, actor(req), 'equipe.invitation_verification_demandee', 'invitation', String(invite.id), JSON.stringify({ email_verified: false }), req.ip || null]
    );
    await conn.commit();
    res.set('Cache-Control', 'no-store, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return res.status(202).json({
      verification_required: true, email_en_file: true, email_statut: 'queued',
      message: 'Un lien de confirmation a été placé dans la file d’envoi sécurisée. L’accès à l’équipe ne sera accordé qu’après ouverture de ce lien depuis la boîte email invitée.'
    });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Cette invitation ne peut plus être acceptée.' });
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.post('/team/invitations/accept/verify', async (req, res, next) => {
  let conn;
  try {
    const token = String(req.body.token || '');
    const verificationToken = String(req.body.verification_token || '');
    if (!/^[a-f0-9]{64}$/i.test(token) || !/^[a-f0-9]{64}$/i.test(verificationToken)) {
      return res.status(400).json({ error: 'Lien de vérification invalide.' });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const verificationHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [[currentAccount]] = await conn.query(
      'SELECT id, email FROM users WHERE id = ? LIMIT 1 FOR UPDATE', [actor(req)]
    );
    if (!currentAccount?.email) {
      await conn.rollback();
      return res.status(403).json({ error: 'Le compte connecté doit disposer d’une adresse email.' });
    }
    const [invites] = await conn.query(
      "SELECT * FROM pro_team_invitations WHERE token_hash = ? AND statut = 'envoyee' AND expire_at > NOW() LIMIT 1 FOR UPDATE",
      [tokenHash]
    );
    const invite = invites[0];
    if (!invite) {
      await conn.rollback();
      return res.status(404).json({ error: 'Invitation expirée, révoquée ou déjà utilisée.' });
    }
    if (Number(invite.user_id) === actor(req)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Le propriétaire ne peut pas accepter sa propre invitation.' });
    }
    if (String(invite.email).toLowerCase() !== String(currentAccount.email).toLowerCase()) {
      await conn.rollback();
      return res.status(403).json({ error: 'Connectez-vous avec le compte associé à l’adresse email invitée.' });
    }
    const [[alreadyMember]] = await conn.query(
      'SELECT id FROM pro_team_members WHERE owner_user_id = ? AND member_user_id = ? AND active = 1 LIMIT 1 FOR UPDATE',
      [invite.user_id, actor(req)]
    );
    if (alreadyMember) {
      await conn.rollback();
      return res.status(409).json({ error: 'Vous êtes déjà membre de cette équipe.' });
    }
    const [proofs] = await conn.query(
      "SELECT id FROM pro_team_invitation_verifications WHERE invitation_id = ? AND member_user_id = ? AND token_hash = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1 FOR UPDATE",
      [invite.id, actor(req), verificationHash]
    );
    const proof = proofs[0];
    if (!proof) {
      await conn.rollback();
      return res.status(404).json({ error: 'Le lien de confirmation est expiré, invalide ou déjà utilisé. Recommencez depuis votre invitation.' });
    }
    const [used] = await conn.query(
      "UPDATE pro_team_invitation_verifications SET used_at = NOW() WHERE id = ? AND member_user_id = ? AND token_hash = ? AND used_at IS NULL AND expires_at > NOW()",
      [proof.id, actor(req), verificationHash]
    );
    if (used.affectedRows !== 1) {
      await conn.rollback();
      return res.status(409).json({ error: 'Ce lien de confirmation a déjà été utilisé.' });
    }
    const permissionsJson = typeof invite.permissions_json === 'string'
      ? invite.permissions_json
      : JSON.stringify(invite.permissions_json || []);
    await conn.query(
      'INSERT INTO pro_team_members (owner_user_id, member_user_id, role, permissions_json) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role), permissions_json = VALUES(permissions_json), active = 1',
      [invite.user_id, actor(req), invite.role, permissionsJson]
    );
    const [accepted] = await conn.query(
      "UPDATE pro_team_invitations SET statut = 'acceptee', accepted_user_id = ?, accepted_at = NOW() WHERE id = ? AND user_id = ? AND statut = 'envoyee'",
      [actor(req), invite.id, invite.user_id]
    );
    if (accepted.affectedRows !== 1) {
      await conn.rollback();
      return res.status(409).json({ error: 'Cette invitation a déjà été acceptée.' });
    }
    await conn.query(
      "UPDATE email_outbox SET statut = 'cancelled', verrouille_le = NULL, lock_token = NULL, dernier_code_erreur = 'invitation_accepted', updated_at = NOW() " +
      "WHERE owner_user_id = ? AND ((entity_type = 'team_invitation' AND entity_id = ?) OR (entity_type = 'team_invitation_verification' AND entity_id = ?)) AND statut IN ('queued', 'retry')",
      [invite.user_id, invite.id, proof.id]
    );
    await conn.query(
      'INSERT INTO pro_audit_logs (user_id, acteur_user_id, action, entite, entite_id, details_json, adresse_ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [invite.user_id, actor(req), 'equipe.invitation_acceptee', 'invitation', String(invite.id), JSON.stringify({ owner_user_id: invite.user_id, email_verified: true }), req.ip || null]
    );
    await conn.commit();
    res.set('Cache-Control', 'no-store, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({
      success: true,
      entreprise_id: invite.user_id,
      message: 'Adresse email confirmée. Invitation acceptée. Reconnectez-vous pour ouvrir l’espace de cette entreprise.'
    });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Vous êtes déjà membre de cette équipe.' });
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.delete('/team/:memberId', async (req, res, next) => {
  try {
    if (!idOk(req.params.memberId)) return res.status(400).json({ error: 'Identifiant de membre invalide.' });
    const [result] = await pool.query('UPDATE pro_team_members SET active = 0 WHERE id = ? AND owner_user_id = ?', [req.params.memberId, owner(req)]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Membre introuvable.' });
    await audit(req, 'equipe.membre_desactive', 'membre', req.params.memberId, {});
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/team/companies', async (req, res, next) => {
  try {
    const [teamRows] = await pool.query(
      'SELECT m.owner_user_id AS id, u.entreprise_nom, u.nom, m.role, \'equipe\' AS source FROM pro_team_members m JOIN users u ON u.id = m.owner_user_id WHERE m.member_user_id = ? AND m.active = 1',
      [actor(req)]
    );
    const [groupRows] = await pool.query(
      `SELECT gc.company_owner_id AS id, u.entreprise_nom, u.nom,
              'administrateur' AS role, 'groupe' AS source,
              gc.is_primary, gc.linked_at
       FROM pro_company_group_companies gc
       JOIN pro_company_groups g ON g.id = gc.group_id
       JOIN users u ON u.id = gc.company_owner_id
       WHERE g.owner_user_id = ?
       ORDER BY gc.is_primary DESC, u.entreprise_nom ASC`,
      [actor(req)]
    );
    const byId = new Map();
    for (const item of [...teamRows, ...groupRows]) byId.set(Number(item.id), item);
    res.json({
      entreprises: [...byId.values()],
      entreprise_active: owner(req),
      permissions: req.permissions || []
    });
  } catch (err) { next(err); }
});


/* ---------------------- GROUPE MULTI-SOCIÉTÉS (ENTREPRISE) ------------- */

router.get('/company-group/membership', async (req, res, next) => {
  try {
    const [[membership]] = await pool.query(
      `SELECT g.id AS group_id, g.nom AS group_name, g.owner_user_id,
              owner.entreprise_nom AS group_owner_company,
              owner.plan AS group_plan,
              gc.is_primary
       FROM pro_company_group_companies gc
       JOIN pro_company_groups g ON g.id = gc.group_id
       JOIN users owner ON owner.id = g.owner_user_id
       WHERE gc.company_owner_id = ?
       LIMIT 1`,
      [actor(req)]
    );
    if (!membership) return res.json({ membre: false });
    res.json({
      membre: true,
      groupe: {
        id: Number(membership.group_id),
        nom: membership.group_name,
        entreprise_proprietaire: membership.group_owner_company,
        actif: isEnterprisePlan(membership.group_plan)
      },
      societe_principale: Number(membership.is_primary) === 1,
      peut_quitter: Number(membership.is_primary) !== 1
    });
  } catch (err) { next(err); }
});

router.get('/company-group', async (req, res, next) => {
  try {
    if (!await assertEnterpriseGroupOwner(req, res)) return;
    const pagination = parseCompanyGroupPagination(req.query);
    if (pagination?.error) return res.status(400).json({ error: pagination.error });
    const [groups] = await pool.query(
      'SELECT id, owner_user_id, nom, created_at, updated_at FROM pro_company_groups WHERE owner_user_id = ? LIMIT 1',
      [actor(req)]
    );
    if (!groups.length) {
      return res.json({
        groupe: null, societes: [], invitations: [],
        ...(pagination ? { pagination: companyGroupPaginationMeta(0, pagination) } : {})
      });
    }
    const group = groups[0];
    const [[companyCount]] = await pool.query(
      'SELECT COUNT(*) AS total FROM pro_company_group_companies WHERE group_id = ?',
      [group.id]
    );
    const companyTotal = Number(companyCount.total || 0);
    const companySql = `
      SELECT gc.id AS liaison_id, gc.company_owner_id AS id, gc.is_primary, gc.linked_at,
             u.nom AS contact_nom, u.email, u.entreprise_nom, u.entreprise_ninea,
             u.entreprise_rccm, u.pays_code, u.devise
      FROM pro_company_group_companies gc
      JOIN users u ON u.id = gc.company_owner_id
      WHERE gc.group_id = ?
      ORDER BY gc.is_primary DESC, u.entreprise_nom ASC, gc.company_owner_id ASC`;
    const companyParams = [group.id];
    const companyQuery = pagination
      ? companySql + ' LIMIT ? OFFSET ?'
      : companySql;
    if (pagination) companyParams.push(pagination.limit, pagination.offset);
    const [companies] = await pool.query(companyQuery, companyParams);
    const [invitations] = await pool.query(
      `SELECT i.id, i.invited_email, i.statut, i.expire_at, i.created_at,
              e.statut AS email_statut, e.tentatives AS tentatives_email,
              e.envoye_le AS email_envoye_le, e.dernier_code_erreur AS email_code_erreur
       FROM pro_company_group_invitations i
       LEFT JOIN email_outbox e
         ON e.entity_type = 'company_group_invitation' AND e.entity_id = i.id
       WHERE i.group_id = ? AND i.statut = 'envoyee' AND i.expire_at > NOW()
       ORDER BY i.created_at DESC LIMIT 100`,
      [group.id]
    );
    res.json({
      groupe: group,
      societes: companies,
      invitations,
      ...(pagination ? { pagination: companyGroupPaginationMeta(companyTotal, pagination) } : {})
    });
  } catch (err) { next(err); }
});

router.post('/company-group', async (req, res, next) => {
  let conn;
  try {
    if (!await assertEnterpriseGroupOwner(req, res)) return;
    const nom = String(req.body.nom || '').trim().slice(0, 190);
    if (!nom) return res.status(400).json({ error: 'Le nom du groupe est obligatoire.' });
    const [[existing]] = await pool.query(
      'SELECT id FROM pro_company_groups WHERE owner_user_id = ? LIMIT 1',
      [actor(req)]
    );
    if (existing) return res.status(409).json({ error: 'Un groupe de sociétés existe déjà pour ce compte.' });

    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [groupResult] = await conn.query(
      'INSERT INTO pro_company_groups (owner_user_id, nom) VALUES (?, ?)',
      [actor(req), nom]
    );
    await conn.query(
      'INSERT INTO pro_company_group_companies (group_id, company_owner_id, is_primary) VALUES (?, ?, 1)',
      [groupResult.insertId, actor(req)]
    );
    await conn.query(
      'INSERT INTO pro_audit_logs (user_id, acteur_user_id, action, entite, entite_id, details_json, adresse_ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [actor(req), actor(req), 'groupe.societes.cree', 'groupe_societes', String(groupResult.insertId), JSON.stringify({ nom }), req.ip || null]
    );
    await conn.commit();
    res.status(201).json({ id: groupResult.insertId, nom, societe_principale_id: actor(req) });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Un groupe de sociétés existe déjà pour ce compte ou cette société.' });
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.post('/company-group/invitations', async (req, res, next) => {
  let conn;
  try {
    if (!await assertEnterpriseGroupOwner(req, res)) return;
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Adresse email invalide.' });
    }
    if (email === String(req.user.email || '').toLowerCase()) {
      return res.status(400).json({ error: 'La société principale appartient déjà à ce groupe.' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Verrouille la ligne du groupe : toutes les créations d'invitations du même
    // groupe passent ainsi l'une après l'autre, y compris entre plusieurs workers.
    const [[group]] = await conn.query(
      'SELECT id, nom FROM pro_company_groups WHERE owner_user_id = ? LIMIT 1 FOR UPDATE',
      [actor(req)]
    );
    if (!group) {
      await conn.rollback();
      return res.status(409).json({ error: 'Créez d’abord le groupe de sociétés.' });
    }

    const [[recipient]] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (recipient) {
      const [[alreadyLinked]] = await conn.query(
        'SELECT id FROM pro_company_group_companies WHERE company_owner_id = ? LIMIT 1',
        [recipient.id]
      );
      if (alreadyLinked) {
        await conn.rollback();
        return res.status(409).json({ error: 'Ce compte société appartient déjà à un groupe.' });
      }
    }

    const [[pending]] = await conn.query(
      'SELECT id FROM pro_company_group_invitations WHERE group_id = ? AND invited_email = ? AND statut = ? AND expire_at > NOW() LIMIT 1 FOR UPDATE',
      [group.id, email, 'envoyee']
    );
    if (pending) {
      await conn.rollback();
      return res.status(409).json({ error: 'Une invitation active existe déjà pour cette adresse.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expires = new Date(Date.now() + 7 * 86400000);
    const base = (process.env.APP_URL || (req.protocol + '://' + req.get('host'))).replace(/\/$/, '');
    const invitationUrl = base + '/invitation.html?type=company-group&token=' + token;
    const subject = 'Invitation à rejoindre un groupe de sociétés SamaFacture Pro';
    const text = 'Le groupe « ' + group.nom + ' » vous invite à rattacher votre société à son espace de gestion. Acceptez uniquement si vous autorisez explicitement le propriétaire du groupe à accéder à votre société : ' + invitationUrl;

    const [result] = await conn.query(
      'INSERT INTO pro_company_group_invitations (group_id, invited_email, token_hash, expire_at) VALUES (?, ?, ?, ?)',
      [group.id, email, tokenHash, expires]
    );

    // L'invitation et son email chiffré sont enregistrés dans la même transaction :
    // aucun lien/jeton brut ne reste en clair dans la base ou les journaux.
    const payloadEnc = encryptEmailPayload({ to: email, subject, text, invitation_url: invitationUrl });
    const idempotencyKey = crypto.createHash('sha256')
      .update('company-group-invitation:' + result.insertId)
      .digest('hex');
    await conn.query(
      `INSERT INTO email_outbox
       (owner_user_id, entity_type, entity_id, idempotency_key, payload_enc, statut, prochaine_tentative)
       VALUES (?, 'company_group_invitation', ?, ?, ?, 'queued', NOW())`,
      [actor(req), result.insertId, idempotencyKey, payloadEnc]
    );
    await conn.commit();

    await audit(req, 'groupe.societes.invitation_creee', 'invitation_groupe', result.insertId, { email });
    // Le jeton brut n'est retourné qu'au propriétaire et ne doit jamais être mis en cache.
    res.set('Cache-Control', 'no-store, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.status(201).json({
      id: result.insertId,
      email,
      invitation_url: invitationUrl,
      email_envoye: false,
      email_en_file: true,
      email_statut: 'queued',
      avertissement: 'Email placé dans la file d’envoi sécurisée. Il sera envoyé en arrière-plan et réessayé automatiquement en cas d’indisponibilité temporaire du serveur SMTP.',
      expire_le: expires
    });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.get('/company-group/invitations/:invitationId/link', async (req, res, next) => {
  try {
    if (!await assertEnterpriseGroupOwner(req, res)) return;
    if (!idOk(req.params.invitationId)) {
      return res.status(400).json({ error: 'Identifiant d’invitation invalide.' });
    }

    const [[invitation]] = await pool.query(
      `SELECT i.id, i.invited_email, i.token_hash, e.payload_enc
       FROM pro_company_group_invitations i
       JOIN pro_company_groups g ON g.id = i.group_id
       JOIN email_outbox e
         ON e.entity_type = 'company_group_invitation' AND e.entity_id = i.id
       WHERE i.id = ? AND g.owner_user_id = ?
         AND i.statut = 'envoyee' AND i.expire_at > NOW()
       LIMIT 1`,
      [req.params.invitationId, actor(req)]
    );
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation active introuvable ou expirée.' });
    }

    const payload = decryptEmailPayload(invitation.payload_enc);
    if (String(payload.to).toLowerCase() !== String(invitation.invited_email).toLowerCase()) {
      return res.status(409).json({
        error: 'Le lien de cette invitation ne peut pas être récupéré.',
        code: 'LIEN_INVITATION_INDISPONIBLE'
      });
    }
    const fallbackLink = typeof payload.text === 'string'
      ? payload.text.match(/https?:\/\/[^\s]+/)?.[0]
      : null;
    const invitationUrl = String(payload.invitation_url || fallbackLink || '');
    let parsed;
    try { parsed = new URL(invitationUrl); } catch {
      return res.status(409).json({
        error: 'Le lien de cette invitation ne peut pas être récupéré.',
        code: 'LIEN_INVITATION_INDISPONIBLE'
      });
    }
    const token = parsed.searchParams.get('token') || '';
    if (!['http:', 'https:'].includes(parsed.protocol) ||
        parsed.username || parsed.password ||
        parsed.pathname !== '/invitation.html' ||
        parsed.searchParams.get('type') !== 'company-group' ||
        !/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(409).json({
        error: 'Le lien de cette invitation ne peut pas être récupéré.',
        code: 'LIEN_INVITATION_INDISPONIBLE'
      });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest();
    const expectedHash = Buffer.from(invitation.token_hash, 'hex');
    if (expectedHash.length !== tokenHash.length || !crypto.timingSafeEqual(expectedHash, tokenHash)) {
      return res.status(409).json({
        error: 'Le lien de cette invitation ne peut pas être récupéré.',
        code: 'LIEN_INVITATION_INDISPONIBLE'
      });
    }

    await audit(req, 'groupe.societes.lien_invitation_recupere', 'invitation_groupe', invitation.id, {
      email: invitation.invited_email
    });
    // Le lien contient un jeton d'acceptation : désactive explicitement tout cache HTTP.
    res.set('Cache-Control', 'no-store, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({ id: invitation.id, email: invitation.invited_email, invitation_url: invitationUrl });
  } catch (err) { next(err); }
});

router.post('/company-group/invitations/:invitationId/retry-email', async (req, res, next) => {
  let conn;
  try {
    if (!await assertEnterpriseGroupOwner(req, res)) return;
    if (!idOk(req.params.invitationId)) {
      return res.status(400).json({ error: 'Identifiant d’invitation invalide.' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [[group]] = await conn.query(
      'SELECT id FROM pro_company_groups WHERE owner_user_id = ? LIMIT 1 FOR UPDATE',
      [actor(req)]
    );
    if (!group) {
      await conn.rollback();
      return res.status(404).json({ error: 'Groupe de sociétés introuvable.' });
    }

    const [[invitation]] = await conn.query(
      `SELECT i.id, i.invited_email, e.id AS email_id, e.statut AS email_statut
       FROM pro_company_group_invitations i
       JOIN email_outbox e
         ON e.entity_type = 'company_group_invitation' AND e.entity_id = i.id
       WHERE i.id = ? AND i.group_id = ?
         AND i.statut = 'envoyee' AND i.expire_at > NOW()
       LIMIT 1 FOR UPDATE`,
      [req.params.invitationId, group.id]
    );
    if (!invitation) {
      await conn.rollback();
      return res.status(404).json({ error: 'Invitation active introuvable ou expirée.' });
    }
    if (invitation.email_statut !== 'failed') {
      await conn.rollback();
      return res.status(409).json({
        error: 'Seul un email définitivement échoué peut être relancé.',
        code: 'EMAIL_NON_RELANCABLE',
        email_statut: invitation.email_statut
      });
    }

    const [updated] = await conn.query(
      `UPDATE email_outbox
       SET statut = 'queued', tentatives = 0, prochaine_tentative = NOW(),
           verrouille_le = NULL, lock_token = NULL, dernier_code_erreur = NULL,
           updated_at = NOW()
       WHERE id = ? AND owner_user_id = ? AND statut = 'failed'`,
      [invitation.email_id, actor(req)]
    );
    if (updated.affectedRows !== 1) {
      await conn.rollback();
      return res.status(409).json({ error: 'Cet email ne peut plus être relancé.' });
    }
    await conn.commit();
    await audit(req, 'groupe.societes.email_invitation_relance', 'invitation_groupe', invitation.id, {
      email: invitation.invited_email
    });
    res.status(202).json({
      success: true,
      email_statut: 'queued',
      message: 'Email remis dans la file d’envoi sécurisée.'
    });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.post('/company-group/invitations/accept', async (req, res, next) => {
  let conn;
  try {
    if (actor(req) !== owner(req) || req.companyMembership) {
      return res.status(403).json({ error: 'Connectez-vous au compte propriétaire de la société à rattacher.' });
    }
    const token = String(req.body.token || '');
    if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(400).json({ error: 'Jeton d’invitation invalide.' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [[currentAccount]] = await conn.query(
      'SELECT email FROM users WHERE id = ? LIMIT 1 FOR UPDATE',
      [actor(req)]
    );
    if (!currentAccount?.email) {
      await conn.rollback();
      return res.status(403).json({ error: 'Le compte connecté doit disposer d’une adresse email.' });
    }
    const [invites] = await conn.query(
      "SELECT i.id, i.group_id, i.invited_email, i.statut, i.expire_at, g.owner_user_id, g.nom AS group_name, u.plan AS owner_plan\n" +
      "FROM pro_company_group_invitations i JOIN pro_company_groups g ON g.id = i.group_id JOIN users u ON u.id = g.owner_user_id\n" +
      "WHERE i.token_hash = ? AND i.statut = 'envoyee' AND i.expire_at > NOW() LIMIT 1 FOR UPDATE",
      [tokenHash]
    );
    const invite = invites[0];
    if (!invite) {
      await conn.rollback();
      return res.status(404).json({ error: 'Invitation expirée, révoquée ou déjà utilisée.' });
    }
    if (String(invite.invited_email).toLowerCase() !== String(currentAccount.email).toLowerCase()) {
      await conn.rollback();
      return res.status(403).json({ error: 'Connectez-vous avec l’adresse email qui a reçu cette invitation.' });
    }
    if (!isEnterprisePlan(invite.owner_plan)) {
      await conn.rollback();
      return res.status(409).json({ error: 'Le compte propriétaire du groupe n’a plus la formule Entreprise active.' });
    }
    if (Number(invite.owner_user_id) === actor(req)) {
      await conn.rollback();
      return res.status(400).json({ error: 'La société principale ne peut pas être ajoutée une seconde fois.' });
    }
    const [[alreadyLinked]] = await conn.query(
      'SELECT id FROM pro_company_group_companies WHERE company_owner_id = ? LIMIT 1 FOR UPDATE',
      [actor(req)]
    );
    if (alreadyLinked) {
      await conn.rollback();
      return res.status(409).json({ error: 'Cette société est déjà rattachée à un groupe.' });
    }

    const [[existingProof]] = await conn.query(
      "SELECT id, used_at, (expires_at > NOW()) AS is_active, (sent_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)) AS recently_sent " +
      "FROM pro_company_group_invitation_verifications WHERE invitation_id = ? LIMIT 1 FOR UPDATE",
      [invite.id]
    );
    if (existingProof && !existingProof.used_at && Number(existingProof.is_active) === 1 &&
        Number(existingProof.recently_sent) === 1) {
      const [[outbox]] = await conn.query(
        "SELECT statut FROM email_outbox WHERE entity_type = 'company_group_invitation_verification' AND entity_id = ? LIMIT 1",
        [existingProof.id]
      );
      await conn.commit();
      res.set('Cache-Control', 'no-store, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      return res.status(202).json({
        verification_required: true,
        email_en_file: true,
        email_statut: outbox?.statut || 'queued',
        message: 'Un lien de vérification a déjà été demandé récemment. Consultez la boîte de réception de l’adresse invitée avant de demander un nouvel envoi.'
      });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const expires = new Date(Date.now() + 20 * 60 * 1000);
    await conn.query(
      "INSERT INTO pro_company_group_invitation_verifications (invitation_id, company_owner_id, token_hash, expires_at, sent_at, used_at) " +
      "VALUES (?, ?, ?, ?, NOW(), NULL) ON DUPLICATE KEY UPDATE company_owner_id = VALUES(company_owner_id), " +
      "token_hash = VALUES(token_hash), expires_at = VALUES(expires_at), sent_at = NOW(), used_at = NULL",
      [invite.id, actor(req), verificationHash, expires]
    );
    const [[proof]] = await conn.query(
      'SELECT id FROM pro_company_group_invitation_verifications WHERE invitation_id = ? LIMIT 1',
      [invite.id]
    );
    const base = (process.env.APP_URL || (req.protocol + '://' + req.get('host'))).replace(/\/$/, '');
    const verificationUrl = base + '/invitation.html?type=company-group#token=' +
      encodeURIComponent(token) + '&verification_token=' + encodeURIComponent(verificationToken);
    const subject = 'Confirmez votre adresse email pour rejoindre le groupe SamaFacture Pro';
    const text = 'Une demande a été faite pour rattacher votre société au groupe « ' + invite.group_name +
      ' ». Pour confirmer que vous contrôlez cette adresse email et autoriser le rattachement, ouvrez ce lien valable 20 minutes : ' +
      verificationUrl + '\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez ce message. Votre société ne sera pas rattachée sans cette confirmation.';
    const payloadEnc = encryptEmailPayload({
      to: invite.invited_email,
      subject,
      text,
      verification_url: verificationUrl
    });
    const idempotencyKey = crypto.createHash('sha256')
      .update('company-group-invitation-verification:' + proof.id)
      .digest('hex');
    await conn.query(
      "INSERT INTO email_outbox (owner_user_id, entity_type, entity_id, idempotency_key, payload_enc, statut, tentatives, prochaine_tentative) " +
      "VALUES (?, 'company_group_invitation_verification', ?, ?, ?, 'queued', 0, NOW()) " +
      "ON DUPLICATE KEY UPDATE payload_enc = VALUES(payload_enc), statut = 'queued', tentatives = 0, " +
      "prochaine_tentative = NOW(), verrouille_le = NULL, lock_token = NULL, dernier_code_erreur = NULL, envoye_le = NULL, updated_at = NOW()",
      [invite.owner_user_id, proof.id, idempotencyKey, payloadEnc]
    );
    await conn.commit();

    await audit(req, 'groupe.societes.verification_email_demandee', 'invitation_groupe', invite.id, {
      company_owner_id: actor(req)
    });
    res.set('Cache-Control', 'no-store, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return res.status(202).json({
      verification_required: true,
      email_en_file: true,
      email_statut: 'queued',
      message: 'Un lien de confirmation a été placé dans la file d’envoi sécurisée à l’adresse invitée. Le rattachement ne sera effectué qu’après ouverture de ce lien depuis cette boîte email.'
    });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Cette société appartient déjà à un groupe.' });
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.post('/company-group/invitations/accept/verify', async (req, res, next) => {
  let conn;
  try {
    if (actor(req) !== owner(req) || req.companyMembership) {
      return res.status(403).json({ error: 'Connectez-vous au compte propriétaire de la société à rattacher.' });
    }
    const token = String(req.body.token || '');
    const verificationToken = String(req.body.verification_token || '');
    if (!/^[a-f0-9]{64}$/i.test(token) || !/^[a-f0-9]{64}$/i.test(verificationToken)) {
      return res.status(400).json({ error: 'Lien de vérification invalide.' });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const verificationHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [[currentAccount]] = await conn.query(
      'SELECT email FROM users WHERE id = ? LIMIT 1 FOR UPDATE',
      [actor(req)]
    );
    if (!currentAccount?.email) {
      await conn.rollback();
      return res.status(403).json({ error: 'Le compte connecté doit disposer d’une adresse email.' });
    }
    const [invites] = await conn.query(
      "SELECT i.id, i.group_id, i.invited_email, i.statut, i.expire_at, g.owner_user_id, g.nom AS group_name, u.plan AS owner_plan\n" +
      "FROM pro_company_group_invitations i JOIN pro_company_groups g ON g.id = i.group_id JOIN users u ON u.id = g.owner_user_id\n" +
      "WHERE i.token_hash = ? AND i.statut = 'envoyee' AND i.expire_at > NOW() LIMIT 1 FOR UPDATE",
      [tokenHash]
    );
    const invite = invites[0];
    if (!invite) {
      await conn.rollback();
      return res.status(404).json({ error: 'Invitation expirée, révoquée ou déjà utilisée.' });
    }
    if (String(invite.invited_email).toLowerCase() !== String(currentAccount.email).toLowerCase()) {
      await conn.rollback();
      return res.status(403).json({ error: 'Connectez-vous avec le compte associé à l’adresse email invitée.' });
    }
    if (!isEnterprisePlan(invite.owner_plan)) {
      await conn.rollback();
      return res.status(409).json({ error: 'Le compte propriétaire du groupe n’a plus la formule Entreprise active.' });
    }
    if (Number(invite.owner_user_id) === actor(req)) {
      await conn.rollback();
      return res.status(400).json({ error: 'La société principale ne peut pas être ajoutée une seconde fois.' });
    }
    const [[alreadyLinked]] = await conn.query(
      'SELECT id FROM pro_company_group_companies WHERE company_owner_id = ? LIMIT 1 FOR UPDATE',
      [actor(req)]
    );
    if (alreadyLinked) {
      await conn.rollback();
      return res.status(409).json({ error: 'Cette société est déjà rattachée à un groupe.' });
    }
    const [companies] = await conn.query('SELECT id FROM users WHERE id = ? LIMIT 1', [actor(req)]);
    if (!companies.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Compte société introuvable.' });
    }
    const [proofs] = await conn.query(
      "SELECT id FROM pro_company_group_invitation_verifications " +
      "WHERE invitation_id = ? AND company_owner_id = ? AND token_hash = ? AND used_at IS NULL AND expires_at > NOW() " +
      "LIMIT 1 FOR UPDATE",
      [invite.id, actor(req), verificationHash]
    );
    const proof = proofs[0];
    if (!proof) {
      await conn.rollback();
      return res.status(404).json({ error: 'Le lien de confirmation est expiré, invalide ou déjà utilisé. Demandez un nouveau lien depuis l’invitation.' });
    }

    const [used] = await conn.query(
      "UPDATE pro_company_group_invitation_verifications SET used_at = NOW() " +
      "WHERE id = ? AND company_owner_id = ? AND token_hash = ? AND used_at IS NULL AND expires_at > NOW()",
      [proof.id, actor(req), verificationHash]
    );
    if (used.affectedRows !== 1) {
      await conn.rollback();
      return res.status(409).json({ error: 'Ce lien de confirmation a déjà été utilisé.' });
    }
    await conn.query(
      'INSERT INTO pro_company_group_companies (group_id, company_owner_id, is_primary) VALUES (?, ?, 0)',
      [invite.group_id, actor(req)]
    );
    await conn.query(
      "UPDATE pro_company_group_invitations SET statut = 'acceptee', accepted_company_owner_id = ?, accepted_at = NOW() WHERE id = ? AND group_id = ? AND statut = 'envoyee'",
      [actor(req), invite.id, invite.group_id]
    );
    await conn.query(
      "UPDATE email_outbox SET statut = 'cancelled', verrouille_le = NULL, lock_token = NULL, " +
      "dernier_code_erreur = 'invitation_accepted', updated_at = NOW() " +
      "WHERE owner_user_id = ? AND entity_type IN ('company_group_invitation', 'company_group_invitation_verification') " +
      "AND ((entity_type = 'company_group_invitation' AND entity_id = ?) " +
      "OR (entity_type = 'company_group_invitation_verification' AND entity_id = ?)) AND statut IN ('queued', 'retry')",
      [invite.owner_user_id, invite.id, proof.id]
    );
    await conn.query(
      'INSERT INTO pro_audit_logs (user_id, acteur_user_id, action, entite, entite_id, details_json, adresse_ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [invite.owner_user_id, actor(req), 'groupe.societe.invitation_acceptee', 'societe', String(actor(req)), JSON.stringify({ group_id: invite.group_id, group_name: invite.group_name, email_verified: true }), req.ip || null]
    );
    await conn.commit();

    res.set('Cache-Control', 'no-store, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({
      success: true,
      groupe_id: invite.group_id,
      entreprise_id: Number(invite.owner_user_id),
      message: 'Adresse email confirmée. Votre société a rejoint le groupe. Le propriétaire du groupe peut maintenant ouvrir cet espace avec les droits administrateur.'
    });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Cette société appartient déjà à un groupe.' });
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.delete('/company-group/companies/:companyOwnerId', async (req, res, next) => {
  try {
    if (!await assertEnterpriseGroupOwner(req, res)) return;
    if (!idOk(req.params.companyOwnerId)) return res.status(400).json({ error: 'Identifiant de société invalide.' });
    const companyOwnerId = Number(req.params.companyOwnerId);
    if (companyOwnerId === actor(req)) return res.status(400).json({ error: 'La société principale ne peut pas être retirée du groupe.' });
    const [[group]] = await pool.query(
      'SELECT id FROM pro_company_groups WHERE owner_user_id = ? LIMIT 1',
      [actor(req)]
    );
    if (!group) return res.status(404).json({ error: 'Groupe de sociétés introuvable.' });
    const [result] = await pool.query(
      'DELETE FROM pro_company_group_companies WHERE group_id = ? AND company_owner_id = ? AND is_primary = 0',
      [group.id, companyOwnerId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Société rattachée introuvable.' });
    await pool.query(
      'INSERT INTO pro_audit_logs (user_id, acteur_user_id, action, entite, entite_id, details_json, adresse_ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [actor(req), actor(req), 'groupe.societe.retiree', 'societe', String(companyOwnerId), JSON.stringify({ group_id: group.id }), req.ip || null]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/company-group/leave', async (req, res, next) => {
  try {
    // Cette action est exécutée par le propriétaire de la société qui avait accepté
    // l'invitation ; elle retire uniquement cette société non principale de son groupe.
    if (actor(req) !== Number(req.user.id)) return res.status(403).json({ error: 'Compte propriétaire requis.' });
    const [[link]] = await pool.query(
      `SELECT gc.id, gc.group_id, gc.is_primary, g.owner_user_id
       FROM pro_company_group_companies gc
       JOIN pro_company_groups g ON g.id = gc.group_id
       WHERE gc.company_owner_id = ?
       LIMIT 1`,
      [actor(req)]
    );
    if (!link) return res.status(404).json({ error: 'Cette société ne fait partie d’aucun groupe.' });
    if (Number(link.is_primary) === 1 || Number(link.owner_user_id) === actor(req)) {
      return res.status(409).json({ error: 'La société principale ne peut pas quitter son propre groupe. Supprimez le groupe depuis sa gestion.' });
    }
    const [result] = await pool.query(
      'DELETE FROM pro_company_group_companies WHERE id = ? AND company_owner_id = ? AND is_primary = 0',
      [link.id, actor(req)]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Rattachement introuvable.' });
    await pool.query(
      'INSERT INTO pro_audit_logs (user_id, acteur_user_id, action, entite, entite_id, details_json, adresse_ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [link.owner_user_id, actor(req), 'groupe.societe.quitte', 'societe', String(actor(req)), JSON.stringify({ group_id: link.group_id }), req.ip || null]
    );
    res.json({ success: true, message: 'Votre société a quitté le groupe. Ses données restent dans son compte indépendant.' });
  } catch (err) { next(err); }
});

router.delete('/company-group/invitations/:invitationId', async (req, res, next) => {
  let conn;
  try {
    if (!await assertEnterpriseGroupOwner(req, res)) return;
    if (!idOk(req.params.invitationId)) return res.status(400).json({ error: 'Identifiant d’invitation invalide.' });
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [[group]] = await conn.query(
      'SELECT id FROM pro_company_groups WHERE owner_user_id = ? LIMIT 1 FOR UPDATE',
      [actor(req)]
    );
    if (!group) {
      await conn.rollback();
      return res.status(404).json({ error: 'Groupe de sociétés introuvable.' });
    }
    const [[invitation]] = await conn.query(
      "SELECT id FROM pro_company_group_invitations WHERE id = ? AND group_id = ? AND statut = 'envoyee' LIMIT 1 FOR UPDATE",
      [req.params.invitationId, group.id]
    );
    if (!invitation) {
      await conn.rollback();
      return res.status(404).json({ error: 'Invitation active introuvable.' });
    }

    await conn.query(
      "UPDATE pro_company_group_invitations SET statut = 'revoquee' WHERE id = ? AND group_id = ? AND statut = 'envoyee'",
      [invitation.id, group.id]
    );
    // Annule seulement les messages qui n'ont pas encore été réclamés.
    // Un message déjà en cours de remise SMTP peut être impossible à rappeler.
    const [cancelled] = await conn.query(
      "UPDATE email_outbox SET statut = 'cancelled', verrouille_le = NULL, lock_token = NULL, dernier_code_erreur = 'invitation_revoked', updated_at = NOW() WHERE owner_user_id = ? AND entity_type = 'company_group_invitation' AND entity_id = ? AND statut IN ('queued', 'retry')",
      [actor(req), invitation.id]
    );
    const [[emailState]] = await conn.query(
      "SELECT statut FROM email_outbox WHERE entity_type = 'company_group_invitation' AND entity_id = ? LIMIT 1",
      [invitation.id]
    );
    await conn.commit();
    res.json({
      success: true,
      email_annule: Number(cancelled.affectedRows) > 0,
      email_en_cours: emailState?.statut === 'processing',
      email_deja_envoye: emailState?.statut === 'sent'
    });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.get('/company-group/dashboard', async (req, res, next) => {
  try {
    if (!await assertEnterpriseGroupOwner(req, res)) return;
    const pagination = parseCompanyGroupPagination(req.query);
    if (pagination?.error) return res.status(400).json({ error: pagination.error });
    const [[group]] = await pool.query(
      'SELECT id, nom FROM pro_company_groups WHERE owner_user_id = ? LIMIT 1',
      [actor(req)]
    );
    if (!group) return res.status(404).json({ error: 'Groupe de sociétés introuvable.' });

    const [companies] = await pool.query(
      `SELECT gc.company_owner_id AS id, gc.is_primary, u.entreprise_nom, u.nom AS contact_nom,
              u.pays_code, u.devise, u.fuseau_horaire
       FROM pro_company_group_companies gc
       JOIN users u ON u.id = gc.company_owner_id
       WHERE gc.group_id = ?
       ORDER BY gc.is_primary DESC, u.entreprise_nom ASC, gc.company_owner_id ASC`,
      [group.id]
    );
    const ids = companies.map(company => Number(company.id));
    const paginationMeta = companyGroupPaginationMeta(ids.length, pagination);
    if (!ids.length) {
      return res.json({
        groupe: group, societes: [], factures_par_devise: [], depenses_par_devise: [],
        stocks_par_devise: [], caisses_par_devise: [], performance_mensuelle: [], alertes: [],
        ...(pagination ? { pagination: paginationMeta } : {})
      });
    }

    const slots = ids.map(() => '?').join(', ');
    const dateCase = 'CASE f.user_id ' + companies.map(() => 'WHEN ? THEN ?').join(' ') + " ELSE '9999-12-31' END";
    const dateCaseParams = companies.flatMap(company => [
      Number(company.id),
      localDateString(company.fuseau_horaire || 'Africa/Dakar')
    ]);

    const [invoiceRows] = await pool.query(
      `SELECT f.user_id, f.devise, COUNT(*) AS nombre_factures,
              COALESCE(SUM(f.total),0) AS total_facture,
              COALESCE(SUM(f.montant_paye),0) AS total_encaisse,
              COALESCE(SUM(GREATEST(f.total - f.montant_paye,0)),0) AS total_impaye,
              SUM(CASE WHEN GREATEST(f.total - f.montant_paye,0) > 0.01 THEN 1 ELSE 0 END) AS nombre_impayees,
              COALESCE(SUM(CASE
                WHEN GREATEST(f.total - f.montant_paye,0) > 0.01
                 AND (f.statut = 'en_retard' OR (f.date_echeance IS NOT NULL AND f.date_echeance < ${dateCase}))
                THEN GREATEST(f.total - f.montant_paye,0) ELSE 0 END),0) AS total_en_retard,
              SUM(CASE
                WHEN GREATEST(f.total - f.montant_paye,0) > 0.01
                 AND (f.statut = 'en_retard' OR (f.date_echeance IS NOT NULL AND f.date_echeance < ${dateCase}))
                THEN 1 ELSE 0 END) AS nombre_en_retard
       FROM factures f
       WHERE f.user_id IN (${slots}) AND f.type = 'facture' AND f.statut <> 'annulee'
       GROUP BY f.user_id, f.devise`,
      [...dateCaseParams, ...dateCaseParams, ...ids]
    );

    const [expenseRows] = await pool.query(
      `SELECT d.user_id, u.devise, COUNT(*) AS nombre_depenses,
              COALESCE(SUM(d.montant),0) AS total_depenses
       FROM depenses d
       JOIN users u ON u.id = d.user_id
       WHERE d.user_id IN (${slots})
       GROUP BY d.user_id, u.devise`,
      ids
    );

    const [stockRows] = await pool.query(
      `SELECT p.user_id, u.devise, COUNT(*) AS nombre_produits,
              SUM(CASE WHEN COALESCE(s.quantite,p.stock,0) <= 0 THEN 1 ELSE 0 END) AS ruptures_stock,
              SUM(CASE WHEN COALESCE(s.quantite,p.stock,0) > 0
                         AND COALESCE(s.quantite,p.stock,0) <= COALESCE(p.stock_minimum,0)
                       THEN 1 ELSE 0 END) AS stocks_faibles,
              COALESCE(SUM(CASE WHEN p.prix_achat > 0
                THEN COALESCE(s.quantite,p.stock,0) * p.prix_achat ELSE 0 END),0) AS valeur_stock_estimee,
              SUM(CASE WHEN COALESCE(s.quantite,p.stock,0) > 0 AND COALESCE(p.prix_achat,0) <= 0
                       THEN 1 ELSE 0 END) AS produits_sans_cout
       FROM produits p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN (
         SELECT user_id, produit_id, SUM(quantite) AS quantite
         FROM pro_stocks_entrepots
         WHERE user_id IN (${slots})
         GROUP BY user_id, produit_id
       ) s ON s.user_id = p.user_id AND s.produit_id = p.id
       WHERE p.user_id IN (${slots}) AND COALESCE(p.type_catalogue, 'non_classe') <> 'service'
       GROUP BY p.user_id, u.devise`,
      [...ids, ...ids]
    );

    const [cashRows] = await pool.query(
      `SELECT c.user_id, c.devise, COUNT(*) AS nombre_caisses,
              COALESCE(SUM(c.solde_initial + COALESCE(o.solde_operations,0)),0) AS solde_total
       FROM pro_caisses c
       LEFT JOIN (
         SELECT user_id, caisse_id,
                SUM(CASE WHEN type = 'entree' THEN montant WHEN type = 'sortie' THEN -montant ELSE 0 END) AS solde_operations
         FROM pro_caisse_operations
         WHERE user_id IN (${slots})
         GROUP BY user_id, caisse_id
       ) o ON o.user_id = c.user_id AND o.caisse_id = c.id
       WHERE c.user_id IN (${slots}) AND c.active = 1
       GROUP BY c.user_id, c.devise`,
      [...ids, ...ids]
    );

    const [performanceRows] = await pool.query(
      `SELECT user_id, devise, DATE_FORMAT(date_emission,'%Y-%m') AS mois,
              COUNT(*) AS nombre_factures, COALESCE(SUM(total),0) AS total_facture
       FROM factures
       WHERE user_id IN (${slots}) AND type = 'facture' AND statut <> 'annulee'
         AND date_emission >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
       GROUP BY user_id, devise, mois
       ORDER BY mois ASC`,
      ids
    );

    const addCurrency = (map, row, factory, apply) => {
      const currency = row.devise || 'INCONNUE';
      const item = map.get(currency) || factory(currency);
      apply(item, row);
      map.set(currency, item);
    };

    const invoiceCurrencies = new Map();
    for (const row of invoiceRows) {
      addCurrency(invoiceCurrencies, row,
        devise => ({ devise, nombre_factures: 0, total_facture: 0, total_encaisse: 0, total_impaye: 0, nombre_impayees: 0, total_en_retard: 0, nombre_en_retard: 0 }),
        (item, value) => {
          for (const field of ['nombre_factures','total_facture','total_encaisse','total_impaye','nombre_impayees','total_en_retard','nombre_en_retard']) {
            item[field] += Number(value[field] || 0);
          }
        }
      );
    }

    const expenseCurrencies = new Map();
    for (const row of expenseRows) {
      addCurrency(expenseCurrencies, row,
        devise => ({ devise, nombre_depenses: 0, total_depenses: 0 }),
        (item, value) => {
          item.nombre_depenses += Number(value.nombre_depenses || 0);
          item.total_depenses += Number(value.total_depenses || 0);
        }
      );
    }

    const stockCurrencies = new Map();
    for (const row of stockRows) {
      addCurrency(stockCurrencies, row,
        devise => ({ devise, nombre_produits: 0, ruptures_stock: 0, stocks_faibles: 0, valeur_stock_estimee: 0, produits_sans_cout: 0 }),
        (item, value) => {
          for (const field of ['nombre_produits','ruptures_stock','stocks_faibles','valeur_stock_estimee','produits_sans_cout']) {
            item[field] += Number(value[field] || 0);
          }
        }
      );
    }

    const cashCurrencies = new Map();
    for (const row of cashRows) {
      addCurrency(cashCurrencies, row,
        devise => ({ devise, nombre_caisses: 0, solde_total: 0 }),
        (item, value) => {
          item.nombre_caisses += Number(value.nombre_caisses || 0);
          item.solde_total += Number(value.solde_total || 0);
        }
      );
    }

    const companyById = new Map(companies.map(company => [Number(company.id), company]));
    const companiesForResponse = pagination
      ? companies.slice(pagination.offset, pagination.offset + pagination.limit)
      : companies;
    const companiesWithTotals = companiesForResponse.map(company => {
      const companyId = Number(company.id);
      return {
        ...company,
        factures: invoiceRows.filter(row => Number(row.user_id) === companyId).map(row => ({
          devise: row.devise, nombre: Number(row.nombre_factures), total: Number(row.total_facture),
          encaisse: Number(row.total_encaisse), impaye: Number(row.total_impaye),
          nombre_impayees: Number(row.nombre_impayees), en_retard: Number(row.total_en_retard),
          nombre_en_retard: Number(row.nombre_en_retard)
        })),
        depenses: expenseRows.filter(row => Number(row.user_id) === companyId).map(row => ({
          devise: row.devise, nombre: Number(row.nombre_depenses), total: Number(row.total_depenses)
        })),
        stock: stockRows.filter(row => Number(row.user_id) === companyId).map(row => ({
          devise: row.devise, nombre_produits: Number(row.nombre_produits),
          ruptures: Number(row.ruptures_stock), stocks_faibles: Number(row.stocks_faibles),
          valeur_estimee: Number(row.valeur_stock_estimee), produits_sans_cout: Number(row.produits_sans_cout)
        })),
        caisses: cashRows.filter(row => Number(row.user_id) === companyId).map(row => ({
          devise: row.devise, nombre: Number(row.nombre_caisses), solde: Number(row.solde_total)
        })),
        performance: performanceRows.filter(row => Number(row.user_id) === companyId).map(row => ({
          devise: row.devise, mois: row.mois, nombre_factures: Number(row.nombre_factures),
          total_facture: Number(row.total_facture)
        }))
      };
    });

    const alertes = [];
    for (const row of invoiceRows) {
      if (Number(row.nombre_en_retard || 0) > 0) {
        const company = companyById.get(Number(row.user_id));
        alertes.push({
          type: 'factures_en_retard',
          societe_id: Number(row.user_id),
          societe: company?.entreprise_nom || company?.contact_nom || 'Société',
          devise: row.devise || company?.devise || 'INCONNUE',
          nombre: Number(row.nombre_en_retard),
          montant: Number(row.total_en_retard),
          societe_is_primary: Number(company?.is_primary) === 1
        });
      }
    }
    for (const row of stockRows) {
      const lowStock = Number(row.ruptures_stock || 0) + Number(row.stocks_faibles || 0);
      if (lowStock > 0) {
        const company = companyById.get(Number(row.user_id));
        alertes.push({
          type: 'stocks_a_surveiller',
          societe_id: Number(row.user_id),
          societe: company?.entreprise_nom || company?.contact_nom || 'Société',
          devise: row.devise || company?.devise || 'INCONNUE',
          ruptures: Number(row.ruptures_stock || 0),
          stocks_faibles: Number(row.stocks_faibles || 0),
          societe_is_primary: Number(company?.is_primary) === 1
        });
      }
    }

    res.json({
      groupe: group,
      societes: companiesWithTotals,
      factures_par_devise: [...invoiceCurrencies.values()],
      depenses_par_devise: [...expenseCurrencies.values()],
      stocks_par_devise: [...stockCurrencies.values()],
      caisses_par_devise: [...cashCurrencies.values()],
      performance_mensuelle: performanceRows.map(row => ({
        devise: row.devise || 'INCONNUE', mois: row.mois,
        nombre_factures: Number(row.nombre_factures), total_facture: Number(row.total_facture)
      })),
      alertes,
      ...(pagination ? { pagination: paginationMeta } : {}),
      note: 'Les montants sont regroupés par devise ; les soldes affichés concernent uniquement les caisses actives enregistrées dans SamaFacture. La valorisation du stock utilise les prix d’achat renseignés. Aucune conversion de change ou consolidation comptable OHADA n’est réalisée.'
    });
  } catch (err) { next(err); }
});

/* ---------------------------- DOCUMENTS -------------------------------- */

router.get('/documents', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, facture_id, client_id, nom_fichier, mime_type, taille_octets, signature_nom, signature_hash, signed_at, created_at FROM pro_documents WHERE user_id = ? ORDER BY created_at DESC LIMIT 300', [owner(req)]);
    res.json({ documents: rows });
  } catch (err) { next(err); }
});

router.post('/documents', async (req, res, next) => {
  try {
    const uid = owner(req), name = String(req.body.nom_fichier || '').trim().slice(0, 255);
    const mime = String(req.body.mime_type || '').toLowerCase();
    const allowed = ['application/pdf','image/jpeg','image/png'];
    const raw = String(req.body.contenu_base64 || '').replace(/^data:[^,]+,/, '');
    if (!name || !allowed.includes(mime) || !raw) return res.status(400).json({ error: 'Nom, type PDF/JPEG/PNG et contenu requis.' });
    const content = Buffer.from(raw, 'base64');
    if (!content.length || content.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'Le document doit peser moins de 5 Mo.' });
    const isPdf = mime === 'application/pdf' && content.subarray(0, 5).toString('ascii') === '%PDF-';
    const isPng = mime === 'image/png' && content.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
    const isJpeg = mime === 'image/jpeg' && content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
    if (!isPdf && !isPng && !isJpeg) return res.status(400).json({ error: 'Le contenu du fichier ne correspond pas à son type PDF/JPEG/PNG déclaré.' });
    if (req.body.facture_id && !await invoiceOwned(uid, Number(req.body.facture_id))) return res.status(404).json({ error: 'Facture introuvable.' });
    if (req.body.client_id && !await clientOwned(uid, Number(req.body.client_id))) return res.status(404).json({ error: 'Client introuvable.' });
    const [result] = await pool.query('INSERT INTO pro_documents (user_id, facture_id, client_id, nom_fichier, mime_type, taille_octets, contenu) VALUES (?, ?, ?, ?, ?, ?, ?)', [uid, req.body.facture_id || null, req.body.client_id || null, name, mime, content.length, content]);
    await audit(req, 'document.archive', 'document', result.insertId, { nom_fichier: name, taille: content.length });
    res.status(201).json({ id: result.insertId, nom_fichier: name, taille_octets: content.length });
  } catch (err) { next(err); }
});

router.get('/documents/:id/download', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT nom_fichier, mime_type, contenu FROM pro_documents WHERE id = ? AND user_id = ?', [req.params.id, owner(req)]);
    if (!rows.length) return res.status(404).json({ error: 'Document introuvable.' });
    res.setHeader('Content-Type', rows[0].mime_type);
    res.setHeader('Content-Disposition', 'attachment; filename="' + rows[0].nom_fichier.replace(/["\\\r\n]/g, '_') + '"');
    res.send(rows[0].contenu);
  } catch (err) { next(err); }
});

router.post('/documents/:id/signature', async (req, res, next) => {
  try {
    const nom = String(req.body.nom || '').trim().slice(0, 190);
    const data = String(req.body.signature_data || '');
    if (!nom || !/^data:image\/(png|jpeg);base64,/.test(data) || data.length > 700000) return res.status(400).json({ error: 'Nom du signataire et signature PNG/JPEG valides requis.' });
    const signatureBytes = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
    const signaturePng = data.startsWith('data:image/png;') && signatureBytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
    const signatureJpeg = data.startsWith('data:image/jpeg;') && signatureBytes.length >= 3 && signatureBytes[0] === 0xff && signatureBytes[1] === 0xd8 && signatureBytes[2] === 0xff;
    if (!signaturePng && !signatureJpeg) return res.status(400).json({ error: 'La signature image ne possède pas un contenu PNG/JPEG valide.' });
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    const [result] = await pool.query('UPDATE pro_documents SET signature_nom = ?, signature_data = ?, signature_hash = ?, signed_at = NOW() WHERE id = ? AND user_id = ?', [nom, data, hash, req.params.id, owner(req)]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Document introuvable.' });
    await audit(req, 'document.signe', 'document', req.params.id, { signataire: nom, signature_hash: hash });
    res.json({ success: true, signature_hash: hash, signed_at: new Date().toISOString(), niveau: 'signature interne simple — ne constitue pas une signature qualifiée' });
  } catch (err) { next(err); }
});

/* ---------------------- RAPPORTS / ANALYSES ----------------------------- */

router.get('/suppliers', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, nom, email, telephone, adresse, ninea, notes, actif, created_at FROM pro_fournisseurs WHERE user_id = ? ORDER BY nom LIMIT 500', [owner(req)]);
    res.json({ fournisseurs: rows });
  } catch (err) { next(err); }
});

router.post('/suppliers', async (req, res, next) => {
  try {
    const nom = String(req.body.nom || '').trim().slice(0, 190);
    if (!nom) return res.status(400).json({ error: 'Le nom du fournisseur est obligatoire.' });
    const [result] = await pool.query(
      'INSERT INTO pro_fournisseurs (user_id, nom, email, telephone, adresse, ninea, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [owner(req), nom, optionalText(req.body.email, 190), optionalText(req.body.telephone, 40), optionalText(req.body.adresse, 255), optionalText(req.body.ninea, 60), optionalText(req.body.notes, 5000)]
    );
    await audit(req, 'achat.fournisseur_cree', 'fournisseur', result.insertId, { nom });
    res.status(201).json({ id: result.insertId, nom });
  } catch (err) { next(err); }
});

router.put('/suppliers/:id', async (req, res, next) => {
  try {
    const nom = String(req.body.nom || '').trim().slice(0, 190);
    if (!nom) return res.status(400).json({ error: 'Le nom du fournisseur est obligatoire.' });
    const [result] = await pool.query(
      'UPDATE pro_fournisseurs SET nom = ?, email = ?, telephone = ?, adresse = ?, ninea = ?, notes = ?, actif = ? WHERE id = ? AND user_id = ?',
      [nom, optionalText(req.body.email, 190), optionalText(req.body.telephone, 40), optionalText(req.body.adresse, 255), optionalText(req.body.ninea, 60), optionalText(req.body.notes, 5000), req.body.actif === false ? 0 : 1, req.params.id, owner(req)]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Fournisseur introuvable.' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/warehouses', async (req, res, next) => {
  try {
    await ensureDefaultWarehouse(owner(req));
    const [rows] = await pool.query('SELECT id, code, nom, adresse, par_defaut, actif FROM pro_entrepots WHERE user_id = ? ORDER BY par_defaut DESC, nom', [owner(req)]);
    res.json({ entrepots: rows });
  } catch (err) { next(err); }
});

router.post('/warehouses', async (req, res, next) => {
  try {
    await ensureDefaultWarehouse(owner(req));
    const code = String(req.body.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);
    const nom = String(req.body.nom || '').trim().slice(0, 120);
    if (!code || !nom) return res.status(400).json({ error: 'Code et nom de l’entrepôt obligatoires.' });
    const [result] = await pool.query(
      'INSERT INTO pro_entrepots (user_id, code, nom, adresse, par_defaut) VALUES (?, ?, ?, ?, 0)',
      [owner(req), code, nom, optionalText(req.body.adresse, 255)]
    );
    res.status(201).json({ id: result.insertId, code, nom });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ce code d’entrepôt existe déjà.' });
    next(err);
  }
});

router.get('/purchase-orders', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT o.*, s.nom AS fournisseur_nom FROM pro_commandes_fournisseurs o JOIN pro_fournisseurs s ON s.id = o.fournisseur_id AND s.user_id = o.user_id WHERE o.user_id = ? ORDER BY o.date_commande DESC, o.id DESC LIMIT 250',
      [owner(req)]
    );
    res.json({ commandes: rows });
  } catch (err) { next(err); }
});

router.get('/purchase-orders/:id', async (req, res, next) => {
  try {
    const [orders] = await pool.query(
      'SELECT o.*, s.nom AS fournisseur_nom FROM pro_commandes_fournisseurs o JOIN pro_fournisseurs s ON s.id = o.fournisseur_id AND s.user_id = o.user_id WHERE o.id = ? AND o.user_id = ?',
      [req.params.id, owner(req)]
    );
    if (!orders.length) return res.status(404).json({ error: 'Commande fournisseur introuvable.' });
    const [lines] = await pool.query('SELECT * FROM pro_commandes_fournisseurs_lignes WHERE commande_id = ? AND user_id = ? ORDER BY id', [req.params.id, owner(req)]);
    res.json({ commande: orders[0], lignes: lines });
  } catch (err) { next(err); }
});

router.post('/purchase-orders', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req), supplierId = Number(req.body.fournisseur_id), lines = Array.isArray(req.body.lignes) ? req.body.lignes : [];
    if (!idOk(supplierId) || !lines.length || lines.length > 100) return res.status(400).json({ error: 'Fournisseur et 1 à 100 lignes obligatoires.' });
    let totalHt = 0, totalTax = 0;
    const normalized = [];
    const productIds = [];
    for (const line of lines) {
      const designation = String(line.designation || '').trim().slice(0, 255);
      const rawProductId = line.produit_id;
      const productId = rawProductId === undefined || rawProductId === null || rawProductId === '' ? null : Number(rawProductId);
      if (productId !== null && (!Number.isSafeInteger(productId) || productId <= 0)) {
        return res.status(400).json({ error: 'Le produit associé à une ligne de commande est invalide.' });
      }
      if (productId !== null) productIds.push(productId);
      const qty = Math.round(Number(line.quantite) * 1000) / 1000, price = Math.round(Number(line.prix_unitaire) * 100) / 100, tax = Math.round(Number(line.tva || 0) * 100) / 100;
      if (!designation || !Number.isFinite(qty) || qty <= 0 || qty > 10000000 || !Number.isFinite(price) || price < 0 || !Number.isFinite(tax) || tax < 0 || tax > 100) {
        return res.status(400).json({ error: 'Chaque ligne doit avoir une désignation, une quantité, un prix et une TVA valides.' });
      }
      const ht = Math.round(qty * price * 100) / 100;
      const vat = Math.round(ht * tax) / 100;
      totalHt += ht; totalTax += vat;
      normalized.push({ produit_id: productId, designation, qty, price, tax, total: ht + vat });
    }
    totalHt = Math.round(totalHt * 100) / 100;
    totalTax = Math.round(totalTax * 100) / 100;
    const uniqueProductIds = [...new Set(productIds)].sort((a, b) => a - b);
    const numero = randomRef('ACH');
    conn = await pool.getConnection();
    await conn.beginTransaction();
    // Verrou partagé avec les paramètres de devise : un changement de devise ne
    // peut pas passer entre la lecture du compte et l'insertion de l'achat.
    const [[company]] = await conn.query('SELECT devise FROM users WHERE id = ? FOR UPDATE', [uid]);
    if (!company) {
      await conn.rollback();
      return res.status(404).json({ error: 'Entreprise introuvable.' });
    }
    const companyCurrency = String(company.devise || 'FCFA').toUpperCase();
    const orderCurrency = String(req.body.devise || companyCurrency).toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(orderCurrency)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Devise de commande fournisseur non prise en charge.' });
    }
    if (orderCurrency !== companyCurrency) {
      await conn.rollback();
      return res.status(409).json({ error: 'La devise de la commande doit correspondre à la devise de base de l’entreprise. Les conversions ne sont pas encore activées.' });
    }
    const [[supplier]] = await conn.query('SELECT id FROM pro_fournisseurs WHERE id = ? AND user_id = ? AND actif = 1', [supplierId, uid]);
    if (!supplier) {
      await conn.rollback();
      return res.status(400).json({ error: 'Fournisseur inconnu ou inactif.' });
    }
    if (uniqueProductIds.length) {
      const [owned] = await conn.query(
        `SELECT id, type_catalogue FROM produits
         WHERE user_id = ? AND id IN (${uniqueProductIds.map(() => '?').join(',')})
         ORDER BY id FOR UPDATE`,
        [uid, ...uniqueProductIds]
      );
      const ownedById = new Map(owned.map(row => [Number(row.id), row]));
      if (uniqueProductIds.some(id => !ownedById.has(id))) {
        await conn.rollback();
        return res.status(400).json({ error: 'Un produit référencé n’appartient pas à cette entreprise.' });
      }
      if (uniqueProductIds.some(id => ownedById.get(id).type_catalogue === 'service')) {
        await conn.rollback();
        return res.status(400).json({ error: 'Les services ne peuvent pas être commandés via Achats & stocks.' });
      }
    }
    const [created] = await conn.query(
      "INSERT INTO pro_commandes_fournisseurs (user_id, fournisseur_id, numero, statut, date_commande, date_livraison_prevue, devise, total_ht, total_tva, total_ttc, notes) VALUES (?, ?, ?, 'confirmee', ?, ?, ?, ?, ?, ?, ?)",
      [uid, supplierId, numero, await safeDateForUser(req.body.date_commande, uid), req.body.date_livraison_prevue || null, orderCurrency, totalHt, totalTax, totalHt + totalTax, optionalText(req.body.notes, 5000)]
    );
    for (const line of normalized) {
      await conn.query(
        'INSERT INTO pro_commandes_fournisseurs_lignes (user_id, commande_id, produit_id, designation, quantite, prix_unitaire, tva, total_ligne) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [uid, created.insertId, line.produit_id, line.designation, line.qty, line.price, line.tax, line.total]
      );
    }
    await conn.commit();
    await audit(req, 'achat.commande_creee', 'commande_fournisseur', created.insertId, { numero, montant: totalHt + totalTax });
    res.status(201).json({ id: created.insertId, numero, total_ht: totalHt, total_tva: totalTax, total_ttc: totalHt + totalTax, statut: 'confirmee' });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally { if (conn) conn.release(); }
});

router.post('/purchase-orders/:id/cancel', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req);
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [orderRows] = await conn.query(
      'SELECT * FROM pro_commandes_fournisseurs WHERE id = ? AND user_id = ? FOR UPDATE',
      [req.params.id, uid]
    );
    const order = orderRows[0];
    if (!order) {
      await conn.rollback();
      return res.status(404).json({ error: 'Commande fournisseur introuvable.' });
    }
    if (order.statut === 'annulee') {
      await conn.rollback();
      return res.status(409).json({ error: 'Cette commande fournisseur est déjà annulée.' });
    }
    const [[progress]] = await conn.query(
      `SELECT COUNT(*) AS lignes,
              COALESCE(SUM(quantite), 0) AS commandee,
              COALESCE(SUM(quantite_recue), 0) AS recue
         FROM pro_commandes_fournisseurs_lignes
        WHERE commande_id = ? AND user_id = ?`,
      [order.id, uid]
    );
    const orderedQuantity = Number(progress.commandee || 0);
    const receivedQuantity = Number(progress.recue || 0);
    if (Number(progress.lignes || 0) === 0 || order.statut === 'recue' ||
        (orderedQuantity > 0 && receivedQuantity + 0.0001 >= orderedQuantity)) {
      await conn.rollback();
      return res.status(409).json({ error: 'Une commande intégralement réceptionnée ne peut pas être annulée.' });
    }
    const remainingQuantity = Math.max(0, Math.round((orderedQuantity - receivedQuantity) * 1000) / 1000);
    await conn.query(
      "UPDATE pro_commandes_fournisseurs SET statut = 'annulee' WHERE id = ? AND user_id = ?",
      [order.id, uid]
    );
    await conn.commit();
    await audit(req, 'achat.commande_annulee', 'commande_fournisseur', order.id, {
      reference: order.numero,
      quantite_recue_conservee: Math.round(receivedQuantity * 1000) / 1000,
      quantite_restante_annulee: remainingQuantity
    });
    res.json({
      id: order.id,
      numero: order.numero,
      statut: 'annulee',
      quantite_recue_conservee: Math.round(receivedQuantity * 1000) / 1000,
      quantite_restante_annulee: remainingQuantity
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally { if (conn) conn.release(); }
});

router.put('/purchase-orders/:id/lines/:lineId/product', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req);
    const orderId = Number(req.params.id), lineId = Number(req.params.lineId), productId = Number(req.body.produit_id);
    if (![orderId, lineId, productId].every(value => Number.isSafeInteger(value) && value > 0)) {
      return res.status(400).json({ error: 'Commande, ligne et produit doivent être valides.' });
    }
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [orders] = await conn.query(
      'SELECT id, statut FROM pro_commandes_fournisseurs WHERE id = ? AND user_id = ? FOR UPDATE',
      [orderId, uid]
    );
    const order = orders[0];
    if (!order) {
      await conn.rollback();
      return res.status(404).json({ error: 'Commande fournisseur introuvable.' });
    }
    if (order.statut === 'annulee' || order.statut === 'recue') {
      await conn.rollback();
      return res.status(409).json({ error: 'Cette commande ne peut plus être modifiée.' });
    }
    const [lines] = await conn.query(
      'SELECT id, quantite_recue FROM pro_commandes_fournisseurs_lignes WHERE id = ? AND commande_id = ? AND user_id = ? FOR UPDATE',
      [lineId, orderId, uid]
    );
    const line = lines[0];
    if (!line) {
      await conn.rollback();
      return res.status(404).json({ error: 'Ligne de commande introuvable.' });
    }
    if (Number(line.quantite_recue) > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Le produit d’une ligne déjà réceptionnée ne peut plus être modifié.' });
    }
    const [products] = await conn.query(
      'SELECT id, type_catalogue FROM produits WHERE id = ? AND user_id = ? FOR UPDATE',
      [productId, uid]
    );
    if (!products.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Le produit sélectionné n’appartient pas à cette entreprise.' });
    }
    if (products[0].type_catalogue === 'service') {
      await conn.rollback();
      return res.status(400).json({ error: 'Un service ne peut pas être associé à une réception de stock physique.' });
    }
    await conn.query(
      'UPDATE pro_commandes_fournisseurs_lignes SET produit_id = ? WHERE id = ? AND commande_id = ? AND user_id = ?',
      [productId, lineId, orderId, uid]
    );
    await conn.commit();
    await audit(req, 'achat.ligne_produit_associe', 'commande_fournisseur', orderId, { ligne_id: lineId, produit_id: productId });
    res.json({ success: true, commande_id: orderId, ligne_id: lineId, produit_id: productId });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally { if (conn) conn.release(); }
});

router.post('/purchase-orders/:id/receive', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req), defaultWarehouseId = await ensureDefaultWarehouse(uid);
    const lines = Array.isArray(req.body.lignes) ? req.body.lignes : [];
    const warehouseId = Number(req.body.entrepot_id) || defaultWarehouseId;
    if (!lines.length || lines.length > 100) return res.status(400).json({ error: 'Indiquez au moins une ligne à réceptionner.' });
    const normalizedLines = lines.map(line => ({
      ligne_id: Number(line.ligne_id),
      quantite: Math.round(Number(line.quantite) * 1000) / 1000
    }));
    if (normalizedLines.some(line => !Number.isSafeInteger(line.ligne_id) || line.ligne_id <= 0 ||
        !Number.isFinite(line.quantite) || line.quantite <= 0)) {
      return res.status(400).json({ error: 'Chaque ligne doit avoir un identifiant et une quantité reçue valides.' });
    }
    if (new Set(normalizedLines.map(line => line.ligne_id)).size !== normalizedLines.length) return res.status(400).json({ error: 'Une même ligne de commande ne peut être réceptionnée qu’une fois par opération.' });
    const operationId = String(req.body.operation_id || '').trim();
    if (operationId && !/^[a-zA-Z0-9_-]{16,64}$/.test(operationId)) {
      return res.status(400).json({ error: 'Identifiant d’opération de réception invalide.' });
    }
    const reference = operationId ? 'REC-' + operationId : randomRef('REC');
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [orderRows] = await conn.query('SELECT * FROM pro_commandes_fournisseurs WHERE id = ? AND user_id = ? FOR UPDATE', [req.params.id, uid]);
    const order = orderRows[0];
    if (!order) { await conn.rollback(); return res.status(404).json({ error: 'Commande fournisseur introuvable.' }); }
    const [existingReceipts] = await conn.query(
      'SELECT id, commande_id FROM pro_receptions_achats WHERE user_id = ? AND reference = ? FOR UPDATE',
      [uid, reference]
    );
    if (existingReceipts.length) {
      const existing = existingReceipts[0];
      if (Number(existing.commande_id) !== Number(order.id)) {
        await conn.rollback();
        return res.status(409).json({ error: 'Cet identifiant de réception est déjà utilisé pour une autre commande.' });
      }
      const [savedLines] = await conn.query(
        'SELECT commande_ligne_id, quantite FROM pro_receptions_achats_lignes WHERE reception_id = ? AND user_id = ? ORDER BY commande_ligne_id',
        [existing.id, uid]
      );
      const requested = normalizedLines.slice().sort((a, b) => a.ligne_id - b.ligne_id);
      const saved = savedLines.map(line => ({ ligne_id: Number(line.commande_ligne_id), quantite: Number(line.quantite) }))
        .sort((a, b) => a.ligne_id - b.ligne_id);
      const samePayload = requested.length === saved.length && requested.every((line, index) =>
        line.ligne_id === saved[index].ligne_id && Math.abs(line.quantite - saved[index].quantite) <= 0.0001
      );
      if (!samePayload) {
        await conn.rollback();
        return res.status(409).json({ error: 'Cet identifiant de réception a déjà été utilisé avec des quantités différentes.' });
      }
      await conn.rollback();
      return res.status(200).json({ reception_id: existing.id, reference, statut: order.statut, repeated: true });
    }
    if (order.statut === 'annulee' || order.statut === 'recue') {
      await conn.rollback();
      return res.status(409).json({ error: 'Commande annulée ou déjà intégralement réceptionnée.' });
    }
    const [warehouseRows] = await conn.query('SELECT id, nom FROM pro_entrepots WHERE id = ? AND user_id = ? AND actif = 1', [warehouseId, uid]);
    if (!warehouseRows.length) { await conn.rollback(); return res.status(400).json({ error: 'Entrepôt invalide.' }); }
    const [receipt] = await conn.query(
      'INSERT INTO pro_receptions_achats (user_id, commande_id, entrepot_id, reference, date_reception, acteur_user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [uid, order.id, warehouseId, reference, await safeDateForUser(req.body.date_reception, uid), actor(req)]
    );
    const [orderLines] = await conn.query('SELECT * FROM pro_commandes_fournisseurs_lignes WHERE commande_id = ? AND user_id = ? FOR UPDATE', [order.id, uid]);
    for (const received of normalizedLines) {
      const line = orderLines.find(item => Number(item.id) === received.ligne_id);
      const qty = received.quantite;
      if (!line || !Number.isFinite(qty) || qty <= 0 || qty > Number(line.quantite) - Number(line.quantite_recue) + 0.0001) {
        throw new Error('Quantité reçue invalide ou supérieure au reliquat de commande.');
      }
      if (!line.produit_id) throw new Error('La ligne "' + line.designation + '" doit être associée à un produit du catalogue avant de mettre à jour le stock.');
      const [productRows] = await conn.query('SELECT id, type_catalogue FROM produits WHERE id = ? AND user_id = ? FOR UPDATE', [line.produit_id, uid]);
      if (!productRows.length) throw new Error('Produit supprimé ou non autorisé.');
      if (productRows[0].type_catalogue === 'service') throw new Error('Un service ne peut pas être réceptionné dans le stock physique.');
      await conn.query(
        'INSERT INTO pro_stocks_entrepots (user_id, entrepot_id, produit_id, quantite) VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE id = id',
        [uid, warehouseId, line.produit_id]
      );
      await conn.query('UPDATE pro_stocks_entrepots SET quantite = quantite + ? WHERE user_id = ? AND entrepot_id = ? AND produit_id = ?', [qty, uid, warehouseId, line.produit_id]);
      await conn.query('UPDATE pro_commandes_fournisseurs_lignes SET quantite_recue = quantite_recue + ? WHERE id = ? AND user_id = ?', [qty, line.id, uid]);
      await conn.query(
        'INSERT INTO pro_receptions_achats_lignes (user_id, reception_id, commande_ligne_id, produit_id, quantite, prix_unitaire) VALUES (?, ?, ?, ?, ?, ?)',
        [uid, receipt.insertId, line.id, line.produit_id, qty, line.prix_unitaire]
      );
      await conn.query(
        "INSERT INTO pro_mouvements_stock (user_id, produit_id, produit_nom, entrepot_id, entrepot_nom, type, quantite, cout_unitaire, reference, motif, acteur_user_id) VALUES (?, ?, ?, ?, ?, 'reception_achat', ?, ?, ?, ?, ?)",
        [uid, line.produit_id, line.designation, warehouseId, warehouseRows[0].nom, qty, line.prix_unitaire, reference, 'Réception ' + order.numero, actor(req)]
      );
    }
    const [[progress]] = await conn.query('SELECT SUM(quantite_recue) AS recu, SUM(quantite) AS commande FROM pro_commandes_fournisseurs_lignes WHERE commande_id = ? AND user_id = ?', [order.id, uid]);
    const status = Number(progress.recu) + 0.0001 >= Number(progress.commande) ? 'recue' : 'partiellement_recue';
    await conn.query('UPDATE pro_commandes_fournisseurs SET statut = ? WHERE id = ? AND user_id = ?', [status, order.id, uid]);
    await conn.query(
      'UPDATE produits p SET p.stock = (SELECT COALESCE(SUM(s.quantite),0) FROM pro_stocks_entrepots s WHERE s.user_id = p.user_id AND s.produit_id = p.id) WHERE p.user_id = ? AND EXISTS (SELECT 1 FROM pro_stocks_entrepots s WHERE s.user_id = p.user_id AND s.produit_id = p.id)',
      [uid]
    );
    await conn.commit();
    await audit(req, 'achat.reception', 'commande_fournisseur', order.id, { reference, statut: status });
    res.status(201).json({ reception_id: receipt.insertId, reference, statut: status, repeated: false });
  } catch (err) {
    if (conn) await conn.rollback();
    if (/Quantité reçue|associée à un produit|Produit supprimé|service ne peut pas être réceptionné/.test(err.message || '')) return res.status(400).json({ error: err.message });
    next(err);
  } finally { if (conn) conn.release(); }
});

router.get('/accounting/config', async (req, res, next) => {
  try {
    await ensureAccountingDefaults(owner(req));
    const [accountsResult, journalsResult] = await Promise.all([
      pool.query('SELECT id, code, libelle, classe, nature, lettrable, actif FROM pro_compta_comptes WHERE user_id = ? ORDER BY code', [owner(req)]),
      pool.query('SELECT id, code, libelle, type, actif FROM pro_compta_journaux WHERE user_id = ? ORDER BY code', [owner(req)])
    ]);
    res.json({ comptes: accountsResult[0], journaux: journalsResult[0], standard: 'SYSCOHADA — plan de démarrage à valider avec un expert-comptable local' });
  } catch (err) { next(err); }
});

router.get('/accounting/mappings', async (req, res, next) => {
  try {
    const uid = owner(req);
    await ensureAccountingDefaults(uid);
    const [mappingRows, categoryRows] = await Promise.all([
      pool.query(
        'SELECT m.type_source, m.cle_source, m.compte_id, c.code, c.libelle, c.classe, c.actif FROM pro_compta_correspondances m JOIN pro_compta_comptes c ON c.id = m.compte_id AND c.user_id = m.user_id WHERE m.user_id = ? ORDER BY m.type_source, m.cle_source',
        [uid]
      ),
      pool.query(
        "SELECT DISTINCT TRIM(categorie) AS categorie FROM depenses WHERE user_id = ? AND categorie IS NOT NULL AND TRIM(categorie) <> '' ORDER BY categorie",
        [uid]
      )
    ]);
    const mappings = mappingRows[0];
    const fallback = mappings.find(row => row.type_source === 'depense' && row.cle_source === '__default__');
    const categories = categoryRows[0].map(row => {
      const key = normalizeAccountingCategoryKey(row.categorie);
      const specific = mappings.find(mapping => mapping.type_source === 'depense' && mapping.cle_source === key);
      const effective = specific || fallback || null;
      return {
        categorie: row.categorie,
        cle_source: key,
        personnalisee: Boolean(specific),
        compte_id: effective?.compte_id ?? null,
        code: effective?.code ?? null,
        libelle: effective?.libelle ?? null
      };
    });
    res.json({ correspondances: mappings, categories_depenses: categories });
  } catch (err) { next(err); }
});

router.put('/accounting/mappings', async (req, res, next) => {
  try {
    const uid = owner(req);
    const sourceType = String(req.body.type_source || '').trim().toLowerCase();
    const rawKey = String(req.body.cle_source ?? '');
    let sourceKey;
    if (sourceType === 'vente') {
      sourceKey = rawKey.trim().toLowerCase();
      if (!ACCOUNTING_SALE_MAPPING_KEYS.includes(sourceKey)) {
        return res.status(400).json({ error: 'Type de vente invalide.', code: 'TYPE_CORRESPONDANCE_INVALIDE' });
      }
    } else if (sourceType === 'depense') {
      const normalizedCategory = String(rawKey).normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
      if (rawKey === '__default__') {
        sourceKey = '__default__';
      } else if (!normalizedCategory || normalizedCategory.length > 100) {
        return res.status(400).json({ error: 'Indiquez une catégorie de dépense valide (100 caractères maximum).', code: 'CATEGORIE_CORRESPONDANCE_INVALIDE' });
      } else {
        sourceKey = normalizedCategory;
      }
    } else {
      return res.status(400).json({ error: 'La source doit être vente ou dépense.', code: 'SOURCE_CORRESPONDANCE_INVALIDE' });
    }

    const accountIdValue = Number(req.body.compte_id);
    if (!idOk(accountIdValue)) return res.status(400).json({ error: 'Compte comptable invalide.' });
    const expectedClass = sourceType === 'vente' ? 7 : 6;
    const [accountRows] = await pool.query(
      'SELECT id, code, libelle, classe FROM pro_compta_comptes WHERE id = ? AND user_id = ? AND actif = 1 LIMIT 1',
      [accountIdValue, uid]
    );
    const account = accountRows[0];
    if (!account) return res.status(404).json({ error: 'Compte actif introuvable dans cette entreprise.' });
    if (Number(account.classe) !== expectedClass) {
      return res.status(400).json({
        error: 'Une vente doit être affectée à un compte de classe 7 et une dépense à un compte de classe 6.',
        code: 'CLASSE_COMPTE_CORRESPONDANCE_INVALIDE'
      });
    }

    await pool.query(
      'INSERT INTO pro_compta_correspondances (user_id, type_source, cle_source, compte_id) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE compte_id = VALUES(compte_id)',
      [uid, sourceType, sourceKey, accountIdValue]
    );
    await audit(req, 'comptabilite.correspondance_modifiee', 'compte', accountIdValue, {
      type_source: sourceType,
      cle_source: sourceKey,
      code_compte: account.code
    });
    res.json({ success: true, correspondance: { type_source: sourceType, cle_source: sourceKey, compte_id: account.id, code: account.code, libelle: account.libelle } });
  } catch (err) { next(err); }
});

router.post('/accounting/accounts', async (req, res, next) => {
  try {
    const code = String(req.body.code || '').trim().slice(0,20), libelle = String(req.body.libelle || '').trim().slice(0,190);
    const classe = Number(req.body.classe), nature = String(req.body.nature || 'debit');
    if (!/^\d{1,8}$/.test(code) || !libelle || !Number.isInteger(classe) || classe < 1 || classe > 8 || !['debit','credit'].includes(nature)) return res.status(400).json({ error: 'Code, libellé, classe 1 à 8 et nature débit/crédit requis.' });
    const [result] = await pool.query('INSERT INTO pro_compta_comptes (user_id, code, libelle, classe, nature, lettrable) VALUES (?, ?, ?, ?, ?, ?)', [owner(req), code, libelle, classe, nature, req.body.lettrable ? 1 : 0]);
    res.status(201).json({ id: result.insertId, code, libelle });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ce numéro de compte existe déjà.' });
    next(err);
  }
});

router.post('/accounting/entries', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req), lines = Array.isArray(req.body.lignes) ? req.body.lignes : [];
    const label = String(req.body.libelle || '').trim().slice(0,255);
    const date = optionalIsoDate(req.body.date_ecriture);
    if (!idOk(req.body.journal_id) || !label || date === undefined || !date || lines.length < 2 || lines.length > 100) return res.status(400).json({ error: 'Journal, date, libellé et au moins deux lignes sont obligatoires.' });
    let debit = 0, credit = 0;
    const clean = [];
    for (const line of lines) {
      const account = Number(line.compte_id);
      const d = Math.round(Number(line.debit || 0) * 100) / 100;
      const c = Math.round(Number(line.credit || 0) * 100) / 100;
      if (!idOk(account) || !Number.isFinite(d) || !Number.isFinite(c) || d < 0 || c < 0 || (d > 0 && c > 0) || (d === 0 && c === 0)) return res.status(400).json({ error: 'Chaque ligne doit avoir un compte et un seul montant débit ou crédit positif (au centime).' });
      debit += d; credit += c;
      clean.push({ account, d, c, label: String(line.libelle || label).slice(0,255), tiers: optionalText(line.tiers,190) });
    }
    debit = Math.round(debit * 100) / 100; credit = Math.round(credit * 100) / 100;
    if (Math.abs(debit - credit) > 0.01) return res.status(400).json({ error: 'Écriture déséquilibrée : total débit et crédit doivent être identiques.' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    // Les écritures manuelles sont elles aussi un historique qui fige la devise.
    const [[account]] = await conn.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [uid]);
    if (!account) { await conn.rollback(); return res.status(404).json({ error: 'Entreprise introuvable.' }); }
    const [journalRows] = await conn.query('SELECT id FROM pro_compta_journaux WHERE id = ? AND user_id = ? AND actif = 1', [req.body.journal_id, uid]);
    if (!journalRows.length) { await conn.rollback(); return res.status(400).json({ error: 'Journal invalide.' }); }
    const ids = [...new Set(clean.map(line => line.account))];
    const [accounts] = await conn.query(`SELECT id FROM pro_compta_comptes WHERE user_id = ? AND actif = 1 AND id IN (${ids.map(() => '?').join(',')})`, [uid, ...ids]);
    if (accounts.length !== ids.length) { await conn.rollback(); return res.status(400).json({ error: 'Un compte comptable ne appartient pas à cette entreprise ou est inactif.' }); }
    const numero = randomRef('ECR');
    const [entry] = await conn.query(
      "INSERT INTO pro_compta_ecritures (user_id, journal_id, numero, date_ecriture, reference, libelle, statut, total_debit, total_credit, acteur_user_id, validee_le) VALUES (?, ?, ?, ?, ?, ?, 'validee', ?, ?, ?, NOW())",
      [uid, req.body.journal_id, numero, date, optionalText(req.body.reference,120), label, debit, credit, actor(req)]
    );
    for (const line of clean) {
      await conn.query('INSERT INTO pro_compta_lignes (user_id, ecriture_id, compte_id, libelle, debit, credit, tiers) VALUES (?, ?, ?, ?, ?, ?, ?)', [uid, entry.insertId, line.account, line.label, line.d, line.c, line.tiers]);
    }
    await conn.commit();
    await audit(req, 'comptabilite.ecriture_validee', 'ecriture', entry.insertId, { numero, debit, credit });
    res.status(201).json({ id: entry.insertId, numero, statut: 'validee', total_debit: debit, total_credit: credit });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally { if (conn) conn.release(); }
});

router.get('/accounting/entries', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT e.id, e.numero, e.date_ecriture, e.reference, e.libelle, e.total_debit, e.total_credit, j.code AS journal_code, j.libelle AS journal_libelle FROM pro_compta_ecritures e JOIN pro_compta_journaux j ON j.id = e.journal_id AND j.user_id = e.user_id WHERE e.user_id = ? AND e.statut = \'validee\' ORDER BY e.date_ecriture DESC, e.id DESC LIMIT 200',
      [owner(req)]
    );
    res.json({ ecritures: rows });
  } catch (err) { next(err); }
});

router.get('/accounting/trial-balance', async (req, res, next) => {
  try {
    await ensureAccountingDefaults(owner(req));
    const from = optionalIsoDate(req.query.from), to = optionalIsoDate(req.query.to);
    if (from === undefined || to === undefined) return res.status(400).json({ error: 'Période invalide.' });
    let filters = ' AND e.statut = ?'; const params = [owner(req), 'validee'];
    if (from) { filters += ' AND e.date_ecriture >= ?'; params.push(from); }
    if (to) { filters += ' AND e.date_ecriture <= ?'; params.push(to); }
    const [rows] = await pool.query(
      `SELECT c.id, c.code, c.libelle, c.classe,
        COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.debit ELSE 0 END),0) AS total_debit,
        COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.credit ELSE 0 END),0) AS total_credit,
        COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.debit-l.credit ELSE 0 END),0) AS solde
       FROM pro_compta_comptes c
       LEFT JOIN pro_compta_lignes l ON l.compte_id = c.id AND l.user_id = c.user_id
       LEFT JOIN pro_compta_ecritures e ON e.id = l.ecriture_id AND e.user_id = c.user_id ${filters}
       WHERE c.user_id = ? GROUP BY c.id ORDER BY c.code`,
      [...params.slice(1), owner(req)]
    );
    const totalDebit = rows.reduce((sum,row)=>sum+Number(row.total_debit),0);
    const totalCredit = rows.reduce((sum,row)=>sum+Number(row.total_credit),0);
    res.json({ balance: rows, total_debit: totalDebit, total_credit: totalCredit, equilibree: Math.abs(totalDebit-totalCredit) <= 0.01, periode: { from: from || null, to: to || null } });
  } catch (err) { next(err); }
});

router.get('/accounting/ledger', async (req, res, next) => {
  try {
    const accountIdValue = Number(req.query.compte_id);
    if (!idOk(accountIdValue)) return res.status(400).json({ error: 'compte_id obligatoire.' });
    const [accountRows] = await pool.query('SELECT id, code, libelle FROM pro_compta_comptes WHERE id = ? AND user_id = ?', [accountIdValue, owner(req)]);
    if (!accountRows.length) return res.status(404).json({ error: 'Compte introuvable.' });
    const from = optionalIsoDate(req.query.from), to = optionalIsoDate(req.query.to);
    if (from === undefined || to === undefined) return res.status(400).json({ error: 'Période invalide.' });
    const filters = [], params = [owner(req), accountIdValue];
    if (from) { filters.push('e.date_ecriture >= ?'); params.push(from); }
    if (to) { filters.push('e.date_ecriture <= ?'); params.push(to); }
    const [rows] = await pool.query(
      `SELECT e.date_ecriture, e.numero, e.reference, e.libelle AS ecriture_libelle, l.libelle, l.debit, l.credit, l.tiers FROM pro_compta_lignes l JOIN pro_compta_ecritures e ON e.id = l.ecriture_id AND e.user_id = l.user_id WHERE l.user_id = ? AND l.compte_id = ? AND e.statut = 'validee' ${filters.length ? 'AND '+filters.join(' AND ') : ''} ORDER BY e.date_ecriture, e.id, l.id`,
      params
    );
    let running = 0;
    const entries = rows.map(row => { running += Number(row.debit) - Number(row.credit); return { ...row, solde_progressif: Math.round(running*100)/100 }; });
    res.json({ compte: accountRows[0], ecritures: entries, solde_periode: Math.round(running*100)/100 });
  } catch (err) { next(err); }
});

router.post('/accounting/post-invoice/:id', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req);
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [rows] = await conn.query(
      "SELECT * FROM factures WHERE id = ? AND user_id = ? AND type = 'facture' AND statut <> 'annulee' FOR UPDATE",
      [req.params.id, uid]
    );
    const invoice = rows[0];
    if (!invoice) {
      await conn.rollback();
      return res.status(404).json({ error: 'Facture non trouvée ou annulée.' });
    }

    // Une écriture validée doit rester idempotente même si une correspondance a
    // été modifiée ou si son compte est ensuite désactivé. Ne pas recalculer la pièce.
    const [existingEntries] = await conn.query(
      "SELECT id, numero FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'facture' AND source_id = ? LIMIT 1 FOR UPDATE",
      [uid, invoice.id]
    );
    if (existingEntries.length) {
      await conn.commit();
      return res.status(200).json({
        id: existingEntries[0].id,
        numero: existingEntries[0].numero,
        duplicate: true
      });
    }

    await ensureAccountingDefaults(uid, conn);
    const lines = await buildInvoiceAccountingLines(uid, invoice, conn);
    const result = await postSystemEntry(
      uid,
      actor(req),
      'facture',
      invoice.id,
      invoice.date_emission,
      'Comptabilisation facture ' + invoice.numero,
      'VE',
      lines,
      conn
    );
    await conn.commit();
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    if (err.code === 'FACTURE_NON_COMPTABILISABLE') return res.status(409).json({ error: 'La facture a été supprimée ou annulée avant sa comptabilisation.' });
    if (err.status === 409 && err.code) return res.status(409).json({ error: err.message, code: err.code });
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.post('/accounting/post-payment/:id', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req);
    // Le même verrou paiement est utilisé par le traitement des remboursements :
    // les deux opérations ne peuvent pas créer des écritures concurrentes divergentes.
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT * FROM paiements WHERE id = ? AND user_id = ? FOR UPDATE',
      [req.params.id, uid]
    );
    const payment = rows[0];
    if (!payment) {
      await conn.rollback();
      return res.status(404).json({ error: 'Paiement introuvable.' });
    }
    // Lire le numéro de facture sans verrouiller celle-ci : le traitement du
    // remboursement suit le même ordre de verrous (paiement, puis facture).
    const [invoiceRows] = await conn.query(
      'SELECT numero FROM factures WHERE id = ? AND user_id = ? LIMIT 1',
      [payment.facture_id, uid]
    );
    if (!invoiceRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Facture du paiement introuvable.' });
    }
    const invoiceNumber = invoiceRows[0].numero;
    const treasuryAccount = paymentTreasuryAccount(payment.methode);
    if (!treasuryAccount) {
      await conn.rollback();
      return res.status(409).json({
        error: 'La méthode de paiement ne permet pas de déterminer le compte de trésorerie.',
        code: 'METHODE_PAIEMENT_NON_RECONNUE'
      });
    }
    const bank = treasuryAccount === '521';
    const result = await postSystemEntry(
      uid,
      actor(req),
      'paiement',
      payment.id,
      String(payment.date_paiement).slice(0, 10),
      'Encaissement facture ' + invoiceNumber,
      bank ? 'BQ' : 'CA',
      [
        { code: bank ? '521' : '571', libelle: 'Règlement ' + invoiceNumber, debit: Number(payment.montant), credit: 0, paiement_id: payment.id },
        { code: '411', libelle: 'Lettrage client ' + invoiceNumber, debit: 0, credit: Number(payment.montant), paiement_id: payment.id }
      ],
      conn
    );
    await conn.commit();
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.post('/accounting/post-expense/:id', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req);
    conn = await pool.getConnection();
    await conn.beginTransaction();
    // Le verrou commun avec PUT/DELETE empêche une modification concurrente
    // entre la lecture du mode de règlement et la création de l'écriture.
    const [rows] = await conn.query(
      'SELECT * FROM depenses WHERE id = ? AND user_id = ? FOR UPDATE',
      [req.params.id, uid]
    );
    const expense = rows[0];
    if (!expense) {
      await conn.rollback();
      return res.status(404).json({ error: 'Dépense introuvable.' });
    }

    // Une écriture déjà validée n'est jamais recalculée selon une correspondance
    // modifiée ou un compte devenu inactif : le rejeu renvoie l'écriture d'origine.
    const [existingEntries] = await conn.query(
      "SELECT id, numero FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'depense' AND source_id = ? LIMIT 1 FOR UPDATE",
      [uid, expense.id]
    );
    if (existingEntries.length) {
      await conn.commit();
      return res.status(200).json({
        id: existingEntries[0].id,
        numero: existingEntries[0].numero,
        duplicate: true
      });
    }

    const amount = Number(expense.montant);
    if (!Number.isFinite(amount) || amount <= 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Le montant de la dépense doit être positif avant comptabilisation.' });
    }
    await ensureAccountingDefaults(uid, conn);
    const expenseMapping = await requireExpenseCorrespondence(uid, expense.categorie, conn);
    const bank = expense.mode_reglement === 'banque';
    const result = await postSystemEntry(
      uid,
      actor(req),
      'depense',
      expense.id,
      expense.date_depense,
      'Dépense ' + expense.libelle,
      bank ? 'BQ' : 'CA',
      [
        { code: expenseMapping.code, libelle: expense.categorie || expense.libelle, debit: amount, credit: 0 },
        { code: bank ? '521' : '571', libelle: bank ? 'Règlement bancaire dépense' : 'Règlement caisse dépense', debit: 0, credit: amount }
      ],
      conn
    );
    await conn.commit();
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    if (err.code === 'DEPENSE_NON_COMPTABILISABLE') return res.status(404).json({ error: 'Dépense supprimée avant comptabilisation.' });
    if (err.code === 'DEPENSE_MODIFIEE') return res.status(409).json({ error: 'La dépense a changé; actualisez puis relancez la comptabilisation.' });
    if (err.status === 409 && err.code) return res.status(409).json({ error: err.message, code: err.code });
    next(err);
  } finally {
    if (conn) conn.release();
  }
});


/* ----------------------- PORTAIL CLIENT & CRM -------------------------- */
module.exports = router;
