require('dotenv').config();
const { ensureJwtSecret } = require('./config/secrets');
try {
  ensureJwtSecret();
} catch (err) {
  // Échec volontaire et immédiat (voir server/config/secrets.js) : un message clair plutôt
  // qu'une pile d'appels brute, mais le serveur s'arrête bien avant d'écouter le moindre port.
  console.error(`\n❌ Démarrage impossible : ${err.message}\n`);
  process.exit(1);
}
const { initMonitoring, captureException } = require('./config/monitoring');
const Sentry = initMonitoring();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const path = require('path');
const http = require('http');
const cluster = require('cluster');

const { initDatabase, pool } = require('./config/db');
const { initSocket, closeSocket } = require('./realtime');
const { initRedis, closeRedis, getRedisClient, isRedisConfigured } = require('./config/redis');
const { closeBrowser } = require('./utils/pdf');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const authRoutes = require('./routes/auth');
const clientsRoutes = require('./routes/clients');
const produitsRoutes = require('./routes/produits');
const facturesRoutes = require('./routes/factures');
const dashboardRoutes = require('./routes/dashboard');
const depensesRoutes = require('./routes/depenses');
const rapportsRoutes = require('./routes/rapports');
const facturesRecurrentesRoutes = require('./routes/factures-recurrentes');
const publicRoutes = require('./routes/public');
const abonnementRoutes = require('./routes/abonnement');
const assistantRoutes = require('./routes/assistant');
const professionnelRoutes = require('./routes/professionnel');
const { startScheduler } = require('./config/scheduler');
const { startBackupScheduler } = require('./config/backup');
const { getRuntimeConfig, validateProductionConfig } = require('./config/runtime');
const crypto = require('crypto');

validateProductionConfig();
const runtimeConfig = getRuntimeConfig();

const app = express();

// Identifiant de requête : facilite le diagnostic distribué (Nginx -> Node -> MySQL/Redis)
// sans stocker de données sensibles. Le client peut réutiliser X-Request-Id ; on le limite
// à un UUID généré par le serveur pour éviter l'injection de valeurs arbitraires dans les logs.
app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

// Sentry v8 (@sentry/node) n'utilise plus l'ancienne API Sentry.Handlers.requestHandler() /
// errorHandler() (supprimée depuis la v7) : le suivi des requêtes est maintenant automatique
// dès lors que Sentry.init() est appelé avant que 'express' soit chargé (c'est le cas ici,
// initMonitoring() s'exécute avant le require('express') plus bas). Il ne reste donc qu'à
// brancher le gestionnaire d'erreurs Express dédié, plus bas juste avant notre propre
// middleware d'erreurs — voir la section "Gestion des erreurs" en fin de fichier.

// Nécessaire si l'app tourne derrière un reverse proxy / load balancer (Nginx, etc.) en
// production, pour que req.ip (utilisé par les limiteurs de requêtes) reflète la vraie
// adresse du visiteur plutôt que celle du proxy.
if (process.env.TRUST_PROXY) app.set('trust proxy', 1);

app.use(compression()); // compresse les réponses (gzip/brotli) : bande passante et temps de réponse réduits

// Journal des requêtes HTTP (méthode, chemin, statut, temps de réponse) — utile pour le
// diagnostic en production et pour repérer une dérive de performance. Désactivé pendant
// les tests automatisés (bruit inutile dans la sortie de `npm test`) et ignore délibérément
// /api/health, appelé très fréquemment par les sondes de supervision (uptime monitor,
// load balancer), pour ne pas noyer les vrais logs applicatifs. Format "combined" en
// production (inclut IP et user-agent, exploitable par un agrégateur de logs), "dev" en
// développement (concis, coloré, plus lisible dans un terminal).
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    skip: (req) => req.path === '/api/health'
  }));
}

