const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { resolveTenant, requirePermission, ROLE_PERMISSIONS } = require('../middleware/tenant');
const { sendMail } = require('../config/mailer');
const { encryptSecret } = require('../utils/pro-webhooks');
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
    const [result] = await pool.query(
      'INSERT INTO pro_bons_livraison (user_id, commande_id, numero, date_livraison, destinataire, adresse_livraison, lignes_json, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uid, order.id, randomRef('BL'), safeDate(req.body.date_livraison), clientRows[0]?.nom || null, req.body.adresse_livraison || clientRows[0]?.adresse || null, order.lignes_json, String(req.body.notes || '').slice(0, 2000) || null]
    );
    await pool.query('UPDATE pro_commandes SET statut = ? WHERE id = ? AND user_id = ?', ['preparee', order.id, uid]);
    await audit(req, 'bon_livraison.cree', 'bon_livraison', result.insertId, { commande_id: order.id });
    res.status(201).json({ id: result.insertId, numero: result.insertId });
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
  try {
    const uid = owner(req), invoiceId = Number(req.body.facture_id), amount = money(req.body.montant), motif = String(req.body.motif || '').trim().slice(0, 500);
    const invoice = await invoiceOwned(uid, invoiceId);
    if (!invoice) return res.status(404).json({ error: 'Facture introuvable.' });
    if (!amount || !motif) return res.status(400).json({ error: 'Montant positif et motif obligatoires.' });
    const [[sum]] = await pool.query('SELECT COALESCE(SUM(montant),0) AS total FROM pro_avoirs WHERE user_id = ? AND facture_id = ? AND statut != ?', [uid, invoiceId, 'rejete']);
    const available = Number(invoice.total) - Number(sum.total || 0);
    if (amount > available + 0.001) return res.status(400).json({ error: 'Le montant de cet avoir dépasse le montant encore disponible sur la facture.' });
    const [result] = await pool.query('INSERT INTO pro_avoirs (user_id, facture_id, numero, date_emission, montant, motif) VALUES (?, ?, ?, ?, ?, ?)', [uid, invoiceId, randomRef('AVR'), safeDate(req.body.date_emission), amount, motif]);
    await audit(req, 'avoir.cree', 'avoir', result.insertId, { facture_id: invoiceId, montant: amount });
    res.status(201).json({ id: result.insertId, statut: 'brouillon', montant: amount });
  } catch (err) { next(err); }
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
  try {
    const uid = owner(req), invoiceId = Number(req.body.facture_id), amount = money(req.body.montant);
    const invoice = await invoiceOwned(uid, invoiceId);
    if (!invoice || invoice.type !== 'facture' || invoice.statut === 'annulee') return res.status(404).json({ error: 'Facture finale introuvable ou non éligible.' });
    if (!amount) return res.status(400).json({ error: 'Le montant de l’acompte doit être positif.' });
    const [[sum]] = await pool.query(
      "SELECT COALESCE(SUM(montant),0) AS total FROM pro_acomptes WHERE user_id = ? AND facture_id = ? AND statut != 'annule'",
      [uid, invoiceId]
    );
    const alreadyPlanned = Number(sum.total || 0);
    const available = Number(invoice.total) - Number(invoice.montant_paye) - alreadyPlanned;
    if (amount > available + 0.001) return res.status(400).json({ error: 'Le montant dépasse le solde qui peut encore être demandé en acompte.' });
    const numero = randomRef('ACP');
    const [result] = await pool.query(
      'INSERT INTO pro_acomptes (user_id, facture_id, numero, date_emission, montant) VALUES (?, ?, ?, ?, ?)',
      [uid, invoiceId, numero, safeDate(req.body.date_emission), amount]
    );
    await audit(req, 'acompte.cree', 'acompte', result.insertId, { facture_id: invoiceId, montant: amount });
    res.status(201).json({ id: result.insertId, numero, montant: amount, statut: 'a_encaisser' });
  } catch (err) { next(err); }
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
    const [paiements] = await pool.query('SELECT p.id, p.facture_id, p.montant, p.methode, p.reference, p.date_paiement, f.numero FROM paiements p JOIN factures f ON f.id = p.facture_id WHERE p.user_id = ? AND f.client_id = ? ORDER BY p.date_paiement DESC', [uid, clientId]);
    const totalFacture = factures.filter(f => f.type === 'facture' && f.statut !== 'annulee').reduce((s, f) => s + Number(f.total), 0);
    const totalPaye = paiements.reduce((s, p) => s + Number(p.montant), 0);
    res.json({ client, factures, paiements, solde: Math.round((totalFacture - totalPaye) * 100) / 100 });
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
  try {
    const uid = owner(req), amount = money(req.body.montant), reason = String(req.body.motif || '').trim().slice(0, 500);
    const [rows] = await pool.query('SELECT * FROM paiements WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    const payment = rows[0];
    if (!payment) return res.status(404).json({ error: 'Paiement introuvable.' });
    if (!amount || !reason) return res.status(400).json({ error: 'Montant positif et motif obligatoires.' });
    const [[sum]] = await pool.query("SELECT COALESCE(SUM(montant),0) AS total FROM pro_refund_requests WHERE user_id = ? AND paiement_id = ? AND statut IN ('a_traiter','approuve','rembourse')", [uid, payment.id]);
    if (amount > Number(payment.montant) - Number(sum.total || 0) + 0.001) return res.status(400).json({ error: 'Le montant dépasse le paiement non remboursé.' });
    const [result] = await pool.query('INSERT INTO pro_refund_requests (user_id, paiement_id, montant, motif) VALUES (?, ?, ?, ?)', [uid, payment.id, amount, reason]);
    await audit(req, 'remboursement.demande', 'paiement', payment.id, { montant: amount });
    res.status(201).json({ id: result.insertId, statut: 'a_traiter', message: 'Demande enregistrée. Le remboursement effectif doit être effectué auprès du prestataire de paiement.' });
  } catch (err) { next(err); }
});

