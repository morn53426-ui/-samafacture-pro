# Audit approfondi — SamaFacture Pro

**Date :** 16 novembre 2026  
**Base examinée :** `main` — commit `abf4994f57e01dd2dedefb92299fa58e82b90361`  
**Branche de travail :** `audit/rapport-approfondi-2026-11-16-run2`  
**Statut :** audit ciblé documenté ; un correctif de file PDF est proposé en Pull Request. Aucun changement n'a été poussé directement sur `main`.

## 1. Périmètre et méthode

Inventaire de l'arbre Git de `main`, lecture ciblée du backend, des routes, des modules de configuration, du worker PDF, des sauvegardes, de la configuration Docker, du schéma et du mécanisme de migrations, des dépendances, des tests, des workflows GitHub Actions et des Pull Requests.

L'arbre examiné contient 225 fichiers suivis, dont 38 pages HTML publiques, 15 fichiers de routes Express, 9 fichiers SQL (schéma et migrations) et 56 fichiers dont le nom évoque un test ou une spécification. Le backend est organisé autour de Node.js / Express, MySQL, Redis, Puppeteer et Socket.IO. Le frontend est livré comme fichiers statiques HTML/CSS/JavaScript : aucun manifeste npm racine ni étape de compilation frontend séparée n'a été trouvé.

L'inventaire a recensé 55 branches. Huit branches candidates ont fait l'objet d'une comparaison détaillée avec `main`. Il s'agit d'un audit ciblé, pas d'une analyse AST exhaustive de chaque ligne du dépôt.

## 2. État de la branche principale et CI

Le dernier commit `main` observé pendant cet audit est `abf4994f57e01dd2dedefb92299fa58e82b90361`.

Le workflow GitHub Actions `43859492636` sur ce commit s'est terminé avec succès le 16 novembre 2026 à 11:42 UTC. Les journaux confirment :

- validation de la configuration Docker Compose locale et de l'overlay de production ;
- construction de l'image Docker et contrôle que les fichiers `.env` de test ne sont pas intégrés à l'image ;
- installation reproductible par `npm ci` ;
- `npm audit` : 0 vulnérabilité info, low, moderate, high ou critical détectée dans l'arbre audité à cette date ;
- suite Node.js / MySQL : 307 tests réussis, 0 échec, 0 test ignoré, 47 suites ;
- démarrage de cluster et smoke test avec MySQL et Redis ;
- validation syntaxique Nginx ;
- recette visuelle : 119 captures, 7 largeurs, jeu de données extrêmes (`worst`).

Le workflow ne comporte pas de tâche ESLint ni Prettier, et le `server/package.json` ne déclare pas de scripts `lint` ou `format`. Ces contrôles sont donc **non configurés**, et non « réussis ». La CI utilise Node 26 ; le paquet annonce `node >=22.13.0`, mais aucune matrice Node 22/26 n'a été observée. Le build Docker a été exécuté ; aucun déploiement réel de production ni test de charge sur une infrastructure de production n'a été effectué.

## 3. Branches et Pull Requests

### Pull Requests

Au début de cette exécution, la seule Pull Request ouverte était la **#53 — Plan d'entreprise et stratégie commerciale**.

- La PR #53 est toujours ouverte et son workflow de tests ainsi que l'archive source ont réussi.
- Sa branche contient 2 commits propres, mais la comparaison avec le `main` actuel indique 2 commits de retard et 2 commits en avance.
- GitHub la signale comme fusionnable, mais elle n'est pas à jour avec `main`. Elle n'a donc pas été fusionnée.
- Les PR #52 (assainissement des journaux) et #54 (ordre des directives Nginx) sont déjà intégrées à `main` ; aucun nouveau travail n'a été effectué sur ces correctifs pendant cette exécution.

### Branches candidates comparées

