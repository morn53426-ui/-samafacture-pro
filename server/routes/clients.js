const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { resolveTenant, requirePermission } = require('../middleware/tenant');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { notifierUtilisateur } = require('../realtime');
const { ajusterStockFacture } = require('./factures');
const { queueWebhookEvent } = require('../utils/pro-webhooks');

const router = express.Router();
router.use(requireAuth, resolveTenant, requirePermission);

/**
 * @openapi
 * /clients:
 *   get:
 *     summary: Liste les clients de l'utilisateur connecté (avec total facturé/payé par client)
 *     tags: [Clients]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Recherche sur le nom, l'email ou le téléphone.
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limite
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Liste paginée des clients.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clients: { type: array, items: { $ref: '#/components/schemas/Client' } }
 */
router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query;
    const { page, limite, offset } = getPagination(req.query);

    const searchParams = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM clients WHERE user_id = ?${q ? ' AND (nom LIKE ? OR email LIKE ? OR telephone LIKE ?)' : ''}`,
      [req.tenantId, ...searchParams]
    );

    const baseSql = `
      SELECT c.*,
        COALESCE(SUM(CASE WHEN f.type = 'facture' THEN f.total END), 0) as total_facture,
        COALESCE(SUM(CASE WHEN f.type = 'facture' THEN f.montant_paye END), 0) as total_paye
      FROM clients c
      LEFT JOIN factures f ON f.client_id = c.id AND f.user_id = c.user_id
      WHERE c.user_id = ?${q ? ' AND (c.nom LIKE ? OR c.email LIKE ? OR c.telephone LIKE ?)' : ''}
    `;
    const [rows] = await pool.query(
      `${baseSql} GROUP BY c.id ORDER BY c.nom LIMIT ? OFFSET ?`,
      [req.tenantId, ...searchParams, limite, offset]
    );

    const withTotals = rows.map(c => ({ ...c, total_du: c.total_facture - c.total_paye }));

    res.json({ clients: withTotals, pagination: buildPaginationMeta(page, limite, total) });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /clients/{id}:
 *   get:
 *     summary: Détail d'un client, avec l'historique de ses factures/devis
 *     tags: [Clients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Client trouvé.
 *       404:
 *         description: Client introuvable.
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } }
 */
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM clients WHERE id = ? AND user_id = ?', [req.params.id, req.tenantId]);
    const client = rows[0];
    if (!client) return res.status(404).json({ error: 'Client introuvable.' });
    const [factures] = await pool.query('SELECT * FROM factures WHERE client_id = ? AND user_id = ? ORDER BY date_emission DESC', [client.id, req.tenantId]);
    res.json({ client, factures });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /clients:
 *   post:
 *     summary: Crée un nouveau client
 *     tags: [Clients]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nom]
 *             properties:
 *               nom: { type: string, example: 'Fatou Ndiaye' }
 *               email: { type: string }
 *               telephone: { type: string }
 *               whatsapp: { type: string }
 *               adresse: { type: string }
 *               notes: { type: string }
 *               photo: { type: string, description: 'Image en base64 (data URL), facultative.' }
 *     responses:
 *       201:
 *         description: Client créé. Déclenche aussi une notification temps réel (voir Priorité 6).
 *       400:
 *         description: Nom manquant.
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } }
 */
router.post('/', async (req, res, next) => {
  try {
    const { nom, email, telephone, whatsapp, adresse, notes, photo } = req.body;
    if (!nom) return res.status(400).json({ error: 'Le nom du client est obligatoire.' });

    const [result] = await pool.query(
      `INSERT INTO clients (user_id, nom, email, telephone, whatsapp, adresse, notes, photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.tenantId, nom, email || null, telephone || null, whatsapp || null, adresse || null, notes || null, photo || null]
    );

    const [rows] = await pool.query('SELECT * FROM clients WHERE id = ?', [result.insertId]);
    res.status(201).json({ client: rows[0] });
    notifierUtilisateur(req.tenantId, 'nouveau_client', { client: rows[0] });
    queueWebhookEvent(req.tenantId, 'client.created', { client_id: rows[0].id, nom: rows[0].nom }).catch(err => console.warn('Webhook client.created ignoré :', err.message));
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /clients/{id}:
 *   put:
 *     summary: Met à jour un client (champs fournis uniquement — les autres sont conservés)
 *     tags: [Clients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Client' }
 *     responses:
 *       200: { description: Client mis à jour. }
 *       404: { description: Client introuvable., content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 *       409: { description: Client avec historique protégé., content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.put('/:id', async (req, res, next) => {
  try {
    const [existingRows] = await pool.query('SELECT * FROM clients WHERE id = ? AND user_id = ?', [req.params.id, req.tenantId]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Client introuvable.' });

    const { nom, email, telephone, whatsapp, adresse, notes, photo } = req.body;
    // Le nom est obligatoire à la création (voir POST /clients ci-dessus) ; la mise à jour
    // doit respecter la même règle — sans ce contrôle, envoyer `{ nom: "" }` effaçait
    // silencieusement le nom d'un client existant (nom ?? existing.nom ne bloque que
    // null/undefined, pas une chaîne vide explicitement fournie).
    if (nom !== undefined && !nom) {
      return res.status(400).json({ error: 'Le nom du client est obligatoire.' });
    }
    await pool.query(
      `UPDATE clients SET nom=?, email=?, telephone=?, whatsapp=?, adresse=?, notes=?, photo=? WHERE id = ?`,
      [
        nom ?? existing.nom, email ?? existing.email, telephone ?? existing.telephone, whatsapp ?? existing.whatsapp,
        adresse ?? existing.adresse, notes ?? existing.notes, photo ?? existing.photo, existing.id
      ]
    );

    const [rows] = await pool.query('SELECT * FROM clients WHERE id = ?', [existing.id]);
    res.json({ client: rows[0] });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /clients/{id}:
 *   delete:
 *     summary: Supprime un client, ainsi que toutes ses factures/devis (irréversible)
 *     tags: [Clients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Client supprimé. }
 *       404: { description: Client introuvable., content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.delete('/:id', async (req, res, next) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [existingRows] = await conn.query(
      'SELECT id FROM clients WHERE id = ? AND user_id = ? FOR UPDATE',
      [req.params.id, req.tenantId]
    );
    if (!existingRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Client introuvable.' });
    }
    const clientId = existingRows[0].id;

    // Une référence inter-entreprises anormale ne doit jamais être supprimée en cascade.
    const [foreignInvoices] = await conn.query(
      'SELECT id FROM factures WHERE client_id = ? AND user_id <> ? LIMIT 1 FOR UPDATE',
      [clientId, req.tenantId]
    );
    if (foreignInvoices.length) {
      await conn.rollback();
      return res.status(409).json({
        error: 'Suppression refusée : des factures appartenant à une autre entreprise référencent ce client.'
      });
    }

    // Protéger tous les enfants référencés par client_id, même si un user_id anomal
    // est présent : les FK peuvent cascade (factures, récurrence, portail, CRM),
    // RESTRICT (commandes) ou détacher les documents. L'archivage remplacera la suppression.
    const [historyRows] = await conn.query(
      `SELECT
         (SELECT COUNT(*) FROM factures WHERE client_id = ?) AS factures,
         (SELECT COUNT(*) FROM factures_recurrentes WHERE client_id = ?) AS factures_recurrentes,
         (SELECT COUNT(*) FROM pro_commandes WHERE client_id = ?) AS commandes,
         (SELECT COUNT(*) FROM pro_documents WHERE client_id = ?) AS documents,
         (SELECT COUNT(*) FROM pro_customer_portal_access WHERE client_id = ?) AS acces_portail,
         (SELECT COUNT(*) FROM pro_portal_quote_decisions WHERE client_id = ?) AS decisions_portail,
         (SELECT COUNT(*) FROM pro_crm_activities WHERE client_id = ?) AS activites_crm`,
      [clientId, clientId, clientId, clientId, clientId, clientId, clientId]
    );
    const history = historyRows[0];
    if (Object.values(history).some(count => Number(count) > 0)) {
      await conn.rollback();
      return res.status(409).json({
        error: 'Ce client possède un historique commercial, financier, documentaire ou portail. Archivez-le plutôt que de le supprimer.',
        code: 'CLIENT_HISTORIQUE_PROTEGE'
      });
    }

    await conn.query('DELETE FROM clients WHERE id = ? AND user_id = ?', [clientId, req.tenantId]);
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
