const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const METHODES_SENSIBLES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const EN_TETE_ANTI_CSRF = 'x-requested-with';
const VALEUR_ANTI_CSRF = 'SamaFacturePro';

function unauthorized(res) {
  return res.status(401).json({ error: 'Session invalide, révoquée ou expirée. Veuillez vous reconnecter.' });
}

/**
 * Fabrique le middleware afin de pouvoir tester l'invalidation des sessions avec un pool
 * simulé, sans dépendre d'une base MySQL pour les tests unitaires.
 */
function createRequireAuth(database = pool) {
  return async function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;

    // Le Bearer reste prioritaire pour le web historique et les clients mobiles.
    const cookieToken = req.cookies ? req.cookies.sf_token : null;
    const token = bearerToken || cookieToken;
    const viaCookie = !bearerToken && !!cookieToken;

    if (!token) {
      return res.status(401).json({ error: 'Authentification requise.' });
    }

    if (viaCookie && METHODES_SENSIBLES.has(req.method) &&
        req.headers[EN_TETE_ANTI_CSRF] !== VALEUR_ANTI_CSRF) {
      return res.status(403).json({ error: 'Requête refusée (protection CSRF) — en-tête requis manquant.' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (_) {
      return unauthorized(res);
    }

    try {
      // Les anciens jetons, créés avant la migration, sont traités comme version 0.
      // Après déconnexion ou réinitialisation, la version stockée augmente et rend
      // immédiatement tous les anciens jetons inutilisables.
      const [rows] = await database.query(
        'SELECT token_version FROM users WHERE id = ? LIMIT 1',
        [payload.id]
      );
      if (!rows.length || Number(payload.token_version || 0) !== Number(rows[0].token_version || 0)) {
        return unauthorized(res);
      }

      req.user = payload;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

const requireAuth = createRequireAuth();

module.exports = { requireAuth, createRequireAuth };
