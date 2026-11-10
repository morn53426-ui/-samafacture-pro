const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { resolveTenant, requirePermission } = require('../middleware/tenant');
const { positiveNumber, percentage, positiveInt } = require('../utils/validation');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');

const router = express.Router();
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
      [req.tenantId, nom, reference || null, positiveNumber(prix_ht), positiveNumber(prix_achat), percentage(tva), positiveInt(stock), categorie || null, description || null, image || null]
    );

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
  try {
    const [existingRows] = await pool.query('SELECT * FROM produits WHERE id = ? AND user_id = ?', [req.params.id, req.tenantId]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Produit introuvable.' });

    const { nom, reference, prix_ht, prix_achat, tva, stock, categorie, description, image } = req.body;
    // Même règle qu'à la création (POST /produits) : le nom est obligatoire. Sans ce
    // contrôle, `{ nom: "" }` effaçait silencieusement le nom d'un produit existant.
    if (nom !== undefined && !nom) {
      return res.status(400).json({ error: 'Le nom du produit est obligatoire.' });
    }
    await pool.query(
      `UPDATE produits SET nom=?, reference=?, prix_ht=?, prix_achat=?, tva=?, stock=?, categorie=?, description=?, image=? WHERE id = ? AND user_id = ?`,
      [
        nom ?? existing.nom, reference ?? existing.reference,
        prix_ht !== undefined ? positiveNumber(prix_ht, existing.prix_ht) : existing.prix_ht,
        prix_achat !== undefined ? positiveNumber(prix_achat, existing.prix_achat) : existing.prix_achat,
        tva !== undefined ? percentage(tva, existing.tva) : existing.tva,
        stock !== undefined ? positiveInt(stock, existing.stock) : existing.stock,
        categorie ?? existing.categorie, description ?? existing.description, image ?? existing.image,
        existing.id, req.tenantId
      ]
    );

    const [rows] = await pool.query('SELECT * FROM produits WHERE id = ? AND user_id = ?', [existing.id, req.tenantId]);
    res.json({ produit: rows[0] });
  } catch (err) { next(err); }
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
