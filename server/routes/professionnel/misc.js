/**
 * Module "misc" — extrait depuis routes/professionnel.js (Phase 3b, chunkage par route).
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
const { lireGateway } = require('./integrations');


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

router.get('/deposits', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT a.*, f.numero AS facture_numero, c.nom AS client_nom FROM pro_acomptes a JOIN factures f ON f.id = a.facture_id AND f.user_id = a.user_id JOIN clients c ON c.id = f.client_id AND c.user_id = f.user_id WHERE a.user_id = ? ORDER BY a.date_emission DESC, a.id DESC LIMIT 250',
      [owner(req)]
    );
    res.json({ acomptes: rows });
  } catch (err) { next(err); }
});

router.post('/deposits', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req), invoiceId = Number(req.body.facture_id), amount = money(req.body.montant);
    if (!amount) return res.status(400).json({ error: 'Le montant de l’acompte doit être positif.' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [invoiceRows] = await conn.query('SELECT * FROM factures WHERE id = ? AND user_id = ? FOR UPDATE', [invoiceId, uid]);
    const invoice = invoiceRows[0];
    if (!invoice || invoice.type !== 'facture' || invoice.statut === 'annulee') {
      await conn.rollback();
      return res.status(404).json({ error: 'Facture finale introuvable ou non éligible.' });
    }
    const [[sum]] = await conn.query(
      "SELECT COALESCE(SUM(montant),0) AS total FROM pro_acomptes WHERE user_id = ? AND facture_id = ? AND statut != 'annule'",
      [uid, invoiceId]
    );
    const available = Number(invoice.total) - Number(invoice.montant_paye) - Number(sum.total || 0);
    if (amount > available + 0.001) {
      await conn.rollback();
      return res.status(400).json({ error: 'Le montant dépasse le solde qui peut encore être demandé en acompte.' });
    }
    const numero = randomRef('ACP');
    const [result] = await conn.query(
      'INSERT INTO pro_acomptes (user_id, facture_id, numero, date_emission, montant) VALUES (?, ?, ?, ?, ?)',
      [uid, invoiceId, numero, await safeDateForUser(req.body.date_emission, uid), amount]
    );
    await conn.commit();
    await audit(req, 'acompte.cree', 'acompte', result.insertId, { facture_id: invoiceId, montant: amount });
    res.status(201).json({ id: result.insertId, numero, montant: amount, statut: 'a_encaisser' });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.post('/deposits/:id/receive', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const uid = owner(req);
    const methode = String(req.body.methode || '').trim().slice(0, 50);
    const reference = String(req.body.reference || '').trim().slice(0, 190) || null;
    if (!methode) return res.status(400).json({ error: 'La méthode de règlement est obligatoire.' });
    await conn.beginTransaction();
    const [depositRows] = await conn.query('SELECT * FROM pro_acomptes WHERE id = ? AND user_id = ? FOR UPDATE', [req.params.id, uid]);
    const deposit = depositRows[0];
    if (!deposit) { await conn.rollback(); return res.status(404).json({ error: 'Acompte introuvable.' }); }
    if (deposit.statut === 'encaisse') { await conn.rollback(); return res.json({ success: true, idempotent_replay: true }); }
    if (deposit.statut !== 'a_encaisser') { await conn.rollback(); return res.status(409).json({ error: 'Cet acompte n’est plus encaissable.' }); }
    const [invoiceRows] = await conn.query('SELECT * FROM factures WHERE id = ? AND user_id = ? FOR UPDATE', [deposit.facture_id, uid]);
    const invoice = invoiceRows[0];
    if (!invoice || invoice.type !== 'facture' || invoice.statut === 'annulee') { await conn.rollback(); return res.status(409).json({ error: 'La facture liée n’est plus disponible.' }); }
    const remaining = Math.max(0, Number(invoice.total) - Number(invoice.montant_paye));
    if (Number(deposit.montant) > remaining + 0.001) { await conn.rollback(); return res.status(409).json({ error: 'Le solde de la facture est devenu inférieur au montant de cet acompte.' }); }
    await conn.query(
      'INSERT INTO paiements (user_id, facture_id, montant, methode, reference) VALUES (?, ?, ?, ?, ?)',
      [uid, invoice.id, deposit.montant, methode, reference || ('ACOMPTE-' + deposit.numero)]
    );
    const paid = Number(invoice.montant_paye) + Number(deposit.montant);
    const status = paid >= Number(invoice.total) ? 'payee' : invoice.statut;
    await conn.query('UPDATE factures SET montant_paye = ?, statut = ? WHERE id = ? AND user_id = ?', [paid, status, invoice.id, uid]);
    await conn.query("UPDATE pro_acomptes SET statut = 'encaisse', methode = ?, reference_paiement = ?, encaisse_le = NOW() WHERE id = ? AND user_id = ?", [methode, reference, deposit.id, uid]);
    await conn.commit();
    await audit(req, 'acompte.encaisse', 'acompte', deposit.id, { facture_id: invoice.id, montant: deposit.montant, methode });
    queueWebhookEvent(uid, 'payment.received', { invoice_id: invoice.id, montant: Number(deposit.montant), methode, type: 'acompte' }).catch(err => console.warn('Webhook acompte ignoré :', err.message));
    res.json({ success: true, facture_id: invoice.id, montant_encaisse: Number(deposit.montant), solde_restant: Math.max(0, Number(invoice.total) - paid) });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    next(err);
  } finally {
    conn.release();
  }
});

/* --------------------------- CLIENTS ----------------------------------- */

router.get('/clients/:id/statement', async (req, res, next) => {
  try {
    const uid = owner(req), clientId = Number(req.params.id);
    const client = await clientOwned(uid, clientId);
    if (!client) return res.status(404).json({ error: 'Client introuvable.' });
    const [factures] = await pool.query('SELECT id, numero, date_emission, date_echeance, total, montant_paye, statut, type FROM factures WHERE user_id = ? AND client_id = ? ORDER BY date_emission DESC, id DESC', [uid, clientId]);
    const [paiements] = await pool.query(
      `SELECT p.id, p.facture_id, p.montant, p.methode, p.reference, p.date_paiement, f.numero FROM paiements p JOIN factures f ON f.id = p.facture_id WHERE p.user_id = ? AND f.user_id = ? AND f.client_id = ? AND f.type = 'facture' ORDER BY p.date_paiement DESC`,
      [uid, uid, clientId]
    );
    const [remboursements] = await pool.query(
      "SELECT r.id, r.paiement_id, r.montant, r.motif, r.reference_prestataire, r.traite_le, f.numero FROM pro_refund_requests r JOIN paiements p ON p.id = r.paiement_id AND p.user_id = r.user_id JOIN factures f ON f.id = p.facture_id AND f.user_id = p.user_id WHERE r.user_id = ? AND f.user_id = ? AND r.statut = 'rembourse' AND f.client_id = ? AND f.type = 'facture' ORDER BY r.traite_le DESC",
      [uid, uid, clientId]
    );
    const totalFacture = factures.filter(f => f.type === 'facture' && f.statut !== 'annulee').reduce((s, f) => s + Number(f.total), 0);
    const totalPaye = paiements.reduce((s, p) => s + Number(p.montant), 0);
    const totalRembourse = remboursements.reduce((s, r) => s + Number(r.montant), 0);
    res.json({ client, factures, paiements, remboursements, total_paye: totalPaye, total_rembourse: totalRembourse, solde: Math.round((totalFacture - totalPaye + totalRembourse) * 100) / 100 });
  } catch (err) { next(err); }
});

