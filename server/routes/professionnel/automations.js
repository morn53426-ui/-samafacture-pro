/**
 * Module "automations" — extrait depuis routes/professionnel.js (Phase 3b, chunkage par route).
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

router.get('/automations', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM pro_automations WHERE user_id = ? ORDER BY created_at DESC', [owner(req)]);
    res.json({ automatisations: rows.map(r => ({ ...r, configuration: parseJson(r.configuration_json, {}) })) });
  } catch (err) { next(err); }
});

router.post('/automations', async (req, res, next) => {
  try {
    const type = String(req.body.type || '');
    const allowed = ['relance_impayes_email','relance_impayes_whatsapp','relance_devis_email','alerte_stock_email'];
    const nom = String(req.body.nom || '').trim().slice(0, 150);
    const config = req.body.configuration && typeof req.body.configuration === 'object' ? req.body.configuration : {};
    if (!allowed.includes(type) || !nom) return res.status(400).json({ error: 'Type ou nom d’automatisation invalide.' });
    if (type === 'relance_impayes_whatsapp') return res.status(501).json({ error: 'L’envoi WhatsApp automatique exige un fournisseur WhatsApp Business configuré. Le canal email reste disponible.' });

    let normalized;
    if (type === 'relance_impayes_email') {
      normalized = {
        jours_retard: Math.min(120, Math.max(1, Number(config.jours_retard) || 7)),
        frequence_jours: Math.min(90, Math.max(1, Number(config.frequence_jours) || 7)),
        canal: 'email'
      };
    } else if (type === 'relance_devis_email') {
      normalized = {
        jours_avant_expiration: Math.min(30, Math.max(0, Number(config.jours_avant_expiration ?? 5))),
        frequence_jours: Math.min(90, Math.max(1, Number(config.frequence_jours) || 3)),
        canal: 'email'
      };
    } else {
      normalized = {
        frequence_jours: Math.min(30, Math.max(1, Number(config.frequence_jours) || 1)),
        canal: 'email',
        utiliser_seuils_produits: true
      };
    }
    const [result] = await pool.query(
      'INSERT INTO pro_automations (user_id, type, nom, configuration_json, prochaine_execution) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))',
      [owner(req), type, nom, JSON.stringify(normalized)]
    );
    await audit(req, 'automatisation.creee', 'automatisation', result.insertId, { type, configuration: normalized });
    res.status(201).json({ id: result.insertId, type, prochaine_execution: 'dans environ une heure' });
  } catch (err) { next(err); }
});

router.put('/automations/:id', async (req, res, next) => {
  try {
    const active = req.body.actif ? 1 : 0;
    const [result] = await pool.query('UPDATE pro_automations SET actif = ?, prochaine_execution = CASE WHEN ? = 1 THEN COALESCE(prochaine_execution, DATE_ADD(NOW(), INTERVAL 1 HOUR)) ELSE NULL END WHERE id = ? AND user_id = ?', [active, active, req.params.id, owner(req)]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Automatisation introuvable.' });
    await audit(req, 'automatisation.modifiee', 'automatisation', req.params.id, { actif: !!active });
    res.json({ success: true, actif: !!active });
  } catch (err) { next(err); }
});

router.delete('/automations/:id', async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM pro_automations WHERE id = ? AND user_id = ?', [req.params.id, owner(req)]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Automatisation introuvable.' });
    await audit(req, 'automatisation.supprimee', 'automatisation', req.params.id, {});
    res.json({ success: true });
  } catch (err) { next(err); }
});

/* ------------------------- INTÉGRATIONS --------------------------------- */

module.exports = router;
