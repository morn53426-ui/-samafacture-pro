const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { resolveTenant, requirePermission } = require('../middleware/tenant');

const router = express.Router();
router.use(requireAuth, resolveTenant, requirePermission);

router.get('/:id/runs', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Automatisation invalide.' });
    const [owned] = await pool.query('SELECT id FROM pro_automations WHERE id = ? AND user_id = ?', [id, req.tenantId]);
    if (!owned.length) return res.status(404).json({ error: 'Automatisation introuvable.' });
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const [runs] = await pool.query(
      `SELECT r.id, r.client_id, c.nom AS client, r.statut, r.destinataire, r.detail, r.created_at
       FROM pro_automation_runs r
       LEFT JOIN clients c ON c.id = r.client_id AND c.user_id = r.user_id
       WHERE r.automation_id = ? AND r.user_id = ?
       ORDER BY r.created_at DESC, r.id DESC LIMIT ?`,
      [id, req.tenantId, limit]
    );
    res.json({ executions: runs });
  } catch (err) { next(err); }
});

// Prévisualisation sans effet de bord : cette route n'envoie aucun email et ne modifie
// ni la planification, ni les factures. Elle permet de contrôler la cible avant activation.
router.post('/:id/test', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(
      'SELECT id, type, nom, configuration_json, actif FROM pro_automations WHERE id = ? AND user_id = ?',
      [id, req.tenantId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Automatisation introuvable.' });
    const automation = rows[0];
    if (automation.type !== 'relance_impayes_email') {
      return res.status(400).json({ error: 'La prévisualisation est disponible pour les relances email.' });
    }
    const config = typeof automation.configuration_json === 'string'
      ? JSON.parse(automation.configuration_json || '{}')
      : (automation.configuration_json || {});
    const jours = Math.min(120, Math.max(1, Number(config.jours_retard) || 7));
    const [clients] = await pool.query(
      `SELECT c.id, c.nom, c.email, COUNT(f.id) AS nb_factures,
              SUM(f.total - f.montant_paye) AS solde
       FROM factures f
       JOIN clients c ON c.id = f.client_id AND c.user_id = f.user_id
       WHERE f.user_id = ? AND f.type = 'facture'
         AND f.statut IN ('en_attente','en_retard')
         AND f.date_echeance IS NOT NULL
         AND f.date_echeance <= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         AND f.total > f.montant_paye
       GROUP BY c.id, c.nom, c.email
       ORDER BY solde DESC LIMIT 100`,
      [req.tenantId, jours]
    );
    const recipients = clients.filter(client => !!client.email);
    res.json({
      dry_run: true,
      envoi_effectue: false,
      active: !!automation.actif,
      automation: automation.nom,
      criteres: { jours_retard_minimum: jours },
      clients_avec_retard: clients.length,
      destinataires_email: recipients.length,
      exemples: recipients.slice(0, 5).map(c => ({
        client: c.nom,
        email: c.email,
        factures: Number(c.nb_factures),
        solde: Number(c.solde || 0)
      })),
      message: 'Simulation uniquement : aucun email n’a été envoyé et aucune donnée n’a été modifiée.'
    });
  } catch (err) { next(err); }
});

module.exports = router;