// En-têtes de sécurité HTTP (équivalent minimal de "helmet", sans dépendance
// supplémentaire) : empêche le MIME-sniffing, le clickjacking (chargement de l'app dans
// une <iframe> tierce), désactive certaines API navigateur sensibles, et force HTTPS en
// production. N'affecte aucune fonctionnalité existante — uniquement des en-têtes de
// réponse en plus.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  // Content-Security-Policy — voir AUDIT_PRODUCTION.md §2.4 et SECURITY_REPORT.md pour le détail
  // des choix ci-dessous. Autorise explicitement les 3 origines externes réellement chargées par
  // le frontend (Google Identity, et les deux CDN de secours de public/js/chart-loader.js pour
  // Chart.js) — tout le reste est bloqué par défaut (default-src 'self').
  //
  // ⚠️ 'unsafe-inline' reste nécessaire pour script-src ET style-src : le frontend actuel repose
  // massivement sur des <script> inline par page et des attributs onclick="..."/style="..." (voir
  // SECURITY_REPORT.md) — les retirer casserait l'interactivité de la quasi-totalité des pages.
  // Cette CSP bloque déjà l'essentiel des scénarios d'exploitation réels (chargement de script
  // depuis un domaine tiers non listé, cadrage dans une <iframe>, <object>/<embed>, changement de
  // <base href>) ; le verrouillage complet de script-src est documenté comme prochaine étape dans
  // SECURITY_REPORT.md plutôt que fait ici en une fois, ce qui casserait l'application.
  //
  // Exclue de /api/docs : swagger-ui-express charge ses propres assets d'une façon que je n'ai
  // pas pu vérifier dans cet environnement (pas de navigateur) — outil de documentation interne,
  // pas de risque à le laisser hors de cette politique plutôt que de deviner et casser la page.
  if (!req.path.startsWith('/api/docs')) {
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://accounts.google.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      // cdnjs.cloudflare.com est ajouté ici (en plus de script-src) car le navigateur récupère
      // le sourcemap (.js.map) de socket.io.min.js via une requête soumise à connect-src, pas
      // script-src — sans cette origine, DevTools loggue une erreur CSP bloquant ce fichier
      // (inoffensif fonctionnellement, mais source de faux positifs lors d'un audit console).
      "connect-src 'self' https://accounts.google.com https://cdnjs.cloudflare.com",
      "frame-src https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; '));
  }
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// CORS : en production, restreint aux origines listées dans ALLOWED_ORIGINS (séparées par
// des virgules dans .env, ex: "https://samafacturepro.com,https://www.samafacturepro.com").
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && allowedOrigins.length === 0) {
  // Avant : ce cas laissait l'API ouverte à toute origine (comportement par défaut du
  // package cors) — un simple avertissement au démarrage suffisait à documenter le risque
  // mais ne le corrigeait pas. Corrigé : sans ALLOWED_ORIGINS renseigné, on bascule sur un
  // repli restrictif ci-dessous (origine explicite obligatoire) plutôt que de rester grand
  // ouvert par défaut. Sans impact sur l'usage normal : le frontend est servi par ce même
  // serveur Express (voir express.static plus bas), donc les requêtes de l'app elle-même
  // sont same-origin (aucun en-tête Origin envoyé par le navigateur) et passent toujours.
  // Seuls des appels API cross-origin depuis un autre domaine, non prévus par défaut,
  // seraient désormais bloqués — exactement le comportement attendu en production.
  console.warn(
    '⚠️  ALLOWED_ORIGINS n\'est pas défini alors que NODE_ENV=production : par sécurité, ' +
    'l\'API refuse désormais toute requête cross-origin tant que cette variable n\'est pas ' +
    'renseignée (les requêtes same-origin, ex: le frontend servi par cette même app, ' +
    'continuent de fonctionner normalement). Définissez ALLOWED_ORIGINS dans .env ' +
    '(ex: https://votredomaine.com) pour autoriser explicitement d\'autres origines si besoin.'
  );
}
// hasOriginPolicy : dès qu'une politique doit s'appliquer — soit une liste explicite, soit
// le repli restrictif de production ci-dessus — on passe un validateur à `cors()` plutôt que
// de le laisser ouvert par défaut (undefined = tout autoriser, réservé au développement local
// sans NODE_ENV=production et sans ALLOWED_ORIGINS, pour ne pas gêner les tests locaux).
const hasOriginPolicy = allowedOrigins.length > 0 || isProduction;
app.use(cors(hasOriginPolicy ? {
  origin(origin, callback) {
    // origin est undefined pour les requêtes sans en-tête Origin (ex: curl, apps mobiles,
    // requêtes same-origin) — on les laisse toujours passer.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Origine non autorisée par la politique CORS.'));
  }
} : undefined));
// { verify: ... } conserve le corps brut de la requête (req.rawBody), nécessaire pour
// vérifier la signature HMAC du webhook Wave — un JSON ré-encodé ne donnerait pas
// forcément les mêmes octets que ce que Wave a signé.
app.use(express.json({ limit: '7mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
// PayDunya envoie ses notifications IPN en application/x-www-form-urlencoded.
app.use(express.urlencoded({ extended: true }));

// Lecture du cookie de session HttpOnly (voir server/routes/auth.js, definirCookieSession) —
// analyseur minimal volontairement écrit à la main plutôt que d'ajouter la dépendance
// "cookie-parser" : server/package-lock.json est déjà signalé absent dans
// AUDIT_PRODUCTION.md §1.1, ajouter une dépendance de plus qui n'y figure pas aggraverait ce
// problème plutôt que de le régler. N'écrit rien (res.cookie()/res.clearCookie() sont fournis
// nativement par Express) — uniquement la lecture de req.cookies.
app.use((req, res, next) => {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    for (const part of header.split(';')) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      const name = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (!name) continue;
      try {
        req.cookies[name] = decodeURIComponent(value);
      } catch {
        req.cookies[name] = value;
      }
    }
  }
  next();
});

// Limite générale de requêtes API par adresse IP, en plus des limiteurs spécifiques déjà
// en place sur l'authentification — protège le serveur d'un usage abusif ou d'un bug
// client qui bouclerait sur un appel API, sans gêner un usage normal même intensif.
// /api/health est exclu : c'est une sonde de supervision (Docker healthcheck — voir
// Dockerfile —, load balancer, uptime monitor), appelée très fréquemment et depuis
// plusieurs origines qui partagent souvent la même IP source (plusieurs sondes derrière le
// même reverse proxy). La limiter comme un endpoint métier normal risquait de la faire
// répondre 429 sous forte charge — Docker aurait alors cru le conteneur en panne et l'aurait
// redémarré, un vrai risque de disponibilité confirmé par test de charge (voir
// AMELIORATIONS_SCALABILITE.md §7 — non2xx proche de 100% sur /api/health à 10+ connexions
// simultanées avant ce correctif).
const apiLimiter = rateLimit({
  ...(isRedisConfigured() ? (() => {
    try {
      const { RedisStore } = require('rate-limit-redis');
      const redisClient = getRedisClient();
      return { store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) }) };
    } catch (err) {
      console.warn('⚠️ rate-limit-redis indisponible : limitation locale utilisée.', err.message);
      return {};
    }
  })() : {}),
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Veuillez ralentir.' },
  skip: (req) => req.path === '/health' || req.originalUrl === '/api/health',
  // Compte par utilisateur authentifié (identifiant du jeton) plutôt que par adresse IP quand
  // un jeton valide est présent — voir AMELIORATIONS_SCALABILITE.md §7. Avec un comptage par IP,
  // toute une équipe derrière la même connexion (bureau, NAT partagé — un cas courant pour une
  // petite entreprise) se partageait un seul quota de 300 requêtes/minute à eux tous, alors que
  // chacun devrait avoir le sien. Repli sur l'IP (comportement identique à avant) pour tout
  // visiteur sans jeton valide — connexion, inscription, consultation publique d'une facture...
  //
  // Vérification complète du jeton (jwt.verify), pas un simple décodage : un jeton signé avec
  // une clé différente ou modifié serait sinon un moyen facile d'épuiser le quota d'un autre
  // utilisateur (il suffirait de connaître/deviner son identifiant numérique et de le placer
  // dans un jeton non vérifié) plutôt que le sien propre.
  keyGenerator: (req) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        return `user:${payload.id}`;
      } catch {
        // Jeton absent/invalide/expiré : repli sur l'IP, comme avant ce changement.
      }
    }
    return req.ip;
  }
});
app.use('/api/', apiLimiter);

