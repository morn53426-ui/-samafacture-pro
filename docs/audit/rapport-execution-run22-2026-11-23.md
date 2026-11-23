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
