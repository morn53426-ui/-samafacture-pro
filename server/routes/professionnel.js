const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { resolveTenant, requirePermission, ROLE_PERMISSIONS } = require('../middleware/tenant');
const { sendMail } = require('../config/mailer');
const { encryptSecret, decryptSecret } = require('../utils/pro-webhooks');
const { waveConfigured, paydunyaConfigured, creerSessionWave, creerFacturePaydunya } = require('../config/payments');
const net = require('net');

const router = express.Router();
router.use(requireAuth, resolveTenant, requirePermission);

const owner = (req) => Number(req.tenantId);
const actor = (req) => Number(req.actorId || req.user.id);
const idOk = (value) => /^\d+$/.test(String(value || '')) && Number(value) > 0;
const money = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999999) return null;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};
const safeDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? value : new Date().toISOString().slice(0, 10);
function optionalText(value, maxLength) {
  if (value === undefined || value === null) return null;
  return String(value).trim().slice(0, maxLength) || null;
}
function optionalIsoDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const date = new Date(text + 'T00:00:00.000Z');
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? undefined : text;
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

/* ----------------------------- VENTES ---------------------------------- */
router.get('/orders', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT o.*, c.nom AS client_nom FROM pro_commandes o JOIN clients c ON c.id = o.client_id WHERE o.user_id = ? ORDER BY o.date_commande DESC, o.id DESC LIMIT 250',
      [owner(req)]
    );
    res.json({ commandes: rows.map(r => ({ ...r, lignes: parseJson(r.lignes_json, []) })) });
  } catch (err) { next(err); }
});

router.post('/orders', async (req, res, next) => {
  try {
    const uid = owner(req);
    const clientId = Number(req.body.client_id);
    const client = await clientOwned(uid, clientId);
    if (!client) return res.status(400).json({ error: 'Client invalide pour cette entreprise.' });
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
    const orderNumber = randomRef('CMD');
    const [result] = await pool.query(
      'INSERT INTO pro_commandes (user_id, client_id, numero, statut, date_commande, date_livraison_prevue, devise, total, lignes_json, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [uid, clientId, orderNumber, 'confirmee', safeDate(req.body.date_commande), req.body.date_livraison_prevue || null, String(req.body.devise || 'FCFA').slice(0, 10), total, JSON.stringify(normalized), String(req.body.notes || '').slice(0, 2000) || null]
    );
    await audit(req, 'commande.creee', 'commande', result.insertId, { numero: orderNumber });
    res.status(201).json({ id: result.insertId, total, lignes: normalized });
  } catch (err) { next(err); }
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
      [uid, order.id, numero, safeDate(req.body.date_livraison), clientRows[0]?.nom || null, req.body.adresse_livraison || clientRows[0]?.adresse || null, order.lignes_json, String(req.body.notes || '').slice(0, 2000) || null]
    );
    await pool.query('UPDATE pro_commandes SET statut = ? WHERE id = ? AND user_id = ?', ['preparee', order.id, uid]);
    await audit(req, 'bon_livraison.cree', 'bon_livraison', result.insertId, { commande_id: order.id, numero });
    res.status(201).json({ id: result.insertId, numero });
  } catch (err) { next(err); }
});

router.get('/delivery-notes', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT b.*, c.nom AS client_nom FROM pro_bons_livraison b LEFT JOIN pro_commandes o ON o.id = b.commande_id LEFT JOIN clients c ON c.id = o.client_id WHERE b.user_id = ? ORDER BY b.date_livraison DESC, b.id DESC LIMIT 250', [owner(req)]);
    res.json({ bons_livraison: rows.map(r => ({ ...r, lignes: parseJson(r.lignes_json, []) })) });
  } catch (err) { next(err); }
});

