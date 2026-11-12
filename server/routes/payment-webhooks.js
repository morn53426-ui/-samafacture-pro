const express = require('express');
const crypto = require('crypto');
const { pool } = require('../config/db');
const {
  verifierSignatureWave, consulterSessionWave,
  verifierHashPaydunya, confirmerFacturePaydunya
} = require('../config/payments');
const { decryptSecret } = require('../utils/pro-webhooks');
const { notifierUtilisateur } = require('../realtime');
const { queueWebhookEvent } = require('../utils/pro-webhooks');

const router = express.Router();

async function credentialsFor(userId, provider) {
  const [rows] = await pool.query(
    'SELECT credentials_enc, mode, actif FROM pro_payment_gateways WHERE user_id = ? AND fournisseur = ? LIMIT 1',
    [userId, provider]
  );
  if (!rows.length || !rows[0].actif) return null;
  const credentials = JSON.parse(decryptSecret(rows[0].credentials_enc));
  return { ...credentials, PAYDUNYA_MODE: rows[0].mode || 'test' };
}

async function applySuccessfulCheckout(checkoutId, providerRef, amount, method, eventId, payload) {
  const conn = await pool.getConnection();
  let emitted = null;
  try {
    await conn.beginTransaction();
    const [checkoutRows] = await conn.query(
      'SELECT * FROM pro_invoice_checkouts WHERE id = ? FOR UPDATE', [checkoutId]
    );
    const checkout = checkoutRows[0];
    if (!checkout) { await conn.rollback(); return { ignored: true }; }
    if (checkout.statut === 'payee') { await conn.commit(); return { duplicate: true }; }

    const [invoiceRows] = await conn.query(
      'SELECT * FROM factures WHERE id = ? AND user_id = ? FOR UPDATE',
      [checkout.facture_id, checkout.user_id]
    );
    const invoice = invoiceRows[0];
    if (!invoice || invoice.type !== 'facture' || invoice.statut === 'annulee') {
      throw new Error('Facture absente ou annulée : paiement refusé.');
    }
    const paidAmount = Math.round(Number(amount) * 100) / 100;
    const expected = Math.round(Number(checkout.montant) * 100) / 100;
    if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - expected) > 0.001) {
      throw new Error('Montant confirmé par le prestataire différent du montant attendu.');
    }
    const remaining = Math.round((Number(invoice.total) - Number(invoice.montant_paye)) * 100) / 100;
    if (paidAmount > remaining + 0.001) {
      throw new Error('Le paiement dépasse le solde restant de la facture.');
    }

    const paymentKey = 'online-' + crypto.createHash('sha256')
      .update(checkout.fournisseur + ':' + providerRef).digest('hex').slice(0, 55);
    await conn.query(
      'INSERT IGNORE INTO paiements (user_id, facture_id, montant, methode, reference, idempotency_key) VALUES (?, ?, ?, ?, ?, ?)',
      [checkout.user_id, checkout.facture_id, paidAmount, method, providerRef, paymentKey]
    );
    const [paymentRows] = await conn.query(
      'SELECT id FROM paiements WHERE user_id = ? AND idempotency_key = ? LIMIT 1',
      [checkout.user_id, paymentKey]
    );
    if (!paymentRows.length) throw new Error('Impossible de retrouver le paiement enregistré.');

    const [[sum]] = await conn.query(
      'SELECT COALESCE(SUM(montant),0) AS total FROM paiements WHERE user_id = ? AND facture_id = ?',
      [checkout.user_id, checkout.facture_id]
    );
    const totalPaid = Math.round(Number(sum.total) * 100) / 100;
    const newStatus = totalPaid + 0.001 >= Number(invoice.total) ? 'payee' : 'en_attente';
    await conn.query(
      'UPDATE factures SET montant_paye = ?, statut = ? WHERE id = ? AND user_id = ?',
      [totalPaid, newStatus, checkout.facture_id, checkout.user_id]
    );
    await conn.query(
      "UPDATE pro_invoice_checkouts SET statut = 'payee', paiement_id = ?, paid_at = NOW(), updated_at = NOW() WHERE id = ?",
      [paymentRows[0].id, checkout.id]
    );
    if (eventId) {
      await conn.query(
        "UPDATE pro_payment_webhook_events SET statut = 'traite', processed_at = NOW() WHERE fournisseur = ? AND event_id = ?",
        [checkout.fournisseur, String(eventId).slice(0, 190)]
      );
    }
    await conn.commit();
    emitted = { userId: checkout.user_id, invoiceId: checkout.facture_id, paymentId: paymentRows[0].id, amount: paidAmount, method, fullyPaid: newStatus === 'payee' };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  if (emitted) {
    const [[invoice]] = await pool.query('SELECT id, numero, total, montant_paye, statut FROM factures WHERE id = ? AND user_id = ?', [emitted.invoiceId, emitted.userId]);
    if (emitted.fullyPaid) notifierUtilisateur(emitted.userId, 'facture_payee', { facture: invoice });
    queueWebhookEvent(emitted.userId, 'payment.received', { facture_id: emitted.invoiceId, montant: emitted.amount, methode: emitted.method, paiement_id: emitted.paymentId }).catch(err => console.warn('Webhook payment.received ignoré :', err.message));
    return { received: true, invoice };
  }
  return { ignored: true };
}

