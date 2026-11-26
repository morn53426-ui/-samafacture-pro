const QRCode = require('qrcode');
const { ROLE_PERMISSIONS } = require('../../middleware/tenant');
const { SUPPORTED_CURRENCIES } = require('../../config/localization');
const crypto = require('crypto');
const { encryptEmailPayload } = require('../../utils/email-outbox-crypto');
const { formatAmountWithCurrency, normalizeCurrency } = require('../../utils/money-format');
const { localDateString } = require('../../utils/local-date');
const { pool } = require('../../config/db');
const { queueWebhookEvent } = require('../../utils/pro-webhooks');
const { sendMail } = require('../../config/mailer');
const {
  actor,
  audit,
  clientOwned,
  idOk,
  money,
  owner,
  parseJson,
  postRefundAccountingEntry,
  randomRef,
  safeDateForUser
} = require('./shared');

module.exports = function registerSalesTeamRoutes(router) {
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
    const currency = String(req.body.devise || company.devise || 'FCFA').trim().toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Devise de commande non prise en charge.' });
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
      'SELECT c.*, e.nom AS etablissement_nom, c.solde_initial + COALESCE(SUM(CASE WHEN o.type = ? THEN o.montant WHEN o.type = ? THEN -o.montant ELSE 0 END),0) AS solde_actuel FROM pro_caisses c LEFT JOIN pro_etablissements e ON e.id = c.etablissement_id AND e.user_id = c.user_id LEFT JOIN pro_caisse_operations o ON o.caisse_id = c.id AND o.user_id = c.user_id WHERE c.user_id = ? GROUP BY c.id ORDER BY c.nom',
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
    const [rows] = await pool.query('SELECT o.*, c.nom AS caisse_nom FROM pro_caisse_operations o JOIN pro_caisses c ON c.id = o.caisse_id AND c.user_id = o.user_id WHERE o.user_id = ? ORDER BY o.operation_date DESC LIMIT 300', [owner(req)]);
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
};
