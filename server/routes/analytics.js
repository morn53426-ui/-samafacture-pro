const express = require('express');
const rateLimit = require('express-rate-limit');
const { pool } = require('../config/db');
const { PAGE_PATHS, hashVisitor } = require('../utils/sunupilot-analytics');

const router = express.Router();
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
        !PAGE_PATHS.has(requestedPath)) {
      return res.status(400).json({ error: 'Chemin de page invalide.' });
    }

    const visitorHash = hashVisitor(sessionId);
    if (!visitorHash) {
      return res.status(503).json({ error: 'Mesure de fréquentation indisponible.' });
    }
    await pool.query(
      'INSERT INTO sunupilot_analytics_pageviews (visitor_hash, page_path, created_at) VALUES (?, ?, UTC_TIMESTAMP())',
      [visitorHash, requestedPath]
    );
    res.set('Cache-Control', 'no-store');
    return res.status(202).json({ recorded: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
