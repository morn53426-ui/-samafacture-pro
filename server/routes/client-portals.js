const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { resolveTenant, requirePermission } = require('../middleware/tenant');

const admin = express.Router();
const publicPortal = express.Router();

admin.use(requireAuth, resolveTenant, requirePermission);

function owner(req) {
  return Number(req.tenantId);
}

function tokenFromRequest(req) {
  const header = String(req.get('Authorization') || '');
  const match = header.match(/^Bearer ([A-Za-z0-9_-]{40,100})$/);
  return match ? match[1] : null;
}

const portalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de consultations du portail. Réessayez plus tard.' }
});

// Crée un lien client à usage de lecture seule. Le jeton brut n'est affiché qu'une fois.
admin.post('/:clientId', async (req, res, next) => {
  try {
    const clientId = Number(req.params.clientId);
    if (!Number.isSafeInteger(clientId) || clientId <= 0) return res.status(400).json({ error: 'Client invalide.' });
    const [clients] = await pool.query('SELECT id, nom FROM clients WHERE id = ? AND user_id = ?', [clientId, owner(req)]);
    if (!clients.length) return res.status(404).json({ error: 'Client introuvable.' });

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const days = Math.min(90, Math.max(1, Number(req.body?.validite_jours) || 30));
    const expiresAt = new Date(Date.now() + days * 86400000);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        'UPDATE pro_client_portal_tokens SET revoked_at = NOW() WHERE user_id = ? AND client_id = ? AND revoked_at IS NULL',
        [owner(req), clientId]
      );
      await conn.query(
        'INSERT INTO pro_client_portal_tokens (user_id, client_id, token_hash, expires_at, created_by) VALUES (?, ?, ?, ?, ?)',
        [owner(req), clientId, tokenHash, expiresAt, Number(req.user.id)]
      );
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const baseUrl = String(process.env.APP_URL || '').replace(/\/$/, '');
    if (!/^https:\/\//i.test(baseUrl) && process.env.NODE_ENV === 'production') {
      await pool.query(
        'UPDATE pro_client_portal_tokens SET revoked_at = NOW() WHERE token_hash = ?',
        [tokenHash]
      );
      return res.status(503).json({ error: 'APP_URL doit être configurée en HTTPS pour créer un lien client en production.' });
    }
    const url = (baseUrl || 'http://localhost:4000') + '/portail-client.html#token=' + rawToken;
    res.status(201).json({
      client: clients[0].nom,
      url,
      expires_at: expiresAt.toISOString(),
      validite_jours: days,
      warning: 'Ce lien donne accès en lecture seule à l’historique de facturation du client. Copiez-le maintenant.'
    });
  } catch (err) { next(err); }
});

admin.get('/:clientId', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, expires_at, last_accessed_at, created_at FROM pro_client_portal_tokens WHERE user_id = ? AND client_id = ? AND revoked_at IS NULL AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [owner(req), req.params.clientId]
    );
    res.json({ active: !!rows.length, portal: rows[0] || null });
  } catch (err) { next(err); }
});

admin.delete('/:clientId', async (req, res, next) => {
  try {
    const [result] = await pool.query(
      'UPDATE pro_client_portal_tokens SET revoked_at = NOW() WHERE user_id = ? AND client_id = ? AND revoked_at IS NULL',
      [owner(req), req.params.clientId]
    );
    res.json({ success: true, revoked: result.affectedRows });
  } catch (err) { next(err); }
});

// Le portail public n'accepte jamais un identifiant client seul : il faut le jeton aléatoire
// de 256 bits, transmis dans Authorization (le fragment URL n'est pas envoyé au serveur).
publicPortal.get('/', portalLimiter, async (req, res, next) => {
  try {
    const rawToken = tokenFromRequest(req);
    if (!rawToken) return res.status(401).json({ error: 'Lien de portail manquant ou invalide.' });
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const [access] = await pool.query(
      `SELECT t.id, t.user_id, t.client_id
       FROM pro_client_portal_tokens t
       WHERE t.token_hash = ? AND t.revoked_at IS NULL AND t.expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );
    if (!access.length) return res.status(404).json({ error: 'Ce lien client a expiré ou a été révoqué. Contactez l’entreprise pour obtenir un nouveau lien.' });

    const grant = access[0];
    const [[client]] = await pool.query(
      'SELECT id, nom, email, telephone FROM clients WHERE id = ? AND user_id = ?',
      [grant.client_id, grant.user_id]
    );
    if (!client) return res.status(404).json({ error: 'Portail client indisponible.' });
    const [[company]] = await pool.query(
      'SELECT entreprise_nom, entreprise_email, entreprise_telephone, devise, locale, timezone FROM users WHERE id = ?',
      [grant.user_id]
    );
    const [invoices] = await pool.query(
      `SELECT id, numero, type, date_emission, date_echeance, date_validite, statut,
              total, montant_paye, commentaires
       FROM factures
       WHERE user_id = ? AND client_id = ? AND type IN ('facture', 'devis')
       ORDER BY date_emission DESC, id DESC LIMIT 100`,
      [grant.user_id, grant.client_id]
    );

    const ids = invoices.map(row => row.id);
    let lines = [];
    let payments = [];
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      [lines] = await pool.query(
        `SELECT facture_id, designation, quantite, prix_unitaire, tva, total_ligne
         FROM facture_lignes WHERE facture_id IN (${placeholders}) ORDER BY id ASC`,
        ids
      );
      [payments] = await pool.query(
        `SELECT facture_id, montant, methode, date_paiement
         FROM paiements WHERE user_id = ? AND facture_id IN (${placeholders})
         ORDER BY date_paiement DESC`,
        [grant.user_id, ...ids]
      );
    }

    const linesByInvoice = new Map();
    for (const line of lines) {
      if (!linesByInvoice.has(line.facture_id)) linesByInvoice.set(line.facture_id, []);
      linesByInvoice.get(line.facture_id).push(line);
    }
    const paymentsByInvoice = new Map();
    for (const payment of payments) {
      if (!paymentsByInvoice.has(payment.facture_id)) paymentsByInvoice.set(payment.facture_id, []);
      paymentsByInvoice.get(payment.facture_id).push(payment);
    }
    await pool.query('UPDATE pro_client_portal_tokens SET last_accessed_at = NOW() WHERE id = ?', [grant.id]);

    res.set('Cache-Control', 'no-store');
    res.json({
      entreprise: {
        nom: company?.entreprise_nom || 'Entreprise',
        email: company?.entreprise_email || null,
        telephone: company?.entreprise_telephone || null
      },
      client: { nom: client.nom, email: client.email, telephone: client.telephone },
      devise: company?.devise || 'FCFA',
      locale: company?.locale || 'fr-FR',
      timezone: company?.timezone || 'Africa/Dakar',
      documents: invoices.map(row => ({
        ...row,
        lignes: linesByInvoice.get(row.id) || [],
        paiements: paymentsByInvoice.get(row.id) || []
      }))
    });
  } catch (err) { next(err); }
});

module.exports = { admin, publicPortal };