| Branche | En avance | En retard | Décision |
|---|---:|---:|---|
| `fix/pdf-worker-db-readiness-2026-11-16` | 4 | 5 | Ne pas fusionner en bloc ; la vérification MySQL existe déjà dans `main`, et la branche diverge |
| `fix/whatsapp-country-guard-2026-11-16` | 2 | 9 | Ne pas fusionner en bloc ; les tests de refus des numéros locaux sans pays sont déjà présents sur `main` |
| `audit/visual-viewport-offset-regression-20261116` | 1 | 6 | Changement limité à la recette visuelle, pas de correctif applicatif supplémentaire identifié |
| `fix/backup-retention-guard-2026-11-16` | 19 | 10 | Ne pas fusionner sans revue dédiée : modifications étendues de restauration et de sauvegarde |
| `fix/invoice-settlement-integrity-2026-11-15` | 4 | 28 | Ne pas fusionner sans revue métier approfondie : modifications importantes du calcul/règlement des factures |
| `security/immediate-session-revocation-2026-11-16` | 2 | 12 | Ne pas fusionner en bloc ; le contrôle de version des jetons et ses tests sont déjà présents sur `main` |
| `feat/professional-subscription-page-2026-11-15` | 4 | 68 | Branche trop ancienne et divergente pour une fusion sûre |
| `audit/npm-audit-gate-2026-11-16` | 0 | 3 | Aucun commit propre restant |

### Protection de `main`

L'API de liste des branches renvoie `protected=false` pour `main`, et l'API des rulesets renvoie une liste vide. L'endpoint détaillé de protection de branche a refusé l'accès à l'intégration GitHub (403) ; les réglages administratifs historiques n'ont donc pas pu être inspectés. La protection effective de `main` n'est pas démontrée. Il faut configurer des règles exigeant les contrôles CI, interdisant les force-push et imposant une revue selon la politique du propriétaire du dépôt.

## 4. Anomalie corrigée dans cette branche — durée de vie des métadonnées PDF

### Cause

`server/pdf-queue.js` appliquait `JOB_TTL` au hash Redis dès la mise en file. L'élément de travail, lui, reste dans une liste Redis sans TTL. Si le worker est arrêté ou si la file attend plus longtemps que le TTL (une heure par défaut), le hash contenant notamment `userId` peut expirer alors que le travail est toujours dans la liste. Quand le worker traite ensuite l'élément, il recrée un hash avec `status` mais sans `userId`. `getPdfJob()` ne peut alors plus rattacher le résultat à son propriétaire : le PDF peut être produit mais le statut n'est plus récupérable par l'utilisateur.

### Correctif proposé

- La création du hash et l'ajout de l'élément dans la liste sont maintenant regroupés dans une transaction Redis `MULTI/EXEC`.
- Le TTL n'est plus appliqué au statut `queued`.
- Le worker conserve son comportement existant et applique le TTL après un état terminal (`completed` ou `failed`).
- Un nouveau fichier `server/tests/pdf-queue.test.js` couvre la conservation des métadonnées en attente et l'absence d'écriture partielle si la transaction échoue.

**Statut de validation :** le code et le test sont présents dans cette branche, mais le résultat de la CI de la Pull Request créée pour ce correctif doit être vérifié avant toute fusion. Aucun succès de test local n'est revendiqué pour cette exécution.

## 5. Risques résiduels importants

### P1 — Perte possible d'un travail PDF après retrait de la file

`server/workers/pdf-worker.js` consomme encore la liste avec `BLPOP`. Cette opération retire l'élément avant que le PDF soit terminé. Si le processus tombe après le retrait, l'élément n'est pas automatiquement remis en file. Les erreurs de génération sont enregistrées en `failed`, sans politique de nouvelle tentative ni file de quarantaine. Le correctif de métadonnées ci-dessus ne règle pas cette perte après `BLPOP`.

Une file avec réservation, acquittement, récupération des travaux abandonnés et gestion des doublons (ou Redis Streams / un gestionnaire de tâches éprouvé) est nécessaire. Cette évolution touche à la concurrence et à la cohérence des tâches : elle nécessite une conception séparée, des tests de crash/reprise et des tests avec plusieurs workers avant déploiement.

### P1 — Sauvegardes locales uniquement dans la configuration Compose

Le service `app` monte `app_backups` et les sauvegardes sont chiffrées si la clé de production est présente. Le volume Docker reste toutefois sur l'hôte du serveur. Une perte du VPS peut donc affecter à la fois les données et les sauvegardes. Prévoir une copie chiffrée vers un stockage indépendant et tester une restauration réelle depuis cette copie.

### P1 — Protection de la branche principale non démontrée