router.post('/clients/:id/remind', async (req, res, next) => {
  try {
    const uid = owner(req), clientId = Number(req.params.id), canal = req.body.canal || 'email';
    const client = await clientOwned(uid, clientId);
    if (!client) return res.status(404).json({ error: 'Client introuvable.' });
    const [rows] = await pool.query("SELECT numero, total, montant_paye, date_echeance, devise FROM factures WHERE user_id = ? AND client_id = ? AND type = 'facture' AND statut IN ('en_attente','en_retard') ORDER BY date_echeance ASC", [uid, clientId]);
    const dues = rows.filter(f => Number(f.total) > Number(f.montant_paye));
    if (!dues.length) return res.status(400).json({ error: 'Aucune facture impayée pour ce client.' });
    const byCurrency = new Map();
    for (const facture of dues) {
      const devise = normalizeCurrency(facture.devise);
      const groupe = byCurrency.get(devise) || { lignes: [], solde: 0 };
      const reste = Number(facture.total) - Number(facture.montant_paye);
      groupe.lignes.push(facture.numero + ' : ' + formatAmountWithCurrency(reste, devise));
      groupe.solde += reste;
      byCurrency.set(devise, groupe);
    }
    const details = Array.from(byCurrency.entries()).map(([devise, groupe]) =>
      'Factures en ' + devise + ' :\n' + groupe.lignes.join('\n') +
      '\nSolde total : ' + formatAmountWithCurrency(groupe.solde, devise)
    ).join('\n\n');
    const message = 'Bonjour ' + client.nom + ', petit rappel concernant vos factures en attente :\n' + details + '\n\nMerci.';
    if (canal === 'whatsapp') {
      const phone = String(client.whatsapp || client.telephone || '').replace(/[^0-9]/g, '');
      if (!phone) return res.status(400).json({ error: 'Aucun numéro WhatsApp disponible pour ce client.' });
      const url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);
      await audit(req, 'relance.whatsapp_preparee', 'client', clientId, { nb_factures: dues.length });
      return res.json({ canal, url, message, automatisation: false });
    }
    if (canal !== 'email') return res.status(400).json({ error: 'Canal de relance non pris en charge.' });
    if (!client.email) return res.status(400).json({ error: 'Ce client ne possède pas d’adresse email.' });
    const result = await sendMail({ to: client.email, subject: 'Rappel de factures en attente', text: message });
    await audit(req, 'relance.email', 'client', clientId, { nb_factures: dues.length });
    res.json({ canal, sent: result.sent, smtp_configured: result.sent, message: result.sent ? 'Relance envoyée.' : 'SMTP non configuré : email non envoyé, voir les logs du serveur.' });
  } catch (err) { next(err); }
});

/* -------------------------- PAIEMENTS ---------------------------------- */

router.get('/payment-gateways', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT fournisseur, mode, actif, updated_at FROM pro_payment_gateways WHERE user_id = ? ORDER BY fournisseur',
      [owner(req)]
    );
    res.json({
      gateways: rows.map(row => ({ ...row, configured: true })),
      encryption_ready: Boolean(process.env.DATA_ENCRYPTION_KEY),
      warning: 'Chaque entreprise doit utiliser ses propres identifiants marchands. Les clés d’abonnement SamaFacture ne sont jamais réutilisées pour encaisser les factures clients.'
    });
  } catch (err) { next(err); }
});

router.put('/payment-gateways/:provider', async (req, res, next) => {
  try {
    const uid = owner(req), provider = String(req.params.provider || '').toLowerCase();
    if (!['wave', 'paydunya'].includes(provider)) return res.status(400).json({ error: 'Prestataire non pris en charge.' });
    if (!process.env.DATA_ENCRYPTION_KEY) return res.status(503).json({ error: 'DATA_ENCRYPTION_KEY doit être configurée avant d’enregistrer des clés marchandes.' });

    const [existingRows] = await pool.query(
      'SELECT credentials_enc, mode FROM pro_payment_gateways WHERE user_id = ? AND fournisseur = ? LIMIT 1',
      [uid, provider]
    );
    let credentials = existingRows.length ? JSON.parse(decryptSecret(existingRows[0].credentials_enc)) : {};
    if (provider === 'wave') {
      const apiKey = String(req.body.api_key || '').trim();
      const signingSecret = String(req.body.signing_secret || '').trim();
      if (apiKey) credentials.WAVE_API_KEY = apiKey;
      if (signingSecret) credentials.WAVE_SIGNING_SECRET = signingSecret;
      if (!credentials.WAVE_API_KEY || !credentials.WAVE_SIGNING_SECRET) {
        return res.status(400).json({ error: 'La clé API Wave et le secret de signature de webhook sont obligatoires.' });
      }
      if (credentials.WAVE_API_KEY.length < 12 || credentials.WAVE_SIGNING_SECRET.length < 12) {
        return res.status(400).json({ error: 'Les identifiants Wave semblent incomplets.' });
      }
    } else {
      const master = String(req.body.master_key || '').trim();
      const privateKey = String(req.body.private_key || '').trim();
      const token = String(req.body.token || '').trim();
      if (master) credentials.PAYDUNYA_MASTER_KEY = master;
      if (privateKey) credentials.PAYDUNYA_PRIVATE_KEY = privateKey;
      if (token) credentials.PAYDUNYA_TOKEN = token;
      if (!credentials.PAYDUNYA_MASTER_KEY || !credentials.PAYDUNYA_PRIVATE_KEY || !credentials.PAYDUNYA_TOKEN) {
        return res.status(400).json({ error: 'Les trois clés PayDunya sont obligatoires.' });
      }
      if ([credentials.PAYDUNYA_MASTER_KEY, credentials.PAYDUNYA_PRIVATE_KEY, credentials.PAYDUNYA_TOKEN].some(value => String(value).length < 8)) {
        return res.status(400).json({ error: 'Les identifiants PayDunya semblent incomplets.' });
      }
    }

    const mode = provider === 'paydunya' ? String(req.body.mode || existingRows[0]?.mode || 'test') : 'live';
    if (provider === 'paydunya' && !['test', 'live'].includes(mode)) return res.status(400).json({ error: 'Mode PayDunya invalide.' });
    await pool.query(
      'INSERT INTO pro_payment_gateways (user_id, fournisseur, credentials_enc, mode, actif) VALUES (?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE credentials_enc = VALUES(credentials_enc), mode = VALUES(mode), actif = 1',
      [uid, provider, encryptSecret(JSON.stringify(credentials)), mode]
    );
    await audit(req, 'paiement.prestataire_configure', 'prestataire', provider, { mode });
    res.json({ success: true, fournisseur: provider, mode, credentials_masked: true });
  } catch (err) { next(err); }
});