router.get('/credit-notes', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT a.*, f.numero AS facture_numero FROM pro_avoirs a JOIN factures f ON f.id = a.facture_id WHERE a.user_id = ? ORDER BY a.date_emission DESC, a.id DESC LIMIT 250', [owner(req)]);
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
    const [result] = await conn.query('INSERT INTO pro_avoirs (user_id, facture_id, numero, date_emission, montant, motif) VALUES (?, ?, ?, ?, ?, ?)', [uid, invoiceId, numero, safeDate(req.body.date_emission), amount, motif]);
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
router.get('/deposits', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT a.*, f.numero AS facture_numero, c.nom AS client_nom FROM pro_acomptes a JOIN factures f ON f.id = a.facture_id JOIN clients c ON c.id = f.client_id WHERE a.user_id = ? ORDER BY a.date_emission DESC, a.id DESC LIMIT 250',
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
      [uid, invoiceId, numero, safeDate(req.body.date_emission), amount]
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
      "SELECT r.id, r.paiement_id, r.montant, r.motif, r.reference_prestataire, r.traite_le, f.numero FROM pro_refund_requests r JOIN paiements p ON p.id = r.paiement_id JOIN factures f ON f.id = p.facture_id WHERE r.user_id = ? AND f.user_id = ? AND r.statut = 'rembourse' AND f.client_id = ? AND f.type = 'facture' ORDER BY r.traite_le DESC",
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
    const [rows] = await pool.query("SELECT numero, total, montant_paye, date_echeance FROM factures WHERE user_id = ? AND client_id = ? AND type = 'facture' AND statut IN ('en_attente','en_retard') ORDER BY date_echeance ASC", [uid, clientId]);
    const dues = rows.filter(f => Number(f.total) > Number(f.montant_paye));
    if (!dues.length) return res.status(400).json({ error: 'Aucune facture impayée pour ce client.' });
    const total = dues.reduce((s, f) => s + Number(f.total) - Number(f.montant_paye), 0);
    const list = dues.map(f => f.numero + ' : ' + (Number(f.total) - Number(f.montant_paye)).toLocaleString('fr-FR') + ' FCFA').join('\n');
    const message = 'Bonjour ' + client.nom + ', petit rappel concernant vos factures en attente :\n' + list + '\nSolde total : ' + total.toLocaleString('fr-FR') + ' FCFA. Merci.';
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
router.get('/payments', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT p.id, p.facture_id, p.montant, p.methode, p.reference, p.date_paiement, f.numero, c.nom AS client_nom FROM paiements p JOIN factures f ON f.id = p.facture_id JOIN clients c ON c.id = f.client_id WHERE p.user_id = ? ORDER BY p.date_paiement DESC LIMIT 300', [owner(req)]);
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
      const today = new Date().toISOString().slice(0, 10);
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
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.get('/payment-links', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT l.id, l.facture_id, l.montant, l.devise, l.statut, l.expire_at, l.created_at, f.numero FROM pro_payment_links l JOIN factures f ON f.id = l.facture_id WHERE l.user_id = ? ORDER BY l.created_at DESC LIMIT 100', [owner(req)]);
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
    const devise = String(req.body.devise || 'FCFA').slice(0, 10);
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
router.get('/establishments', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM pro_etablissements WHERE user_id = ? ORDER BY nom', [owner(req)]);
    res.json({ etablissements: rows });
  } catch (err) { next(err); }
});
router.post('/establishments', async (req, res, next) => {
  try {
    const nom = String(req.body.nom || '').trim().slice(0, 190);
    if (!nom) return res.status(400).json({ error: 'Le nom de l’établissement est obligatoire.' });
    const [result] = await pool.query('INSERT INTO pro_etablissements (user_id, nom, code, adresse, telephone, email, responsable) VALUES (?, ?, ?, ?, ?, ?, ?)', [owner(req), nom, String(req.body.code || '').trim().slice(0, 40) || null, String(req.body.adresse || '').slice(0, 255) || null, String(req.body.telephone || '').slice(0, 40) || null, String(req.body.email || '').slice(0, 190) || null, String(req.body.responsable || '').slice(0, 190) || null]);
    await audit(req, 'etablissement.cree', 'etablissement', result.insertId, { nom });
    res.status(201).json({ id: result.insertId, nom });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ce code d’établissement existe déjà.' });
    next(err);
  }
});

router.get('/cash/registers', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT c.*, e.nom AS etablissement_nom, c.solde_initial + COALESCE(SUM(CASE WHEN o.type = ? THEN o.montant WHEN o.type = ? THEN -o.montant ELSE 0 END),0) AS solde_actuel FROM pro_caisses c LEFT JOIN pro_etablissements e ON e.id = c.etablissement_id LEFT JOIN pro_caisse_operations o ON o.caisse_id = c.id AND o.user_id = c.user_id WHERE c.user_id = ? GROUP BY c.id ORDER BY c.nom',
      ['entree', 'sortie', owner(req)]
    );
    res.json({ caisses: rows });
  } catch (err) { next(err); }
});
router.post('/cash/registers', async (req, res, next) => {
  try {
    const nom = String(req.body.nom || '').trim().slice(0, 120);
    if (!nom) return res.status(400).json({ error: 'Le nom de la caisse est obligatoire.' });
    let establishmentId = null;
    if (req.body.etablissement_id) {
      const [e] = await pool.query('SELECT id FROM pro_etablissements WHERE id = ? AND user_id = ?', [req.body.etablissement_id, owner(req)]);
      if (!e.length) return res.status(400).json({ error: 'Établissement invalide.' });
      establishmentId = e[0].id;
    }
    const initial = Number(req.body.solde_initial || 0);
    if (!Number.isFinite(initial) || initial < 0) return res.status(400).json({ error: 'Solde initial invalide.' });
    const [result] = await pool.query('INSERT INTO pro_caisses (user_id, etablissement_id, nom, devise, solde_initial) VALUES (?, ?, ?, ?, ?)', [owner(req), establishmentId, nom, String(req.body.devise || 'FCFA').slice(0, 10), initial]);
    await audit(req, 'caisse.creee', 'caisse', result.insertId, { nom });
    res.status(201).json({ id: result.insertId, nom });
  } catch (err) { next(err); }
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
    const [rows] = await pool.query('SELECT o.*, c.nom AS caisse_nom FROM pro_caisse_operations o JOIN pro_caisses c ON c.id = o.caisse_id WHERE o.user_id = ? ORDER BY o.operation_date DESC LIMIT 300', [owner(req)]);
    res.json({ operations: rows });
  } catch (err) { next(err); }
});

