const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { pool } = require('../config/db');

const router = express.Router();
const PAGE_PATHS = new Set([
  '/', '/index.html', '/login.html', '/register.html', '/dashboard.html', '/abonnement.html', '/abonnement-retour.html', '/achats.html', '/aide.html', '/assistant-ia.html', '/automatisations.html', '/clients.html', '/comptabilite.html', '/conditions.html', '/confidentialite.html', '/consulter.html', '/crm.html', '/depenses.html', '/devis.html', '/facture-detail.html', '/facture-ia.html', '/factures-recurrentes.html', '/factures.html', '/finances.html', '/groupe-entreprise.html', '/internationalisation.html', '/invitation.html', '/login.html', '/mot-de-passe-oublie.html', '/nouvelle-facture.html', '/paiement-retour.html', '/paiement.html', '/paiements-professionnels.html', '/parametres.html', '/portail-client.html', '/produits.html', '/professionnel.html', '/rapports.html', '/reinitialiser-mot-de-passe.html', '/support.html', '/verifier.html'
]);
const pageviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 120,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Trop de mesures de fréquentation. Réessayez plus tard.' }
});

router.post('/pageview', pageviewLimiter, async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const requestedPath = typeof body.page_path === 'string' ? body.page_path : '';
    if (!/^[a-f0-9-]{32,80}$/i.test(sessionId)) {
      return res.status(400).json({ error: 'Identifiant de session invalide.' });
    }
    if (requestedPath.length > 120 || requestedPath.includes('?') || requestedPath.includes('#') ||
        !PAGE_PATHS.has(requestedPath) || requestedPath === '/admin.html') {
      return res.status(400).json({ error: 'Chemin de page invalide.' });
    }

    const secret = process.env.SUNUPILOT_ANALYTICS_HASH_SECRET || process.env.JWT_SECRET || '';
    if (!secret && process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'Mesure de fréquentation indisponible.' });
    }
    const visitorHash = crypto.createHmac('sha256', secret || 'sunupilot-development-analytics-only')
      .update(sessionId).digest('hex');
    await pool.query(
      'INSERT INTO sunupilot_analytics_pageviews (visitor_hash, page_path, created_at) VALUES (?, ?, UTC_TIMESTAMP())',
      [visitorHash, requestedPath]
    );
    return res.status(202).json({ recorded: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
