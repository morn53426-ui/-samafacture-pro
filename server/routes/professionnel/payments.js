/**
 * Module "payments" — extrait depuis routes/professionnel.js (Phase 3b, chunkage par route).
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
const { postSystemEntry } = require('./misc');


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

router.get('/payments', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT p.id, p.facture_id, p.montant, p.methode, p.reference, p.date_paiement, f.numero, c.nom AS client_nom FROM paiements p JOIN factures f ON f.id = p.facture_id AND f.user_id = p.user_id JOIN clients c ON c.id = f.client_id AND c.user_id = f.user_id WHERE p.user_id = ? ORDER BY p.date_paiement DESC LIMIT 300', [owner(req)]);
    const [refunds] = await pool.query('SELECT id, paiement_id, montant, motif, statut, created_at FROM pro_refund_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [owner(req)]);
    res.json({ paiements: rows, remboursements: refunds });
  } catch (err) { next(err); }
});

router.post('/payments/:id/refunds', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req), amount = money(req.body.montant), reason = String(req.body.motif || '').trim().slice(0, 500);
    if (!amount || !reason) return res.status(400).json({ error: 'Montant positif et motif obligatoires.' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM paiements WHERE id = ? AND user_id = ? FOR UPDATE', [req.params.id, uid]);
    const payment = rows[0];
    if (!payment) { await conn.rollback(); return res.status(404).json({ error: 'Paiement introuvable.' }); }
    const [[sum]] = await conn.query("SELECT COALESCE(SUM(montant),0) AS total FROM pro_refund_requests WHERE user_id = ? AND paiement_id = ? AND statut IN ('a_traiter','approuve','rembourse')", [uid, payment.id]);
    if (amount > Number(payment.montant) - Number(sum.total || 0) + 0.001) {
      await conn.rollback();
      return res.status(400).json({ error: 'Le montant dépasse le paiement non remboursé.' });
    }
    const [result] = await conn.query('INSERT INTO pro_refund_requests (user_id, paiement_id, montant, motif) VALUES (?, ?, ?, ?)', [uid, payment.id, amount, reason]);
    await conn.commit();
    await audit(req, 'remboursement.demande', 'paiement', payment.id, { montant: amount });
    res.status(201).json({ id: result.insertId, statut: 'a_traiter', message: 'Demande enregistrée. Le remboursement effectif doit être effectué auprès du prestataire de paiement.' });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

async function postRefundAccountingEntry(conn, uid, actorId, payment, invoice, refund, entryDate) {
  // Garantir qu'un remboursement déclaré réellement effectué possède toujours
  // l'encaissement d'origine au journal. Les deux mouvements sont dans la même
  // transaction : impossible de laisser le grand livre dans un état intermédiaire.
  let [paymentEntries] = await conn.query(
    `SELECT e.id, e.journal_id, j.code AS journal_code
     FROM pro_compta_ecritures e
     JOIN pro_compta_journaux j ON j.id = e.journal_id AND j.user_id = e.user_id
     WHERE e.user_id = ? AND e.source_type = 'paiement' AND e.source_id = ?
     LIMIT 1 FOR UPDATE`,
    [uid, payment.id]
  );
  if (!paymentEntries.length) {
    const treasuryAccount = paymentTreasuryAccount(payment.methode);
    if (!treasuryAccount) {
      const error = new Error('La méthode du paiement d’origine ne permet pas de déterminer le compte de trésorerie. Le remboursement est bloqué pour éviter une écriture comptable incorrecte.');
      error.status = 409;
      error.code = 'METHODE_PAIEMENT_NON_RECONNUE';
      throw error;
    }
    const bank = treasuryAccount === '521';
    await postSystemEntry(
      uid,
      actorId,
      'paiement',
      payment.id,
      String(payment.date_paiement || entryDate).slice(0, 10),
      'Encaissement facture ' + invoice.numero,
      bank ? 'BQ' : 'CA',
      [
        { code: bank ? '521' : '571', libelle: 'Règlement ' + invoice.numero, debit: Number(payment.montant), credit: 0, paiement_id: payment.id, facture_id: invoice.id },
        { code: '411', libelle: 'Lettrage client ' + invoice.numero, debit: 0, credit: Number(payment.montant), paiement_id: payment.id, facture_id: invoice.id }
      ],
      conn
    );
    [paymentEntries] = await conn.query(
      `SELECT e.id, e.journal_id, j.code AS journal_code
       FROM pro_compta_ecritures e
       JOIN pro_compta_journaux j ON j.id = e.journal_id AND j.user_id = e.user_id
       WHERE e.user_id = ? AND e.source_type = 'paiement' AND e.source_id = ?
       LIMIT 1 FOR UPDATE`,
      [uid, payment.id]
    );
  }
  const paymentEntry = paymentEntries[0];
  if (!paymentEntry) throw new Error('Impossible de retrouver l’écriture comptable du paiement d’origine.');

  const [originalLines] = await conn.query(
    `SELECT c.code, l.debit, l.credit
     FROM pro_compta_lignes l
     JOIN pro_compta_comptes c ON c.id = l.compte_id AND c.user_id = l.user_id
     WHERE l.user_id = ? AND l.ecriture_id = ?
     ORDER BY l.id`,
    [uid, paymentEntry.id]
  );
  const expectedAmount = Math.round(Number(payment.montant) * 100) / 100;
  const treasuryLine = originalLines.find(line =>
    ['521', '571'].includes(String(line.code)) &&
    Number(line.debit) > 0 && Number(line.credit) === 0
  );
  const customerLine = originalLines.find(line =>
    String(line.code) === '411' &&
    Number(line.credit) > 0 && Number(line.debit) === 0
  );
  if (originalLines.length !== 2 || !treasuryLine || !customerLine ||
      Math.abs(Number(treasuryLine.debit) - expectedAmount) > 0.01 ||
      Math.abs(Number(customerLine.credit) - expectedAmount) > 0.01 ||
      !['BQ', 'CA'].includes(paymentEntry.journal_code)) {
    const error = new Error('L’écriture d’origine ne présente pas les deux lignes attendues (trésorerie et client). Le remboursement est bloqué pour éviter une contrepassation incorrecte.');
    error.status = 409;
    error.code = 'ECRITURE_PAIEMENT_NON_REVERSIBLE';
    throw error;
  }

  const refundAmount = Math.round(Number(refund.montant) * 100) / 100;
  if (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount > expectedAmount + 0.001) {
    const error = new Error('Le montant du remboursement ne correspond pas à un montant valide du paiement d’origine.');
    error.status = 409;
    error.code = 'MONTANT_REMBOURSEMENT_INVALIDE';
    throw error;
  }

  return postSystemEntry(
    uid,
    actorId,
    'remboursement',
    refund.id,
    entryDate,
    'Remboursement facture ' + invoice.numero,
    paymentEntry.journal_code,
    [
      {
        code: customerLine.code,
        libelle: 'Annulation du lettrage client ' + invoice.numero,
        debit: refundAmount,
        credit: 0,
        paiement_id: payment.id,
        facture_id: invoice.id
      },
      {
        code: treasuryLine.code,
        libelle: 'Sortie de trésorerie — remboursement ' + (refund.reference_prestataire || refund.id),
        debit: 0,
        credit: refundAmount,
        paiement_id: payment.id,
        facture_id: invoice.id
      }
    ],
    conn
  );
}

router.put('/refunds/:id/status', async (req, res, next) => {
  let conn;
  try {
    const statut = req.body.statut;
    if (!['approuve', 'rejete', 'rembourse'].includes(statut)) return res.status(400).json({ error: 'Statut invalide.' });
    const reference = String(req.body.reference_prestataire || '').trim().slice(0, 190) || null;
    if (statut === 'rembourse' && !reference) return res.status(400).json({ error: 'La référence du remboursement réellement exécuté est obligatoire.' });

    if (statut !== 'rembourse') {
      const [result] = await pool.query(
        'UPDATE pro_refund_requests SET statut = ?, traite_par = ?, traite_le = NOW() WHERE id = ? AND user_id = ? AND statut = ?',
        [statut, actor(req), req.params.id, owner(req), 'a_traiter']
      );
      if (!result.affectedRows) return res.status(404).json({ error: 'Demande introuvable ou déjà traitée.' });
    } else {
      conn = await pool.getConnection();
      await conn.beginTransaction();
      const [refundRows] = await conn.query(
        'SELECT * FROM pro_refund_requests WHERE id = ? AND user_id = ? FOR UPDATE',
        [req.params.id, owner(req)]
      );
      const refund = refundRows[0];
      if (!refund || !['a_traiter', 'approuve'].includes(refund.statut)) {
        await conn.rollback();
        return res.status(404).json({ error: 'Demande introuvable ou déjà traitée.' });
      }
      const [paymentRows] = await conn.query(
        'SELECT * FROM paiements WHERE id = ? AND user_id = ? FOR UPDATE',
        [refund.paiement_id, owner(req)]
      );
      const payment = paymentRows[0];
      if (!payment) {
        await conn.rollback();
        return res.status(409).json({ error: 'Le paiement d’origine est introuvable.' });
      }
      const [invoiceRows] = await conn.query(
        'SELECT * FROM factures WHERE id = ? AND user_id = ? FOR UPDATE',
        [payment.facture_id, owner(req)]
      );
      const invoice = invoiceRows[0];
      if (!invoice || Number(invoice.montant_paye) + 0.001 < Number(refund.montant)) {
        await conn.rollback();
        return res.status(409).json({ error: 'Le montant remboursé dépasse les encaissements encore comptabilisés sur la facture.' });
      }
      const remainingPaid = Math.max(0, Number(invoice.montant_paye) - Number(refund.montant));
      const [accountRows] = await conn.query(
        'SELECT fuseau_horaire FROM users WHERE id = ? LIMIT 1',
        [owner(req)]
      );
      const today = localDateString(accountRows?.[0]?.fuseau_horaire || 'Africa/Dakar');
      // Enregistrer la sortie de trésorerie dans le même journal et le même compte
      // que l'encaissement initial, avant d'affirmer que le remboursement est effectué.
      await postRefundAccountingEntry(conn, owner(req), actor(req), payment, invoice, refund, today);
      const newInvoiceStatus = invoice.statut === 'annulee'
        ? 'annulee'
        : (remainingPaid + 0.001 >= Number(invoice.total)
          ? 'payee'
          : (invoice.date_echeance && String(invoice.date_echeance) < today ? 'en_retard' : 'en_attente'));
      await conn.query(
        'UPDATE factures SET montant_paye = ?, statut = ? WHERE id = ? AND user_id = ?',
        [remainingPaid, newInvoiceStatus, invoice.id, owner(req)]
      );
      await conn.query(
        "UPDATE pro_refund_requests SET statut = 'rembourse', reference_prestataire = ?, traite_par = ?, traite_le = NOW() WHERE id = ? AND user_id = ?",
        [reference, actor(req), refund.id, owner(req)]
      );
      await conn.commit();
    }

    await audit(req, 'remboursement.statut_modifie', 'remboursement', req.params.id, { statut, reference });
    res.json({ success: true, statut, solde_facture_ajuste: statut === 'rembourse' });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    if (err?.status === 409 && err.code) {
      return res.status(409).json({ error: err.message, code: err.code });
    }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.get('/payment-links', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT l.id, l.facture_id, l.montant, l.devise, l.statut, l.expire_at, l.created_at, f.numero FROM pro_payment_links l JOIN factures f ON f.id = l.facture_id AND f.user_id = l.user_id WHERE l.user_id = ? ORDER BY l.created_at DESC LIMIT 100', [owner(req)]);
    res.json({ liens: rows });
  } catch (err) { next(err); }
});

router.post('/payment-links', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req), invoiceId = Number(req.body.facture_id), amount = money(req.body.montant);
    if (!amount) return res.status(400).json({ error: 'Le montant du lien doit être positif.' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [invoiceRows] = await conn.query('SELECT * FROM factures WHERE id = ? AND user_id = ? FOR UPDATE', [invoiceId, uid]);
    const invoice = invoiceRows[0];
    if (!invoice) { await conn.rollback(); return res.status(404).json({ error: 'Facture introuvable.' }); }
    const remaining = Number(invoice.total) - Number(invoice.montant_paye);
    if (amount > remaining + 0.001 || remaining <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Le montant du lien dépasse le solde restant ou la facture est déjà réglée.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expires = req.body.expire_jours ? new Date(Date.now() + Math.min(90, Math.max(1, Number(req.body.expire_jours))) * 86400000) : null;
    const rawCurrency = req.body.devise;
    const devise = normalizeCurrency(
      rawCurrency === undefined || rawCurrency === null || String(rawCurrency).trim() === ''
        ? invoice.devise
        : rawCurrency
    );
    if (!SUPPORTED_CURRENCIES.includes(devise)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Devise non prise en charge.' });
    }
    if (devise !== normalizeCurrency(invoice.devise)) {
      await conn.rollback();
      return res.status(409).json({ error: 'La devise du lien doit correspondre à celle de la facture.' });
    }
    const [result] = await conn.query('INSERT INTO pro_payment_links (user_id, facture_id, token_hash, montant, devise, expire_at) VALUES (?, ?, ?, ?, ?, ?)', [uid, invoiceId, tokenHash, amount, devise, expires]);
    await conn.commit();
    const base = (process.env.APP_URL || (req.protocol + '://' + req.get('host'))).replace(/\/$/, '');
    const url = base + '/paiement.html?token=' + token;
    const qr = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 320 });
    await audit(req, 'lien_paiement.cree', 'facture', invoiceId, { montant: amount, link_id: result.insertId });
    res.status(201).json({ id: result.insertId, url, qr_code: qr, montant: amount, devise, mode: 'demande_de_paiement' });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

/* ---------------------- ÉTABLISSEMENTS / CAISSES ------------------------ */

module.exports = router;
