# WIP — Étapes 30 à 41 — SamaFacture Pro

## Étape 30 — Santé / readiness
- `/api/health` est une liveness probe pure : aucune requête SQL n'y est effectuée (corrigé —
  une version antérieure de cette note indiquait par erreur le contraire ; voir le code réel
  dans `server/app.js` et `RAPPORT_AUDIT_FINAL_2026-08-31.md` §2.2).
- `/api/ready` sert de readiness réelle DB + Redis lorsqu'il est configuré.
- Le benchmark distingue maintenant erreurs réseau et réponses HTTP non-2xx.

## Étape 31 — Utilisateurs virtuels distincts
- `load/k6-10000.js` accepte désormais `LOAD_TEST_TOKENS_FILE` (tableau JSON de JWT de staging).
- Un seul token reste accepté pour les tests HTTP, mais n'est pas présenté comme un test multi-utilisateurs.

## Étape 32 — Charge progressive
- Parcours progressif jusqu'à 10 000 VU conservé.
- Paliers et seuils documentés dans `load/README.md`.

## Étape 33 — Critères de réussite
- Les scénarios k6 échouent sur les seuils HTTP/latence.
- Les réponses 4xx/5xx inattendues ne sont plus masquées.

## Étape 34 — Résistance
- Ajout de `load/k6-soak.js` pour les tests longue durée.
- Objectif : détection des fuites mémoire et dérives de pool/queue.

## Étape 35 — Spike
- Ajout de `load/k6-spike.js` : 50 → 500 → 1 000 → 5 000 VU, maintien, descente et récupération.

## Étape 36 — Récupération
- Le spike test mesure explicitement le retour à la normale.
- `scripts/failover-smoke.sh` permet de vérifier le retour de readiness après récupération Redis.

## Étape 37 — Concurrence métier
- Idempotence HTTP ajoutée aux créations de factures et aux paiements de facture via `Idempotency-Key`.
- Transactions/locks métier existants conservés.

## Étape 38 — Idempotence
- Nouvelle clé facultative : aucun changement pour les clients historiques.
- Même clé + même utilisateur = replay du résultat existant, pas de seconde opération.
- Contrainte UNIQUE MySQL pour fermer la course entre deux requêtes simultanées.
- Tests dédiés ajoutés pour factures et paiements.

## Étape 39 — Failover
- Script de smoke test Redis : baseline → panne → 503 readiness → restauration → 200.
- Il ne manipule Docker automatiquement qu'avec `RUN_DOCKER_FAILOVER=true`.

## Étape 40 — Sécurité sous charge
- `load/k6-security.js` vérifie que des jetons invalides produisent 401/429 et jamais 5xx.
- Authentification, CORS, CSRF et rate limiting existants ne sont pas désactivés.

## Étape 41 — Dépendances / capacité / livrable
- `scripts/check-scalability-config.js` calcule les connexions DB estimées : instances × workers × pool + workers PDF.
- Aucune mise à jour majeure de Puppeteer/uuid/glob n'a été faite automatiquement : les upgrades signalés par npm doivent être validés avec la suite PDF complète avant changement, afin d'éviter une régression fonctionnelle.
- Le présent ZIP est un WIP ; il ne certifie pas une capacité de 10 000 utilisateurs sans exécution k6 sur l'infrastructure cible.

## Non-régression
- Aucun endpoint existant supprimé.
- `Idempotency-Key` est facultatif.
- Le comportement sans cette clé reste inchangé.
- Les protections de sécurité existantes sont conservées.