router.put('/refunds/:id/status', async (req, res, next) => {
  try {
    const statut = req.body.statut;
    if (!['approuve', 'rejete', 'rembourse'].includes(statut)) return res.status(400).json({ error: 'Statut invalide.' });
    const reference = String(req.body.reference_prestataire || '').trim().slice(0, 190) || null;
    if (statut === 'rembourse' && !reference) return res.status(400).json({ error: 'La référence du remboursement réellement exécuté est obligatoire.' });
    const [result] = await pool.query('UPDATE pro_refund_requests SET statut = ?, reference_prestataire = ?, traite_par = ?, traite_le = NOW() WHERE id = ? AND user_id = ? AND statut IN (?, ?)', [statut, reference, actor(req), req.params.id, owner(req), 'a_traiter', 'approuve']);
    if (!result.affectedRows) return res.status(404).json({ error: 'Demande introuvable ou déjà traitée.' });
    await audit(req, 'remboursement.statut_modifie', 'remboursement', req.params.id, { statut, reference });
    res.json({ success: true, statut });
  } catch (err) { next(err); }
});

router.get('/payment-links', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT l.id, l.facture_id, l.montant, l.devise, l.statut, l.expire_at, l.created_at, f.numero FROM pro_payment_links l JOIN factures f ON f.id = l.facture_id WHERE l.user_id = ? ORDER BY l.created_at DESC LIMIT 100', [owner(req)]);
    res.json({ liens: rows });
  } catch (err) { next(err); }
});

