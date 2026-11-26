/**
 * Index de routes professionnelles (Phase 3b). Extrait depuis routes/professionnel.js.
 */
const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const { resolveTenant, requirePermission } = require('../../middleware/tenant');
const automationsRoutes = require('./automations');
const cashRoutes = require('./cash');
const establishmentsRoutes = require('./establishments');
const integrationsRoutes = require('./integrations');
const miscRoutes = require('./misc');
const ordersRoutes = require('./orders');
const paymentsRoutes = require('./payments');
const reportsRoutes = require('./reports');
const teamRoutes = require('./team');

const router = express.Router();
router.use(requireAuth, resolveTenant, requirePermission);
router.use(automationsRoutes);
router.use(cashRoutes);
router.use(establishmentsRoutes);
router.use(integrationsRoutes);
router.use(miscRoutes);
router.use(ordersRoutes);
router.use(paymentsRoutes);
router.use(reportsRoutes);
router.use(teamRoutes);

module.exports = router;