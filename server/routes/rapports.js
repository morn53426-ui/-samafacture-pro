const express = require('express');
const XLSX = require('xlsx');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { resolveTenant, requirePermission } = require('../middleware/tenant');
const { isProPlan } = require('../utils/plans');

const router = express.Router();
router.use(requireAuth, resolveTenant, requirePermission);

// Récupère les mêmes lignes que /ventes, factorisé pour être réutilisé par l'export Excel.
async function fetchVentes(userId, { from, to, group_by = 'month' }) {
  const dateFilter = [];
  const params = [userId];
  if (from) { dateFilter.push('f.date_emission >= ?'); params.push(from); }
  if (to) { dateFilter.push('f.date_emission <= ?'); params.push(to); }
  const whereExtra = dateFilter.length ? ' AND ' + dateFilter.join(' AND ') : '';

  if (group_by === 'client') {
    const [rows] = await pool.query(
      `SELECT c.nom as label, COUNT(*) as nb_factures, COALESCE(SUM(f.total),0) as total
       FROM factures f JOIN clients c ON c.id = f.client_id
       WHERE f.user_id = ? AND f.type = 'facture' ${whereExtra}
       GROUP BY c.id, c.nom ORDER BY total DESC`,
      params
    );
    return rows;
  }
  if (group_by === 'produit') {
    const [rows] = await pool.query(
      `SELECT fl.designation as label, SUM(fl.quantite) as quantite, COALESCE(SUM(fl.total_ligne),0) as total
       FROM facture_lignes fl JOIN factures f ON f.id = fl.facture_id
       WHERE f.user_id = ? AND f.type = 'facture' ${whereExtra}
       GROUP BY fl.designation ORDER BY total DESC`,
      params
    );
    return rows;
  }
  const fmt = { day: '%Y-%m-%d', week: '%x-W%v', month: '%Y-%m', year: '%Y' }[group_by] || '%Y-%m';
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(f.date_emission, '${fmt}') as label, COUNT(*) as nb_factures, COALESCE(SUM(f.total),0) as total
     FROM factures f WHERE f.user_id = ? AND f.type = 'facture' ${whereExtra}
     GROUP BY label ORDER BY label`,
    params
  );
  return rows;
}

/**
 * @openapi
 * /rapports/ventes:
 *   get:
 *     summary: Ventes agrégées par période, client ou produit
 *     tags: [Rapports]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: group_by
 *         schema: { type: string, enum: [day, week, month, year, client, produit], default: month }
 *     responses:
 *       200: { description: Lignes agrégées selon le regroupement demandé. }
 */
router.get('/ventes', async (req, res, next) => {
  try {
    const rows = await fetchVentes(req.tenantId, req.query);
    res.json({ group_by: req.query.group_by || 'month', rows });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /rapports/export-excel:
 *   get:
 *     summary: Génère un classeur Excel (ventes + dépenses de la période) — réservé au plan Pro
 *     tags: [Rapports]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Fichier .xlsx à télécharger.
 *         content: { application/vnd.openxmlformats-officedocument.spreadsheetml.sheet: { schema: { type: string, format: binary } } }
 *       403: { description: Fonctionnalité réservée au plan Pro., content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.get('/export-excel', async (req, res, next) => {
  try {
    const [[userRow]] = await pool.query('SELECT plan FROM users WHERE id = ?', [req.tenantId]);
    if (!isProPlan(userRow?.plan)) {
      return res.status(403).json({ error: "L'export Excel est réservé au plan Pro. Passez à un plan payant dans Paramètres.", code: 'FONCTIONNALITE_PRO' });
    }

    const { from, to } = req.query;
    const groupBy = req.query.group_by || 'month';

    const ventes = await fetchVentes(req.tenantId, req.query);

    const dateFilterD = [];
    const paramsD = [req.tenantId];
    if (from) { dateFilterD.push('date_depense >= ?'); paramsD.push(from); }
    if (to) { dateFilterD.push('date_depense <= ?'); paramsD.push(to); }
    const whereD = dateFilterD.length ? ' AND ' + dateFilterD.join(' AND ') : '';
    const [depenses] = await pool.query(
      `SELECT libelle, categorie, date_depense, montant FROM depenses WHERE user_id = ? ${whereD} ORDER BY date_depense DESC`,
      paramsD
    );

    const isProduit = groupBy === 'produit';
    const venteHeader = isProduit ? ['Produit', 'Quantité', 'Total'] : ['Période / Client', 'Factures', 'Total'];
    const venteRows = ventes.map(r => isProduit ? [r.label, r.quantite, r.total] : [r.label, r.nb_factures, r.total]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([venteHeader, ...venteRows]), 'Ventes');
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Libellé', 'Catégorie', 'Date', 'Montant'],
        ...depenses.map(d => [d.libelle, d.categorie || '', d.date_depense, d.montant])
      ]),
      'Dépenses'
    );

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="rapport-samafacture.xlsx"');
    res.send(buffer);
  } catch (err) { next(err); }
});


// GET /api/rapports/comptabilite?from=&to=
/**
 * @openapi
 * /rapports/comptabilite:
 *   get:
 *     summary: Résumé comptable (recettes, dépenses, bénéfice, TVA collectée) sur une période
 *     tags: [Rapports]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: Résumé chiffré de la période. }
 */
router.get('/comptabilite', async (req, res, next) => {
  try {
    const userId = req.tenantId;
    const { from, to } = req.query;

    const dateFilterF = [];
    const paramsF = [userId];
    if (from) { dateFilterF.push('date_emission >= ?'); paramsF.push(from); }
    if (to) { dateFilterF.push('date_emission <= ?'); paramsF.push(to); }
    const whereF = dateFilterF.length ? ' AND ' + dateFilterF.join(' AND ') : '';

    const dateFilterD = [];
    const paramsD = [userId];
    if (from) { dateFilterD.push('date_depense >= ?'); paramsD.push(from); }
    if (to) { dateFilterD.push('date_depense <= ?'); paramsD.push(to); }
    const whereD = dateFilterD.length ? ' AND ' + dateFilterD.join(' AND ') : '';

    const [
      [[{ total: recettes }]],
      [[{ total: tvaCollectee }]],
      [[{ total: totalDepenses }]],
      [depensesParCategorie]
    ] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(montant_paye),0) as total FROM factures WHERE user_id = ? AND type = 'facture' ${whereF}`, paramsF),
      pool.query(`SELECT COALESCE(SUM(total_tva),0) as total FROM factures WHERE user_id = ? AND type = 'facture' ${whereF}`, paramsF),
      pool.query(`SELECT COALESCE(SUM(montant),0) as total FROM depenses WHERE user_id = ? ${whereD}`, paramsD),
      pool.query(
        `SELECT COALESCE(categorie, 'Autre') as categorie, COALESCE(SUM(montant),0) as total
         FROM depenses WHERE user_id = ? ${whereD} GROUP BY categorie ORDER BY total DESC`,
        paramsD
      )
    ]);

    res.json({
      recettes,
      depenses: totalDepenses,
      benefice: recettes - totalDepenses,
      tva_collectee: tvaCollectee,
      depenses_par_categorie: depensesParCategorie
    });
  } catch (err) { next(err); }
});

module.exports = router;
