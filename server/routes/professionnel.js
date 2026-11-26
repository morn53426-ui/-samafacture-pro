const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { resolveTenant, requirePermission } = require('../middleware/tenant');

// Routes /api/pro — découpées par domaine dans ./professionnel/.
// L'ordre d'enregistrement ci-dessous reproduit l'ordre historique du fichier unique.
const router = express.Router();
router.use(requireAuth, resolveTenant, requirePermission);

require('./professionnel/sales-team')(router);
require('./professionnel/company-group')(router);
require('./professionnel/operations')(router);
require('./professionnel/accounting-crm')(router);

module.exports = router;