/* ---------------------------- ÉQUIPE ----------------------------------- */
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
    const allowed = ['dashboard.read','clients.read','clients.write','products.read','products.write','invoices.read','invoices.write','payments.read','payments.write','expenses.read','expenses.write','reports.read','documents.read','documents.write','sales.read','sales.write','cash.read','cash.write','team.read','team.manage','integrations.read','integrations.manage','automations.read','automations.manage','purchasing.read','purchasing.write','inventory.read','inventory.write','accounting.read','accounting.write','audit.read'];
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
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const role = String(req.body.role || 'employe').trim();
    const allowedRoles = ['administrateur','manager','comptable','commercial','caissier','employe','lecture_seule'];
    const allowedPermissions = ['dashboard.read','clients.read','clients.write','products.read','products.write','invoices.read','invoices.write','payments.read','payments.write','expenses.read','expenses.write','reports.read','documents.read','documents.write','sales.read','sales.write','cash.read','cash.write','team.read','team.manage','integrations.read','integrations.manage','automations.read','automations.manage','purchasing.read','purchasing.write','inventory.read','inventory.write','accounting.read','accounting.write','audit.read'];
    let permissions = ROLE_PERMISSIONS[role];
    if (role === 'personnalise') permissions = Array.isArray(req.body.permissions) ? [...new Set(req.body.permissions.filter(p => allowedPermissions.includes(p)))] : [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (!allowedRoles.includes(role) && role !== 'personnalise')) return res.status(400).json({ error: 'Adresse email ou rôle invalide.' });
    if (!Array.isArray(permissions) || !permissions.length || permissions.length > 30) return res.status(400).json({ error: 'Les permissions du rôle sont invalides.' });
    const [already] = await pool.query('SELECT id FROM pro_team_members WHERE owner_user_id = ? AND active = 1 AND member_user_id IN (SELECT id FROM users WHERE email = ?)', [owner(req), email]);
    if (already.length) return res.status(409).json({ error: 'Cet utilisateur est déjà membre de votre équipe.' });
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const expires = new Date(Date.now() + 7 * 86400000);
    const [result] = await pool.query('INSERT INTO pro_team_invitations (user_id, email, role, permissions_json, token_hash, expire_at) VALUES (?, ?, ?, ?, ?, ?)', [owner(req), email, role, JSON.stringify(permissions), hash, expires]);
    const base = (process.env.APP_URL || (req.protocol + '://' + req.get('host'))).replace(/\/$/, '');
    const inviteUrl = base + '/invitation.html?token=' + token;
    const mailResult = await sendMail({ to: email, subject: 'Invitation à rejoindre SamaFacture Pro', text: 'Vous êtes invité à rejoindre un espace SamaFacture Pro. Créez un compte avec cette adresse email puis acceptez l’invitation : ' + inviteUrl });
    await audit(req, 'equipe.invitation_creee', 'invitation', result.insertId, { email, role });
    res.status(201).json({ id: result.insertId, email, role, invitation_url: inviteUrl, email_envoye: mailResult.sent });
  } catch (err) { next(err); }
});
router.post('/team/invitations/accept', async (req, res, next) => {
  try {
    const token = String(req.body.token || '');
    if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(400).json({ error: 'Jeton d’invitation invalide.' });
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.query("SELECT * FROM pro_team_invitations WHERE token_hash = ? AND statut = 'envoyee' AND expire_at > NOW() LIMIT 1", [hash]);
    const invite = rows[0];
    if (!invite) return res.status(404).json({ error: 'Invitation expirée ou déjà utilisée.' });
    if (String(invite.email).toLowerCase() !== String(req.user.email).toLowerCase()) return res.status(403).json({ error: 'Connectez-vous avec l’adresse email ayant reçu l’invitation.' });
    await pool.query('INSERT INTO pro_team_members (owner_user_id, member_user_id, role, permissions_json) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role), permissions_json = VALUES(permissions_json), active = 1', [invite.user_id, actor(req), invite.role, invite.permissions_json]);
    await pool.query("UPDATE pro_team_invitations SET statut = 'acceptee', accepted_user_id = ?, accepted_at = NOW() WHERE id = ?", [actor(req), invite.id]);
    await pool.query('INSERT INTO pro_audit_logs (user_id, acteur_user_id, action, entite, entite_id, details_json, adresse_ip) VALUES (?, ?, ?, ?, ?, ?, ?)', [invite.user_id, actor(req), 'equipe.invitation_acceptee', 'invitation', String(invite.id), JSON.stringify({ owner_user_id: invite.user_id }), req.ip || null]);
    res.json({ success: true, entreprise_id: invite.user_id, message: 'Invitation acceptée. Reconnectez-vous pour ouvrir l’espace de cette entreprise.' });
  } catch (err) { next(err); }
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
    const [rows] = await pool.query('SELECT m.owner_user_id AS id, u.entreprise_nom, u.nom, m.role FROM pro_team_members m JOIN users u ON u.id = m.owner_user_id WHERE m.member_user_id = ? AND m.active = 1', [actor(req)]);
    res.json({ entreprises: rows, entreprise_active: owner(req), permissions: req.permissions || [] });
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
    const [rows] = await pool.query(
      "SELECT DATE_FORMAT(p.date_paiement, '%Y-%m') AS mois, SUM(p.montant) AS encaissements, COUNT(*) AS nb_paiements FROM paiements p JOIN factures f ON f.id = p.facture_id AND f.user_id = p.user_id WHERE p.user_id = ? AND f.type = 'facture' AND f.statut != 'annulee' AND p.date_paiement >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) GROUP BY mois ORDER BY mois",
      [owner(req)]
    );
    const monthlyAverage = rows.length ? rows.reduce((s, r) => s + Number(r.encaissements || 0), 0) / 6 : 0;
    const forecast = [1,2,3].map(i => ({ mois: new Date(new Date().getFullYear(), new Date().getMonth() + i, 1).toISOString().slice(0, 7), encaissements_estimes: Math.round(monthlyAverage * 100) / 100 }));
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
    const [rows] = await pool.query('SELECT ' + dateExpr + ' AS label, COUNT(*) AS nb_factures, SUM(f.total) AS total, SUM(f.montant_paye) AS encaisse FROM factures f JOIN clients c ON c.id = f.client_id WHERE f.user_id = ? AND f.type = ? AND f.statut != ?' + where + ' GROUP BY label ORDER BY label', [params[0], params[1], 'annulee', ...params.slice(2)]);
    res.json({ groupe: group, rows });
  } catch (err) { next(err); }
});

