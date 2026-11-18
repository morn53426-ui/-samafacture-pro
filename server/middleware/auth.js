const jwt = require('jsonwebtoken');
const { jetonEstValide } = require('../utils/session');

// Méthodes qui modifient un état côté serveur — précisément celles qu'une requête intersites
// forgée (CSRF) chercherait à déclencher. GET/HEAD/OPTIONS ne devraient jamais avoir d'effet de
// bord, donc pas besoin de les protéger ici.
const METHODES_SENSIBLES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// En-tête que seul du JavaScript same-origin peut poser (un <form>/<img>/<script> forgé depuis
// un autre site ne peut pas ajouter d'en-tête personnalisé à sa requête). Sert de seconde
// protection CSRF pour les requêtes authentifiées uniquement par cookie — voir plus bas et
// public/js/api.js (Api.request() l'envoie systématiquement).
const EN_TETE_ANTI_CSRF = 'x-requested-with';
// Accepte temporairement l'en-tête historique pour les anciens clients déjà déployés.
const VALEURS_ANTI_CSRF = new Set(['SunuPilot', 'OptiGest', 'SamaFacturePro']);

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;

  // Migration progressive vers un cookie HttpOnly (voir SECURITY_REPORT.md et
  // server/routes/auth.js, definirCookieSession) : l'en-tête Authorization reste la source
  // d'authentification prioritaire et inchangée — c'est toujours elle qui authentifie le
  // frontend web actuel (localStorage) et l'app mobile Capacitor (cross-origin, un cookie n'y
  // fonctionnerait pas). Le cookie sf_token n'est utilisé qu'en repli, si aucun en-tête
  // Authorization n'est fourni — ce qui ne change rien au comportement observable aujourd'hui.
  const cookieToken = req.cookies ? req.cookies.sf_token : null;
  const token = bearerToken || cookieToken;
  const viaCookie = !bearerToken && !!cookieToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }

  // Protection CSRF : contrairement à l'en-tête Authorization (qu'un site tiers ne peut pas
  // positionner), un cookie est envoyé automatiquement par le navigateur sur toute requête vers
  // ce domaine — y compris déclenchée depuis un site tiers. SameSite=Lax (voir
  // definirCookieSession) bloque déjà la plupart des cas ; ceci ajoute une seconde couche pour
  // les requêtes qui modifient des données et ne sont authentifiées que par ce cookie.
  if (viaCookie && METHODES_SENSIBLES.has(req.method) && !VALEURS_ANTI_CSRF.has(req.headers[EN_TETE_ANTI_CSRF])) {
    return res.status(403).json({ error: 'Requête refusée (protection CSRF) — en-tête requis manquant.' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Session invalide ou expirée. Veuillez vous reconnecter.' });
  }

  // Révocation : le jeton doit correspondre à la version courante du compte (voir utils/session.js).
  try {
    if (!(await jetonEstValide(payload))) {
      return res.status(401).json({ error: 'Session invalide ou expirée. Veuillez vous reconnecter.' });
    }
  } catch (err) {
    return res.status(503).json({ error: 'Service temporairement indisponible.' });
  }
  req.user = payload; // { id, email, role, nom, tv }
  next();
}

module.exports = { requireAuth };
