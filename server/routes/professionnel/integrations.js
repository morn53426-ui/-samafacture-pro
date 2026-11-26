/**
 * Module "integrations" — extrait depuis routes/professionnel.js (Phase 3b, chunkage par route).
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

router.get('/integrations/api-keys', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, nom, scopes_json, derniere_utilisation, expire_at, revoked_at, created_at FROM pro_api_keys WHERE user_id = ? ORDER BY created_at DESC', [owner(req)]);
    res.json({ cles: rows.map(r => ({ ...r, scopes: parseJson(r.scopes_json, []) })) });
  } catch (err) { next(err); }
});

router.post('/integrations/api-keys', async (req, res, next) => {
  try {
    const nom = String(req.body.nom || '').trim().slice(0, 120);
    const available = ['clients:read','products:read','invoices:read','invoices:write'];
    const scopes = Array.isArray(req.body.scopes) ? [...new Set(req.body.scopes.filter(s => available.includes(s)))] : ['invoices:read'];
    if (!nom || !scopes.length) return res.status(400).json({ error: 'Nom et permissions API valides requis.' });
    const token = 'sf_live_' + crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expires = req.body.expire_jours ? new Date(Date.now() + Math.min(365, Math.max(1, Number(req.body.expire_jours))) * 86400000) : null;
    const [result] = await pool.query('INSERT INTO pro_api_keys (user_id, nom, token_hash, scopes_json, expire_at) VALUES (?, ?, ?, ?, ?)', [owner(req), nom, tokenHash, JSON.stringify(scopes), expires]);
    await audit(req, 'api.cle_creee', 'api_key', result.insertId, { nom, scopes });
    res.status(201).json({ id: result.insertId, nom, token, scopes, warning: 'Copiez cette clé maintenant : elle ne sera plus affichée.' });
  } catch (err) { next(err); }
});

router.delete('/integrations/api-keys/:id', async (req, res, next) => {
  try {
    const [result] = await pool.query('UPDATE pro_api_keys SET revoked_at = NOW() WHERE id = ? AND user_id = ? AND revoked_at IS NULL', [req.params.id, owner(req)]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Clé API introuvable ou déjà révoquée.' });
    await audit(req, 'api.cle_revoquee', 'api_key', req.params.id, {});
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/integrations/webhooks', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, url, evenements_json, actif, created_at FROM pro_webhooks WHERE user_id = ? ORDER BY created_at DESC', [owner(req)]);
    res.json({ webhooks: rows.map(r => ({ ...r, evenements: parseJson(r.evenements_json, []) })) });
  } catch (err) { next(err); }
});

router.post('/integrations/webhooks', async (req, res, next) => {
  try {
    const url = String(req.body.url || '').trim();
    let parsed;
    try { parsed = new URL(url); } catch (_) { return res.status(400).json({ error: 'URL de webhook invalide.' }); }
    if (parsed.protocol !== 'https:' || (parsed.port && parsed.port !== '443')) return res.status(400).json({ error: 'Les webhooks doivent utiliser HTTPS sur le port standard.' });
    const host = parsed.hostname.toLowerCase();
    const literalIp = net.isIP(host);
    const privateIpv4 = literalIp === 4 && (/^(10|127|0)\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host));
    const privateIpv6 = literalIp === 6 && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80'));
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || privateIpv4 || privateIpv6) {
      return res.status(400).json({ error: 'Les webhooks ne peuvent pas cibler un hôte local ou une adresse IP privée.' });
    }
    const allowedEvents = ['invoice.created','payment.received','client.created'];
    const events = Array.isArray(req.body.evenements) ? [...new Set(req.body.evenements.filter(x => allowedEvents.includes(x)))] : [];
    if (!events.length) return res.status(400).json({ error: 'Sélectionnez au moins un événement valide.' });
    const secret = crypto.randomBytes(32).toString('hex');
    const [result] = await pool.query('INSERT INTO pro_webhooks (user_id, url, secret_enc, evenements_json) VALUES (?, ?, ?, ?)', [owner(req), url, encryptSecret(secret), JSON.stringify(events)]);
    await audit(req, 'webhook.cree', 'webhook', result.insertId, { url, events });
    res.status(201).json({ id: result.insertId, url, evenements: events, secret, warning: 'Conservez le secret : il ne sera pas réaffiché.' });
  } catch (err) { next(err); }
});

router.delete('/integrations/webhooks/:id', async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM pro_webhooks WHERE id = ? AND user_id = ?', [req.params.id, owner(req)]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Webhook introuvable.' });
    await audit(req, 'webhook.supprime', 'webhook', req.params.id, {});
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/integrations/webhooks/:id/test', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id FROM pro_webhooks WHERE id = ? AND user_id = ? AND actif = 1', [req.params.id, owner(req)]);
    if (!rows.length) return res.status(404).json({ error: 'Webhook introuvable ou inactif.' });
    const [result] = await pool.query('INSERT INTO pro_webhook_deliveries (user_id, webhook_id, evenement, payload_json, prochaine_tentative) VALUES (?, ?, ?, ?, NOW())', [owner(req), req.params.id, 'test.ping', JSON.stringify({ test: true, date: new Date().toISOString() })]);
    res.status(202).json({ success: true, delivery_id: result.insertId, message: 'Test placé dans la file de livraison.' });
  } catch (err) { next(err); }
});

router.get('/audit', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, acteur_user_id, action, entite, entite_id, details_json, adresse_ip, created_at FROM pro_audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 300', [owner(req)]);
    res.json({ journal: rows.map(r => ({ ...r, details: parseJson(r.details_json, null) })) });
  } catch (err) { next(err); }
});


/* ---------------- PAIEMENTS EN LIGNE DES FACTURES ---------------------- */
async function lireGateway(uid, provider) {
  const [rows] = await pool.query(
    'SELECT credentials_enc, mode, actif FROM pro_payment_gateways WHERE user_id = ? AND fournisseur = ? LIMIT 1',
    [uid, provider]
  );
  if (!rows.length || !rows[0].actif) return null;
  return { ...JSON.parse(decryptSecret(rows[0].credentials_enc)), PAYDUNYA_MODE: rows[0].mode || 'test' };
}

module.exports = router;
module.exports.lireGateway = lireGateway;