router.post('/invoices/:invoiceId/checkout', async (req, res, next) => {
  try {
    const uid = owner(req), provider = String(req.body.fournisseur || '').toLowerCase();
    if (!['wave', 'paydunya'].includes(provider)) return res.status(400).json({ error: 'Choisissez Wave ou PayDunya.' });
    const credentials = await lireGateway(uid, provider);
    if (!credentials || (provider === 'wave' ? !waveConfigured(credentials) : !paydunyaConfigured(credentials))) {
      return res.status(409).json({ error: 'Ce prestataire n’est pas configuré pour cette entreprise. Renseignez d’abord ses clés marchandes.' });
    }
    const [rows] = await pool.query(
      "SELECT f.id, f.numero, f.total, f.montant_paye, f.statut, f.type, u.entreprise_nom, u.devise FROM factures f JOIN users u ON u.id = f.user_id WHERE f.id = ? AND f.user_id = ? LIMIT 1",
      [req.params.invoiceId, uid]
    );
    const invoice = rows[0];
    if (!invoice || invoice.type !== 'facture') return res.status(404).json({ error: 'Facture introuvable.' });
    if (invoice.statut === 'annulee') return res.status(409).json({ error: 'Une facture annulée ne peut pas être payée.' });
    const remaining = Math.round((Number(invoice.total) - Number(invoice.montant_paye)) * 100) / 100;
    if (!Number.isFinite(remaining) || remaining <= 0) return res.status(409).json({ error: 'Cette facture est déjà soldée.' });
    // Wave et PayDunya règlent ici en XOF, devise sans sous-unité. Refuser un solde
    // fractionnaire plutôt que de créer un lien arrondi qui pourrait encaisser un autre montant.
    if (invoice.devise && invoice.devise !== 'FCFA' && invoice.devise !== 'XOF') {
      return res.status(409).json({ error: 'Les paiements en ligne ne sont activés que pour les factures en XOF/FCFA.' });
    }
    if (Math.abs(remaining - Math.round(remaining)) > 0.001) {
      return res.status(409).json({ error: 'Le solde XOF doit être un montant entier avant de créer un lien Wave ou PayDunya.' });
    }

    const base = String(process.env.APP_URL || '').replace(/\/$/, '');
    if (!base || !base.startsWith('https://')) return res.status(503).json({ error: 'APP_URL doit être une URL publique HTTPS pour activer le paiement en ligne.' });
    const reference = crypto.randomBytes(32).toString('hex');
    const [inserted] = await pool.query(
      "INSERT INTO pro_invoice_checkouts (user_id, facture_id, fournisseur, reference_interne, montant, devise, statut, expire_at) VALUES (?, ?, ?, ?, ?, 'XOF', 'creation', DATE_ADD(NOW(), INTERVAL 30 MINUTE))",
      [uid, invoice.id, provider, reference, remaining]
    );
    const returnUrl = base + '/paiement-retour.html?reference=' + encodeURIComponent(reference);
    try {
      let checkoutUrl, providerRef;
      if (provider === 'wave') {
        const session = await creerSessionWave({
          amount: remaining, reference, successUrl: returnUrl, errorUrl: returnUrl, credentials
        });
        checkoutUrl = session.checkoutUrl;
        providerRef = session.sessionId;
      } else {
        const created = await creerFacturePaydunya({
          amount: remaining,
          description: 'Facture ' + invoice.numero,
          reference,
          storeName: invoice.entreprise_nom || 'SamaFacture Pro',
          returnUrl,
          cancelUrl: returnUrl,
          callbackUrl: base + '/api/payment-webhooks/paydunya',
          credentials
        });
        checkoutUrl = created.checkoutUrl;
        providerRef = created.token;
      }
      if (!checkoutUrl || !providerRef) throw new Error('Le prestataire n’a pas retourné une session de paiement valide.');
      await pool.query(
        "UPDATE pro_invoice_checkouts SET reference_prestataire = ?, checkout_url = ?, statut = 'en_attente' WHERE id = ? AND user_id = ?",
        [String(providerRef), checkoutUrl, inserted.insertId, uid]
      );
      await audit(req, 'paiement.checkout_cree', 'facture', invoice.id, { fournisseur: provider, montant: remaining, reference_interne: reference });
      res.status(201).json({ checkout_url: checkoutUrl, reference, fournisseur: provider, montant: remaining, devise: 'XOF', expires_in_minutes: 30 });
    } catch (providerError) {
      await pool.query("UPDATE pro_invoice_checkouts SET statut = 'echec' WHERE id = ? AND user_id = ?", [inserted.insertId, uid]);
      throw providerError;
    }
  } catch (err) {
    if (/Impossible|prestataire|Wave|PayDunya|session/i.test(err.message || '')) return res.status(502).json({ error: err.message });
    next(err);
  }
});

router.get('/checkouts/:reference/status', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT c.statut, c.montant, c.devise, c.fournisseur, c.created_at, c.paid_at, f.numero AS facture_numero FROM pro_invoice_checkouts c JOIN factures f ON f.id = c.facture_id AND f.user_id = c.user_id WHERE c.reference_interne = ? AND c.user_id = ? LIMIT 1',
      [req.params.reference, owner(req)]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session de paiement introuvable.' });
    res.json({ checkout: rows[0] });
  } catch (err) { next(err); }
});

/* ------------------------- FOURNISSEURS & ACHATS ------------------------ */
async function ensureDefaultWarehouse(uid) {
  const userId = Number(uid);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error('Identifiant utilisateur invalide pour initialiser le magasin principal.');
  }

  // Plusieurs requêtes métier peuvent demander le magasin principal en même temps.
  // Le verrou nommé MySQL sérialise le backfill par entreprise, sur tous les workers.
  const lockName = 'sunupilot:default-warehouse:' + userId;
  const conn = await pool.getConnection();
  let lockAcquired = false;
  let transactionStarted = false;
  try {
    const [[lock]] = await conn.query('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
    if (Number(lock?.acquired) !== 1) {
      throw new Error('Impossible de verrouiller l’initialisation du magasin principal. Réessayez.');
    }
    lockAcquired = true;

    await conn.beginTransaction();
    transactionStarted = true;
    await conn.query(
      "INSERT IGNORE INTO pro_entrepots (user_id, code, nom, par_defaut) VALUES (?, 'PRINCIPAL', 'Magasin principal', 1)",
      [userId]
    );
    const [[warehouse]] = await conn.query(
      'SELECT id, backfill_stock_termine FROM pro_entrepots WHERE user_id = ? AND code = ? LIMIT 1 FOR UPDATE',
      [userId, 'PRINCIPAL']
    );
    if (!warehouse) throw new Error('Impossible de retrouver le magasin principal après son initialisation.');

    // Un autre parcours (ex. facture récurrente) peut avoir créé le magasin avant cet appel.
    // Le marqueur représente l'état réel du backfill, et non le résultat de INSERT IGNORE.
    // Le verrou nommé + la transaction rendent la reprise unique, atomique et réessayable.
    if (Number(warehouse.backfill_stock_termine) !== 1) {
      await conn.query(
        `INSERT IGNORE INTO pro_stocks_entrepots (user_id, entrepot_id, produit_id, quantite)
         SELECT p.user_id, ?, p.id, GREATEST(0, p.stock - COALESCE(existing.total, 0))
         FROM produits p
         LEFT JOIN (
           SELECT produit_id, SUM(quantite) AS total
           FROM pro_stocks_entrepots
           WHERE user_id = ?
           GROUP BY produit_id
         ) existing ON existing.produit_id = p.id
         WHERE p.user_id = ?
           AND COALESCE(p.type_catalogue, 'non_classe') <> 'service'`,
        [warehouse.id, userId, userId]
      );
      await conn.query(
        'UPDATE pro_entrepots SET backfill_stock_termine = 1 WHERE id = ? AND user_id = ?',
        [warehouse.id, userId]
      );
    }

    await conn.commit();
    transactionStarted = false;
    return Number(warehouse.id);
  } catch (err) {
    if (transactionStarted) {
      try { await conn.rollback(); } catch (_) { /* Conserver l'erreur initiale. */ }
    }
    throw err;
  } finally {
    let discardConnection = false;
    if (lockAcquired) {
      try {
        await conn.query('SELECT RELEASE_LOCK(?)', [lockName]);
      } catch (_) {
        // Détruire la connexion force MySQL à libérer tout verrou nommé restant.
        discardConnection = true;
      }
    }
    if (discardConnection) conn.destroy();
    else conn.release();
  }
}

router.get('/inventory/stock', async (req, res, next) => {
  try {
    await ensureDefaultWarehouse(owner(req));
    const [rows] = await pool.query(
      `SELECT p.id AS produit_id, p.nom, p.reference, p.prix_achat, p.prix_ht, COALESCE(SUM(s.quantite),0) AS quantite, COUNT(DISTINCT s.entrepot_id) AS nb_entrepots FROM produits p LEFT JOIN pro_stocks_entrepots s ON s.produit_id = p.id AND s.user_id = p.user_id WHERE p.user_id = ? AND COALESCE(p.type_catalogue, 'non_classe') <> 'service' GROUP BY p.id ORDER BY p.nom`,
      [owner(req)]
    );
    res.json({ stocks: rows });
  } catch (err) { next(err); }
});

router.get('/inventory/movements', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT m.*, COALESCE(m.produit_nom, p.nom) AS produit_nom, COALESCE(m.entrepot_nom, w.nom) AS entrepot_nom FROM pro_mouvements_stock m LEFT JOIN produits p ON p.id = m.produit_id AND p.user_id = m.user_id LEFT JOIN pro_entrepots w ON w.id = m.entrepot_id AND w.user_id = m.user_id WHERE m.user_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT 300',
      [owner(req)]
    );
    res.json({ mouvements: rows });
  } catch (err) { next(err); }
});