router.post('/payment-links', async (req, res, next) => {
  try {
    const uid = owner(req), invoiceId = Number(req.body.facture_id), amount = money(req.body.montant);
    const invoice = await invoiceOwned(uid, invoiceId);
    if (!invoice) return res.status(404).json({ error: 'Facture introuvable.' });
    const remaining = Number(invoice.total) - Number(invoice.montant_paye);
    if (!amount || amount > remaining + 0.001) return res.status(400).json({ error: 'Le montant du lien doit être positif et ne pas dépasser le solde restant.' });
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expires = req.body.expire_jours ? new Date(Date.now() + Math.min(90, Math.max(1, Number(req.body.expire_jours))) * 86400000) : null;
    const [result] = await pool.query('INSERT INTO pro_payment_links (user_id, facture_id, token_hash, montant, devise, expire_at) VALUES (?, ?, ?, ?, ?, ?)', [uid, invoiceId, tokenHash, amount, String(req.body.devise || 'FCFA').slice(0, 10), expires]);
    const base = (process.env.APP_URL || (req.protocol + '://' + req.get('host'))).replace(/\/$/, '');
    const url = base + '/paiement.html?token=' + token;
    const qr = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 320 });
    await audit(req, 'lien_paiement.cree', 'facture', invoiceId, { montant: amount, link_id: result.insertId });
    res.status(201).json({ id: result.insertId, url, qr_code: qr, montant: amount, devise: req.body.devise || 'FCFA', mode: 'demande_de_paiement' });
  } catch (err) { next(err); }
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
  try {
    const type = req.body.type;
    const montant = money(req.body.montant);
    const motif = String(req.body.motif || '').trim().slice(0, 255);
    if (!['entree', 'sortie'].includes(type) || !montant || !motif) return res.status(400).json({ error: 'Type, montant positif et motif obligatoires.' });
    const [rows] = await pool.query('SELECT id FROM pro_caisses WHERE id = ? AND user_id = ? AND active = 1', [req.params.id, owner(req)]);
    if (!rows.length) return res.status(404).json({ error: 'Caisse introuvable ou inactive.' });
    if (type === 'sortie') {
      const [[balance]] = await pool.query('SELECT solde_initial + COALESCE(SUM(CASE WHEN type = ? THEN montant WHEN type = ? THEN -montant ELSE 0 END),0) AS solde FROM pro_caisses c LEFT JOIN pro_caisse_operations o ON o.caisse_id = c.id WHERE c.id = ? AND c.user_id = ? GROUP BY c.id', ['entree', 'sortie', req.params.id, owner(req)]);
      if (montant > Number(balance.solde || 0) + 0.001) return res.status(400).json({ error: 'Solde de caisse insuffisant.' });
    }
    const [result] = await pool.query('INSERT INTO pro_caisse_operations (user_id, caisse_id, type, montant, motif, reference) VALUES (?, ?, ?, ?, ?, ?)', [owner(req), req.params.id, type, montant, motif, String(req.body.reference || '').slice(0, 100) || null]);
    await audit(req, 'caisse.operation', 'caisse', req.params.id, { operation_id: result.insertId, type, montant });
    res.status(201).json({ id: result.insertId });
  } catch (err) { next(err); }
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
    const allowed = ['dashboard.read','clients.read','clients.write','products.read','products.write','invoices.read','invoices.write','payments.read','payments.write','expenses.read','expenses.write','reports.read','documents.read','documents.write','sales.read','sales.write','cash.read','cash.write','team.read','team.manage','integrations.read','integrations.manage','automations.read','automations.manage'];
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
    const allowedPermissions = ['dashboard.read','clients.read','clients.write','products.read','products.write','invoices.read','invoices.write','payments.read','payments.write','expenses.read','expenses.write','reports.read','documents.read','documents.write','sales.read','sales.write','cash.read','cash.write','team.read','integrations.read','integrations.manage','automations.read','automations.manage','audit.read'];
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
    await audit(req, 'equipe.invitation_acceptee', 'invitation', invite.id, { owner_user_id: invite.user_id });
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
    res.json({ entreprises: rows, entreprise_active: owner(req) });
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
      "SELECT DATE_FORMAT(date_emission, '%Y-%m') AS mois, SUM(montant_paye) AS encaissements, SUM(total) AS facturation FROM factures WHERE user_id = ? AND type = 'facture' AND statut != 'annulee' AND date_emission >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) GROUP BY mois ORDER BY mois",
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
    const allowed = ['relance_impayes_email','relance_impayes_whatsapp','facture_recurrente'];
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
    if (!['https:'].includes(parsed.protocol) && process.env.NODE_ENV === 'production') return res.status(400).json({ error: 'Les webhooks doivent utiliser HTTPS en production.' });
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

module.exports = router;
