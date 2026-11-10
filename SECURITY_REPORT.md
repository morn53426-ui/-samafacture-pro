# SECURITY_REPORT.md — Phase 3 : Sécurité critique

**Portée :** JWT_SECRET obligatoire, cookie HttpOnly progressif, CSP, en-têtes HTTP. Rien d'autre
n'a été touché (Phase 4 — API publiques/DTO — reste à faire séparément).

---

## 1. JWT_SECRET obligatoire en production

Déjà en place dans `server/config/secrets.js` (`ensureJwtSecret()`, appelée au démarrage dans
`server/app.js` et `server/cluster.js`) — vérifié à nouveau à cette occasion : le serveur lève une
exception fatale si `NODE_ENV=production` et `JWT_SECRET` absent/faible, plutôt que d'en générer un
silencieusement. Cela empêche qu'un secret vide ou faible permette de fabriquer des jetons JWT valides.

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

Un analyseur de cookies minimal a été écrit à la main dans `server/app.js` plutôt que d'ajouter
la dépendance `cookie-parser` : le besoin est limité à la lecture du cookie `sf_token`, et le
projet dispose maintenant d'un `server/package-lock.json` utilisé pour les installations
reproductibles.

La déconnexion `POST /auth/logout` exige maintenant une session valide et incrémente
`users.token_version`. Le middleware compare cette version à celle inscrite dans chaque JWT :
les jetons Bearer et cookie émis avant la déconnexion deviennent donc invalides à la prochaine
requête. `Api.clearSession()` capture et transmet le jeton avant de vider `localStorage`, puis
termine immédiatement la déconnexion locale, même si le réseau est indisponible.

La réinitialisation de mot de passe incrémente aussi `token_version` et consomme le lien de
réinitialisation dans une mise à jour conditionnelle atomique. Les autres sessions sont ainsi
révoquées et un même lien ne peut pas être utilisé deux fois.

### Protection CSRF ajoutée en même temps, pas après
Un cookie envoyé automatiquement par le navigateur sur toute requête — y compris déclenchée depuis
un site tiers — réintroduit un risque CSRF qui n'existait pas avec la seule authentification par
en-tête `Authorization` (à traiter en même temps que toute migration vers une session par cookie). Deux couches, l'une n'annulant pas l'autre :
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

`server/tests/csrf-cookie-auth.test.js` — 6 tests unitaires purs de `requireAuth` (sans base de
données ni serveur HTTP, seulement `jsonwebtoken`) : jeton Bearer toujours prioritaire, cookie
accepté en repli, GET par cookie seul autorisé, POST par cookie seul refusé sans l'en-tête
anti-CSRF puis autorisé avec. **Validation du dépôt :** sur `main`, le workflow du 10 novembre 2026 a réussi avec
182 tests (0 échec, 0 test ignoré). Sur la branche d'audit, un workflow ultérieur a validé
206 tests (0 échec, 0 test ignoré), y compris les tests de sauvegarde, de révocation de session,
de quota multi-parcours, de confirmation de paiement, de statut payé et d'idempotence liée à la facture. Le workflow valide aussi la construction Docker, Compose et l'installation npm reproductible.

## 5. Protection des emails de récupération

En production, le service mail n'affiche plus le corps du message dans les journaux lorsqu'aucun SMTP n'est configuré. L'erreur est signalée sans enregistrer le lien de récupération. Le endpoint de mot de passe oublié conserve une réponse générique lorsque l'envoi échoue, afin de ne pas exposer l'existence d'un compte. Le mode de journalisation du contenu reste disponible uniquement en développement local.

## 6. Ce qui n'a pas été touché dans cette phase

- Le stockage `localStorage` côté frontend reste la méthode active aujourd'hui — la version
  de session est vérifiée côté serveur pour qu'un jeton volé ne reste pas accepté après
  déconnexion ou réinitialisation du mot de passe.
- Les réponses API qui retournent des objets complets (`SELECT *`) doivent continuer à être
revues pour limiter les champs exposés ; `sanitizeUser()` retire déjà les champs internes du
compte, dont `reset_token_hash`.
- CORS (`server/app.js`) n'a pas été modifié — le cookie n'est utile qu'en same-origin
  aujourd'hui (web servi par ce même serveur Express) ; l'activer en cross-origin
  (`credentials: true` + liste stricte d'origines) serait à faire seulement si un frontend séparé
  apparaît un jour.