router.post('/inventory/adjustments', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req), productId = Number(req.body.produit_id), warehouseId = Number(req.body.entrepot_id) || await ensureDefaultWarehouse(uid);
    const delta = Math.round(Number(req.body.quantite) * 1000) / 1000, reason = String(req.body.motif || '').trim().slice(0, 255);
    if (!idOk(productId) || !Number.isFinite(delta) || !delta || Math.abs(delta) > 10000000 || !reason) return res.status(400).json({ error: 'Produit, quantité non nulle et motif obligatoires.' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [products] = await conn.query('SELECT id, nom, prix_achat, type_catalogue FROM produits WHERE id = ? AND user_id = ? FOR UPDATE', [productId, uid]);
    const [warehouses] = await conn.query('SELECT id, nom FROM pro_entrepots WHERE id = ? AND user_id = ? AND actif = 1', [warehouseId, uid]);
    if (!products.length || !warehouses.length) { await conn.rollback(); return res.status(404).json({ error: 'Produit ou entrepôt introuvable.' }); }
    if (products[0].type_catalogue === 'service') { await conn.rollback(); return res.status(409).json({ error: 'Un service ne peut pas recevoir de mouvement de stock.' }); }
    await conn.query('INSERT INTO pro_stocks_entrepots (user_id, entrepot_id, produit_id, quantite) VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE id = id', [uid, warehouseId, productId]);
    const [[stock]] = await conn.query('SELECT quantite FROM pro_stocks_entrepots WHERE user_id = ? AND entrepot_id = ? AND produit_id = ? FOR UPDATE', [uid, warehouseId, productId]);
    const next = Math.round((Number(stock.quantite) + delta) * 1000) / 1000;
    if (next < 0) { await conn.rollback(); return res.status(409).json({ error: 'Le stock de cet entrepôt ne peut pas devenir négatif.' }); }
    await conn.query('UPDATE pro_stocks_entrepots SET quantite = ? WHERE user_id = ? AND entrepot_id = ? AND produit_id = ?', [next, uid, warehouseId, productId]);
    await conn.query(
      "INSERT INTO pro_mouvements_stock (user_id, produit_id, produit_nom, entrepot_id, entrepot_nom, type, quantite, cout_unitaire, motif, acteur_user_id) VALUES (?, ?, ?, ?, ?, 'ajustement', ?, ?, ?, ?)",
      [uid, productId, products[0].nom, warehouseId, warehouses[0].nom, delta, products[0].prix_achat, reason, actor(req)]
    );
    await conn.query(
      'UPDATE produits p SET p.stock = (SELECT COALESCE(SUM(s.quantite),0) FROM pro_stocks_entrepots s WHERE s.user_id = p.user_id AND s.produit_id = p.id) WHERE p.id = ? AND p.user_id = ?',
      [productId, uid]
    );
    await conn.commit();
    await audit(req, 'stock.ajustement', 'produit', productId, { entrepot_id: warehouseId, variation: delta, motif: reason });
    res.json({ success: true, stock_entrepot: next });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally { if (conn) conn.release(); }
});

router.post('/inventory/transfers', async (req, res, next) => {
  let conn;
  try {
    await ensureDefaultWarehouse(owner(req));
    const uid = owner(req), productId = Number(req.body.produit_id), fromId = Number(req.body.entrepot_source_id), toId = Number(req.body.entrepot_destination_id), qty = Math.round(Number(req.body.quantite) * 1000) / 1000;
    if (!idOk(productId) || !idOk(fromId) || !idOk(toId) || fromId === toId || !Number.isFinite(qty) || qty <= 0 || qty > 10000000) return res.status(400).json({ error: 'Produit, deux entrepôts différents et quantité positive obligatoires.' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [productRows] = await conn.query('SELECT id, nom, prix_achat, type_catalogue FROM produits WHERE id = ? AND user_id = ? FOR UPDATE', [productId, uid]);
    const [warehouseRows] = await conn.query('SELECT id, nom FROM pro_entrepots WHERE id IN (?, ?) AND user_id = ? AND actif = 1', [fromId, toId, uid]);
    if (!productRows.length || warehouseRows.length !== 2) { await conn.rollback(); return res.status(404).json({ error: 'Produit ou entrepôt introuvable.' }); }
    if (productRows[0].type_catalogue === 'service') { await conn.rollback(); return res.status(409).json({ error: 'Un service ne peut pas être transféré entre entrepôts.' }); }
    await conn.query('INSERT INTO pro_stocks_entrepots (user_id, entrepot_id, produit_id, quantite) VALUES (?, ?, ?, 0), (?, ?, ?, 0) ON DUPLICATE KEY UPDATE id = id', [uid, fromId, productId, uid, toId, productId]);
    const [stocks] = await conn.query('SELECT entrepot_id, quantite FROM pro_stocks_entrepots WHERE user_id = ? AND produit_id = ? AND entrepot_id IN (?, ?) FOR UPDATE', [uid, productId, fromId, toId]);
    const source = stocks.find(row => Number(row.entrepot_id) === fromId);
    if (!source || Number(source.quantite) < qty) { await conn.rollback(); return res.status(409).json({ error: 'Stock insuffisant dans l’entrepôt source.' }); }
    const reference = randomRef('TRF');
    await conn.query('UPDATE pro_stocks_entrepots SET quantite = quantite - ? WHERE user_id = ? AND entrepot_id = ? AND produit_id = ?', [qty, uid, fromId, productId]);
    await conn.query('UPDATE pro_stocks_entrepots SET quantite = quantite + ? WHERE user_id = ? AND entrepot_id = ? AND produit_id = ?', [qty, uid, toId, productId]);
    await conn.query(
      "INSERT INTO pro_mouvements_stock (user_id, produit_id, produit_nom, entrepot_id, entrepot_nom, type, quantite, cout_unitaire, reference, motif, acteur_user_id) VALUES (?, ?, ?, ?, ?, 'transfert_sortant', ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, 'transfert_entrant', ?, ?, ?, ?, ?)",
      [uid, productId, productRows[0].nom, fromId, warehouseRows.find(w => Number(w.id) === fromId).nom, -qty, productRows[0].prix_achat, reference, 'Transfert vers entrepôt #' + toId, actor(req),
       uid, productId, productRows[0].nom, toId, warehouseRows.find(w => Number(w.id) === toId).nom, qty, productRows[0].prix_achat, reference, 'Transfert depuis entrepôt #' + fromId, actor(req)]
    );
    await conn.commit();
    res.json({ success: true, reference });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally { if (conn) conn.release(); }
});

router.get('/inventory/valuation', async (req, res, next) => {
  try {
    await ensureDefaultWarehouse(owner(req));
    const [rows] = await pool.query(
      `SELECT p.id, p.nom, p.reference, p.prix_achat, COALESCE(SUM(s.quantite),0) AS quantite, COALESCE(SUM(s.quantite * p.prix_achat),0) AS valeur FROM produits p LEFT JOIN pro_stocks_entrepots s ON s.produit_id = p.id AND s.user_id = p.user_id WHERE p.user_id = ? AND COALESCE(p.type_catalogue, 'non_classe') <> 'service' GROUP BY p.id ORDER BY p.nom`,
      [owner(req)]
    );
    const total = rows.reduce((sum, row) => sum + Number(row.valeur), 0);
    const [[company]] = await pool.query('SELECT devise FROM users WHERE id = ? LIMIT 1', [owner(req)]);
    res.json({ valorisation: rows, valeur_totale: Math.round(total * 100) / 100, devise: company?.devise || 'FCFA' });
  } catch (err) { next(err); }
});

/* --------------------------- COMPTABILITE OHADA ------------------------- */
const OHADA_STARTER_ACCOUNTS = [
  ['101','Capital social',1,'credit',0],['12','Résultat net de l’exercice',1,'credit',0],
  ['21','Immobilisations corporelles',2,'debit',0],['28','Amortissements',2,'credit',0],
  ['31','Stocks de marchandises',3,'debit',0],['37','Stocks de produits',3,'debit',0],
  ['401','Fournisseurs',4,'credit',1],['411','Clients',4,'debit',1],['421','Personnel, rémunérations dues',4,'credit',1],
  ['443','État, TVA facturée',4,'credit',0],['445','État, TVA récupérable',4,'debit',0],
  ['521','Banques',5,'debit',0],['571','Caisse',5,'debit',0],
  ['601','Achats de marchandises',6,'debit',0],['604','Achats de matières et fournitures',6,'debit',0],
  ['6181','Voyages et déplacements',6,'debit',0],['622','Locations et charges locatives',6,'debit',0],['625','Primes d’assurance',6,'debit',0],['641','Rémunérations du personnel',6,'debit',0],
  ['638','Autres charges externes',6,'debit',0],['661','Charges d’intérêts',6,'debit',0],['701','Ventes de marchandises',7,'credit',0],
  ['702','Ventes de produits finis',7,'credit',0],['703','Ventes de produits intermédiaires',7,'credit',0],
  ['704','Ventes de produits résiduels',7,'credit',0],['705','Travaux facturés',7,'credit',0],
  ['706','Services vendus',7,'credit',0],['707','Produits accessoires',7,'credit',0],['758','Produits divers',7,'credit',0]
];


const ACCOUNTING_SALE_MAPPING_KEYS = Object.freeze([
  'produit', 'service', 'non_classe', 'saisie_libre', 'frais_livraison'
]);

function normalizeAccountingCategoryKey(value) {
  return String(value == null ? '' : value)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 100);
}

function accountingMappingError(message, code = 'CORRESPONDANCE_COMPTABLE_MANQUANTE') {
  const error = new Error(message);
  error.status = 409;
  error.code = code;
  return error;
}

async function findAccountingCorrespondence(uid, sourceType, sourceKey, conn = pool) {
  const [rows] = await conn.query(
    'SELECT m.id, m.compte_id, m.type_source, m.cle_source, c.code, c.libelle, c.classe, c.actif FROM pro_compta_correspondances m JOIN pro_compta_comptes c ON c.id = m.compte_id AND c.user_id = m.user_id WHERE m.user_id = ? AND m.type_source = ? AND m.cle_source = ? LIMIT 1',
    [uid, sourceType, sourceKey]
  );
  return rows[0] || null;
}

async function requireAccountingCorrespondence(uid, sourceType, sourceKey, conn = pool) {
  const mapping = await findAccountingCorrespondence(uid, sourceType, sourceKey, conn);
  if (!mapping) {
    throw accountingMappingError(
      'Aucune correspondance comptable n’est configurée pour ' + sourceType + ' / ' + sourceKey + '.',
      'CORRESPONDANCE_COMPTABLE_MANQUANTE'
    );
  }
  const expectedClass = sourceType === 'vente' ? 7 : 6;
  if (Number(mapping.actif) !== 1) {
    throw accountingMappingError(
      'Le compte ' + mapping.code + ' affecté à ' + sourceKey + ' est inactif. Choisissez un compte actif.',
      'COMPTE_CORRESPONDANCE_INACTIF'
    );
  }
  if (Number(mapping.classe) !== expectedClass) {
    throw accountingMappingError(
      'Le compte affecté à ' + sourceKey + ' doit appartenir à la classe ' + expectedClass + '.',
      'CLASSE_COMPTE_CORRESPONDANCE_INVALIDE'
    );
  }
  return mapping;
}

async function requireExpenseCorrespondence(uid, category, conn = pool) {
  const key = normalizeAccountingCategoryKey(category);
  if (key) {
    const specific = await findAccountingCorrespondence(uid, 'depense', key, conn);
    if (specific) {
      if (Number(specific.actif) !== 1 || Number(specific.classe) !== 6) {
        throw accountingMappingError(
          'Le compte affecté à la catégorie « ' + key + ' » est inactif ou n’appartient plus à la classe 6.',
          'CORRESPONDANCE_DEPENSE_INVALIDE'
        );
      }
      return specific;
    }
  }
  return requireAccountingCorrespondence(uid, 'depense', '__default__', conn);
}

function amountToCents(value, field) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0 || number > 999999999999) {
    throw accountingMappingError('Montant invalide pour ' + field + '.', 'MONTANT_COMPTABLE_INVALIDE');
  }
  return BigInt(Math.round(number * 100));
}

