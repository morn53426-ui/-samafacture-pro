const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { resolveTenant, requirePermission } = require('../middleware/tenant');
const { positiveNumber } = require('../utils/validation');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');

const router = express.Router();
router.use(requireAuth, resolveTenant, requirePermission);

/**
 * @openapi
 * /depenses:
 *   get:
 *     summary: Liste les dépenses de l'utilisateur connecté (paginée)
 *     tags: [Dépenses]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limite
 *         schema: { type: integer, default: 200 }
 *     responses:
 *       200:
 *         description: Liste des dépenses.
 *         content: { application/json: { schema: { type: object, properties: { depenses: { type: array, items: { $ref: '#/components/schemas/Depense' } } } } } }
 */
router.get('/', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    // Audit final : contrairement à /api/clients et /api/produits, cette liste n'était jamais
    // paginée — un SELECT * sans LIMIT sur toute la table. Sans conséquence pour un commerçant
    // avec quelques dizaines de dépenses, mais une charge croissante sans borne au fil des années
    // pour un compte actif. defaultLimite=200 (bien au-delà d'un usage courant) pour ne rien
    // changer d'observable pour la quasi-totalité des utilisateurs actuels — depenses.html
    // affiche aujourd'hui `depenses` comme une liste plate ; ajouter une pagination visible
    // côté frontend (page suivante) est une amélioration UI séparée, non faite ici pour ne pas
    // modifier le comportement de l'écran sans le prévenir.
    const { page, limite, offset } = getPagination(req.query, { defaultLimite: 200, maxLimite: 500 });

    let whereSql = ' WHERE user_id = ?';
    const params = [req.tenantId];
    if (from) { whereSql += ' AND date_depense >= ?'; params.push(from); }
    if (to) { whereSql += ' AND date_depense <= ?'; params.push(to); }

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM depenses${whereSql}`, params);
    const [rows] = await pool.query(
      `SELECT * FROM depenses${whereSql} ORDER BY date_depense DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, limite, offset]
    );
    res.json({ depenses: rows, pagination: buildPaginationMeta(page, limite, total) });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /depenses:
 *   post:
 *     summary: Enregistre une dépense
 *     tags: [Dépenses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [libelle, montant]
 *             properties:
 *               libelle: { type: string, example: 'Achat de fournitures' }
 *               montant: { type: number, example: 8500 }
 *               categorie: { type: string }
 *               date_depense: { type: string, format: date, description: "Défaut : aujourd’hui." }
 *               notes: { type: string }
 *     responses:
 *       201: { description: Dépense créée. }
 *       400: { description: Libellé ou montant manquant., content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/', async (req, res, next) => {
  try {
    const { libelle, montant, categorie, date_depense, notes } = req.body;
    if (!libelle || !montant) return res.status(400).json({ error: 'Le libellé et le montant sont obligatoires.' });

    const [result] = await pool.query(
      `INSERT INTO depenses (user_id, libelle, montant, categorie, date_depense, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      [req.tenantId, libelle, positiveNumber(montant, 0), categorie || null, date_depense || new Date().toISOString().slice(0, 10), notes || null]
    );

    const [rows] = await pool.query('SELECT * FROM depenses WHERE id = ?', [result.insertId]);
    res.status(201).json({ depense: rows[0] });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /depenses/{id}:
 *   put:
 *     summary: Met à jour une dépense (champs fournis uniquement)
 *     tags: [Dépenses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content: { application/json: { schema: { $ref: '#/components/schemas/Depense' } } }
 *     responses:
 *       200: { description: Dépense mise à jour. }
 *       404: { description: Dépense introuvable., content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.put('/:id', async (req, res, next) => {
  try {
    const [existingRows] = await pool.query('SELECT * FROM depenses WHERE id = ? AND user_id = ?', [req.params.id, req.tenantId]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Dépense introuvable.' });

    const { libelle, montant, categorie, date_depense, notes } = req.body;
    // Même règle qu'à la création (POST /depenses) : le libellé est obligatoire. Sans ce
    // contrôle, `{ libelle: "" }` effaçait silencieusement le libellé d'une dépense existante.
    if (libelle !== undefined && !libelle) {
      return res.status(400).json({ error: 'Le libellé est obligatoire.' });
    }
    await pool.query(
      `UPDATE depenses SET libelle=?, montant=?, categorie=?, date_depense=?, notes=? WHERE id = ?`,
      [
        libelle ?? existing.libelle,
        montant !== undefined ? positiveNumber(montant, existing.montant) : existing.montant,
        categorie ?? existing.categorie,
        date_depense ?? existing.date_depense, notes ?? existing.notes, existing.id
      ]
    );

    const [rows] = await pool.query('SELECT * FROM depenses WHERE id = ?', [existing.id]);
    res.json({ depense: rows[0] });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /depenses/{id}:
 *   delete:
 *     summary: Supprime une dépense
 *     tags: [Dépenses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Dépense supprimée. }
 *       404: { description: Dépense introuvable., content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const [existingRows] = await pool.query('SELECT * FROM depenses WHERE id = ? AND user_id = ?', [req.params.id, req.tenantId]);
    if (!existingRows.length) return res.status(404).json({ error: 'Dépense introuvable.' });
    await pool.query('DELETE FROM depenses WHERE id = ?', [existingRows[0].id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
