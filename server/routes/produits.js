const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { resolveTenant, requirePermission } = require('../middleware/tenant');
const { positiveNumber, percentage, nonNegativeQuantity } = require('../utils/validation');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');

const router = express.Router();

async function initialiserStockEntrepotPrincipal(conn, userId, productId, quantity) {
  const [warehouses] = await conn.query(
    "SELECT id FROM pro_entrepots WHERE user_id = ? AND code = 'PRINCIPAL' LIMIT 1",
    [userId]
  );
  if (!warehouses.length) return;
  await conn.query(
    'INSERT IGNORE INTO pro_stocks_entrepots (user_id, entrepot_id, produit_id, quantite) VALUES (?, ?, ?, ?)',
    [userId, warehouses[0].id, productId, quantity]
  );
}


router.use(requireAuth, resolveTenant, requirePermission);

/**
 * @openapi
 * /produits:
 *   get:
 *     summary: Liste le catalogue de produits/services de l'utilisateur connecté
 *     tags: [Produits]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Recherche sur le nom.
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: Liste paginée.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { produits: { type: array, items: { $ref: '#/components/schemas/Produit' } } }
 */
router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query;
    const { page, limite, offset } = getPagination(req.query);
    const searchParams = q ? [`%${q}%`] : [];

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM produits WHERE user_id = ?${q ? ' AND nom LIKE ?' : ''}`,
      [req.tenantId, ...searchParams]
    );
    const [rows] = await pool.query(
      `SELECT * FROM produits WHERE user_id = ?${q ? ' AND nom LIKE ?' : ''} ORDER BY nom LIMIT ? OFFSET ?`,
      [req.tenantId, ...searchParams, limite, offset]
    );

    res.json({ produits: rows, pagination: buildPaginationMeta(page, limite, total) });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /produits:
 *   post:
 *     summary: Ajoute un produit ou service au catalogue
 *     tags: [Produits]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nom]
 *             properties:
 *               nom: { type: string }
 *               reference: { type: string }
 *               prix_ht: { type: number }
 *               tva: { type: number, description: 'Pourcentage, ex: 18' }
 *               stock: { type: integer }
 *               categorie: { type: string }
 *               description: { type: string }
 *               image: { type: string, description: 'Base64 (data URL), facultatif.' }
 *     responses:
 *       201: { description: Produit créé. }
 *       400: { description: Nom manquant., content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/', async (req, res, next) => {
  try {
    const { nom, reference, prix_ht, prix_achat, tva, stock, categorie, description, image } = req.body;
    if (!nom) return res.status(400).json({ error: 'Le nom du produit est obligatoire.' });

    const [result] = await pool.query(
      `INSERT INTO produits (user_id, nom, reference, prix_ht, prix_achat, tva, stock, categorie, description, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.tenantId, nom, reference || null, positiveNumber(prix_ht), positiveNumber(prix_achat), percentage(tva), nonNegativeQuantity(stock), categorie || null, description || null, image || null]
    );

    await initialiserStockEntrepotPrincipal(pool, req.tenantId, result.insertId, nonNegativeQuantity(stock));
    const [rows] = await pool.query('SELECT * FROM produits WHERE id = ? AND user_id = ?', [result.insertId, req.tenantId]);
    res.status(201).json({ produit: rows[0] });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /produits/{id}:
 *   put:
 *     summary: Met à jour un produit (champs fournis uniquement)
 *     tags: [Produits]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content: { application/json: { schema: { $ref: '#/components/schemas/Produit' } } }
 *     responses:
 *       200: { description: Produit mis à jour. }
 *       404: { description: Produit introuvable., content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.put('/:id', async (req, res, next) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [existingRows] = await conn.query('SELECT * FROM produits WHERE id = ? AND user_id = ? FOR UPDATE', [req.params.id, req.tenantId]);
    const existing = existingRows[0];
    if (!existing) { await conn.rollback(); return res.status(404).json({ error: 'Produit introuvable.' }); }

    const { nom, reference, prix_ht, prix_achat, tva, stock, categorie, description, image } = req.body;
    if (nom !== undefined && !nom) {
      await conn.rollback();
      return res.status(400).json({ error: 'Le nom du produit est obligatoire.' });
    }

    let nextStock = stock !== undefined ? nonNegativeQuantity(stock, Number(existing.stock)) : Number(existing.stock);
    const [warehouses] = await conn.query(
      "SELECT id FROM pro_entrepots WHERE user_id = ? AND code = 'PRINCIPAL' LIMIT 1",
      [req.tenantId]
    );
    if (stock !== undefined && warehouses.length) {
      // Une fois les stocks multi-entrepôts activés, un changement du stock catalogue
      // est traité comme un delta sur le dépôt principal afin de conserver le total.
      const warehouseId = Number(warehouses[0].id);
      await conn.query(
        'INSERT IGNORE INTO pro_stocks_entrepots (user_id, entrepot_id, produit_id, quantite) VALUES (?, ?, ?, 0)',
        [req.tenantId, warehouseId, existing.id]
      );
      const [stockRows] = await conn.query(
        'SELECT entrepot_id, quantite FROM pro_stocks_entrepots WHERE user_id = ? AND produit_id = ? FOR UPDATE',
        [req.tenantId, existing.id]
      );
      const main = stockRows.find(row => Number(row.entrepot_id) === warehouseId);
      const currentTotal = stockRows.reduce((sum, row) => sum + Number(row.quantite), 0);
      const delta = Math.round((nextStock - currentTotal) * 1000) / 1000;
      if (!main || Number(main.quantite) + delta < 0) {
        await conn.rollback();
        return res.status(409).json({ error: 'La nouvelle quantité ne peut pas être obtenue en réduisant uniquement le dépôt principal. Utilisez Achats & stocks pour ajuster chaque entrepôt.' });
      }
      await conn.query(
        'UPDATE pro_stocks_entrepots SET quantite = quantite + ? WHERE user_id = ? AND entrepot_id = ? AND produit_id = ?',
        [delta, req.tenantId, warehouseId, existing.id]
      );
      const [totals] = await conn.query('SELECT COALESCE(SUM(quantite),0) AS total FROM pro_stocks_entrepots WHERE user_id = ? AND produit_id = ?', [req.tenantId, existing.id]);
      nextStock = Number(totals[0].total);
    }

    await conn.query(
      'UPDATE produits SET nom=?, reference=?, prix_ht=?, prix_achat=?, tva=?, stock=?, categorie=?, description=?, image=? WHERE id = ? AND user_id = ?',
      [
        nom ?? existing.nom, reference ?? existing.reference,
        prix_ht !== undefined ? positiveNumber(prix_ht, existing.prix_ht) : existing.prix_ht,
        prix_achat !== undefined ? positiveNumber(prix_achat, existing.prix_achat) : existing.prix_achat,
        tva !== undefined ? percentage(tva, existing.tva) : existing.tva,
        nextStock,
        categorie ?? existing.categorie, description ?? existing.description, image ?? existing.image,
        existing.id, req.tenantId
      ]
    );
    const [rows] = await conn.query('SELECT * FROM produits WHERE id = ? AND user_id = ?', [existing.id, req.tenantId]);
    await conn.commit();
    res.json({ produit: rows[0] });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally { if (conn) conn.release(); }
});

