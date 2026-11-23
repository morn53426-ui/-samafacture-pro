# Rapport d'exécution — Run 22 (23 novembre 2026)

## Résumé et décision

- **Main au début de ce run :** `8df0651951884623d4f5d4cd7ebc48b9c26f79e0` (merge de PR #204).
- **Main après la fusion documentaire #205 :** `f10d89694e264bc710f1ce534a6418dd792e603a`.
- **PR #205 :** fusionnée en squash, documentation uniquement.
- **CI post-fusion #204 :** vérifiée complète et green sur SHA `8df0651951884623d4f5d4cd7ebc48b9c26f79e0` (run #45206892048).
- **CI post-fusion #205 :** non vérifiable via le connecteur dans ce run. Le connecteur de workflow expose seulement les runs déclenchés par PR, et le status/checks de `f10d896...` renvoie une liste vide. Cela ne prouve ni succès ni échec.
- **Décision :** aucune autre fusion. Main après #205 est **non certifié post-fusion** faute de résultat accessible pour le commit exact.

## Fusions

### PR #205 — rapport Run 21

- URL : https://github.com/morn53426-ui/-samafacture-pro/pull/205
- Head avant fusion : `55ac9a0bc2af9df5136f0a09b4ab358a74b414ed`
- Merge SHA : `f10d89694e264bc710f1ce534a6418dd792e603a`
- Méthode : squash.
- Fichier unique : `docs/audit/rapport-execution-run21-2026-11-23.md` (509 lignes ajoutées, 0 suppression).
- Revue documentaire COMMENT effectuée sur le head exact; aucun thread inline non résolu.
- CI PR exacte : ZIP run #45208033685 success; Tests Node/MySQL run #45208033740 success.
- Aucun code, migration, paiement, donnée, backup, volume ou historique comptable modifié.
- Branche `audit/execution-report-20261123-run21` conservée.

## Main et commits récents

Commits observés, du plus récent au plus ancien :

| SHA | Description |
|---|---|
| `f10d89694e264bc710f1ce534a6418dd792e603a` | Merge squash PR #205, rapport Run 21 |
| `8df0651951884623d4f5d4cd7ebc48b9c26f79e0` | Merge squash PR #204, rapport Run 20 |
| `047e7badf4fccd91644af74e0968089b23246c93` | PR #202, contraste badge Entreprise |
| `f8a61187e8b8df7dc319d611dd58fb02dd0aa336` | Main antérieur |
| `c0a3b569e3e685183376be8428c4696d8c767ccd` | Main antérieur |
| `b0b52e660af61fa781dc9a761165dd72977f969a` | Base ancienne candidate devise |

Le connecteur fournit ces SHA; les métadonnées message/auteur/date sont partiellement absentes. Ne pas inférer les messages ou dates non exposés.

## Inventaire actuel

Snapshot après fusion #205 :

- Branches : **214** (pages 100 + 100 + 14; page suivante vide).
- PR ouvertes : **54**.
- PR fermées : **147** (d'après le snapshot précédent 146 + #205).
- PR fusionnées : **115** (114 + #205).
- PR fermées sans merge : **32**.

Branches et PR préservées. Aucun nettoyage de branches.

## CI exacte

| Commit/PR | Contrôle | Run | Résultat |
|---|---|---:|---|
| Main #204 `8df0651...` | Tests Node/MySQL, restore chiffré, smoke MySQL/Redis, recette responsive | #45206892048 | Success |
| PR #205 head `55ac9a0...` | Tests Node/MySQL et recette incluse | #45208033740 | Success |
| PR #205 head `55ac9a0...` | Package source ZIP | #45208033685 | Success |
| Main après #205 `f10d896...` | Status/checks du connecteur | — | **Non exposé / inconnu** |

Main post-#205 ne doit pas être déclaré stable avant vérification des checks du SHA exact. La page Actions/Checks GitHub directe est inaccessible au connecteur web dans ce run; les appels GitHub status et workflow-runs ne retournent pas de runs pour le commit push.

## P0 — Sécurité multi-tenant : PR #194

- URL : https://github.com/morn53426-ui/-samafacture-pro/pull/194
- Head : `900163220356db9c443e11e5f6208760d49a62f2`
- Compare actuel vers main `f10d896...` : **20 commits ahead / 4 behind**, divergent.
- 12 fichiers : routes assistant, clients, dashboard, factures récurrentes/factures, professionnel, public, rapports et tests tenant/redaction.
- Cause racine : certaines requêtes filtrent l'enregistrement principal par tenant mais joignent les entités associées seulement par ID; relations historiques mal formées pourraient révéler données client/facture/paiement.
- Revue statique antérieure : aucun défaut bloquant évident identifié, mais elle n'est pas une approbation.
- Anciennes CI sur le head d'origine/synchronisé ne sont pas réutilisables après les 4 commits de retard.
- Action : ne pas fusionner. Synchroniser non destructivement après stabilité main, CI fraîche, revue indépendante et **validation humaine spécifique sécurité**.
- PR #203 (redaction verification_code) et #199 (statement/refund tenant join) recouvrent des corrections déjà intégrées dans #194; éviter merges séparés si #194 est retenue.

## P1 — Devise de tenant / concurrence : PR #192

- URL : https://github.com/morn53426-ui/-samafacture-pro/pull/192
- Head : `8a11e00bb976979403e9d3fcfa8e767a074b5423`
- Compare vers main `f10d896...` : **11 commits ahead / 5 behind**, divergent.
- 11 fichiers, dont routes auth, dépenses, factures récurrentes, factures, produits, professionnel, API publique et tests concurrence.
- Le verrou de ligne `users FOR UPDATE` protège plusieurs réglages et premières créations, mais **la commande commerciale accepte encore une devise supportée explicitement différente** de la devise de base. Le test couvre la devise inconnue et l'absence de devise, pas l'override valide incompatible.
- Cause : l'API `POST /api/pro/orders` choisit `req.body.devise` si fournie; les conversions ne sont pas activées et les autres documents imposent la devise de base.
- Correction souhaitée, sous décision métier : refuser l'override valide non égal à la devise tenant (409), ajouter un test tenant EUR + commande USD => 409; préserver le défaut à la devise tenant et les tests de verrou/concurrence.
- Branches alternatives `fix/tenant-currency-atomic-current-main-20261123`, `...latest-main...`, `...lock-main...`, `...atomic-main...`, `fix/tenant-currency-final-main...` et `fix/pro-orders-tenant-currency-main...` sont toutes divergentes de main actuel (5 à 9 commits behind; 10 à 21 ahead selon branche). Aucun head n'est prêt à merger.
- Action : aucune fusion. Synchronisation non destructive, tests exacts et validation humaine OHADA/devise requises.

## Migrations et comptabilité

Main précédent reste documenté en schema v23 :

| Version | Rôle |
|---|---|
| v21 | Essai gratuit 15 jours et dates UTC |
| v22 | Conservation des événements de contrepassation |
| v23 | Correspondances comptables tenant-aware |

Aucune migration exécutée ni fichier DDL modifié dans Run 22. Les branches historiques #142/#145 sont divergentes/obsolètes; ne pas fusionner les migrations déjà intégrées. Toute modification destructive ou historique comptable exige validation humaine spécifique.

## Protections GitHub

Ruleset précédemment inspecté : #27410527 (`protect main`), PR obligatoire, non-fast-forward/delete bloqués, required checks Tests Node.js/MySQL et Build complete source archive, conversations à résoudre, aucun bypass. Le connecteur ne permet pas de relire l'endpoint classique de protection (403); ne pas contourner.

## Planning P0–P3

| Priorité | Lot | Prochaine étape |
|---|---|---|
| P0 | #194 isolation tenant/redaction | Main post-#205 stable à vérifier; sync 4 commits; tests exacts; validation sécurité humaine |
| P0 | #203/#199 | Sous-ensembles de #194; ne pas fusionner en doublon |
| P1 | #192 verrou devise | Sync 5 commits; corriger/valider commande multi-devise; CI exacte; revue OHADA humaine |
| P1 | Migrations v21–v23 / écritures | Réconciliation seulement; approbation humaine pour toute migration ou historique |
| P1 | Backup / restore / Docker | Garder tests non destructifs; préserver backups et volumes |
| P2 | PDF, impression, responsive, accessibilité | Lots isolés après main stable, tests visuels exacts |
| P3 | Documentation, branding, abonnements | Continuer en simulation; aucun paiement réel |

## Préservation / risques

- Aucun push direct ou force push sur main.
- Aucune branche supprimée.
- Aucun volume, donnée, sauvegarde ou historique comptable modifié.
- Aucun paiement réel ni déploiement production.
- Une fusion Run 22 : #205 documentaire.
- Main après #205 : SHA connu, mais CI post-fusion inaccessible dans ce run; **arrêt des merges**.
- Les PR sécurité et devise restent Draft/non fusionnées.
- Les risques prioritaires : isolation tenant, exposition codes publics dans listes (à vérifier main), race changement de devise, commande commerciale multidevise sans conversion, divergences de branches et CI post-fusion non observable.

## Liens

- PR #205 : https://github.com/morn53426-ui/-samafacture-pro/pull/205
- Main SHA après #205 : https://github.com/morn53426-ui/-samafacture-pro/commit/f10d89694e264bc710f1ce534a6418dd792e603a
- Main post-#204 CI run #45206892048 : https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45206892048
- PR #194 : https://github.com/morn53426-ui/-samafacture-pro/pull/194
- PR #192 : https://github.com/morn53426-ui/-samafacture-pro/pull/192


## Addendum — snapshot après ouverture de PR #206

Le snapshot de l'inventaire principal ci-dessus a été pris immédiatement après la fusion #205, avant l'ouverture de la PR de ce rapport. Après création de la branche/PR Run 22 :

- Branches : 215 (100 + 100 + 15; page suivante vide).
- PR ouvertes : 55, incluant #206 Draft.
- PR #206 head : `e3725b217b2b453d75e3ddcc073a080346e78060`; base main `f10d89694e264bc710f1ce534a6418dd792e603a`.
- CI PR #206 au snapshot : Package ZIP run #45212244169 queued; Tests Node/MySQL non encore visible.
- Aucun changement applicatif. PR #206 non fusionnée.


## Addendum — après fusion PR #192 et contrôle du main (23 novembre, 16:38 UTC)

### Fusion PR #192 — verrouillage de devise
- PR #192 a été fusionnée sur GitHub le 23 novembre 2026 à 16:34:04 UTC.
- Merge SHA / nouveau main : `60fc886aee3d15993b255a8d4a1ce35a287e9939`.
- Message observé : `Merge pull request #192 from morn53426-ui/fix/tenant-currency-final-main-20261123`.
- Cette fusion est intervenue après le snapshot initial du présent rapport. Elle n'a pas été effectuée dans le cadre de cette étape d'audit.
- Le diff de #192 n'ajoute pas de migration DDL; il introduit des verrous transactionnels `users FOR UPDATE` partagés entre réglages et premières écritures métier ainsi que des tests de concurrence.
- **Risque post-fusion conservé** : l'audit précédent a relevé que `POST /api/pro/orders` accepte une devise supportée explicitement différente de la devise de base, sans conversion activée, contrairement aux factures et achats fournisseurs. La fusion ne résout pas cette incohérence métier. La traiter par une PR de suivi dédiée après analyse des impacts commandes, rapports, facturation et comptabilité OHADA; aucune correction spéculative ni écriture historique n'est effectuée ici.

### CI post-fusion PR #192 — SHA exact
- Workflow Tests automatisés : [run #45217959532](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45217959532).
- Head SHA : `60fc886aee3d15993b255a8d4a1ce35a287e9939`.
- État au relevé : **in_progress**.
- Étapes exécutées avec succès : préparation du job, initialisation containers, récupération du dépôt, validation Docker Compose, installation Node, build image et contrôle secrets, dépendances, détection Chromium, contrôle dépendances, script staging, tests, restauration réelle sauvegarde chiffrée, diagnostics et smoke test MySQL/Redis.
- Étape `Recette visuelle responsive avec données extrêmes` : **in_progress**.
- Publication des captures : **pending**.
- Le run ne peut pas être déclaré réussi avant sa conclusion finale. Aucune fusion supplémentaire pendant ce contrôle.

### PR #194 — nouvel état après #192
- [PR #194](https://github.com/morn53426-ui/-samafacture-pro/pull/194), branche `security/tenant-relations-main-current-20261123-run12`.
- Head exact : `250141bd649cd773462813bd99b098c5f62a6374`.
- Base au moment de sa synchronisation : `f10d89694e264bc710f1ce534a6418dd792e603a`.
- Compare avec le main courant `60fc886aee3d15993b255a8d4a1ce35a287e9939` : **21 commits ahead / 13 behind**, état divergent. Les 13 commits correspondent au développement/fusion intervenu depuis l'ancienne base; la branche n'est plus à jour.
- Les trois workflows sur le head `250141bd...` étaient green : ESLint #45213180825, archive ZIP #45213180911, Tests Node/MySQL #45213180959. Ces résultats ne valident pas la branche contre le nouveau main et ne remplacent pas de nouveaux checks après synchronisation.
- Le diff porte sur 12 fichiers, routes tenant-aware et tests inter-entreprises; aucun changement DDL ni écriture comptable identifié dans le patch revu.
- L'état GitHub observé est ouvert, non fusionné. Aucune synchronisation après la fusion #192 n'a été effectuée dans cette étape.
- Les revues existantes de #194 sont toutes des soumissions `COMMENTED` du compte auteur `morn53426-ui`; aucun état `APPROVED` d'un reviewer distinct n'est présent dans les revues retournées. Aucun thread inline non résolu n'a été retourné.
- **Blocage de fusion** : CI post-fusion du main courant terminée avec succès requise; synchronisation non destructive de #194 requise; trois checks relancés sur le nouveau head; revue de sécurité indépendante par une autre personne requise conformément au corps de la PR; validation humaine spécifique de sécurité requise. La demande de fusion exprimée dans la conversation n'est pas une approbation technique indépendante sur GitHub.

### Candidats P2 relus en lecture seule
- PR #127 (pagination A4 devis Executive) : 6 commits ahead / 45 behind, 3 fichiers.
- PR #155 (grille responsive paramètres entreprise) : 9 ahead / 39 behind; compare ne montre que 3 fichiers modifiés sur main→head.
- PR #156 (skip-link clavier dashboard) : 8 ahead / 39 behind; compare montre 4 fichiers.
- PR #130 (contraste/focus) : 21 ahead / 45 behind, Draft.
- Ces branches sont trop en retard pour être fusionnées ou validées sur leur CI historique. Les reprendre par portage ciblé sur une branche actuelle après stabilisation de main, sans fusion directe de leurs historiques.

### Décision et préservation à 16:38 UTC
- Main : `60fc886aee3d15993b255a8d4a1ce35a287e9939`; CI #45217959532 encore en cours; stabilité post-#192 non certifiée.
- #194 non fusionnée; #192 fusionnée sur GitHub; aucune autre fusion effectuée par cette étape.
- Aucun push direct/force push sur main, aucune branche supprimée, aucun volume/donnée/sauvegarde/historique comptable modifié, aucun paiement réel ni déploiement production.


## Addendum — synchronisation confirmée de #194 (23 novembre, 16:42 UTC)

### Main après PR #192
- Main confirmé : `60fc886aee3d15993b255a8d4a1ce35a287e9939`.
- CI post-fusion #192 : run #45217959532 **success** sur ce SHA exact, y compris tests Node/MySQL, restauration chiffrée, smoke MySQL/Redis, recette responsive et publication des captures.
- Main est stable après #192 au regard de ce workflow complet. Aucun push direct sur main effectué.

### PR #194 — branche synchronisée
- [PR #194](https://github.com/morn53426-ui/-samafacture-pro/pull/194).
- Branche : `security/tenant-relations-main-current-20261123-run12`.
- Commit de synchronisation observé : `970832f4bb45bb348dae99967183e917beeeb7e3`, message `Merge branch 'main' into security/tenant-relations-main-current-20261123-run12`.
- Base main : `60fc886aee3d15993b255a8d4a1ce35a287e9939`.
- Compare GitHub : **22 commits ahead / 0 behind**, merge-base égal au main courant. Les correctifs #194 sont maintenant synchronisés sans rebase et sans réécriture de l'historique.
- La tentative concurrente de synchronisation effectuée depuis cet audit a détecté que le head de branche avait changé et s'est arrêtée avant toute écriture. Le commit de synchronisation ci-dessus était déjà présent sur GitHub; il n'a pas été créé par cette tentative.
- 12 fichiers applicatifs/tests et lint restent le diff de la PR contre main. Aucun DDL ni changement d'historique comptable.

### CI exacte sur le head synchronisé
| Contrôle | Run | Head | État |
|---|---:|---|---|
| ESLint | #45218710123 | `970832f4...` | success |
| Archive source ZIP | #45218710373 | `970832f4...` | success |
| Tests Node.js/MySQL, restore, smoke et recette visuelle | #45218709676 | `970832f4...` | in_progress au relevé |

La dernière étape de recette visuelle responsive était en cours; le workflow Tests doit terminer avec conclusion success avant fusion.

### Revue de sécurité indépendante — blocage restant
- Les revues GitHub retournées pour #194 sont des états `COMMENTED`, toutes rédigées par `morn53426-ui`, auteur de la PR.
- Aucun état `APPROVED` par un reviewer distinct n'est présent dans les revues retournées.
- Aucun thread inline non résolu n'est retourné.
- La PR indique qu'aucun reviewer externe indépendant n'est désigné actuellement.
- Une seconde passe statique a été effectuée, mais elle ne remplace pas la revue humaine indépendante demandée par la PR.
- **Décision : ne pas fusionner #194 tant qu'un reviewer distinct n'a pas enregistré une approbation de sécurité sur le head exact, et tant que les tests complets de ce head ne sont pas success.** La demande de fusion exprimée par le propriétaire ne remplace pas l'approbation indépendante.

### Rapport Run 22 — propre CI
- Branche du rapport : `audit/execution-report-20261123-run22`.
- Head après addendum précédent : `409007958fae037c3e780f260e8014e784c774a3`; CI ZIP #45219320766 success, Tests #45219320400 in_progress au relevé.
- Le présent addendum est ajouté sans écraser le texte ni les rapports Runs 1–21. PR #206 reste Draft et non fusionnée.
