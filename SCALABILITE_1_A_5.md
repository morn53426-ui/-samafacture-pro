# Priorités 1 à 5 — mise à niveau scalabilité

## 1. Dépendances reproductibles
Tentative de génération de `server/package-lock.json` effectuée avec npm, mais le registre npm n'était pas accessible dans l'environnement de build. Aucun faux lockfile n'a été fabriqué. Le Dockerfile conserve un fallback `npm install` tant que le lockfile réel n'est pas généré.

À faire sur une machine avec accès npm : `cd server && npm install`, puis versionner `server/package-lock.json` et passer le build Docker à `npm ci --omit=dev`.

## 2. Test de charge métier
`load/k6-10000.js` authentifie un compte de test ou utilise un JWT fourni et exerce plusieurs endpoints réels. Le scénario monte progressivement jusqu'à 10 000 VU avec seuils p95/p99 et taux d'erreur.

## 3. Validation progressive de charge
Le scénario documente une progression 100 → 500 → 1 000 → 5 000 → 10 000 VU. Les métriques à mesurer sont documentées dans `load/README.md`.

## 4. PDF asynchrone
Ajout d'une file Redis et d'un worker PDF séparé. Les routes `POST /api/factures/:id/pdf/async`, `GET /api/factures/:id/pdf/jobs/:jobId` et `GET /api/factures/:id/pdf/jobs/:jobId/download` permettent de délester la génération lourde. La route PDF synchrone existante est conservée pour compatibilité.

Les fichiers PDF de jobs utilisent un volume Docker partagé sur un hôte unique. Pour une architecture multi-nœuds, remplacer ce stockage par S3/MinIO ou un stockage objet partagé avant de répartir les workers sur plusieurs machines.

## 5. Dimensionnement
Les valeurs de production sont désormais explicitement configurables : `WEB_CONCURRENCY` et `DB_POOL_SIZE`. Les valeurs par défaut du compose sont volontairement modestes (2 workers et 10 connexions par worker) pour éviter une explosion du nombre de connexions MySQL. Le dimensionnement final doit respecter : nombre de conteneurs × workers × pool <= capacité MySQL, avec marge pour les tâches d'administration et workers.

### Architecture cible
Nginx → plusieurs instances API → Redis partagé → MySQL → workers PDF. Les API restent stateless autant que possible.
