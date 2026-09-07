# Rapport de correction — ERR_INVALID_URL sur /api/health (test-scalabilite.sh)

Date : 31 août 2026

## Symptôme

Dans l'étape 3 (« Tests de charge liveness ») de `test-scalabilite.sh`, **100 % des
requêtes** vers `/api/health` échouaient, à tous les paliers (10 à 1000 connexions),
avec :

```
Détail des erreurs   : ERR_INVALID_URL:497
Codes HTTP           : aucun
```

Alors que la même commande `curl -sf "$API_URL/api/health"` en étape 1 fonctionnait,
et que l'étape 4 (`/api/dashboard`) réussissait dans les mêmes conditions.

## Cause racine

Le terminal (`HP@DESKTOP-CTL607I MINGW64`) est **Git Bash sur Windows**. Sous
MSYS/Git Bash, toute variable d'environnement ou argument passé sur la ligne de
commande qui ressemble à un chemin POSIX absolu (`/api/health`) est **automatiquement
réécrit en chemin Windows** avant que Node ne le reçoive — par exemple
`C:/Program Files/Git/api/health`.

L'étape 3 exécute :

```bash
LOAD_ENDPOINT=/api/health ... node load/dashboard-load.js "$n"
```

`LOAD_ENDPOINT` valait donc, une fois dans Node, un chemin Windows mangé plutôt que
`/api/health`. Concaténé à `API_URL`, cela produit une URL invalide
(`http://localhost:4000C:/Program Files/Git/api/health`), d'où `ERR_INVALID_URL`
sur **chaque** requête. L'étape 4 n'était pas touchée car son chemin (`/api/dashboard`)
est une valeur par défaut codée dans `load/dashboard-load.js`, jamais transmise via une
variable d'environnement shell — donc jamais exposée à la conversion MSYS.

## Correction appliquée

- `test-scalabilite.sh` exporte désormais `MSYS_NO_PATHCONV=1` et
  `MSYS2_ARG_CONV_EXCL="*"` en tout début de script, ce qui désactive la conversion de
  chemin MSYS. Sans effet sous Linux/macOS/WSL — sûr à exporter inconditionnellement.
- `load/dashboard-load.js` valide désormais `API_URL + LOAD_ENDPOINT` avec `new URL()`
  dès le démarrage, avant de lancer le moindre worker. En cas d'URL invalide, le script
  s'arrête immédiatement avec un message explicite pointant vers cette cause (au lieu de
  laisser échouer silencieusement des milliers de requêtes individuelles avec un code
  d'erreur cryptique).

## Vérification

- `node --check load/dashboard-load.js` : OK.
- `bash -n test-scalabilite.sh` : OK.
- Reproduction ciblée : `LOAD_ENDPOINT="C:/Program Files/Git/api/health" node load/dashboard-load.js 1`
  échoue maintenant immédiatement avec un message clair, au lieu de tenter — et rater —
  des centaines de requêtes.
- Cas normal (`LOAD_ENDPOINT=/api/health`, aucune conversion) : la validation d'URL
  passe sans erreur.

## À propos des "Queue limit reached" (503) sur /api/dashboard à 250-1000 connexions

Ce comportement est **volontaire et déjà traité** par une correction précédente
(voir `server/app.js`, fonction `isPoolSaturationError`) : quand le pool MySQL
(`DB_POOL_SIZE`, 20 par défaut) et sa file d'attente (`DB_QUEUE_LIMIT`, 200 par défaut)
sont dépassés, le serveur répond `503 Retry-After: 2` plutôt qu'une erreur générique —
c'est la bonne sémantique pour un serveur temporairement surchargé.

Ce n'est donc pas un bug applicatif : c'est le test qui révèle la capacité réellement
disponible sur votre installation WAMP locale (MySQL `max_connections` par défaut ≈ 151,
pool de seulement 20 connexions). Pour que les paliers 250-1000 passent au vert :

1. Augmentez `DB_POOL_SIZE` dans `server/.env` (ex: 60), en gardant
   `DB_POOL_SIZE × nombre de workers < max_connections MySQL`.
2. Si besoin, augmentez `max_connections` côté MySQL (`my.ini` sous WAMP), puis
   redémarrez le service.
3. Augmentez `DB_QUEUE_LIMIT` en conséquence si vous voulez que les requêtes en excès
   attendent plutôt que d'être rejetées rapidement (au prix d'une latence plus élevée
   sous charge).

Voir `deploy/SCALING.md` pour la règle de calcul complète et la méthodologie de montée
en charge progressive (100 → 500 → 1000 → 5000 → 10000 VU).