function invoiceLineToCents(quantity, unitPrice) {
  const qty = Number(quantity), price = Number(unitPrice);
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
    throw accountingMappingError('Une ligne de facture possède une quantité ou un prix invalide.', 'LIGNE_FACTURE_INVALIDE');
  }
  const qtyHundredths = BigInt(Math.round(qty * 100));
  const priceCents = BigInt(Math.round(price * 100));
  return (qtyHundredths * priceCents + 50n) / 100n;
}

function allocateCentsProportionally(totalCents, groups) {
  const totalWeight = groups.reduce((sum, group) => sum + group.weight, 0n);
  if (totalCents === 0n) return groups.map(() => 0n);
  if (totalWeight <= 0n || totalCents < 0n || totalCents > totalWeight) {
    throw accountingMappingError('La remise ne peut pas être répartie sur les lignes de vente.', 'REMISE_FACTURE_INVALIDE');
  }
  const allocations = groups.map((group, index) => {
    const numerator = totalCents * group.weight;
    return { index, cents: numerator / totalWeight, remainder: numerator % totalWeight };
  });
  let remaining = totalCents - allocations.reduce((sum, allocation) => sum + allocation.cents, 0n);
  const order = [...allocations].sort((a, b) => {
    if (a.remainder === b.remainder) return a.index - b.index;
    return a.remainder > b.remainder ? -1 : 1;
  });
  for (const allocation of order) {
    if (remaining <= 0n) break;
    allocation.cents += 1n;
    remaining -= 1n;
  }
  if (remaining !== 0n) throw accountingMappingError('Répartition de remise incomplète.', 'REMISE_FACTURE_INVALIDE');
  return allocations.map(allocation => allocation.cents);
}

async function buildInvoiceAccountingLines(uid, invoice, conn) {
  const [invoiceRows] = await conn.query(
    'SELECT fl.id, fl.produit_id, fl.quantite, fl.prix_unitaire, p.type_catalogue FROM facture_lignes fl LEFT JOIN produits p ON p.id = fl.produit_id AND p.user_id = ? WHERE fl.facture_id = ? ORDER BY fl.id',
    [uid, invoice.id]
  );
  if (!invoiceRows.length) {
    throw accountingMappingError('La facture ne contient aucune ligne comptabilisable.', 'FACTURE_SANS_LIGNE');
  }

  const groups = new Map();
  for (const row of invoiceRows) {
    if (row.produit_id && row.type_catalogue == null) {
      throw accountingMappingError(
        'Une ligne référence un produit qui n’appartient pas à cette entreprise. Comptabilisation refusée.',
        'PRODUIT_FACTURE_NON_AUTORISE'
      );
    }
    const currentType = String(row.type_catalogue || 'non_classe');
    const sourceKey = row.produit_id
      ? (['produit', 'service'].includes(currentType) ? currentType : 'non_classe')
      : 'saisie_libre';
    const cents = invoiceLineToCents(row.quantite, row.prix_unitaire);
    // Une ligne sans montant HT n'apporte aucun produit ; elle ne doit pas forcer
    // une classification commerciale (ex. facture avec seuls frais de livraison).
    if (cents === 0n) continue;
    const mapping = await requireAccountingCorrespondence(uid, 'vente', sourceKey, conn);
    const groupKey = String(mapping.compte_id);
    const group = groups.get(groupKey) || {
      compte_id: Number(mapping.compte_id),
      code: mapping.code,
      libelle: mapping.libelle,
      weight: 0n
    };
    group.weight += cents;
    groups.set(groupKey, group);
  }

  const grouped = [...groups.values()];
  const lineSubtotal = grouped.reduce((sum, group) => sum + group.weight, 0n);
  const invoiceSubtotal = amountToCents(invoice.sous_total, 'sous-total facture');
  if (lineSubtotal !== invoiceSubtotal) {
    throw accountingMappingError(
      'Le total HT des lignes ne correspond pas au sous-total enregistré. Vérifiez la facture avant comptabilisation.',
      'SOUS_TOTAL_FACTURE_INCOHERENT'
    );
  }
  const discount = amountToCents(invoice.remise, 'remise facture');
  const shipping = amountToCents(invoice.frais_livraison, 'frais de livraison');
  const tax = amountToCents(invoice.total_tva, 'TVA facture');
  const total = amountToCents(invoice.total, 'total facture');
  if (discount > invoiceSubtotal || invoiceSubtotal - discount + shipping + tax !== total) {
    throw accountingMappingError(
      'Les totaux HT, remise, livraison, TVA et TTC de la facture sont incohérents.',
      'TOTAUX_FACTURE_INCOHERENTS'
    );
  }

  if (total === 0n) {
    throw accountingMappingError(
      'Cette facture a un total nul ; une écriture automatique équilibrée ne peut pas être créée avec les correspondances actuelles. Vérifiez la remise et les frais avant validation comptable.',
      'FACTURE_TOTAL_NUL'
    );
  }
  const allocations = allocateCentsProportionally(discount, grouped);
  const lines = [{
    code: '411',
    libelle: 'Client ' + invoice.numero,
    debit: Number(total) / 100,
    credit: 0,
    facture_id: invoice.id
  }];
  for (let index = 0; index < grouped.length; index++) {
    const netCents = grouped[index].weight - allocations[index];
    if (netCents <= 0n) continue;
    lines.push({
      code: grouped[index].code,
      libelle: 'Vente ' + grouped[index].libelle + ' — facture ' + invoice.numero,
      debit: 0,
      credit: Number(netCents) / 100,
      facture_id: invoice.id
    });
  }
  if (tax > 0n) {
    lines.push({
      code: '443',
      libelle: 'TVA facture ' + invoice.numero,
      debit: 0,
      credit: Number(tax) / 100,
      facture_id: invoice.id
    });
  }
  if (shipping > 0n) {
    const shippingMapping = await requireAccountingCorrespondence(uid, 'vente', 'frais_livraison', conn);
    lines.push({
      code: shippingMapping.code,
      libelle: 'Frais de livraison facture ' + invoice.numero,
      debit: 0,
      credit: Number(shipping) / 100,
      facture_id: invoice.id
    });
  }
  return lines;
}