/**
 * @openapi
 * /produits/{id}:
 *   delete:
 *     summary: Supprime un produit du catalogue (les lignes de facture existantes le référençant sont conservées, mais détachées)
 *     tags: [Produits]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Produit supprimé. }
 *       404: { description: Produit introuvable., content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 *       409: { description: Suppression bloquée par une contrainte de la base., content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.delete('/:id', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const [existingRows] = await pool.query('SELECT * FROM produits WHERE id = ? AND user_id = ?', [req.params.id, req.tenantId]);
    if (!existingRows.length) return res.status(404).json({ error: 'Produit introuvable.' });

    await conn.beginTransaction();
    // Détache d'abord le produit des lignes de facture existantes (au lieu de compter uniquement
    // sur la contrainte ON DELETE SET NULL de la base, qui peut différer si les tables ont été
    // créées avec une ancienne version du schéma).
    await conn.query('UPDATE facture_lignes fl JOIN factures f ON f.id = fl.facture_id SET fl.produit_id = NULL WHERE fl.produit_id = ? AND f.user_id = ?', [existingRows[0].id, req.tenantId]);
    await conn.query('DELETE FROM produits WHERE id = ? AND user_id = ?', [existingRows[0].id, req.tenantId]);
    await conn.commit();

    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(409).json({ error: 'Impossible de supprimer ce produit : il est encore lié à des données existantes.' });
    }
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