La liste des branches indique `protected=false` pour `main`, aucun ruleset n'est retourné et l'intégration ne peut pas lire les paramètres détaillés (403). Il faut une intervention avec les droits administratifs du dépôt pour activer et vérifier les protections.

### P1 — Paiements de plans non récurrents

`server/routes/abonnement.js` décrit explicitement des achats ponctuels en XOF. Le backend expose Wave et PayDunya ; le mode renvoyé par l'API est `paiement_unique`, avec renouvellement et expiration automatiques désactivés. Ne pas présenter Starter/Pro/Entreprise comme des abonnements mensuels automatiques tant que le cycle de vie récurrent n'est pas implémenté et testé.

### P2 — Surface XSS et migration d'authentification inachevée

Le frontend utilise encore le jeton Bearer côté navigateur et le stockage `localStorage`. Le cookie HttpOnly est accepté en repli, mais ne remplace pas encore le chemin Bearer. La CSP autorise toujours `unsafe-inline` en raison des scripts et attributs inline existants. Une migration nécessite une stratégie CSRF, une migration progressive des pages et des tests de compatibilité web/mobile ; ne pas retirer ces mécanismes en une seule modification.

### P2 — Coût de la révocation immédiate des sessions

`server/utils/session.js` relit `token_version` dans MySQL à chaque requête authentifiée pour rendre la révocation immédiatement visible entre workers. C'est cohérent fonctionnellement, mais ajoute une lecture SQL au chemin de chaque requête protégée. Mesurer la charge réelle et le budget de connexions avant d'augmenter le nombre de workers ou de réplicas.

### P2 — Validation des migrations historiques

Le schéma utilise un marqueur de version (actuellement 8), un verrou MySQL et des vérifications de colonnes/index. Les tests CI utilisent une base MySQL 8 initialisée et couvrent certaines migrations ciblées, notamment le quota mensuel. Il reste à rejouer les chemins de mise à niveau depuis des instantanés représentatifs de bases plus anciennes, avec données réelles anonymisées, et à vérifier les durées/verrous sur un volume proche de la production.

### P2 — Accessibilité et qualité statique

Les 119 captures valident des dimensions visuelles, pas la conformité WCAG ni l'usage avec lecteur d'écran. Les tests clavier, focus, contrastes et parcours avec technologies d'assistance restent à compléter. ESLint, Prettier et une analyse AST de code mort/duplication ne sont pas configurés dans les scripts observés ; aucun résultat d'analyse exhaustive de code mort n'est revendiqué.

## 6. Contrôles et décisions de cette exécution

- Aucune migration SQL ni modification de données n'a été réalisée.
- Aucun test défaillant n'a été supprimé ou ignoré.
- Aucun correctif métier de paiement, de règlement ou de restauration n'a été fusionné.
- Aucun force-push ni contournement de protection n'a été effectué.
- Le correctif PDF proposé est limité à la transaction d'enqueue et à la durée de vie des métadonnées en attente.
- La CI sur `main` est verte pour le commit cité ; les contrôles sur la nouvelle branche restent à confirmer par GitHub Actions.
- La PR documentaire #53 reste ouverte et en retard sur `main` ; elle n'a pas été fusionnée.

## 7. Prochaines priorités

1. Vérifier la CI de la PR du correctif PDF ; corriger tout échec et relancer les contrôles.
2. Concevoir la récupération fiable des tâches PDF après arrêt brutal, avec test de crash et de redélivrance.
3. Mettre en place des sauvegardes hors hôte et une restauration de bout en bout.
4. Faire activer les protections de `main` par un administrateur.
5. Ajouter une matrice Node 22/26 et des contrôles de lint/formatage sans masquer les erreurs existantes.
6. Préparer une revue métier et technique séparée des paiements récurrents et de l'internationalisation.

---
**Conclusion :** la CI de `main` est actuellement verte et un défaut concret de conservation des métadonnées des tâches PDF est corrigé dans une branche dédiée, avec un test de non-régression ajouté. Le worker PDF conserve néanmoins un risque distinct de perte de tâche après `BLPOP`. Aucune fusion ne doit intervenir tant que la PR n'est pas à jour avec `main`, que tous ses contrôles ne sont pas verts et que les protections du dépôt ne sont pas vérifiées.