/* -------------------------- AUTOMATISATIONS ----------------------------- */
router.get('/automations', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM pro_automations WHERE user_id = ? ORDER BY created_at DESC', [owner(req)]);
    res.json({ automatisations: rows.map(r => ({ ...r, configuration: parseJson(r.configuration_json, {}) })) });
  } catch (err) { next(err); }
});
router.post('/automations', async (req, res, next) => {
  try {
    const type = String(req.body.type || '');
    const allowed = ['relance_impayes_email','relance_impayes_whatsapp'];
    const nom = String(req.body.nom || '').trim().slice(0, 150);
    const config = req.body.configuration && typeof req.body.configuration === 'object' ? req.body.configuration : {};
    if (!allowed.includes(type) || !nom) return res.status(400).json({ error: 'Type ou nom d’automatisation invalide.' });
    if (type === 'relance_impayes_whatsapp') return res.status(501).json({ error: 'L’envoi WhatsApp automatique exige un fournisseur WhatsApp Business configuré. Le lien de relance manuelle reste disponible.' });
    const jours = Math.min(120, Math.max(1, Number(config.jours_retard || 7)));
    const frequence = Math.min(90, Math.max(1, Number(config.frequence_jours || 7)));
    const normalized = { jours_retard: jours, frequence_jours: frequence, canal: 'email' };
    const [result] = await pool.query('INSERT INTO pro_automations (user_id, type, nom, configuration_json, prochaine_execution) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))', [owner(req), type, nom, JSON.stringify(normalized)]);
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
      "SELECT f.id, f.numero, f.total, f.montant_paye, f.statut, f.type, u.entreprise_nom FROM factures f JOIN users u ON u.id = f.user_id WHERE f.id = ? AND f.user_id = ? LIMIT 1",
      [req.params.invoiceId, uid]
    );
    const invoice = rows[0];
    if (!invoice || invoice.type !== 'facture') return res.status(404).json({ error: 'Facture introuvable.' });
    if (invoice.statut === 'annulee') return res.status(409).json({ error: 'Une facture annulée ne peut pas être payée.' });
    const remaining = Math.round((Number(invoice.total) - Number(invoice.montant_paye)) * 100) / 100;
    if (!Number.isFinite(remaining) || remaining <= 0) return res.status(409).json({ error: 'Cette facture est déjà soldée.' });

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
      'SELECT c.statut, c.montant, c.devise, c.fournisseur, c.created_at, c.paid_at, f.numero AS facture_numero FROM pro_invoice_checkouts c JOIN factures f ON f.id = c.facture_id WHERE c.reference_interne = ? AND c.user_id = ? LIMIT 1',
      [req.params.reference, owner(req)]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session de paiement introuvable.' });
    res.json({ checkout: rows[0] });
  } catch (err) { next(err); }
});