// API
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/produits', produitsRoutes);
app.use('/api/factures', facturesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/depenses', depensesRoutes);
app.use('/api/rapports', rapportsRoutes);
app.use('/api/factures-recurrentes', facturesRecurrentesRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/abonnement', abonnementRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/pro', professionnelRoutes);

// Documentation interactive de l'API (générée depuis les commentaires @openapi des
// routes). Sécurisée par défaut en production : contrairement à avant (activée par défaut,
// désactivable via DISABLE_API_DOCS=true — un oubli de configuration la laissait exposée
// publiquement), elle est désormais désactivée par défaut dès que NODE_ENV=production, et
// ne peut être réactivée qu'explicitement avec ENABLE_API_DOCS=true (ex: pour une API
// interne/partenaire où l'exposer publiquement est un choix assumé). En développement, elle
// reste activée par défaut comme avant (désactivable avec DISABLE_API_DOCS=true si besoin).
// Dans tous les cas, l'interface "Essayer" exige un vrai jeton JWT valide, elle ne permet
// donc à personne d'agir à votre place sans être déjà authentifié — mais exposer la simple
// description des routes (schémas, endpoints internes) à n'importe qui sur Internet n'a pas
// de raison d'être le comportement par défaut en production.
const docsActivesParDefaut = process.env.NODE_ENV === 'production'
  ? process.env.ENABLE_API_DOCS === 'true'
  : process.env.DISABLE_API_DOCS !== 'true';
if (docsActivesParDefaut) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'SamaFacture Pro — Documentation API'
  }));
}

