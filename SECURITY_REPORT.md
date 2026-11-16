# SECURITY_REPORT.md — Phase 3 : Sécurité critique

**Portée :** JWT_SECRET obligatoire, cookie HttpOnly progressif, CSP, en-têtes HTTP. Rien d'autre
n'a été touché (Phase 4 — API publiques/DTO — reste à faire séparément).

---

## 1. JWT_SECRET obligatoire en production

Déjà en place dans `server/config/secrets.js` (`ensureJwtSecret()`, appelée au démarrage dans
`server/app.js` et `server/cluster.js`) — vérifié à nouveau à cette occasion : le serveur lève une
exception fatale si `NODE_ENV=production` et `JWT_SECRET` absent/faible, plutôt que d'en générer un
silencieusement. Voir `AUDIT_PRODUCTION.md` §1.3 pour le détail du risque que ça corrige.

## 2. Cookie de session HttpOnly — migration progressive

**Principe : rien de cassé, rien d'obligatoire côté frontend.** Le jeton continue d'être renvoyé
dans le corps JSON exactement comme avant (`{ token, user }`) sur `/register`, `/login`, `/google`
— le frontend web (localStorage) et l'app mobile Capacitor (cross-origin, un cookie n'y
fonctionnerait de toute façon pas) continuent de fonctionner à l'identique, sans aucune
modification requise de leur côté.

En plus de ça, un cookie `sf_token` est maintenant posé automatiquement à chaque connexion :
- `HttpOnly` — inaccessible à tout JavaScript (donc à une éventuelle faille XSS), contrairement au
  jeton en `localStorage` aujourd'hui.
- `Secure` en production (jamais envoyé en clair).
- `SameSite=Lax`.
- Durée alignée sur `JWT_EXPIRES_IN` (7 jours par défaut, comme le jeton lui-même).

`server/middleware/auth.js` (`requireAuth`) accepte maintenant ce cookie **en repli uniquement** —
l'en-tête `Authorization` reste systématiquement prioritaire quand il est présent, donc le
comportement observable de l'application n'a pas changé aujourd'hui (le frontend envoie toujours
cet en-tête). C'est la base pour qu'une future page ou un futur client puisse s'appuyer uniquement
sur le cookie, sans que web et mobile aient besoin de migrer en même temps.

Un analyseur de cookies minimal a été écrit à la main dans `server/app.js` plutôt que d'ajouter la
dépendance `cookie-parser`, afin de limiter les dépendances nécessaires à cette migration. **Mise à
jour du 16 novembre 2026 :** `server/package-lock.json` est maintenant présent et suivi dans le
dépôt. Toute nouvelle dépendance doit être ajoutée à `server/package.json` et au lockfile via
`npm install`, puis vérifiée avec `npm ci` en CI.

Une route `POST /auth/logout` a été ajoutée pour effacer ce cookie ; `Api.clearSession()`
(`public/js/api.js`) l'appelle désormais en tâche de fond (best-effort, non bloquant — la
déconnexion locale immédiate, elle, ne dépend jamais du réseau).