async function ensureAccountingDefaults(uid, conn = pool) {
  for (const [code, label, classe, nature, lettrable] of OHADA_STARTER_ACCOUNTS) {
    await conn.query(
      'INSERT IGNORE INTO pro_compta_comptes (user_id, code, libelle, classe, nature, lettrable) VALUES (?, ?, ?, ?, ?, ?)',
      [uid, code, label, classe, nature, lettrable]
    );
  }
  const journals = [['VE','Ventes','vente'],['AC','Achats','achat'],['BQ','Banque','banque'],['CA','Caisse','caisse'],['OD','Opérations diverses','od']];
  for (const [code, label, type] of journals) {
    await conn.query('INSERT IGNORE INTO pro_compta_journaux (user_id, code, libelle, type) VALUES (?, ?, ?, ?)', [uid, code, label, type]);
  }

  // Correspondances initiales compatibles avec le comportement historique.
  // INSERT IGNORE ne remplace jamais les choix personnalisés de l'entreprise.
  const defaultMappings = [
    ['vente', 'produit', '701'],
    ['vente', 'service', '706'],
    ['vente', 'frais_livraison', '707'],
    ['depense', '__default__', '638']
  ];
  for (const [sourceType, sourceKey, accountCode] of defaultMappings) {
    const account = await accountId(uid, accountCode, conn);
    await conn.query(
      'INSERT IGNORE INTO pro_compta_correspondances (user_id, type_source, cle_source, compte_id) VALUES (?, ?, ?, ?)',
      [uid, sourceType, sourceKey, account]
    );
  }
}

async function accountId(uid, code, conn = pool) {
  const [rows] = await conn.query('SELECT id FROM pro_compta_comptes WHERE user_id = ? AND code = ? AND actif = 1 LIMIT 1', [uid, code]);
  if (!rows.length) throw new Error('Compte comptable ' + code + ' introuvable.');
  return Number(rows[0].id);
}

async function journalId(uid, code, conn = pool) {
  const [rows] = await conn.query('SELECT id FROM pro_compta_journaux WHERE user_id = ? AND code = ? AND actif = 1 LIMIT 1', [uid, code]);
  if (!rows.length) throw new Error('Journal ' + code + ' introuvable.');
  return Number(rows[0].id);
}

async function postSystemEntry(uid, actorId, sourceType, sourceId, date, label, journalCode, lines, existingConnection = null) {
  const ownsConnection = !existingConnection;
  const conn = existingConnection || await pool.getConnection();
  try {
    await ensureAccountingDefaults(uid, conn);
    if (ownsConnection) await conn.beginTransaction();

    if (sourceType === 'facture') {
      // Verrou commun avec DELETE /factures/:id : aucun posting ne peut se créer
      // après une vérification d'absence d'historique suivie d'une suppression.
      const [invoiceRows] = await conn.query(
        "SELECT id FROM factures WHERE id = ? AND user_id = ? AND type = 'facture' AND statut <> 'annulee' FOR UPDATE",
        [sourceId, uid]
      );
      if (!invoiceRows.length) {
        const err = new Error('Facture introuvable, supprimée ou annulée.');
        err.code = 'FACTURE_NON_COMPTABILISABLE';
        throw err;
      }
    }
    if (sourceType === 'depense') {
      // Verrou commun avec PUT/DELETE /depenses et contrôle de cohérence de la source.
      const [expenseRows] = await conn.query(
        'SELECT id, montant, date_depense, libelle, categorie FROM depenses WHERE id = ? AND user_id = ? FOR UPDATE',
        [sourceId, uid]
      );
      const expense = expenseRows[0];
      if (!expense) {
        const err = new Error('Dépense introuvable ou supprimée.');
        err.code = 'DEPENSE_NON_COMPTABILISABLE';
        throw err;
      }
      const expectedAmount = Number(expense.montant);
      const debitAmount = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
      const creditAmount = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
      const expectedLabel = expense.categorie || expense.libelle;
      if (Math.abs(debitAmount - expectedAmount) > 0.01 ||
          Math.abs(creditAmount - expectedAmount) > 0.01 ||
          String(date).slice(0, 10) !== String(expense.date_depense).slice(0, 10) ||
          label !== 'Dépense ' + expense.libelle ||
          lines[0]?.libelle !== expectedLabel) {
        const err = new Error('La dépense a été modifiée avant sa comptabilisation; relancez la comptabilisation.');
        err.code = 'DEPENSE_MODIFIEE';
        throw err;
      }
    }

    const [existing] = await conn.query(
      'SELECT id, numero FROM pro_compta_ecritures WHERE user_id = ? AND source_type = ? AND source_id = ? LIMIT 1 FOR UPDATE',
      [uid, sourceType, sourceId]
    );
    if (existing.length) {
      if (ownsConnection) await conn.commit();
      return { id: existing[0].id, numero: existing[0].numero, duplicate: true };
    }

    const journal = await journalId(uid, journalCode, conn);
    let debit = 0, credit = 0;
    for (const line of lines) {
      if (line.debit < 0 || line.credit < 0 || (line.debit > 0 && line.credit > 0) || (!line.debit && !line.credit)) {
        throw new Error('Ligne comptable invalide.');
      }
      debit += line.debit;
      credit += line.credit;
    }
    debit = Math.round(debit * 100) / 100;
    credit = Math.round(credit * 100) / 100;
    if (Math.abs(debit - credit) > 0.01) throw new Error('Écriture déséquilibrée.');

    const numero = randomRef('ECR');
    const [entry] = await conn.query(
      "INSERT INTO pro_compta_ecritures (user_id, journal_id, numero, date_ecriture, reference, libelle, source_type, source_id, statut, total_debit, total_credit, acteur_user_id, validee_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'validee', ?, ?, ?, NOW())",
      [uid, journal, numero, date, String(sourceId), label.slice(0,255), sourceType, sourceId, debit, credit, actorId]
    );
    for (const line of lines) {
      const account = await accountId(uid, line.code, conn);
      await conn.query(
        'INSERT INTO pro_compta_lignes (user_id, ecriture_id, compte_id, libelle, debit, credit, tiers, facture_id, paiement_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uid, entry.insertId, account, line.libelle || label, line.debit || 0, line.credit || 0, line.tiers || null, line.facture_id || null, line.paiement_id || null]
      );
    }
    if (ownsConnection) await conn.commit();
    return { id: entry.insertId, numero, duplicate: false };
  } catch (err) {
    if (ownsConnection) await conn.rollback().catch(() => {});
    if (err.code === 'ER_DUP_ENTRY') {
      const lookup = ownsConnection ? pool : conn;
      const [rows] = await lookup.query(
        'SELECT id, numero FROM pro_compta_ecritures WHERE user_id = ? AND source_type = ? AND source_id = ? LIMIT 1',
        [uid, sourceType, sourceId]
      );
      if (rows.length) return { id: rows[0].id, numero: rows[0].numero, duplicate: true };
    }
    throw err;
  } finally {
    if (ownsConnection) conn.release();
  }
}