// SEO : robots.txt et sitemap.xml générés à partir d'APP_URL, pour toujours pointer vers
// le bon domaine (localhost en dev, votre nom de domaine en production) sans fichier à
// modifier manuellement. Seules les pages publiques sont indexables — le reste de
// l'application nécessite une connexion, donc inutile (et non souhaitable) à indexer.
const PUBLIC_PAGES = ['/', '/login.html', '/register.html', '/confidentialite.html', '/conditions.html', '/aide.html', '/support.html'];

app.get('/robots.txt', (req, res) => {
  const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  res.type('text/plain').send(
    `User-agent: *\n` +
    `Allow: /\n` +
    `Disallow: /api/\n` +
    `Disallow: /dashboard.html\n` +
    `Disallow: /clients.html\n` +
    `Disallow: /produits.html\n` +
    `Disallow: /factures.html\n` +
    `Disallow: /devis.html\n` +
    `Disallow: /nouvelle-facture.html\n` +
    `Disallow: /facture-detail.html\n` +
    `Disallow: /depenses.html\n` +
    `Disallow: /rapports.html\n` +
    `Disallow: /parametres.html\n` +
    `Disallow: /mot-de-passe-oublie.html\n` +
    `Disallow: /reinitialiser-mot-de-passe.html\n` +
    `Disallow: /abonnement-retour.html\n\n` +
    `Sitemap: ${appUrl}/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', (req, res) => {
  const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const urls = PUBLIC_PAGES.map(p => `  <url><loc>${appUrl}${p}</loc></url>`).join('\n');
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
  );
});

// Liveness : doit répondre sans dépendre de MySQL. Cette route est appelée très
// fréquemment par Docker, les load balancers et les outils de supervision. Une panne ou une
// saturation MySQL ne doit pas transformer une sonde de processus en générateur de requêtes
// SQL supplémentaires, ni provoquer des 503 en cascade sous charge. La disponibilité de la
// base est testée séparément par /api/ready.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SamaFacture Pro API' });
});

// Readiness distincte de la santé : utilisée par un load balancer pour ne router du trafic
// que vers une instance dont MySQL et, lorsqu'il est configuré, Redis sont disponibles.
app.get('/api/ready', async (req, res) => {
  try {
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), runtimeConfig.healthTimeoutMs))
    ]);
    if (isRedisConfigured()) {
      const redis = getRedisClient();
      if (!redis?.isReady) return res.status(503).json({ status: 'not_ready', database: 'up', redis: 'down' });
    }
    return res.json({ status: 'ready', database: 'up', ...(isRedisConfigured() ? { redis: 'up' } : {}) });
  } catch (err) {
    return res.status(503).json({ status: 'not_ready', database: 'down' });
  }
});

// Configuration publique (aucune valeur secrète) pour que le frontend sache si la
// connexion Google est disponible, sans avoir à coder l'identifiant en dur dans le HTML.
app.get('/api/config', (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null });
});

// Sert le front-end statique (public/) avec mise en cache : les fichiers versionnés par
// nom (icônes, images) peuvent être mis en cache longtemps par le navigateur, ce qui
// réduit fortement la charge serveur quand beaucoup de visiteurs reviennent sur le site.
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR, {
  // Ne pas mettre les pages HTML en cache 24h : après un déploiement, un navigateur
  // pourrait conserver une ancienne version de l'application et réintroduire un bug
  // déjà corrigé (notamment parametres.html). On cache uniquement les ressources statiques
  // lourdes et réutilisables. Le service worker reste toujours revalidé.
  maxAge: 0,
  etag: true,
  setHeaders(res, filePath) {
    const lower = filePath.toLowerCase();
    if (lower.endsWith('.html') || lower.endsWith('/sw.js')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      return;
    }
    if (/\.(?:css|js|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf)$/.test(lower)) {
      res.setHeader('Cache-Control', process.env.NODE_ENV === 'production'
        ? 'public, max-age=86400'
        : 'no-cache');
    }
  }
}));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Gestion des erreurs
// setupExpressErrorHandler (API Sentry v8) capture automatiquement les erreurs remontées
// par les routes Express et les transmet à Sentry, puis appelle next(err) — notre propre
// middleware ci-dessous continue donc de s'exécuter et de répondre au client exactement
// comme avant. Protégé par try/catch : si jamais cette fonction n'existe pas dans une
// version différente du paquet, on continue sans Sentry plutôt que de planter le serveur
// (captureException() dans le bloc suivant continue de fonctionner dans tous les cas).
if (Sentry) {
  try {
    if (typeof Sentry.setupExpressErrorHandler === 'function') {
      Sentry.setupExpressErrorHandler(app);
    }
  } catch (err) {
    console.warn('⚠️  Impossible de brancher le gestionnaire d\'erreurs Sentry :', err.message);
  }
}
// Sature-t-on le pool MySQL (connectionLimit + queueLimit dépassés) plutôt que de faire
// face à une vraie erreur applicative ? Repéré dans test-scalabilite.sh du 31/08/2026 :
// à 500/1000 connexions simultanées sur /api/dashboard, la file d'attente du pool
// (DB_QUEUE_LIMIT, 200 par défaut) déborde et mysql2 rejette avec "Queue limit reached.".
// Avant : ceci retombait dans le 500 générique ci-dessous, indiscernable d'un vrai bug côté
// client (qui devrait alors abandonner plutôt que réessayer). Un 503 + Retry-After est la
// sémantique correcte : le serveur est temporairement surchargé, réessayer plus tard a du
// sens. Ne change rien pour toute autre erreur, qui continue de recevoir un 500 comme avant.
function isPoolSaturationError(err) {
  return err?.code === 'ER_CON_COUNT_ERROR'
    || /queue limit reached/i.test(err?.message || '');
}

app.use((err, req, res, next) => {
  // Contexte minimal utile au diagnostic (méthode, chemin, utilisateur si authentifié) sans
  // aller au-delà : jamais le corps de la requête ni les en-têtes (risque de logger un mot
  // de passe, un jeton, ou une donnée client sensible par erreur).
  console.error(`[${req.requestId || '-'}] [${req.method} ${req.originalUrl}]${req.user ? ` user#${req.user.id}` : ''}`, err);
  captureException(err);
  if (isPoolSaturationError(err)) {
    res.setHeader('Retry-After', '2');
    return res.status(503).json({ error: 'Serveur temporairement surchargé, veuillez réessayer.' });
  }
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

const PORT = runtimeConfig.port;

// Filets de sécurité au niveau du processus : sous forte charge, une erreur imprévue dans
// une dépendance ou un timing async ne doit jamais planter silencieusement le serveur.
// - unhandledRejection : la plupart sont récupérables (ex: une requête réseau qui échoue
//   sans catch) — on la journalise sans arrêter le processus.
// - uncaughtException : l'état du processus n'est plus fiable après ça. On journalise puis
//   on arrête proprement ce worker ; en mode cluster (npm run start:cluster), le processus
//   principal le redémarre automatiquement sans interrompre les autres workers.
if (process.env.NODE_ENV !== 'test') {
  process.on('unhandledRejection', (reason) => {
    console.error('⚠️  Promesse rejetée non gérée :', reason);
    captureException(reason instanceof Error ? reason : new Error(String(reason)));
  });
  process.on('uncaughtException', (err) => {
    console.error('🔥 Exception non interceptée, arrêt de ce worker pour redémarrage propre :', err);
    captureException(err);
    process.exit(1);
  });
}

async function start() {
  try {
    // En production multi-instance, Redis doit être prêt avant d'accepter des requêtes :
    // rate-limit partagé + diffusion Socket.IO entre conteneurs. Sans REDIS_URL, le mode
    // local/cluster reste pleinement fonctionnel sans dépendance externe.
    if (isRedisConfigured()) await initRedis();
    await initDatabase();
    console.log('Connexion MySQL établie et schéma vérifié.');
    // En mode cluster, app.js est chargé indépendamment par CHAQUE worker (voir
    // cluster.js) : sans cette garde, les tâches planifiées (relance des factures
    // récurrentes, expiration des paiements en attente, sauvegarde mysqldump) partiraient
    // une fois par worker à chaque déclenchement — emails de relance envoyés en double/
    // triple, sauvegardes concurrentes inutiles. On ne les démarre donc que dans un seul
    // processus : le worker #1 en mode cluster, ou le process unique en mode normal
    // (npm start), où cluster.isWorker vaut toujours false.
    if (!cluster.isWorker || cluster.worker.id === 1) {
      startScheduler();
      startBackupScheduler();
    }
  } catch (err) {
    console.error('Impossible de se connecter à MySQL / initialiser la base :', err.message);
    console.error('Vérifiez que WAMPserver est démarré (icône verte) et que le fichier .env contient les bons identifiants.');
    process.exit(1);
  }

  const server = http.createServer(app);
  await initSocket(server);
  // En mode cluster (npm run start:cluster), le processus principal (cluster.js) est
  // celui qui écoute réellement sur PORT et redistribue les connexions aux workers via
  // le mécanisme "sticky" — chaque worker écoute donc un port local arbitraire (0),
  // jamais PORT directement, sous peine de conflit "port déjà utilisé" entre workers.
  const listenPort = cluster.isWorker ? 0 : PORT;
  server.listen(listenPort, () => {
    console.log(`SamaFacture Pro API démarrée sur http://localhost:${PORT}`);
  });

  // Arrêt propre : laisse les requêtes en cours se terminer et ferme le pool MySQL
  // avant de quitter, au lieu de couper brutalement des connexions actives.
  function shutdown(signal) {
    console.log(`\n${signal} reçu — arrêt propre du serveur...`);
    server.close(async () => {
      try { await closeSocket(); } catch (e) { /* déjà fermé */ }
      try { await closeBrowser(); } catch (e) { /* déjà fermé */ }
      try { await closeRedis(); } catch (e) { /* déjà fermé */ }
      try { await pool.end(); } catch (e) { /* déjà fermé */ }
      process.exit(0);
    });
    // Filet de sécurité : force l'arrêt si des connexions traînent trop longtemps.
    setTimeout(() => process.exit(1), runtimeConfig.shutdownTimeoutMs).unref();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Ne démarre le serveur (connexion MySQL, écoute du port, planificateurs) que hors du
// contexte des tests automatisés. cluster.js utilise aussi `require('./app.js')` (pas une
// exécution directe), donc on ne peut pas se fier à `require.main === module` ici — les
// tests (voir tests/) définissent NODE_ENV=test avant d'importer ce fichier pour ne
// récupérer que `app`, sans connexion réseau ni port ouvert.
if (process.env.NODE_ENV !== 'test') {
  start();
}

module.exports = { app, start };
