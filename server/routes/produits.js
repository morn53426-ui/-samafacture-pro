const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { resolveTenant, requirePermission } = require('../middleware/tenant');
const { positiveNumber, percentage, nonNegativeQuantity } = require('../utils/validation');
const { normalizeCatalogueType, isStockManagedType } = require('../utils/catalogue-type');
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
 *               type_catalogue: { type: string, enum: [produit, service, non_classe] }
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
    const { nom, type_catalogue, reference, prix_ht, prix_achat, tva, stock, stock_minimum, categorie, description, image } = req.body;
    if (!nom) return res.status(400).json({ error: 'Le nom du produit est obligatoire.' });

    // Les clients API historiques qui n'envoient pas encore type_catalogue restent
    // compatibles ; le formulaire récent transmet explicitement produit ou service.
    const catalogueType = normalizeCatalogueType(type_catalogue);
    if (!catalogueType) {
      return res.status(400).json({ error: 'Le type doit être produit, service ou non classé.' });
    }
    const stockManaged = isStockManagedType(catalogueType);
    if (!stockManaged && (nonNegativeQuantity(stock) > 0 || nonNegativeQuantity(stock_minimum) > 0)) {
      return res.status(400).json({ error: 'Un service ne peut pas avoir de quantité ni de seuil de stock.' });
    }
    const quantity = stockManaged ? nonNegativeQuantity(stock) : 0;
    const minimumQuantity = stockManaged ? nonNegativeQuantity(stock_minimum) : 0;

    const [result] = await pool.query(
      `INSERT INTO produits (user_id, nom, type_catalogue, reference, prix_ht, prix_achat, tva, stock, stock_minimum, categorie, description, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.tenantId, nom, catalogueType, reference || null, positiveNumber(prix_ht), positiveNumber(prix_achat), percentage(tva), quantity, minimumQuantity, categorie || null, description || null, image || null]
    );

    // Un service n'entre pas dans les stocks physiques ni dans les entrepôts.
    if (stockManaged) {
      await initialiserStockEntrepotPrincipal(pool, req.tenantId, result.insertId, quantity);
    }
    const [rows] = await pool.query('SELECT * FROM produits WHERE id = ? AND user_id = ?', [result.insertId, req.tenantId]);
    res.status(201).json({ produit: rows[0] });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /produits/{id}:
 *   put:
 *     summary: Met à jour une fiche produit ou service (champs fournis uniquement)
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

    const { nom, type_catalogue, reference, prix_ht, prix_achat, tva, stock, stock_minimum, categorie, description, image } = req.body;
    if (nom !== undefined && !nom) {
      await conn.rollback();
      return res.status(400).json({ error: 'Le nom du produit est obligatoire.' });
    }

    const existingType = normalizeCatalogueType(existing.type_catalogue, 'non_classe');
    const nextType = normalizeCatalogueType(type_catalogue, existingType);
    if (!nextType) {
      await conn.rollback();
      return res.status(400).json({ error: 'Le type doit être produit, service ou non classé.' });
    }
    const stockManaged = isStockManagedType(nextType);
    let nextStock = stockManaged
      ? (stock !== undefined ? nonNegativeQuantity(stock, Number(existing.stock)) : Number(existing.stock))
      : 0;
    let stockMovement = null;
    let warehouses = [];

    if (!stockManaged) {
      if ((stock !== undefined && nonNegativeQuantity(stock) > 0) ||
          (stock_minimum !== undefined && nonNegativeQuantity(stock_minimum) > 0)) {
        await conn.rollback();
        return res.status(400).json({ error: 'Un service ne peut pas avoir de quantité ni de seuil de stock.' });
      }
      // La conversion n'est autorisée qu'après sortie réelle du stock : ne pas effacer
      // silencieusement des quantités d'entrepôt ou un stock catalogue historique.
      if (isStockManagedType(existingType)) {
        const [[stockTotals]] = await conn.query(
          'SELECT COALESCE(SUM(ABS(quantite)), 0) AS total FROM pro_stocks_entrepots WHERE user_id = ? AND produit_id = ?',
          [req.tenantId, existing.id]
        );
        if (Number(existing.stock || 0) > 0 || Number(stockTotals?.total || 0) > 0) {
          await conn.rollback();
          return res.status(409).json({ error: 'Impossible de convertir cet article en service tant qu’il reste une quantité en stock. Ajustez d’abord les stocks dans Achats & stocks.' });
        }

        const [[pendingPurchase]] = await conn.query(
          `SELECT COALESCE(SUM(GREATEST(l.quantite - l.quantite_recue, 0)), 0) AS total
           FROM pro_commandes_fournisseurs_lignes l
           JOIN pro_commandes_fournisseurs o
             ON o.id = l.commande_id AND o.user_id = l.user_id
           WHERE l.user_id = ? AND l.produit_id = ?
             AND o.statut NOT IN ('annulee', 'recue')`,
          [req.tenantId, existing.id]
        );
        if (Number(pendingPurchase?.total || 0) > 0) {
          await conn.rollback();
          return res.status(409).json({ error: 'Impossible de convertir cet article en service tant qu’une commande fournisseur reste à réceptionner.' });
        }
      }
    } else {
      const [warehouseRows] = await conn.query(
        "SELECT id, nom FROM pro_entrepots WHERE user_id = ? AND code = 'PRINCIPAL' LIMIT 1",
        [req.tenantId]
      );
      warehouses = warehouseRows;
    }

    if (stockManaged && stock !== undefined && warehouses.length) {
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
      stockMovement = { warehouseId, delta };
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
      'UPDATE produits SET nom=?, type_catalogue=?, reference=?, prix_ht=?, prix_achat=?, tva=?, stock=?, stock_minimum=?, categorie=?, description=?, image=? WHERE id = ? AND user_id = ?',
      [
        nom ?? existing.nom, nextType, reference ?? existing.reference,
        prix_ht !== undefined ? positiveNumber(prix_ht, existing.prix_ht) : existing.prix_ht,
        prix_achat !== undefined ? positiveNumber(prix_achat, existing.prix_achat) : existing.prix_achat,
        tva !== undefined ? percentage(tva, existing.tva) : existing.tva,
        nextStock,
        stockManaged
          ? (stock_minimum !== undefined ? nonNegativeQuantity(stock_minimum, existing.stock_minimum) : existing.stock_minimum)
          : 0,
        categorie ?? existing.categorie, description ?? existing.description, image ?? existing.image,
        existing.id, req.tenantId
      ]
    );

    // Lorsqu'un service redevient un produit, réintégrer une ligne à zéro dans
    // l'entrepôt principal si celui-ci existe ; aucun mouvement n'est inventé.
    if (!isStockManagedType(existingType) && stockManaged) {
      await initialiserStockEntrepotPrincipal(conn, req.tenantId, existing.id, nextStock);
    }
    if (stockMovement && stockMovement.delta !== 0) {
      await conn.query(
        "INSERT INTO pro_mouvements_stock (user_id, produit_id, produit_nom, entrepot_id, entrepot_nom, type, quantite, cout_unitaire, motif) VALUES (?, ?, ?, ?, ?, 'ajustement_catalogue', ?, ?, ?)",
        [req.tenantId, existing.id, existing.nom, stockMovement.warehouseId, warehouses[0].nom, stockMovement.delta, Number(prix_achat !== undefined ? positiveNumber(prix_achat, existing.prix_achat) : existing.prix_achat), 'Modification de quantité depuis la fiche produit']
      );
    }
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
 *     summary: Supprime un produit sans stock ni historique lié
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
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [existingRows] = await conn.query(
      'SELECT * FROM produits WHERE id = ? AND user_id = ? FOR UPDATE',
      [req.params.id, req.tenantId]
    );
    const existing = existingRows[0];
    if (!existing) {
      await conn.rollback();
      return res.status(404).json({ error: 'Produit introuvable.' });
    }

    // Ne pas agréger : des soldes entrepôts opposés (données historiques/anormales)
    // pourraient s'annuler et masquer un stock non nul. Verrouiller la ligne détectée.
    const [warehouseStockRows] = await conn.query(
      'SELECT id FROM pro_stocks_entrepots WHERE produit_id = ? AND (quantite <> 0 OR user_id <> ?) LIMIT 1 FOR UPDATE',
      [existing.id, req.tenantId]
    );
    const [invoiceLines] = await conn.query(
      'SELECT id FROM facture_lignes WHERE produit_id = ? LIMIT 1 FOR UPDATE',
      [existing.id]
    );
    const [movements] = await conn.query(
      'SELECT id FROM pro_mouvements_stock WHERE produit_id = ? LIMIT 1 FOR UPDATE',
      [existing.id]
    );
    // Les lignes d'achats et de réception gardent leur document mais la FK produit
    // est ON DELETE SET NULL : bloquer pour conserver la traçabilité du catalogue.
    const [purchaseLines] = await conn.query(
      'SELECT id FROM pro_commandes_fournisseurs_lignes WHERE produit_id = ? LIMIT 1 FOR UPDATE',
      [existing.id]
    );
    if (Number(existing.stock) !== 0 || warehouseStockRows.length ||
        invoiceLines.length || movements.length || purchaseLines.length) {
      await conn.rollback();
      return res.status(409).json({
        error: 'Ce produit possède du stock, des mouvements ou des lignes de vente/achat liées. Ajustez le stock et archivez le produit plutôt que de le supprimer.',
        code: 'PRODUIT_HISTORIQUE_PROTEGE'
      });
    }

    await conn.query('DELETE FROM produits WHERE id = ? AND user_id = ?', [existing.id, req.tenantId]);
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(409).json({ error: 'Impossible de supprimer ce produit : il est encore lié à des données existantes.' });
    }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
