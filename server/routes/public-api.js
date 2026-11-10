const express = require('express');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { computeTotals, insererLignesFacture, ajusterStockFacture } = require('./factures');
const { FREE_MONTHLY_INVOICE_LIMIT, isPaidPlan } = require('../utils/plans');
const { queueWebhookEvent } = require('../utils/pro-webhooks');

const router = express.Router();

async function authenticateApiKey(req, res, next) {
  try {
    const raw = req.get('X-SamaFacture-Key') || (req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!raw || !/^sf_live_[a-f0-9]{64}$/i.test(raw)) return res.status(401).json({ error: 'Clé API manquante ou invalide.' });
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    const [rows] = await pool.query(
      'SELECT id, user_id, scopes_json FROM pro_api_keys WHERE token_hash = ? AND revoked_at IS NULL AND (expire_at IS NULL OR expire_at > NOW()) LIMIT 1',
      [hash]
    );
    if (!rows.length) return res.status(401).json({ error: 'Clé API inconnue, expirée ou révoquée.' });
    req.apiKeyId = Number(rows[0].id);
    req.apiUserId = Number(rows[0].user_id);
    req.apiScopes = Array.isArray(rows[0].scopes_json) ? rows[0].scopes_json : JSON.parse(rows[0].scopes_json || '[]');
    await pool.query('UPDATE pro_api_keys SET derniere_utilisation = NOW() WHERE id = ?', [req.apiKeyId]);
    next();
  } catch (err) { next(err); }
}

function requireScope(scope) {
  return (req, res, next) => {
    if (req.apiScopes.includes(scope)) return next();
    return res.status(403).json({ error: 'Cette clé API ne possède pas la permission ' + scope + '.' });
  };
}

router.use(authenticateApiKey);

router.get('/health', (req, res) => res.json({ status: 'ok', api: 'SamaFacture Pro v1' }));

router.get('/clients', requireScope('clients:read'), async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, nom, email, telephone, whatsapp, adresse, created_at FROM clients WHERE user_id = ? ORDER BY nom LIMIT 500', [req.apiUserId]);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

router.get('/products', requireScope('products:read'), async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, nom, reference, prix_ht, tva, stock, categorie, description FROM produits WHERE user_id = ? ORDER BY nom LIMIT 500', [req.apiUserId]);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

router.get('/invoices', requireScope('invoices:read'), async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const [rows] = await pool.query(
      'SELECT f.id, f.numero, f.type, f.date_emission, f.date_echeance, f.statut, f.total, f.montant_paye, u.devise, c.nom AS client_nom FROM factures f JOIN clients c ON c.id = f.client_id JOIN users u ON u.id = f.user_id WHERE f.user_id = ? ORDER BY f.date_emission DESC, f.id DESC LIMIT ?',
      [req.apiUserId, limit]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

router.post('/invoices', requireScope('invoices:write'), async (req, res, next) => {
  let conn;
  try {
    const uid = req.apiUserId;
    const clientId = Number(req.body.client_id);
    const [clients] = await pool.query('SELECT id FROM clients WHERE id = ? AND user_id = ?', [clientId, uid]);
    if (!clients.length) return res.status(400).json({ error: 'Client invalide pour cette clé API.' });
    const idempotencyKey = String(req.get('Idempotency-Key') || '').trim() || null;
    if (idempotencyKey && (idempotencyKey.length < 8 || idempotencyKey.length > 100)) return res.status(400).json({ error: 'Idempotency-Key invalide (8 à 100 caractères).' });
    if (idempotencyKey) {
      const [existing] = await pool.query('SELECT id, numero, total, statut FROM factures WHERE user_id = ? AND idempotency_key = ? LIMIT 1', [uid, idempotencyKey]);
      if (existing.length) return res.status(200).json({ facture: existing[0], idempotent_replay: true });
    }
    const inputLines = Array.isArray(req.body.lignes) ? req.body.lignes : [];
    if (!inputLines.length || inputLines.length > 100) return res.status(400).json({ error: 'Une facture doit contenir entre 1 et 100 lignes.' });
    const productIds = [...new Set(inputLines.map(l => Number(l.produit_id)).filter(n => Number.isInteger(n) && n > 0))];
    let validProducts = new Set();
    if (productIds.length) {
      const placeholders = productIds.map(() => '?').join(',');
      const [products] = await pool.query('SELECT id FROM produits WHERE user_id = ? AND id IN (' + placeholders + ')', [uid, ...productIds]);
      validProducts = new Set(products.map(p => Number(p.id)));
    }
    const lines = inputLines.map(l => ({ ...l, produit_id: validProducts.has(Number(l.produit_id)) ? Number(l.produit_id) : null }));
    const totals = computeTotals(lines, req.body.remise, req.body.frais_livraison);
    const [userRows] = await pool.query('SELECT plan FROM users WHERE id = ?', [uid]);
    if (!isPaidPlan(userRows[0]?.plan)) {
      const [[count]] = await pool.query("SELECT COUNT(*) AS n FROM factures WHERE user_id = ? AND type = 'facture' AND date_emission >= DATE_FORMAT(CURDATE(), '%Y-%m-01')", [uid]);
      if (Number(count.n) >= FREE_MONTHLY_INVOICE_LIMIT) return res.status(403).json({ error: 'Le quota mensuel de factures du plan Gratuit est atteint.' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();
    const numero = 'API-' + new Date().getFullYear() + '-' + crypto.randomBytes(5).toString('hex').toUpperCase();
    const dateEmission = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.date_emission || '')) ? req.body.date_emission : new Date().toISOString().slice(0, 10);
    const [result] = await conn.query(
      'INSERT INTO factures (user_id, client_id, numero, type, date_emission, date_echeance, statut, remise, frais_livraison, commentaires, sous_total, total_tva, total, verification_code, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [uid, clientId, numero, 'facture', dateEmission, req.body.date_echeance || null, 'en_attente', totals.remise, Number(req.body.frais_livraison) || 0, String(req.body.commentaires || '').slice(0, 2000) || null, totals.sous_total, totals.total_tva, totals.total, crypto.randomBytes(4).toString('hex').toUpperCase(), idempotencyKey]
    );
    await insererLignesFacture(conn, result.insertId, totals.computedLignes);
    await ajusterStockFacture(conn, result.insertId, uid, -1);
    await conn.commit();
    await queueWebhookEvent(uid, 'invoice.created', { invoice_id: result.insertId, numero, total: totals.total }).catch(e => console.warn('Webhook queue failed:', e.message));
    res.status(201).json({ facture: { id: result.insertId, numero, total: totals.total, statut: 'en_attente' } });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    if (err.code === 'ER_DUP_ENTRY' && req.get('Idempotency-Key')) {
      const [existing] = await pool.query('SELECT id, numero, total, statut FROM factures WHERE user_id = ? AND idempotency_key = ? LIMIT 1', [req.apiUserId, req.get('Idempotency-Key').trim()]);
      if (existing.length) return res.status(200).json({ facture: existing[0], idempotent_replay: true });
    }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