router.get('/clients/:id/portal', async (req, res, next) => {
  try {
    const uid = owner(req);
    const [clients] = await pool.query('SELECT id, nom, email FROM clients WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    if (!clients.length) return res.status(404).json({ error: 'Client introuvable.' });
    const [rows] = await pool.query(
      'SELECT id, expires_at, last_access_at, created_at FROM pro_customer_portal_access WHERE user_id = ? AND client_id = ? AND revoked_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [uid, req.params.id]
    );
    res.json({ client: clients[0], portail_actif: !!rows.length, acces: rows[0] || null });
  } catch (err) { next(err); }
});

router.post('/clients/:id/portal', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const uid = owner(req);
    await conn.beginTransaction();
    const [clients] = await conn.query('SELECT id, nom, email FROM clients WHERE id = ? AND user_id = ? FOR UPDATE', [req.params.id, uid]);
    const client = clients[0];
    if (!client) { await conn.rollback(); return res.status(404).json({ error: 'Client introuvable.' }); }
    if (!client.email) { await conn.rollback(); return res.status(400).json({ error: 'Ajoutez une adresse email au client avant de lui envoyer son portail.' }); }
    const baseUrl = String(process.env.APP_URL || '').replace(/\/$/, '');
    if (!baseUrl || !/^https:\/\//i.test(baseUrl)) {
      if (process.env.NODE_ENV === 'production') {
        await conn.rollback();
        return res.status(503).json({ error: 'APP_URL doit être une URL HTTPS publique avant de partager un portail client.' });
      }
    }
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 86400000);
    await conn.query(
      'UPDATE pro_customer_portal_access SET revoked_at = NOW() WHERE user_id = ? AND client_id = ? AND revoked_at IS NULL',
      [uid, client.id]
    );
    const [created] = await conn.query(
      'INSERT INTO pro_customer_portal_access (user_id, client_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [uid, client.id, hash, expiresAt]
    );
    const [[company]] = await conn.query('SELECT entreprise_nom FROM users WHERE id = ?', [uid]);
    await conn.commit();

    const url = baseUrl + '/portail-client.html#token=' + token;
    // Ne jamais écrire le lien secret dans les logs quand le SMTP est absent.
    // Le lien est remis à l'utilisateur uniquement dans la réponse HTTP (une seule fois).
    const smtpReady = isSmtpConfigured();
    let mail = { sent: false };
    let mailFailure = false;
    if (smtpReady) {
      try {
        mail = await sendMail({
          to: client.email,
          subject: 'Votre espace client sécurisé — ' + (company.entreprise_nom || 'SamaFacture Pro'),
          text: 'Bonjour ' + client.nom + ',\\n\\nVotre entreprise ' + (company.entreprise_nom || '') +
            ' vous donne accès à un espace sécurisé pour consulter vos factures, devis et paiements :\\n' +
            url + '\\n\\nCe lien est personnel, valable 30 jours et peut être révoqué par l’entreprise. Ne le transférez pas.\\n',
          html: '<p>Bonjour ' + htmlEscape(client.nom) + ',</p><p>Votre espace client sécurisé est prêt.</p><p><a href="' +
            htmlEscape(url) + '">Consulter mes factures et devis</a></p><p>Ce lien est personnel, valable 30 jours et révocable.</p>'
        });
      } catch (mailError) {
        mailFailure = true;
        console.warn('Invitation portail client non envoyée :', mailError.message);
      }
    }
    await audit(req, 'portail.client_invite', 'client', client.id, { access_id: created.insertId, email: client.email });
    res.status(201).json({
      success: true, email: client.email, sent: !!mail.sent, url,
      expires_at: expiresAt.toISOString(),
      warning: mail.sent ? 'Invitation envoyée. Le lien ne sera plus réaffiché.' : (mailFailure ? 'L’envoi email a échoué. Le lien est affiché une seule fois pour copie manuelle.' : (!smtpReady ? 'SMTP non configuré : lien affiché une seule fois pour copie manuelle.' : 'L’envoi email n’a pas été confirmé. Le lien est affiché une seule fois pour copie manuelle.'))
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    next(err);
  } finally { conn.release(); }
});

router.delete('/clients/:id/portal', async (req, res, next) => {
  try {
    const uid = owner(req);
    const [result] = await pool.query(
      'UPDATE pro_customer_portal_access SET revoked_at = NOW() WHERE user_id = ? AND client_id = ? AND revoked_at IS NULL',
      [uid, req.params.id]
    );
    await audit(req, 'portail.client_revoque', 'client', req.params.id, { acces_revoques: result.affectedRows });
    res.json({ success: true, acces_revoques: result.affectedRows });
  } catch (err) { next(err); }
});

router.get('/crm/overview', async (req, res, next) => {
  try {
    const uid = owner(req);
    const [[stats]] = await pool.query(
      `SELECT COUNT(*) AS total_activites,
        SUM(CASE WHEN statut = 'a_faire' THEN 1 ELSE 0 END) AS taches_ouvertes,
        SUM(CASE WHEN statut = 'a_faire' AND due_at IS NOT NULL AND due_at < NOW() THEN 1 ELSE 0 END) AS taches_en_retard
       FROM pro_crm_activities WHERE user_id = ?`,
      [uid]
    );
    const [upcoming] = await pool.query(
      `SELECT a.id, a.client_id, c.nom AS client_nom, a.type, a.titre, a.due_at, a.statut
       FROM pro_crm_activities a JOIN clients c ON c.id = a.client_id AND c.user_id = a.user_id
       WHERE a.user_id = ? AND a.statut = 'a_faire'
       ORDER BY a.due_at IS NULL, a.due_at ASC, a.id DESC LIMIT 20`,
      [uid]
    );
    res.json({ statistiques: stats, prochaines_taches: upcoming });
  } catch (err) { next(err); }
});

router.get('/crm/activities', async (req, res, next) => {
  try {
    const uid = owner(req), params = [uid];
    let where = 'a.user_id = ?';
    if (req.query.client_id) { where += ' AND a.client_id = ?'; params.push(Number(req.query.client_id)); }
    if (req.query.statut && ['a_faire','terminee','annulee'].includes(req.query.statut)) { where += ' AND a.statut = ?'; params.push(req.query.statut); }
    const limit = Math.min(300, Math.max(1, Number(req.query.limite) || 100));
    const [rows] = await pool.query(
      `SELECT a.id, a.client_id, c.nom AS client_nom, a.acteur_user_id, a.type, a.titre,
              a.description, a.statut, a.due_at, a.completed_at, a.created_at, a.updated_at
       FROM pro_crm_activities a JOIN clients c ON c.id = a.client_id AND c.user_id = a.user_id
       WHERE ${where} ORDER BY COALESCE(a.due_at, a.created_at) DESC, a.id DESC LIMIT ?`,
      [...params, limit]
    );
    res.json({ activites: rows });
  } catch (err) { next(err); }
});

router.post('/crm/activities', async (req, res, next) => {
  try {
    const uid = owner(req), clientId = Number(req.body.client_id);
    const types = ['note','appel','reunion','email','tache','relance'];
    const type = String(req.body.type || 'note');
    const titre = String(req.body.titre || '').trim().slice(0, 190);
    const description = optionalText(req.body.description, 10000);
    const dueAt = req.body.due_at ? new Date(req.body.due_at) : null;
    if (!idOk(clientId) || !types.includes(type) || !titre || (dueAt && Number.isNaN(dueAt.getTime()))) {
      return res.status(400).json({ error: 'Client, type, titre et date de rappel valide sont requis.' });
    }
    const [clients] = await pool.query('SELECT id FROM clients WHERE id = ? AND user_id = ?', [clientId, uid]);
    if (!clients.length) return res.status(404).json({ error: 'Client introuvable dans cette entreprise.' });
    const statut = type === 'tache' || dueAt ? 'a_faire' : 'terminee';
    const [result] = await pool.query(
      'INSERT INTO pro_crm_activities (user_id, client_id, acteur_user_id, type, titre, description, statut, due_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [uid, clientId, actor(req), type, titre, description, statut, dueAt, statut === 'terminee' ? new Date() : null]
    );
    await audit(req, 'crm.activite_creee', 'client', clientId, { activite_id: result.insertId, type });
    res.status(201).json({ id: result.insertId, client_id: clientId, type, titre, statut });
  } catch (err) { next(err); }
});

