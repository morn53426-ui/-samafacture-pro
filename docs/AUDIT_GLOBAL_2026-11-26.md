# Audit global — SUNUPILOT (SamaFacture Pro)

**Date :** 26 novembre 2026
**Dépôt :** `morn53426-ui/-samafacture-pro` (branche `main`, HEAD `c32ed40`)
**Dossier de travail audité :** `C:\Users\HP\AppData\Local\Temp\opencode\user-repo-sesamafacture-pro`
**Auditeur :** agent OpenCode (Beam)
**Périmètre :** backend Node.js (Express/MySQL), frontend statique, mobile Capacitor, CI/CD, tests.

---

## 1. Résumé exécutif

- **Application mature et bien structurée** : ~324 fichiers, 91 fichiers de tests, 609 tests, documentation exhaustive (rapports d'audit, sécurité, scalabilité, conformité).
- **Sécurité élevée** : JWT + `token_version` en base, cookie HttpOnly + CSRF, bcrypt, jetons de réinitialisation hashés SHA-256 avec expiration 30 min, rate limiting, webhooks signés (HMAC timing-safe), CSP, non-root Docker, npm audit bloquant en CI.
- **Le refactoring en cours (Phases 1 → 3b) a introduit des régressions réelles**, toutes identifiées et corrigées pendant cet audit :
  1. **Mojibake** sur les 9 modules `routes/professionnel/*.js` : ~1 091 caractères accentués corrompus dans `team.js` (UTF-8 décodé en CP850 puis ré-encodé). Tous les messages utilisateur de l'API professionnelle étaient corrompus. **Corrigé** (réversion CP850), validation : 240/240 mots accentués restaurés vs HEAD.
  2. **Fonctions partagées non importées** après le découpage : `ensureAccountingDefaults`, `postSystemEntry`, `ACCOUNTING_SALE_MAPPING_KEYS`, `ensureDefaultWarehouse`, `normalizeAccountingCategoryKey`, `buildInvoiceAccountingLines`, `requireExpenseCorrespondence` définies dans `misc.js`, appelées depuis `team.js`/`payments.js` ; `lireGateway` (`integrations.js` → `misc.js`) ; `htmlEscape` (défini dans `team.js`, appelé dans `misc.js`) → `ReferenceError` à l'exécution (`/api/pro/accounting/config`, `/api/pro/accounting/post-invoice`). **Corrigé** par exports + imports croisés et déplacement de `htmlEscape` dans `utils/professionnel.js`.
  3. **Tests de structure cassés** : `catalogue-type`, `dashboard-regression`, `professional-reports-timezone` lisaient `routes/professionnel.js` (shim) ou `routes/factures.js` (supprimé) → ENOENT. **Corrigé** via helper `readDomainSource` (concaténation des modules).
  4. **CI lint** référençait `server/routes/factures.js` (fichier supprimé) → ESLint en échec. **Corrigé** (globs + modules professionnel).
- **Aucune régression fonctionnelle** après corrections : les suites non-BDD et DB passent avec le même ensemble d'échecs qu'avant le refactoring (uniquement les tests liés à l'absence de MySQL/mysqldump, préexistants).

---

## 2. Méthode et outils

- Inspection statique (structure, tailles, imports, duplication).
- Exécution locale avec MySQL 8.4 démarré en temporaire (port 3307, `--initialize-insecure`) et Chrome pour Puppeteer.
- Comparaison HEAD vs branche refactorisée via extraction TAP (UTF-16) et diff des suites.
- Tests exécutés :
  - 54 fichiers DB-free : **378 tests, 374 pass, 3 fail, 1 skip** (les 3 échecs = `restore-backup-safety`, préexistants, infra).
  - 4 suites de référence (dashboard, db-concurrency, reports-timezone, restore-backup) : **24 tests, 20 pass, 4 fail** — ensemble identique à HEAD.
  - `factures.test.js` : **29/29 pass**.
  - `professional-tenant.test.js` : **3/3 pass**.
  - `paiements.test.js` : **13/13 pass**.
  - `currency-lock-concurrency.test.js` : **11/11 pass**.
  - `rapports.test.js` : **7/7 pass**.
  - `catalogue-type`, `dashboard-regression`, `professional-reports-timezone` : **31/31 pass**.
  - `auth.test.js` : **18/18 pass**.
- `npm audit --omit=dev` : aucune vulnérabilité signalée (sortie vide).

---

## 3. Architecture

| Couche | Détail |
|---|---|
| Backend | `server/app.js` (Express, Helmet-like headers, CORS, rate limit Redis/IP, Sentry, Socket.IO, cluster) |
| Routes | 15 modules + 2 dossiers découpés (`routes/factures/` 6 modules, `routes/professionnel/` 9 modules) |
| Services | `services/factures.js`, `services/accounting-invoice-lifecycle.js`, `services/subscription-simulator.js` |
| Utils | 23 modules (dont `utils/factures.js`, `utils/professionnel.js`) |
| Frontend | 39 pages HTML + `public/js/*.js` (api.js, sidebar.js, facture-templates.js 113 KB) |
| Mobile | Capacitor shell (placeholder `https://votredomaine.com`) |
| Infra | Dockerfile multi-stage non-root, docker-compose, Nginx/Caddy, healthchecks, backups chiffrés |
| CI | GitHub Actions : tests MySQL+Redis, audit npm bloquant, Docker build avec contrôle de secrets, cluster smoke, recette visuelle |

**Points forts :** séparation claire, migrations versionnées (v23), GET_LOCK inter-processus, arrêt propre, rate limiting par utilisateur authentifié, CSRF double couche.

---

## 4. Bugs trouvés et corrigés

### 4.1 Mojibake (critique) — corrigé
- **Fichiers :** `server/routes/professionnel/{automations,cash,establishments,integrations,misc,orders,payments,reports,team}.js`
- **Cause :** extraction depuis `routes/professionnel.js` (UTF-8) via un outil Windows utilisant la page de codes CP850, puis ré-encodage UTF-8. Résultat : `├®` au lieu de `é`, `ÔÇö` au lieu de `—`, etc.
- **Impact :** tous les messages d'erreur et libellés utilisateur de l'API professionnelle corrompus ; assertions de tests sur les accents en échec.
- **Correction :** réversion CP850 → UTF-8 (iconv-lite) avec validation par séquences UTF-8 strictes. 9 fichiers corrigés, 0 mojibake résiduel (hors guillemets légitimes « »).
- **Validation :** 240/240 mots accentués de HEAD présents dans les modules corrigés ; tests passent.

### 4.2 Fonctions partagées non importées — corrigé
- `ensureAccountingDefaults`, `postSystemEntry`, `ACCOUNTING_SALE_MAPPING_KEYS`, `ensureDefaultWarehouse`, `normalizeAccountingCategoryKey`, `buildInvoiceAccountingLines`, `requireExpenseCorrespondence` définies dans `misc.js`, appelées depuis `team.js`/`payments.js` sans import → `ReferenceError`.
- **Correction :** exports depuis `misc.js` + imports dans `team.js` et `payments.js`.
- **Validation :** `factures.test.js` 29/29, `professional-tenant` 3/3.

### 4.3 Tests de structure cassés par le découpage — corrigé
- `catalogue-type.test.js` : `ENOENT` sur `routes/factures.js` supprimé (chargement du fichier entier en échec).
- `dashboard-regression.test.js` et `professional-reports-timezone.test.js` : lecture du shim `routes/professionnel.js`.
- **Correction :** helper `server/tests/helpers/route-source.js` qui concatène `utils/`, `services/` et `routes/<domaine>/*.js`. 31/31 pass.

### 4.4 CI lint — corrigé
- `.github/workflows/lint.yml` référençait `server/routes/factures.js` (supprimé) → ESLint en erreur. Mis à jour vers globs + modules professionnel.

### 4.5 Fonctions partagées non importées (critique) — corrigé
- Le découpage par chemins a laissé des appels cross-module sans import : `ensureAccountingDefaults`, `postSystemEntry`, `ACCOUNTING_SALE_MAPPING_KEYS`, `ensureDefaultWarehouse`, `normalizeAccountingCategoryKey`, `buildInvoiceAccountingLines`, `requireExpenseCorrespondence` (définis dans `misc.js`, appelés depuis `team.js`/`payments.js`) et `lireGateway` (`integrations.js` → `misc.js`), `htmlEscape` (défini dans `team.js`, appelé dans `misc.js`).
- **Symptôme :** `ReferenceError: ensureAccountingDefaults is not defined` sur `GET /api/pro/accounting/config` et `POST /api/pro/accounting/post-invoice`, bloquant `factures.test.js` (27/29 tests annulés).
- **Correction :** exports depuis `misc.js`/`integrations.js` + imports dans `team.js`/`payments.js`/`misc.js` ; `htmlEscape` déplacé dans `utils/professionnel.js`.
- **Validation :** `factures.test.js` 29/29, `professional-tenant` 3/3, `currency-lock-concurrency` 11/11, `rapports` 7/7, `paiements` 13/13.

---

## 5. Dette technique ouverte (non corrigée — recommandations)

### 5.1 Duplication massive des helpers (moyenne)
- 16 fonctions (`owner`, `actor`, `idOk`, `money`, `paymentTreasuryAccount`, `safeDateForUser`, `optionalText`, `optionalIsoDate`, `randomRef`, `parseJson`, `audit`, `clientOwned`, `invoiceOwned`, `parseCompanyGroupPagination`, `companyGroupPaginationMeta`, `assertEnterpriseGroupOwner`) sont **définies 9 fois** (une par module professionnel).
- `server/utils/professionnel.js` (Phase 3a) contient 7 de ces helpers mais est **mort** (0 `require`).
- **Risque :** divergence future lors d'une correction (une seule copie oubliée).
- **Recommandation :** déplacer les 16 helpers dans `utils/professionnel.js` et/ou un `services/professionnel.js`, importer partout. Effort moyen, gain élevé.

### 5.2 Modules encore monolithiques
- `team.js` : 2 332 lignes / 122 KB (comptabilité, achats, équipe, portail).
- `misc.js` : 1 266 lignes.
- Le découpage par chemins a préservé la surface (103 routes = HEAD, 0 doublon, 0 shadowing) mais pas l'équilibre.
- **Recommandation :** découper par domaine métier (compta, achats, équipe, portail, CRM).

### 5.3 Tests dépendants de MySQL
- 41/91 fichiers de tests appellent `setupTestDatabase()` → nécessitent MySQL. Sans serveur : 176 tests annulés, 75 échecs.
- **Recommandation :** fournir un `docker-compose.test.yml` (MySQL + Redis) documenté, ou faire skip propre quand `DB_HOST` absent, pour une DX locale saine.

### 5.4 Code mort / incertain
- `services/subscription-simulator.js` n'est utilisé que par son test (pas en production).
- `utils/professionnel.js` était mort jusqu'à cet audit (maintenant utilisé pour `htmlEscape`).

### 5.5 Frontend
- 204 `innerHTML` pour 133 helpers d'échappement → risque XSS résiduel sur les chemins non échappés.
- CSP en `'unsafe-inline'` (documenté, contrainte structurelle).
- `public/js/facture-templates.js` : 113 KB monolithique.
- 39 pages HTML avec JS inline.

### 5.6 Mobile
- `mobile/capacitor.config.json` pointe encore vers `https://votredomaine.com` (placeholder).

### 5.7 Politique de mots de passe
- Minimum 8 caractères (recommandé : 12). JWT 7 jours (mitigé par `token_version`).

### 5.8 `SELECT *` (101 occurrences)
- À remplacer par des colonnes explicites pour la stabilité du schéma et la performance.

---

## 6. Sécurité (points forts)

| Contrôle | État |
|---|---|
| JWT + vérification `token_version` en base | ✅ |
| Cookie `sf_token` HttpOnly, `SameSite=Lax`, `Secure` en prod | ✅ |
| CSRF par en-tête `X-Requested-With` sur méthodes sensibles | ✅ |
| bcrypt cost 10 | ✅ |
| Reset token SHA-256, expiration 30 min, usage unique | ✅ |
| Rate limit login (10) / register (20) / reset (5) par IP | ✅ |
| Rate limit global 300/min par utilisateur authentifié | ✅ |
| Webhooks Wave/PayDunya : HMAC timing-safe + tolérance 5 min | ✅ |
| PDF Puppeteer : interception des requêtes, blocage SSRF | ✅ |
| Docker : utilisateur non-root, dumb-init, healthcheck | ✅ |
| npm audit bloquant en CI (`--omit=dev`) | ✅ (0 vulnérabilité) |
| CSP + X-Frame-Options + HSTS (prod) | ✅ |
| CORS restrictif en production (ALLOWED_ORIGINS) | ✅ |
| Secrets non commités (.gitignore), JWT_SECRET obligatoire en prod | ✅ |
| Logs assainis (pas d'URL/referrer bruts) | ✅ |

---

## 7. Performance et qualité

- Pool MySQL borné (`connectionLimit`, `queueLimit`), gestion de saturation (503 + Retry-After).
- Cache dashboard court par utilisateur.
- Redis optionnel pour rate-limit et Socket.IO multi-instance.
- Migrations avec `GET_LOCK` inter-processus.
- `console.log` absent des routes (0 occurrence).
- TODO/FIXME/HACK : 0 occurrence.
- Pas de `&&` chaînés dans PowerShell (convention projet).

---

## 8. CI/CD

- Tests Node 26 + MySQL 8.0 + Redis 7.
- Docker build avec sentinelle de secrets.
- npm audit bloquant.
- Cluster smoke (2 workers).
- Recette visuelle responsive.
- ESLint ciblé (config figée 10.15.0).
- **Lint cassé par le découpage (corrigé dans cet audit).**

---

## 9. Scores

| Critère | Score |
|---|---|
| Architecture | 8/10 |
| Sécurité | 9/10 |
| Qualité du code | 6.5/10 (duplication, mojibake corrigé) |
| Tests | 8/10 |
| Documentation | 9/10 |
| Ops / déploiement | 9/10 |
| Frontend | 6.5/10 |
| Mobile | 4/10 |

---

## 10. Recommandations priorisées

1. **P0 — Commiter** les corrections de cet audit (encodage, imports croisés, tests, CI) et pousser.
2. **P1 — Dédupliquer** les 16 helpers professionnels via `utils/professionnel.js` (effort moyen).
3. **P1 — Découper** `team.js` (2 332 l.) par domaine métier.
4. **P2 — Provisionner** une base de test locale (docker-compose.test.yml) pour réduire les 176 tests annulés.
5. **P2 — Durcir** le frontend (extraction JS inline, échappement systématique, CSP stricte).
6. **P3 — Finaliser** la configuration mobile (URL de production).
7. **P3 — Renforcer** la politique de mots de passe et les colonnes explicites (remplacer `SELECT *`).

---

## 11. Modifications apportées pendant cet audit (non commitées)

- `server/routes/professionnel/*.js` (9 fichiers) : correction mojibake CP850 → UTF-8.
- `server/routes/professionnel/misc.js`, `team.js`, `payments.js` : imports/exports des fonctions partagées (ensureAccountingDefaults, postSystemEntry, ACCOUNTING_SALE_MAPPING_KEYS, ensureDefaultWarehouse, normalizeAccountingCategoryKey, buildInvoiceAccountingLines, requireExpenseCorrespondence, lireGateway, htmlEscape).
- `server/utils/professionnel.js` : ajout de `htmlEscape` (et utilisation réelle).
- `server/tests/helpers/route-source.js` : nouveau helper de lecture de sources découpées.
- `server/tests/{catalogue-type,dashboard-regression,professional-reports-timezone}.test.js` : utilisation du helper.
- `.github/workflows/lint.yml` : mise à jour des chemins pour le découpage.

**État git :** working tree modifié, aucun commit/push effectué (push déjà bloqué par le PAT fourni en session précédente — à régénérer avec scope `repo`).