router.get('/:reference/status', async (req, res, next) => {
  try {
    const reference = String(req.params.reference || '');
    if (!/^[a-f0-9]{64}$/.test(reference)) return res.status(404).json({ error: 'Session introuvable.' });
    const [rows] = await pool.query(
      'SELECT c.statut, c.montant, c.devise, c.fournisseur, c.created_at, c.paid_at, f.numero AS facture_numero, COALESCE(u.entreprise_nom, u.nom) AS entreprise_nom FROM pro_invoice_checkouts c JOIN factures f ON f.id = c.facture_id AND f.user_id = c.user_id JOIN users u ON u.id = c.user_id WHERE c.reference_interne = ? LIMIT 1',
      [reference]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session de paiement introuvable.' });
    res.set('Cache-Control', 'no-store');
    res.json({ checkout: rows[0] });
  } catch (err) { next(err); }
});

router.post('/wave', async (req, res) => {
  const body = req.body || {};
  const data = body.data || {};
  const eventType = body.type || body.event;
  if (eventType !== 'checkout.session.completed') return res.json({ received: true, ignored: true });

  try {
    const reference = String(data.client_reference || '');
    const [rows] = await pool.query(
      "SELECT * FROM pro_invoice_checkouts WHERE fournisseur = 'wave' AND reference_interne = ? LIMIT 1",
      [reference]
    );
    const checkout = rows[0];
    if (!checkout) return res.status(404).json({ error: 'Session de paiement inconnue.' });
    const credentials = await credentialsFor(checkout.user_id, 'wave');
    if (!credentials || !verifierSignatureWave(req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(body), req.headers['wave-signature'], credentials.WAVE_SIGNING_SECRET)) {
      return res.status(401).json({ error: 'Signature Wave invalide.' });
    }
    const sessionId = String(data.id || '');
    if (!sessionId || sessionId !== String(checkout.reference_prestataire || '')) {
      return res.status(400).json({ error: 'Référence de session Wave incohérente.' });
    }
    const session = await consulterSessionWave(sessionId, credentials);
    if (!session || session.payment_status !== 'succeeded' || session.checkout_status !== 'complete' ||
        session.client_reference !== checkout.reference_interne || session.currency !== checkout.devise) {
      return res.status(409).json({ error: 'Le prestataire ne confirme pas un paiement réussi correspondant à cette session.' });
    }
    const eventId = body.id || session.transaction_id || session.id;
    await pool.query(
      "INSERT IGNORE INTO pro_payment_webhook_events (fournisseur, event_id, payload_hash) VALUES ('wave', ?, ?)",
      [String(eventId).slice(0, 190), crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex')]
    );
    const result = await applySuccessfulCheckout(checkout.id, session.transaction_id || session.id, Number(session.amount), 'wave', eventId, body);
    res.json(result);
  } catch (err) {
    console.error('Webhook Wave facture échoué :', err.message);
    res.status(500).json({ error: 'Événement Wave non traité ; le prestataire peut réessayer.' });
  }
});

router.post('/paydunya', async (req, res) => {
  try {
    let data = req.body?.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (_) { data = null; }
    }
    if (!data) return res.status(400).json({ error: 'Corps IPN PayDunya invalide.' });
    const token = String(data.invoice?.token || data.token || '');
    if (!token) return res.status(400).json({ error: 'Token PayDunya absent.' });
    const [rows] = await pool.query(
      "SELECT * FROM pro_invoice_checkouts WHERE fournisseur = 'paydunya' AND reference_prestataire = ? LIMIT 1",
      [token]
    );
    const checkout = rows[0];
    if (!checkout) return res.status(404).json({ error: 'Session PayDunya inconnue.' });
    const credentials = await credentialsFor(checkout.user_id, 'paydunya');
    if (!credentials || !verifierHashPaydunya(data.hash, credentials.PAYDUNYA_MASTER_KEY)) {
      return res.status(401).json({ error: 'Hash IPN PayDunya invalide.' });
    }
    const confirmation = await confirmerFacturePaydunya(token, credentials);
    const status = String(confirmation?.status || '').toLowerCase();
    const responseCode = String(confirmation?.response_code || '');
    if (responseCode !== '00' || status !== 'completed') {
      return res.json({ received: true, ignored: true, provider_status: status || 'unknown' });
    }
    const confirmedAmount = Number(confirmation.invoice?.total_amount ?? confirmation.total_amount);
    if (!Number.isFinite(confirmedAmount)) return res.status(409).json({ error: 'Montant confirmé PayDunya absent.' });
    const eventId = 'paydunya-' + token;
    await pool.query(
      "INSERT IGNORE INTO pro_payment_webhook_events (fournisseur, event_id, payload_hash) VALUES ('paydunya', ?, ?)",
      [eventId, crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')]
    );
    const result = await applySuccessfulCheckout(checkout.id, token, confirmedAmount, 'paydunya', eventId, data);
    res.json(result);
  } catch (err) {
    console.error('IPN PayDunya facture échoué :', err.message);
    res.status(500).json({ error: 'Notification PayDunya non traitée ; le prestataire peut réessayer.' });
  }
});

module.exports = router;