/* ------------------------- FOURNISSEURS & ACHATS ------------------------ */
async function ensureDefaultWarehouse(uid) {
  await pool.query(
    "INSERT IGNORE INTO pro_entrepots (user_id, code, nom, par_defaut) VALUES (?, 'PRINCIPAL', 'Magasin principal', 1)",
    [uid]
  );
  const [[warehouse]] = await pool.query('SELECT id FROM pro_entrepots WHERE user_id = ? AND code = ? LIMIT 1', [uid, 'PRINCIPAL']);
  await pool.query(
    'INSERT IGNORE INTO pro_stocks_entrepots (user_id, entrepot_id, produit_id, quantite) SELECT p.user_id, ?, p.id, GREATEST(0, p.stock - COALESCE((SELECT SUM(s.quantite) FROM pro_stocks_entrepots s WHERE s.user_id = p.user_id AND s.produit_id = p.id), 0)) FROM produits p WHERE p.user_id = ?',
    [warehouse.id, uid]
  );
  return Number(warehouse.id);
}

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
      'SELECT o.*, s.nom AS fournisseur_nom FROM pro_commandes_fournisseurs o JOIN pro_fournisseurs s ON s.id = o.fournisseur_id WHERE o.user_id = ? ORDER BY o.date_commande DESC, o.id DESC LIMIT 250',
      [owner(req)]
    );
    res.json({ commandes: rows });
  } catch (err) { next(err); }
});

