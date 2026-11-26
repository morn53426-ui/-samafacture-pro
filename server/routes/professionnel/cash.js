/**
 * Module "cash" — extrait depuis routes/professionnel.js (Phase 3b, chunkage par route).
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

router.get('/cash/registers', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT c.*, e.nom AS etablissement_nom, c.solde_initial + COALESCE(SUM(CASE WHEN o.type = ? THEN o.montant WHEN o.type = ? THEN -o.montant ELSE 0 END),0) AS solde_actuel FROM pro_caisses c LEFT JOIN pro_etablissements e ON e.id = c.etablissement_id AND e.user_id = c.user_id LEFT JOIN pro_caisse_operations o ON o.caisse_id = c.id AND o.user_id = c.user_id WHERE c.user_id = ? GROUP BY c.id ORDER BY c.nom',
      ['entree', 'sortie', owner(req)]
    );
    res.json({ caisses: rows });
  } catch (err) { next(err); }
});

router.post('/cash/registers', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req);
    const nom = String(req.body.nom || '').trim().slice(0, 120);
    if (!nom) return res.status(400).json({ error: 'Le nom de la caisse est obligatoire.' });
    const initial = Number(req.body.solde_initial || 0);
    if (!Number.isFinite(initial) || initial < 0) return res.status(400).json({ error: 'Solde initial invalide.' });

    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [[company]] = await conn.query(
      'SELECT devise FROM users WHERE id = ? FOR UPDATE',
      [uid]
    );
    if (!company) {
      await conn.rollback();
      return res.status(404).json({ error: 'Entreprise introuvable.' });
    }

    const baseCurrency = String(company.devise || 'FCFA').trim().toUpperCase();
    const currency = req.body.devise === undefined || req.body.devise === null || String(req.body.devise).trim() === ''
      ? baseCurrency
      : String(req.body.devise).trim().toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Devise de caisse non prise en charge.' });
    }

    let establishmentId = null;
    if (req.body.etablissement_id) {
      const [establishments] = await conn.query(
        'SELECT id FROM pro_etablissements WHERE id = ? AND user_id = ?',
        [req.body.etablissement_id, uid]
      );
      if (!establishments.length) {
        await conn.rollback();
        return res.status(400).json({ error: 'Établissement invalide.' });
      }
      establishmentId = establishments[0].id;
    }

    const [result] = await conn.query(
      'INSERT INTO pro_caisses (user_id, etablissement_id, nom, devise, solde_initial) VALUES (?, ?, ?, ?, ?)',
      [uid, establishmentId, nom, currency, initial]
    );
    await conn.commit();
    await audit(req, 'caisse.creee', 'caisse', result.insertId, { nom, devise: currency });
    res.status(201).json({ id: result.insertId, nom, devise: currency });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.post('/cash/registers/:id/operations', async (req, res, next) => {
  let conn;
  try {
    const type = req.body.type;
    const montant = money(req.body.montant);
    const motif = String(req.body.motif || '').trim().slice(0, 255);
    if (!['entree', 'sortie'].includes(type) || !montant || !motif) return res.status(400).json({ error: 'Type, montant positif et motif obligatoires.' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT id, solde_initial FROM pro_caisses WHERE id = ? AND user_id = ? AND active = 1 FOR UPDATE', [req.params.id, owner(req)]);
    if (!rows.length) { await conn.rollback(); return res.status(404).json({ error: 'Caisse introuvable ou inactive.' }); }
    if (type === 'sortie') {
      const [[balance]] = await conn.query('SELECT ? + COALESCE(SUM(CASE WHEN type = ? THEN montant WHEN type = ? THEN -montant ELSE 0 END),0) AS solde FROM pro_caisse_operations WHERE caisse_id = ? AND user_id = ?', [rows[0].solde_initial, 'entree', 'sortie', req.params.id, owner(req)]);
      if (montant > Number(balance.solde || 0) + 0.001) {
        await conn.rollback();
        return res.status(400).json({ error: 'Solde de caisse insuffisant.' });
      }
    }
    const [result] = await conn.query('INSERT INTO pro_caisse_operations (user_id, caisse_id, type, montant, motif, reference) VALUES (?, ?, ?, ?, ?, ?)', [owner(req), req.params.id, type, montant, motif, String(req.body.reference || '').slice(0, 100) || null]);
    await conn.commit();
    await audit(req, 'caisse.operation', 'caisse', req.params.id, { operation_id: result.insertId, type, montant });
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.get('/cash/operations', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT o.*, c.nom AS caisse_nom FROM pro_caisse_operations o JOIN pro_caisses c ON c.id = o.caisse_id AND c.user_id = o.user_id WHERE o.user_id = ? ORDER BY o.operation_date DESC LIMIT 300', [owner(req)]);
    res.json({ operations: rows });
  } catch (err) { next(err); }
});

/* ---------------------------- ÉQUIPE ----------------------------------- */

module.exports = router;
