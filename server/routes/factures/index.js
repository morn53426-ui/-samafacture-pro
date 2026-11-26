/**
 * Index de l'API "factures/devis" (Phase 2 : découpage des routes en sous-fichiers).
 *
 * Extrait depuis routes/factures.js → sous-modules :
 *   - crud.js     : GET /, GET /:id, POST /, DELETE /:id
 *   - statut.js   : PUT /:id/statut, POST /:id/transformer-en-facture, POST /:id/dupliquer
 *   - pdf.js      : POST /:id/pdf/async, GET /:id/pdf/jobs/:jobId(+download), GET /:id/pdf
 *   - emails.js   : POST /:id/envoyer, POST /:id/relancer (+ envoyerFactureParEmail)
 *   - paiements.js: POST /:id/paiements
 *
 * Important : app.js / config/scheduler.js import '../routes/factures' ou './routes/factures' —
 * le module de ce dossier re-exporte `envoyerFactureParEmail` (ancien export du fichier extrait).
 */
const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const { resolveTenant, requirePermission } = require('../../middleware/tenant');
const { computeTotals } = require('../../utils/factures');
const {
  ajusterStockFacture,
  resoudreEntrepotFacture,
  insererLignesFacture
} = require('../../services/factures');
const { envoyerFactureParEmail } = require('./emails');

const crudRoutes = require('./crud');
const statutRoutes = require('./statut');
const pdfRoutes = require('./pdf');
const emailsRoutes = require('./emails');
const paiementsRoutes = require('./paiements');

const router = express.Router();

router.use(requireAuth, resolveTenant, requirePermission);

// Montage des sous-modules — aucun préfixe : les chemins sont déjà relatifs à /api/factures.
router.use(crudRoutes);
router.use(statutRoutes);
router.use(pdfRoutes);
router.use(emailsRoutes);
router.use(paiementsRoutes);

module.exports = router;
// Re-exports pour la compatibilité des consommateurs existants (voir app.js, config/scheduler.js).
module.exports.computeTotals = computeTotals;
module.exports.ajusterStockFacture = ajusterStockFacture;
module.exports.resoudreEntrepotFacture = resoudreEntrepotFacture;
module.exports.insererLignesFacture = insererLignesFacture;
module.exports.envoyerFactureParEmail = envoyerFactureParEmail;
