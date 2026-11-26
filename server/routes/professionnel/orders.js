/**
 * Module "orders" — extrait depuis routes/professionnel.js (Phase 3b, chunkage par route).
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

router.get('/orders', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT o.*, c.nom AS client_nom FROM pro_commandes o JOIN clients c ON c.id = o.client_id AND c.user_id = o.user_id WHERE o.user_id = ? ORDER BY o.date_commande DESC, o.id DESC LIMIT 250',
      [owner(req)]
    );
    res.json({ commandes: rows.map(r => ({ ...r, lignes: parseJson(r.lignes_json, []) })) });
  } catch (err) { next(err); }
});

router.post('/orders', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req);
    const clientId = Number(req.body.client_id);
    const lignes = Array.isArray(req.body.lignes) ? req.body.lignes : [];
    if (!lignes.length || lignes.length > 100) return res.status(400).json({ error: 'Une commande doit contenir entre 1 et 100 lignes.' });

    let total = 0;
    const normalized = [];
    for (const line of lignes) {
      const designation = String(line.designation || '').trim().slice(0, 255);
      const quantite = Number(line.quantite);
      const prix = Number(line.prix_unitaire);
      if (!designation || !Number.isFinite(quantite) || quantite <= 0 || !Number.isFinite(prix) || prix < 0) {
        return res.status(400).json({ error: 'Chaque ligne doit avoir une désignation, une quantité positive et un prix valide.' });
      }
      const ligneTotal = Math.round(quantite * prix * 100) / 100;
      total += ligneTotal;
      normalized.push({ designation, quantite, prix_unitaire: prix, total: ligneTotal, produit_id: idOk(line.produit_id) ? Number(line.produit_id) : null });
    }
    total = Math.round(total * 100) / 100;

    conn = await pool.getConnection();
    await conn.beginTransaction();
    // Même verrou de compte que les réglages de devise et le quota des factures.
    // L'ordre est alors sérialisé avec un changement de devise : soit l'ordre est
    // enregistré avant (et bloque le changement), soit il lit la nouvelle devise.
    const [[company]] = await conn.query('SELECT devise FROM users WHERE id = ? FOR UPDATE', [uid]);
    if (!company) {
      await conn.rollback();
      return res.status(404).json({ error: 'Entreprise introuvable.' });
    }
    const baseCurrency = String(company.devise || 'FCFA').trim().toUpperCase();
    const currency = String(req.body.devise || baseCurrency).trim().toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Devise de commande non prise en charge.' });
    }
    if (currency !== baseCurrency) {
      await conn.rollback();
      return res.status(409).json({
        error: 'La devise du document doit correspondre à la devise de base de l’entreprise. Les conversions multi-devises ne sont pas encore activées.'
      });
    }
    const [clientRows] = await conn.query('SELECT id FROM clients WHERE id = ? AND user_id = ?', [clientId, uid]);
    if (!clientRows.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Client invalide pour cette entreprise.' });
    }

    const orderNumber = randomRef('CMD');
    const [result] = await conn.query(
      'INSERT INTO pro_commandes (user_id, client_id, numero, statut, date_commande, date_livraison_prevue, devise, total, lignes_json, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [uid, clientId, orderNumber, 'confirmee', await safeDateForUser(req.body.date_commande, uid), req.body.date_livraison_prevue || null, currency, total, JSON.stringify(normalized), String(req.body.notes || '').slice(0, 2000) || null]
    );
    await conn.commit();
    await audit(req, 'commande.creee', 'commande', result.insertId, { numero: orderNumber });
    res.status(201).json({ id: result.insertId, total, devise: currency, lignes: normalized });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.put('/orders/:id/status', async (req, res, next) => {
  try {
    const statuses = ['brouillon', 'confirmee', 'preparee', 'livree', 'annulee'];
    if (!statuses.includes(req.body.statut)) return res.status(400).json({ error: 'Statut de commande invalide.' });
    const [result] = await pool.query('UPDATE pro_commandes SET statut = ? WHERE id = ? AND user_id = ?', [req.body.statut, req.params.id, owner(req)]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Commande introuvable.' });
    await audit(req, 'commande.statut_modifie', 'commande', req.params.id, { statut: req.body.statut });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/orders/:id/delivery-note', async (req, res, next) => {
  try {
    const uid = owner(req);
    const [rows] = await pool.query('SELECT * FROM pro_commandes WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'Commande introuvable.' });
    const [clientRows] = await pool.query('SELECT nom, adresse FROM clients WHERE id = ? AND user_id = ?', [order.client_id, uid]);
    const numero = randomRef('BL');
    const [result] = await pool.query(
      'INSERT INTO pro_bons_livraison (user_id, commande_id, numero, date_livraison, destinataire, adresse_livraison, lignes_json, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uid, order.id, numero, await safeDateForUser(req.body.date_livraison, uid), clientRows[0]?.nom || null, req.body.adresse_livraison || clientRows[0]?.adresse || null, order.lignes_json, String(req.body.notes || '').slice(0, 2000) || null]
    );
    await pool.query('UPDATE pro_commandes SET statut = ? WHERE id = ? AND user_id = ?', ['preparee', order.id, uid]);
    await audit(req, 'bon_livraison.cree', 'bon_livraison', result.insertId, { commande_id: order.id, numero });
    res.status(201).json({ id: result.insertId, numero });
  } catch (err) { next(err); }
});

router.get('/delivery-notes', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT b.*, c.nom AS client_nom FROM pro_bons_livraison b LEFT JOIN pro_commandes o ON o.id = b.commande_id AND o.user_id = b.user_id LEFT JOIN clients c ON c.id = o.client_id AND c.user_id = o.user_id WHERE b.user_id = ? ORDER BY b.date_livraison DESC, b.id DESC LIMIT 250', [owner(req)]);
    res.json({ bons_livraison: rows.map(r => ({ ...r, lignes: parseJson(r.lignes_json, []) })) });
  } catch (err) { next(err); }
});

router.get('/credit-notes', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT a.*, f.numero AS facture_numero FROM pro_avoirs a JOIN factures f ON f.id = a.facture_id AND f.user_id = a.user_id WHERE a.user_id = ? ORDER BY a.date_emission DESC, a.id DESC LIMIT 250', [owner(req)]);
    res.json({ avoirs: rows });
  } catch (err) { next(err); }
});

router.post('/credit-notes', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req), invoiceId = Number(req.body.facture_id), amount = money(req.body.montant), motif = String(req.body.motif || '').trim().slice(0, 500);
    if (!amount || !motif) return res.status(400).json({ error: 'Montant positif et motif obligatoires.' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [invoiceRows] = await conn.query('SELECT * FROM factures WHERE id = ? AND user_id = ? FOR UPDATE', [invoiceId, uid]);
    const invoice = invoiceRows[0];
    if (!invoice) { await conn.rollback(); return res.status(404).json({ error: 'Facture introuvable.' }); }
    const [[sum]] = await conn.query("SELECT COALESCE(SUM(montant),0) AS total FROM pro_avoirs WHERE user_id = ? AND facture_id = ? AND statut != 'rejete'", [uid, invoiceId]);
    const available = Number(invoice.total) - Number(sum.total || 0);
    if (amount > available + 0.001) {
      await conn.rollback();
      return res.status(400).json({ error: 'Le montant de cet avoir dépasse le montant encore disponible sur la facture.' });
    }
    const numero = randomRef('AVR');
    const [result] = await conn.query('INSERT INTO pro_avoirs (user_id, facture_id, numero, date_emission, montant, motif) VALUES (?, ?, ?, ?, ?, ?)', [uid, invoiceId, numero, await safeDateForUser(req.body.date_emission, uid), amount, motif]);
    await conn.commit();
    await audit(req, 'avoir.cree', 'avoir', result.insertId, { facture_id: invoiceId, montant: amount, numero });
    res.status(201).json({ id: result.insertId, numero, statut: 'brouillon', montant: amount });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.put('/credit-notes/:id/status', async (req, res, next) => {
  try {
    const statut = req.body.statut;
    if (!['valide', 'rejete'].includes(statut)) return res.status(400).json({ error: 'Statut invalide.' });
    const [result] = await pool.query('UPDATE pro_avoirs SET statut = ? WHERE id = ? AND user_id = ? AND statut = ?', [statut, req.params.id, owner(req), 'brouillon']);
    if (!result.affectedRows) return res.status(404).json({ error: 'Avoir introuvable ou déjà traité.' });
    await audit(req, 'avoir.statut_modifie', 'avoir', req.params.id, { statut });
    res.json({ success: true, statut });
  } catch (err) { next(err); }
});


/* ---------------------------- ACOMPTES ---------------------------------- */

module.exports = router;