router.put('/crm/activities/:id', async (req, res, next) => {
  try {
    const uid = owner(req);
    const [rows] = await pool.query('SELECT id, statut FROM pro_crm_activities WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    if (!rows.length) return res.status(404).json({ error: 'Activité CRM introuvable.' });
    const current = rows[0], status = req.body.statut;
    if (status !== undefined && !['a_faire','terminee','annulee'].includes(status)) return res.status(400).json({ error: 'Statut CRM invalide.' });
    const title = req.body.titre === undefined ? null : String(req.body.titre).trim().slice(0, 190);
    if (title !== null && !title) return res.status(400).json({ error: 'Le titre ne peut pas être vide.' });
    const dueAt = req.body.due_at === undefined ? null : (req.body.due_at ? new Date(req.body.due_at) : null);
    if (dueAt && Number.isNaN(dueAt.getTime())) return res.status(400).json({ error: 'Date de rappel invalide.' });
    await pool.query(
      `UPDATE pro_crm_activities SET
       titre = COALESCE(?, titre),
       description = CASE WHEN ? = 1 THEN ? ELSE description END,
       statut = COALESCE(?, statut),
       completed_at = CASE WHEN COALESCE(?, statut) = 'terminee' THEN COALESCE(completed_at, NOW()) WHEN COALESCE(?, statut) <> 'terminee' THEN NULL ELSE completed_at END,
       due_at = CASE WHEN ? = 1 THEN ? ELSE due_at END
       WHERE id = ? AND user_id = ?`,
      [title, req.body.description !== undefined ? 1 : 0, optionalText(req.body.description,10000),
       status || null, status || null, status || null,
       req.body.due_at !== undefined ? 1 : 0, dueAt,
       req.params.id, uid]
    );
    await audit(req, 'crm.activite_modifiee', 'activite', req.params.id, { statut: status || current.statut });
    res.json({ success: true });
  } catch (err) { next(err); }
});

/* ---------------------- CONTEXTE ENTREPRISE ---------------------------- */

router.get('/company-context', async (req, res, next) => {
  try {
    const [[company]] = await pool.query(
      'SELECT devise, fuseau_horaire FROM users WHERE id = ? LIMIT 1',
      [owner(req)]
    );
    if (!company) return res.status(404).json({ error: 'Entreprise introuvable.' });
    res.set('Cache-Control', 'private, no-store');
    res.json({ devise: String(company.devise || 'FCFA').toUpperCase(), fuseau_horaire: company.fuseau_horaire || 'Africa/Dakar' });
  } catch (err) { next(err); }
});

/* ---------------------- PARAMÈTRES INTERNATIONAUX ---------------------- */

router.get('/localization', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT pays_code, langue, locale, devise, fuseau_horaire, format_date, regime_fiscal FROM users WHERE id = ?',
      [owner(req)]
    );
    if (!rows.length) return res.status(404).json({ error: 'Entreprise introuvable.' });
    res.json({
      parametres: rows[0],
      options: { pays: SUPPORTED_COUNTRIES, langues: ['fr','en'], devises: SUPPORTED_CURRENCIES, fuseaux: SUPPORTED_TIMEZONES, formats_date: ['dd/MM/yyyy','yyyy-MM-dd','MM/dd/yyyy'], regimes_fiscaux: ['standard','simplifie','franchise','autre'] }
    });
  } catch (err) { next(err); }
});

router.put('/localization', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req);
    const body = req.body || {};
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Le changement de devise partage le verrou de compte utilisé par les
    // créations de commandes, d'achats et de factures.
    const [[company]] = await conn.query(
      'SELECT devise FROM users WHERE id = ? FOR UPDATE',
      [uid]
    );
    if (!company) {
      await conn.rollback();
      return res.status(404).json({ error: 'Entreprise introuvable.' });
    }

    const currentCurrency = String(company.devise || 'FCFA').toUpperCase();
    const country = String(body.pays_code || 'SN').toUpperCase();
    const language = String(body.langue || 'fr').toLowerCase();
    const currency = body.devise === undefined || body.devise === null || String(body.devise).trim() === ''
      ? currentCurrency
      : String(body.devise).trim().toUpperCase();
    const timezone = String(body.fuseau_horaire || 'Africa/Dakar');
    const dateFormat = String(body.format_date || 'dd/MM/yyyy');
    const taxRegime = String(body.regime_fiscal || 'standard');
    if (!SUPPORTED_COUNTRIES.includes(country) || !['fr','en'].includes(language) ||
        !SUPPORTED_CURRENCIES.includes(currency) || !SUPPORTED_TIMEZONES.includes(timezone) ||
        !['dd/MM/yyyy','yyyy-MM-dd','MM/dd/yyyy'].includes(dateFormat) ||
        !['standard','simplifie','franchise','autre'].includes(taxRegime)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Un paramètre pays, langue, devise, fuseau horaire ou fiscalité est invalide.' });
    }
    const locale = language + '-' + country;

    if (currency !== currentCurrency) {
      const [[history]] = await conn.query(
        'SELECT (SELECT COUNT(*) FROM factures WHERE user_id = ?) AS factures, (SELECT COUNT(*) FROM depenses WHERE user_id = ?) AS depenses, (SELECT COUNT(*) FROM paiements WHERE user_id = ?) AS paiements, (SELECT COUNT(*) FROM pro_commandes_fournisseurs WHERE user_id = ?) AS achats, (SELECT COUNT(*) FROM pro_commandes WHERE user_id = ?) AS commandes, (SELECT COUNT(*) FROM pro_bons_livraison WHERE user_id = ?) AS livraisons, (SELECT COUNT(*) FROM pro_mouvements_stock WHERE user_id = ?) AS mouvements_stock, (SELECT COUNT(*) FROM pro_compta_ecritures WHERE user_id = ?) AS ecritures, (SELECT COUNT(*) FROM produits WHERE user_id = ?) AS produits, (SELECT COUNT(*) FROM factures_recurrentes WHERE user_id = ?) AS modeles_recurrents',
        [uid, uid, uid, uid, uid, uid, uid, uid, uid, uid]
      );
      const hasBusinessHistory = Object.values(history || {}).some(value => Number(value) > 0);
      if (hasBusinessHistory) {
        await conn.rollback();
        return res.status(409).json({
          error: 'La devise de base ne peut plus être modifiée après l’enregistrement de documents, produits tarifés, modèles récurrents ou mouvements financiers. Les anciennes écritures ne sont pas converties automatiquement.'
        });
      }
    }

    await conn.query(
      'UPDATE users SET pays_code = ?, langue = ?, locale = ?, devise = ?, fuseau_horaire = ?, format_date = ?, regime_fiscal = ? WHERE id = ?',
      [country, language, locale, currency, timezone, dateFormat, taxRegime, uid]
    );
    await conn.commit();
    await audit(req, 'entreprise.localisation_modifiee', 'entreprise', uid, { country, language, currency, timezone, dateFormat, taxRegime });
    res.json({ success: true, parametres: { pays_code: country, langue: language, locale, devise: currency, fuseau_horaire: timezone, format_date: dateFormat, regime_fiscal: taxRegime } });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
// Fonctions partagées avec les autres modules du domaine professionnel.
module.exports.ensureDefaultWarehouse = ensureDefaultWarehouse;
module.exports.ensureAccountingDefaults = ensureAccountingDefaults;
module.exports.normalizeAccountingCategoryKey = normalizeAccountingCategoryKey;
module.exports.buildInvoiceAccountingLines = buildInvoiceAccountingLines;
module.exports.requireExpenseCorrespondence = requireExpenseCorrespondence;
module.exports.postSystemEntry = postSystemEntry;
module.exports.ACCOUNTING_SALE_MAPPING_KEYS = ACCOUNTING_SALE_MAPPING_KEYS;