### Protection CSRF ajoutée en même temps, pas après
Un cookie envoyé automatiquement par le navigateur sur toute requête — y compris déclenchée depuis
un site tiers — réintroduit un risque CSRF qui n'existait pas avec la seule authentification par
en-tête `Authorization` (noté dans `AUDIT_PRODUCTION.md` §4, "à traiter en même temps que la
migration, pas après"). Deux couches, l'une n'annulant pas l'autre :
1. `SameSite=Lax` sur le cookie lui-même.
2. Un en-tête personnalisé obligatoire (`X-Requested-With: SamaFacturePro`, envoyé
   systématiquement par `Api.request()`) pour toute requête **qui modifie des données**
   (POST/PUT/PATCH/DELETE) authentifiée **uniquement** par ce cookie — un formulaire ou une image
   forgée depuis un autre site ne peut pas ajouter cet en-tête. Les requêtes en lecture (GET) n'ont
   pas cette contrainte, un cookie seul suffit pour elles (pas d'effet de bord à protéger).

Ce mécanisme n'a aucun effet sur le trafic actuel : tant que l'en-tête `Authorization` est présent
(toujours le cas aujourd'hui), la vérification CSRF ne s'applique même pas.

## 3. Content-Security-Policy

Ajoutée dans `server/app.js`, aux côtés des en-têtes déjà en place (HSTS, X-Frame-Options,
Referrer-Policy, Permissions-Policy, Cross-Origin-Resource-Policy — tous vérifiés toujours
présents). Autorise explicitement les 3 origines externes réellement chargées par le frontend :
`accounts.google.com` (connexion Google), `cdnjs.cloudflare.com` et `cdn.jsdelivr.net` (les deux
CDN de secours de Chart.js dans `public/js/chart-loader.js`). Tout le reste est bloqué par défaut
(`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`,
`form-action 'self'`).

**Limite assumée et documentée, pas cachée :** `script-src`/`style-src` incluent `'unsafe-inline'`.
Le frontend actuel repose massivement sur des `<script>` inline par page et des attributs
`onclick="..."`/`style="..."` — les retirer aurait cassé l'interactivité de la quasi-totalité des
27 pages. Une CSP sans `'unsafe-inline'` bloquerait déjà l'essentiel des scénarios réels
(chargement de script depuis un domaine tiers non listé, cadrage dans une `<iframe>` étrangère,
`<object>`/`<embed>`, changement de `<base href>`) — le verrouillage complet de `script-src`
nécessiterait de déplacer tous les scripts inline vers des fichiers externes (avec nonce ou hash),
un chantier séparé et plus large, à ne pas faire en même temps que cette phase sans risquer de
casser l'application entière.

Exclue de `/api/docs` (documentation Swagger) : outil interne dont je n'ai pas pu vérifier
l'origine exacte des ressources chargées dans cet environnement (pas de navigateur) — mieux vaut
la laisser hors de cette politique que deviner et risquer de la casser.

## 4. Tests ajoutés

`server/tests/csrf-cookie-auth.test.js` — tests unitaires purs de `requireAuth` (sans base de
données ni serveur HTTP, seulement `jsonwebtoken`) : priorité du jeton Bearer, cookie accepté en
repli et contrôle CSRF sur les méthodes qui modifient des données. **Historique :** ces tests
n'étaient pas exécutés dans l'environnement de rédaction initial (dépendances locales absentes).
**Vérification ultérieure :** sur le commit `abf4994f57e01dd2dedefb92299fa58e82b90361`, le workflow
GitHub Actions `43859492636` a exécuté `npm ci`, `npm audit` et l'ensemble de la suite : 307 tests
réussis, 0 échec, 0 test ignoré. Ce résultat concerne ce commit précis et ne remplace pas une
vérification sur chaque nouvelle version.

## 5. Ce qui n'a pas été touché dans cette phase

- Le stockage `localStorage` côté frontend reste la méthode active aujourd'hui — c'est
  volontairement une migration *progressive* : rien n'oblige encore à en dépendre.
- `AUDIT_PRODUCTION.md` §2.1/§2.2 (fuite de `verification_code`/`reset_token_hash`) — Phase 4, pas
  celle-ci.
- CORS (`server/app.js`) n'a pas été modifié — le cookie n'est utile qu'en same-origin
  aujourd'hui (web servi par ce même serveur Express) ; l'activer en cross-origin
  (`credentials: true` + liste stricte d'origines) serait à faire seulement si un frontend séparé
  apparaît un jour.


## 6. Assainissement des journaux HTTP

Les formats Morgan par défaut (`dev` et `combined`) journalisaient l'URL complète et le
`Referer`. Cela pouvait exposer un jeton de réinitialisation présent dans une query string ou
un code de consultation publique placé dans le chemin. Le gestionnaire d'erreurs Express
journalisait également `req.originalUrl` sans filtrage.

Corrections :
- Morgan utilise désormais des jetons dédiés : les query strings sont retirées, les codes des
  routes publiques `/api/public/consulter/:id/:code` et `/api/public/verifier/:id/:code`
  ainsi que le jeton de `/api/public/paiement/:token`, sont remplacés par `[redacted]`, et le referrer est limité à son origine.
- Le journal du gestionnaire d'erreurs utilise le même assainissement.
- Le format d'accès Nginx utilise `$uri` (sans arguments), masque le dernier segment des routes
  publiques de vérification/consultation et ne journalise que l'origine du referrer.
- Des tests couvrent les jetons de réinitialisation, les codes publics, Morgan et le format Nginx.

**Limite résiduelle :** les journaux d'erreur Nginx natifs peuvent, selon le type d'erreur amont,
inclure la ligne de requête. Pour éliminer entièrement ce risque, une évolution ultérieure pourra
déplacer les codes publics hors des URL (fragment côté navigateur puis POST du code dans le corps),
tout en conservant la compatibilité des anciens liens.
