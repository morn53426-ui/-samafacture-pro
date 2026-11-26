/**
 * Module "reports" — extrait depuis routes/professionnel.js (Phase 3b, chunkage par route).
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

router.get('/reports/margins', async (req, res, next) => {
  try {
    const params = [owner(req)];
    let dateClause = '';
    if (req.query.from && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from)) { dateClause += ' AND f.date_emission >= ?'; params.push(req.query.from); }
    if (req.query.to && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)) { dateClause += ' AND f.date_emission <= ?'; params.push(req.query.to); }
    const [rows] = await pool.query(
      'SELECT fl.produit_id, fl.designation, SUM(fl.quantite) AS quantite, SUM(fl.quantite * fl.prix_unitaire) AS chiffre_affaires_ht, SUM(fl.quantite * COALESCE(p.prix_achat,0)) AS cout_estime, SUM(fl.quantite * (fl.prix_unitaire - COALESCE(p.prix_achat,0))) AS marge_estimee, SUM(CASE WHEN p.id IS NULL OR p.prix_achat = 0 THEN 1 ELSE 0 END) AS lignes_sans_cout FROM facture_lignes fl JOIN factures f ON f.id = fl.facture_id LEFT JOIN produits p ON p.id = fl.produit_id AND p.user_id = f.user_id WHERE f.user_id = ? AND f.type = ? AND f.statut != ?' + dateClause + ' GROUP BY fl.produit_id, fl.designation ORDER BY marge_estimee DESC LIMIT 250',
      [...params, 'facture', 'annulee']
    );
    const data = rows.map(r => ({ ...r, marge_estimee: Number(r.marge_estimee || 0), chiffre_affaires_ht: Number(r.chiffre_affaires_ht || 0), cout_estime: Number(r.cout_estime || 0), marge_pourcent: Number(r.chiffre_affaires_ht) > 0 ? Number(r.marge_estimee) / Number(r.chiffre_affaires_ht) * 100 : null }));
    res.json({ marges: data, avertissement: 'Les marges sont estimatives : renseignez le prix d’achat de chaque produit. Les frais indirects et coûts de service ne sont pas inclus.' });
  } catch (err) { next(err); }
});

router.get('/reports/forecast', async (req, res, next) => {
  try {
    const userId = owner(req);
    const [accounts] = await pool.query(
      'SELECT fuseau_horaire FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const localToday = localDateString(accounts?.[0]?.fuseau_horaire || 'Africa/Dakar');
    const [rows] = await pool.query(
      "SELECT DATE_FORMAT(p.date_paiement, '%Y-%m') AS mois, SUM(p.montant) AS encaissements, COUNT(*) AS nb_paiements FROM paiements p JOIN factures f ON f.id = p.facture_id AND f.user_id = p.user_id WHERE p.user_id = ? AND f.type = 'facture' AND f.statut != 'annulee' AND p.date_paiement >= DATE_SUB(?, INTERVAL 6 MONTH) GROUP BY mois ORDER BY mois",
      [userId, localToday]
    );
    const monthlyAverage = rows.length ? rows.reduce((s, r) => s + Number(r.encaissements || 0), 0) / 6 : 0;
    const [yearPart, monthPart] = localToday.slice(0, 7).split('-').map(Number);
    const forecast = [1, 2, 3].map(i => {
      const monthIndex = yearPart * 12 + monthPart - 1 + i;
      const year = Math.floor(monthIndex / 12);
      const month = String(monthIndex % 12 + 1).padStart(2, '0');
      return { mois: year + '-' + month, encaissements_estimes: Math.round(monthlyAverage * 100) / 100 };
    });
    res.json({ historique: rows, moyenne_mensuelle_6_mois: monthlyAverage, previsions: forecast, methode: 'Moyenne simple des encaissements des six derniers mois, sans saisonnalité ni correction statistique.' });
  } catch (err) { next(err); }
});

router.get('/reports/custom', async (req, res, next) => {
  try {
    const group = ['day','month','client'].includes(req.query.group_by) ? req.query.group_by : 'month';
    const dateExpr = group === 'day' ? 'f.date_emission' : group === 'client' ? 'c.nom' : "DATE_FORMAT(f.date_emission, '%Y-%m')";
    const params = [owner(req), 'facture'];
    let where = '';
    if (req.query.from && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from)) { where += ' AND f.date_emission >= ?'; params.push(req.query.from); }
    if (req.query.to && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)) { where += ' AND f.date_emission <= ?'; params.push(req.query.to); }
    if (idOk(req.query.client_id)) { where += ' AND f.client_id = ?'; params.push(Number(req.query.client_id)); }
    const [rows] = await pool.query('SELECT ' + dateExpr + ' AS label, COUNT(*) AS nb_factures, SUM(f.total) AS total, SUM(f.montant_paye) AS encaisse FROM factures f JOIN clients c ON c.id = f.client_id AND c.user_id = f.user_id WHERE f.user_id = ? AND f.type = ? AND f.statut != ?' + where + ' GROUP BY label ORDER BY label', [params[0], params[1], 'annulee', ...params.slice(2)]);
    res.json({ groupe: group, rows });
  } catch (err) { next(err); }
});

/* -------------------------- AUTOMATISATIONS ----------------------------- */

module.exports = router;