router.get('/purchase-orders/:id', async (req, res, next) => {
  try {
    const [orders] = await pool.query(
      'SELECT o.*, s.nom AS fournisseur_nom FROM pro_commandes_fournisseurs o JOIN pro_fournisseurs s ON s.id = o.fournisseur_id WHERE o.id = ? AND o.user_id = ?',
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
    const [[supplier]] = await pool.query('SELECT id FROM pro_fournisseurs WHERE id = ? AND user_id = ? AND actif = 1', [supplierId, uid]);
    if (!supplier) return res.status(400).json({ error: 'Fournisseur inconnu ou inactif.' });
    let totalHt = 0, totalTax = 0;
    const normalized = [];
    const productIds = [...new Set(lines.map(line => Number(line.produit_id)).filter(Boolean))];
    if (productIds.length) {
      const [owned] = await pool.query(`SELECT id FROM produits WHERE user_id = ? AND id IN (${productIds.map(() => '?').join(',')})`, [uid, ...productIds]);
      const set = new Set(owned.map(row => Number(row.id)));
      if (productIds.some(id => !set.has(id))) return res.status(400).json({ error: 'Un produit référencé ne appartient pas à cette entreprise.' });
    }
    for (const line of lines) {
      const designation = String(line.designation || '').trim().slice(0, 255);
      const qty = Number(line.quantite), price = Number(line.prix_unitaire), tax = Number(line.tva || 0);
      if (!designation || !Number.isFinite(qty) || qty <= 0 || qty > 10000000 || !Number.isFinite(price) || price < 0 || !Number.isFinite(tax) || tax < 0 || tax > 100) {
        return res.status(400).json({ error: 'Chaque ligne doit avoir une désignation, une quantité, un prix et une TVA valides.' });
      }
      const ht = Math.round(qty * price * 100) / 100;
      const vat = Math.round(ht * tax) / 100;
      totalHt += ht; totalTax += vat;
      normalized.push({ produit_id: Number(line.produit_id) || null, designation, qty, price, tax, total: ht + vat });
    }
    totalHt = Math.round(totalHt * 100) / 100;
    totalTax = Math.round(totalTax * 100) / 100;
    const numero = randomRef('ACH');
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [created] = await conn.query(
      "INSERT INTO pro_commandes_fournisseurs (user_id, fournisseur_id, numero, statut, date_commande, date_livraison_prevue, devise, total_ht, total_tva, total_ttc, notes) VALUES (?, ?, ?, 'confirmee', ?, ?, ?, ?, ?, ?, ?)",
      [uid, supplierId, numero, safeDate(req.body.date_commande), req.body.date_livraison_prevue || null, String(req.body.devise || 'XOF').slice(0, 10), totalHt, totalTax, totalHt + totalTax, optionalText(req.body.notes, 5000)]
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

router.post('/purchase-orders/:id/receive', async (req, res, next) => {
  let conn;
  try {
    await ensureDefaultWarehouse(owner(req));
    const uid = owner(req), lines = Array.isArray(req.body.lignes) ? req.body.lignes : [];
    const warehouseId = Number(req.body.entrepot_id) || await ensureDefaultWarehouse(uid);
    if (!lines.length || lines.length > 100) return res.status(400).json({ error: 'Indiquez au moins une ligne à réceptionner.' });
    if (new Set(lines.map(line => String(line.ligne_id))).size !== lines.length) return res.status(400).json({ error: 'Une même ligne de commande ne peut être réceptionnée qu’une fois par opération.' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [orderRows] = await conn.query('SELECT * FROM pro_commandes_fournisseurs WHERE id = ? AND user_id = ? FOR UPDATE', [req.params.id, uid]);
    const order = orderRows[0];
    if (!order || order.statut === 'annulee' || order.statut === 'recue') { await conn.rollback(); return res.status(409).json({ error: 'Commande absente, annulée ou déjà intégralement réceptionnée.' }); }
    const [warehouseRows] = await conn.query('SELECT id FROM pro_entrepots WHERE id = ? AND user_id = ? AND actif = 1', [warehouseId, uid]);
    if (!warehouseRows.length) { await conn.rollback(); return res.status(400).json({ error: 'Entrepôt invalide.' }); }
    const reference = randomRef('REC');
    const [receipt] = await conn.query(
      'INSERT INTO pro_receptions_achats (user_id, commande_id, entrepot_id, reference, date_reception, acteur_user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [uid, order.id, warehouseId, reference, safeDate(req.body.date_reception), actor(req)]
    );
    const [orderLines] = await conn.query('SELECT * FROM pro_commandes_fournisseurs_lignes WHERE commande_id = ? AND user_id = ? FOR UPDATE', [order.id, uid]);
    for (const received of lines) {
      const line = orderLines.find(item => Number(item.id) === Number(received.ligne_id));
      const qty = Number(received.quantite);
      if (!line || !Number.isFinite(qty) || qty <= 0 || qty > Number(line.quantite) - Number(line.quantite_recue) + 0.0001) {
        throw new Error('Quantité reçue invalide ou supérieure au reliquat de commande.');
      }
      if (!line.produit_id) throw new Error('La ligne "' + line.designation + '" doit être associée à un produit du catalogue avant de mettre à jour le stock.');
      const [productRows] = await conn.query('SELECT id FROM produits WHERE id = ? AND user_id = ? FOR UPDATE', [line.produit_id, uid]);
      if (!productRows.length) throw new Error('Produit supprimé ou non autorisé.');
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
        "INSERT INTO pro_mouvements_stock (user_id, produit_id, entrepot_id, type, quantite, cout_unitaire, reference, motif, acteur_user_id) VALUES (?, ?, ?, 'reception_achat', ?, ?, ?, ?, ?)",
        [uid, line.produit_id, warehouseId, qty, line.prix_unitaire, reference, 'Réception ' + order.numero, actor(req)]
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
    res.status(201).json({ reception_id: receipt.insertId, reference, statut: status });
  } catch (err) {
    if (conn) await conn.rollback();
    if (/Quantité reçue|associée à un produit|Produit supprimé/.test(err.message || '')) return res.status(400).json({ error: err.message });
    next(err);
  } finally { if (conn) conn.release(); }
});

router.get('/inventory/stock', async (req, res, next) => {
  try {
    await ensureDefaultWarehouse(owner(req));
    const [rows] = await pool.query(
      'SELECT p.id AS produit_id, p.nom, p.reference, p.prix_achat, p.prix_ht, COALESCE(SUM(s.quantite),0) AS quantite, COUNT(DISTINCT s.entrepot_id) AS nb_entrepots FROM produits p LEFT JOIN pro_stocks_entrepots s ON s.produit_id = p.id AND s.user_id = p.user_id WHERE p.user_id = ? GROUP BY p.id ORDER BY p.nom',
      [owner(req)]
    );
    res.json({ stocks: rows });
  } catch (err) { next(err); }
});

router.get('/inventory/movements', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT m.*, p.nom AS produit_nom, w.nom AS entrepot_nom FROM pro_mouvements_stock m JOIN produits p ON p.id = m.produit_id AND p.user_id = m.user_id JOIN pro_entrepots w ON w.id = m.entrepot_id WHERE m.user_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT 300',
      [owner(req)]
    );
    res.json({ mouvements: rows });
  } catch (err) { next(err); }
});

router.post('/inventory/adjustments', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req), productId = Number(req.body.produit_id), warehouseId = Number(req.body.entrepot_id) || await ensureDefaultWarehouse(uid);
    const delta = Number(req.body.quantite), reason = String(req.body.motif || '').trim().slice(0, 255);
    if (!idOk(productId) || !Number.isFinite(delta) || !delta || Math.abs(delta) > 10000000 || !reason) return res.status(400).json({ error: 'Produit, quantité non nulle et motif obligatoires.' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [products] = await conn.query('SELECT id, prix_achat FROM produits WHERE id = ? AND user_id = ? FOR UPDATE', [productId, uid]);
    const [warehouses] = await conn.query('SELECT id FROM pro_entrepots WHERE id = ? AND user_id = ? AND actif = 1', [warehouseId, uid]);
    if (!products.length || !warehouses.length) { await conn.rollback(); return res.status(404).json({ error: 'Produit ou entrepôt introuvable.' }); }
    await conn.query('INSERT INTO pro_stocks_entrepots (user_id, entrepot_id, produit_id, quantite) VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE id = id', [uid, warehouseId, productId]);
    const [[stock]] = await conn.query('SELECT quantite FROM pro_stocks_entrepots WHERE user_id = ? AND entrepot_id = ? AND produit_id = ? FOR UPDATE', [uid, warehouseId, productId]);
    const next = Math.round((Number(stock.quantite) + delta) * 1000) / 1000;
    if (next < 0) { await conn.rollback(); return res.status(409).json({ error: 'Le stock de cet entrepôt ne peut pas devenir négatif.' }); }
    await conn.query('UPDATE pro_stocks_entrepots SET quantite = ? WHERE user_id = ? AND entrepot_id = ? AND produit_id = ?', [next, uid, warehouseId, productId]);
    await conn.query(
      "INSERT INTO pro_mouvements_stock (user_id, produit_id, entrepot_id, type, quantite, cout_unitaire, motif, acteur_user_id) VALUES (?, ?, ?, 'ajustement', ?, ?, ?, ?)",
      [uid, productId, warehouseId, delta, products[0].prix_achat, reason, actor(req)]
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
    const uid = owner(req), productId = Number(req.body.produit_id), fromId = Number(req.body.entrepot_source_id), toId = Number(req.body.entrepot_destination_id), qty = Number(req.body.quantite);
    if (!idOk(productId) || !idOk(fromId) || !idOk(toId) || fromId === toId || !Number.isFinite(qty) || qty <= 0 || qty > 10000000) return res.status(400).json({ error: 'Produit, deux entrepôts différents et quantité positive obligatoires.' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [productRows] = await conn.query('SELECT id, prix_achat FROM produits WHERE id = ? AND user_id = ? FOR UPDATE', [productId, uid]);
    const [warehouseRows] = await conn.query('SELECT id FROM pro_entrepots WHERE id IN (?, ?) AND user_id = ? AND actif = 1', [fromId, toId, uid]);
    if (!productRows.length || warehouseRows.length !== 2) { await conn.rollback(); return res.status(404).json({ error: 'Produit ou entrepôt introuvable.' }); }
    await conn.query('INSERT INTO pro_stocks_entrepots (user_id, entrepot_id, produit_id, quantite) VALUES (?, ?, ?, 0), (?, ?, ?, 0) ON DUPLICATE KEY UPDATE id = id', [uid, fromId, productId, uid, toId, productId]);
    const [stocks] = await conn.query('SELECT entrepot_id, quantite FROM pro_stocks_entrepots WHERE user_id = ? AND produit_id = ? AND entrepot_id IN (?, ?) FOR UPDATE', [uid, productId, fromId, toId]);
    const source = stocks.find(row => Number(row.entrepot_id) === fromId);
    if (!source || Number(source.quantite) < qty) { await conn.rollback(); return res.status(409).json({ error: 'Stock insuffisant dans l’entrepôt source.' }); }
    const reference = randomRef('TRF');
    await conn.query('UPDATE pro_stocks_entrepots SET quantite = quantite - ? WHERE user_id = ? AND entrepot_id = ? AND produit_id = ?', [qty, uid, fromId, productId]);
    await conn.query('UPDATE pro_stocks_entrepots SET quantite = quantite + ? WHERE user_id = ? AND entrepot_id = ? AND produit_id = ?', [qty, uid, toId, productId]);
    await conn.query(
      "INSERT INTO pro_mouvements_stock (user_id, produit_id, entrepot_id, type, quantite, cout_unitaire, reference, motif, acteur_user_id) VALUES (?, ?, ?, 'transfert_sortant', ?, ?, ?, ?, ?), (?, ?, ?, 'transfert_entrant', ?, ?, ?, ?, ?)",
      [uid, productId, fromId, -qty, productRows[0].prix_achat, reference, 'Transfert vers entrepôt #' + toId, actor(req),
       uid, productId, toId, qty, productRows[0].prix_achat, reference, 'Transfert depuis entrepôt #' + fromId, actor(req)]
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
      'SELECT p.id, p.nom, p.reference, p.prix_achat, COALESCE(SUM(s.quantite),0) AS quantite, COALESCE(SUM(s.quantite * p.prix_achat),0) AS valeur FROM produits p LEFT JOIN pro_stocks_entrepots s ON s.produit_id = p.id AND s.user_id = p.user_id WHERE p.user_id = ? GROUP BY p.id ORDER BY p.nom',
      [owner(req)]
    );
    const total = rows.reduce((sum, row) => sum + Number(row.valeur), 0);
    res.json({ valorisation: rows, valeur_totale: Math.round(total * 100) / 100, devise: 'XOF' });
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
  ['622','Transports',6,'debit',0],['625','Déplacements et missions',6,'debit',0],['641','Rémunérations du personnel',6,'debit',0],
  ['661','Charges d’intérêts',6,'debit',0],['701','Ventes de marchandises',7,'credit',0],
  ['706','Services vendus',7,'credit',0],['707','Produits accessoires',7,'credit',0],['758','Produits divers',7,'credit',0]
];

async function ensureAccountingDefaults(uid) {
  for (const [code, label, classe, nature, lettrable] of OHADA_STARTER_ACCOUNTS) {
    await pool.query(
      'INSERT IGNORE INTO pro_compta_comptes (user_id, code, libelle, classe, nature, lettrable) VALUES (?, ?, ?, ?, ?, ?)',
      [uid, code, label, classe, nature, lettrable]
    );
  }
  const journals = [['VE','Ventes','vente'],['AC','Achats','achat'],['BQ','Banque','banque'],['CA','Caisse','caisse'],['OD','Opérations diverses','od']];
  for (const [code, label, type] of journals) {
    await pool.query('INSERT IGNORE INTO pro_compta_journaux (user_id, code, libelle, type) VALUES (?, ?, ?, ?)', [uid, code, label, type]);
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

async function postSystemEntry(uid, actorId, sourceType, sourceId, date, label, journalCode, lines) {
  await ensureAccountingDefaults(uid);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.query('SELECT id, numero FROM pro_compta_ecritures WHERE user_id = ? AND source_type = ? AND source_id = ? LIMIT 1 FOR UPDATE', [uid, sourceType, sourceId]);
    if (existing.length) { await conn.commit(); return { id: existing[0].id, numero: existing[0].numero, duplicate: true }; }
    const journal = await journalId(uid, journalCode, conn);
    let debit = 0, credit = 0;
    for (const line of lines) {
      if (line.debit < 0 || line.credit < 0 || (line.debit > 0 && line.credit > 0) || (!line.debit && !line.credit)) throw new Error('Ligne comptable invalide.');
      debit += line.debit; credit += line.credit;
    }
    debit = Math.round(debit * 100) / 100; credit = Math.round(credit * 100) / 100;
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
    await conn.commit();
    return { id: entry.insertId, numero, duplicate: false };
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      const [rows] = await pool.query('SELECT id, numero FROM pro_compta_ecritures WHERE user_id = ? AND source_type = ? AND source_id = ? LIMIT 1', [uid, sourceType, sourceId]);
      if (rows.length) return { id: rows[0].id, numero: rows[0].numero, duplicate: true };
    }
    throw err;
  } finally { conn.release(); }
}

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
      const account = Number(line.compte_id), d = Number(line.debit || 0), c = Number(line.credit || 0);
      if (!idOk(account) || !Number.isFinite(d) || !Number.isFinite(c) || d < 0 || c < 0 || (d > 0 && c > 0) || (d === 0 && c === 0)) return res.status(400).json({ error: 'Chaque ligne doit avoir un compte et un seul montant débit ou crédit positif.' });
      debit += d; credit += c;
      clean.push({ account, d: Math.round(d * 100) / 100, c: Math.round(c * 100) / 100, label: String(line.libelle || label).slice(0,255), tiers: optionalText(line.tiers,190) });
    }
    debit = Math.round(debit * 100) / 100; credit = Math.round(credit * 100) / 100;
    if (Math.abs(debit - credit) > 0.01) return res.status(400).json({ error: 'Écriture déséquilibrée : total débit et crédit doivent être identiques.' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
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
  try {
    const uid = owner(req);
    const [rows] = await pool.query("SELECT * FROM factures WHERE id = ? AND user_id = ? AND type = 'facture' AND statut <> 'annulee'", [req.params.id, uid]);
    const invoice = rows[0];
    if (!invoice) return res.status(404).json({ error: 'Facture non trouvée ou annulée.' });
    const netSales = Math.round((Number(invoice.total) - Number(invoice.total_tva)) * 100) / 100;
    const lines = [{ code: '411', libelle: 'Client ' + invoice.id, debit: Number(invoice.total), credit: 0, facture_id: invoice.id }];
    if (netSales > 0) lines.push({ code: '706', libelle: 'Vente facture ' + invoice.numero, debit: 0, credit: netSales, facture_id: invoice.id });
    if (Number(invoice.total_tva) > 0) lines.push({ code: '443', libelle: 'TVA facture ' + invoice.numero, debit: 0, credit: Number(invoice.total_tva), facture_id: invoice.id });
    const result = await postSystemEntry(uid, actor(req), 'facture', invoice.id, invoice.date_emission, 'Comptabilisation facture ' + invoice.numero, 'VE', lines);
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (err) { next(err); }
});

router.post('/accounting/post-payment/:id', async (req, res, next) => {
  try {
    const uid = owner(req);
    const [rows] = await pool.query('SELECT p.*, f.numero FROM paiements p JOIN factures f ON f.id = p.facture_id WHERE p.id = ? AND p.user_id = ? AND f.user_id = ?', [req.params.id, uid, uid]);
    const payment = rows[0];
    if (!payment) return res.status(404).json({ error: 'Paiement introuvable.' });
    const bank = /wave|paydunya|orange|carte|virement/i.test(payment.methode || '');
    const result = await postSystemEntry(uid, actor(req), 'paiement', payment.id, String(payment.date_paiement).slice(0,10), 'Encaissement facture ' + payment.numero, bank ? 'BQ' : 'CA', [
      { code: bank ? '521' : '571', libelle: 'Règlement ' + payment.numero, debit: Number(payment.montant), credit: 0, paiement_id: payment.id },
      { code: '411', libelle: 'Lettrage client ' + payment.numero, debit: 0, credit: Number(payment.montant), paiement_id: payment.id }
    ]);
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (err) { next(err); }
});

router.post('/accounting/post-expense/:id', async (req, res, next) => {
  try {
    const uid = owner(req);
    const [rows] = await pool.query('SELECT * FROM depenses WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    const expense = rows[0];
    if (!expense) return res.status(404).json({ error: 'Dépense introuvable.' });
    const amount = Number(expense.montant);
    const result = await postSystemEntry(uid, actor(req), 'depense', expense.id, expense.date_depense, 'Dépense ' + expense.libelle, 'CA', [
      { code: '622', libelle: expense.categorie || expense.libelle, debit: amount, credit: 0 },
      { code: '571', libelle: 'Règlement dépense', debit: 0, credit: amount }
    ]);
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (err) { next(err); }
});

module.exports = router;
