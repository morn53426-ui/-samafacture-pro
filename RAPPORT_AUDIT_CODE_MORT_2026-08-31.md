# Rapport d'audit — code mort, bugs et régressions

Date : 31 août 2026
Périmètre : `server/`, `load/`, `scripts/`, `test-scalabilite.sh`, documentation racine.

## Méthode

Aucune installation réseau n'étant possible dans cet environnement (pas d'accès registre
npm), l'audit s'est appuyé sur de l'analyse statique exhaustive plutôt que sur l'exécution
de `npm test` :

- `node --check` sur l'intégralité des fichiers `.js` du dépôt (147 fichiers, hors
  `node_modules`) ;
- `bash -n` sur les scripts shell ;
- recherche de marqueurs de code mort (`TODO`/`FIXME`/`XXX`/`HACK`, `debugger`,
  `console.log` de débogage) ;
- détection des imports (`require`) jamais réutilisés dans leur fichier ;
- détection des exports (`module.exports.xxx`) jamais référencés depuis un autre fichier
  du dépôt ;
- détection des routes dupliquées par routeur ;
- relecture croisée des rapports d'audit précédents (`RAPPORT_AUDIT_FINAL_2026-08-31.md`,
  `RAPPORT_AUDIT_FINAL_CORRECTIONS_2026-08-31.md`) pour ne pas re-signaler un problème déjà
  corrigé, et vérification que leurs correctifs sont toujours en place dans le code actuel.

## Résultat global

Le dépôt est propre : aucune erreur de syntaxe, aucun import inutilisé, aucune route
dupliquée, aucun marqueur `TODO`/`FIXME`, aucun `console.log` de débogage oublié (tous les
`console.log` restants sont des journaux opérationnels intentionnels — sauvegarde,
planificateur, démarrage serveur, etc.). Les tournées d'audit précédentes avaient déjà
traité l'essentiel des problèmes structurels (dashboard, `/api/health` vs `/api/ready`,
migration `facture_personnalisation`).

Deux éléments ont été trouvés et corrigés :

### 1. Code mort — `invalidateDashboardCache` (bug/dette réel)

`server/routes/dashboard.js` exportait une fonction `invalidateDashboardCache(userId)`,
introduite lors d'un audit précédent « pour une intégration future avec les routes
mutantes », mais **jamais importée ni appelée nulle part** dans le dépôt (vérifié par
recherche croisée sur tous les fichiers `.js` de `server/`, y compris les tests).

**Correction : supprimée.** Le cache dashboard reste protégé par son TTL très court
(1000 ms par défaut, 250 ms minimum, configurable via `DASHBOARD_CACHE_TTL_MS`) — un choix
de conception déjà documenté et assumé dans le fichier (« cache très court... les données
métier restent fraîches »). Garder une fonction d'invalidation manuelle non branchée
n'apportait rien et créait une fausse impression de mécanisme actif. Si une invalidation
immédiate après écriture (facture, paiement, client, dépense) devient un besoin réel, elle
devra être ajoutée et branchée explicitement dans les routes concernées, avec ses propres
tests — pas laissée comme fonction orpheline.

### 2. Documentation obsolète et contradictoire — `ETAPES_30_A_41_WIP.md`

Ce fichier affirmait encore, à l'Étape 30, que « `/api/health` » restait « une sonde DB »,
ce qui **contredit directement** :

- le code réel (`server/app.js`, ligne ~340) : `/api/health` ne fait aucune requête SQL ;
- `RAPPORT_AUDIT_FINAL_2026-08-31.md` §2.2, qui documente explicitement la séparation
  liveness (`/api/health`, sans DB) / readiness (`/api/ready`, avec DB + Redis).

C'était une note de suivi restée non mise à jour après un correctif ultérieur — pas une
régression du code lui-même, mais un risque réel de confusion pour quiconque relirait ce
fichier pour comprendre le comportement actuel.

**Correction : la note a été mise à jour** pour refléter le comportement réel et renvoyer
vers la documentation faisant foi.

## Ce qui a été vérifié et jugé correct (aucune action nécessaire)

- **Rate limiting `/api/health`** : deux prédicats de filtrage différents existent
  (`req.path === '/api/health'` dans le logger `morgan`, monté à la racine ; puis
  `req.path === '/health' || req.originalUrl === '/api/health'` dans `apiLimiter`, monté
  sur `/api/`). Ce n'est pas une incohérence : chaque middleware est monté à un niveau
  différent, donc `req.path` a une valeur différente à cet endroit précis de la chaîne. Le
  second prédicat inclut une vérification de secours sur `originalUrl`, ce qui est une
  défense supplémentaire correcte, pas un bug.
- **Fichiers `migration_*.sql` à la racine** : redondants en apparence avec les migrations
  automatiques de `server/config/db.js`, mais explicitement documentés comme des copies à
  usage manuel pour les équipes qui gèrent leurs migrations SQL séparément de l'application.
  Ce n'est pas du code mort — comportement voulu et déjà expliqué en tête de chaque fichier.
- **Gestion des erreurs de saturation du pool MySQL** (`isPoolSaturationError` /
  503 + `Retry-After` dans `server/app.js`) : toujours en place, cohérente avec le
  correctif précédent et avec `RAPPORT_CORRECTION_ERR_INVALID_URL_2026-08-31.md`.

## Limite de cet audit

La suite `npm test` (tests d'intégration `supertest` contre une vraie base MySQL) n'a pas
pu être exécutée dans cet environnement isolé, faute d'accès réseau pour installer les
dépendances et d'une instance MySQL disponible. L'audit livré ici est donc **statique** :
syntaxe, cohérence du code, code mort, cohérence documentaire. Avant mise en production,
exécutez sur votre machine :

```bash
cd server
npm install
npm test
```

puis, depuis la racine :

```bash
bash test-scalabilite.sh
```

## Fichiers modifiés dans ce correctif

- `server/routes/dashboard.js` — suppression de la fonction morte `invalidateDashboardCache`
  et de son export.
- `ETAPES_30_A_41_WIP.md` — correction de la note obsolète sur `/api/health`.
