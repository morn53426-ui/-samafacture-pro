# Audit et exécution — Run 26 — 23 novembre 2026

> Rapport append-only. Snapshot effectué le 23 novembre 2026 à 18:56 UTC. Les rapports Runs 1–25 sont conservés; ce fichier est nouveau. Aucun code applicatif, migration, donnée, volume, sauvegarde, historique comptable, réglage de protection ou déploiement n'a été modifié pendant ce run.

## 1. Snapshot GitHub vérifié

- Dépôt public : `morn53426-ui/-samafacture-pro`.
- Branche par défaut : `main`.
- SHA main exact : `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c` (merge #194, 23 nov. 16:53 UTC).
- Inventaire branches : **221** — pages 100 + 100 + 21; quatrième page vide. Aucun nom de branche supprimé.
- PR : **208** (snapshot consolidé : 59 ouvertes, 117 fusionnées, 32 fermées sans fusion). La recherche « merged » de l'intégration est limitée à 100 résultats; le total 117 vient du snapshot complet Run 25, et aucun merge supplémentaire n'a été constaté depuis.
- Derniers commits de main : #194 merge commit `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c`; auparavant merge #192 `60fc886aee3d15993b255a8d4a1ce35a287e9939`.
- Toutes les branches et tous les historiques restent préservés.

## 2. Main — stabilité et CI exacte

La PR #194 (isolation tenant facture/client/paiement) est fusionnée. Sur son head exact `970832f4bb45bb348dae99967183e917beeeb7e3`, les 3 workflows étaient verts (Tests Node.js/MySQL, ESLint, ZIP source).

Sur le SHA main exact `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c`, le workflow post-merge Tests Node.js/MySQL est **success**, run [45221526816](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45221526816). Les jobs vérifiés sont terminés : compose, image sans secrets locaux, npm audit, tests, restauration de sauvegarde chiffrée, smoke cluster MySQL/Redis, recette responsive visuelle. Le connecteur combined-status retourne une liste vide; le run exact ci-dessus confirme le test post-merge. Aucun run ESLint/ZIP post-merge distinct n'est revendiqué.

Workflows sur main :
- `.github/workflows/test.yml`
- `.github/workflows/lint.yml`
- `.github/workflows/package-source-zip.yml`

## 3. Migrations et protections

Migrations dans `server/database/migrations/` : `003_professional_modules.sql`, `004_paiements_comptabilite_achats.sql`, `005_portail_crm_international_ia.sql`, `006_company_groups.sql`, `007_email_outbox.sql`, `008_company_group_email_proof.sql`, `009_team_invitation_email_proof.sql`, `010_saas_subscriptions_simulation.sql`, `011_comptabilite_contrepas_factures.sql`, `012_comptabilite_correspondances.sql`. Les scripts historiques à la racine restent également recensés dans Run 25. Lecture seulement : aucune migration n'a été exécutée.

La dernière vérification de protection (Run 25) documentait le ruleset `protect main` #27410527 actif : PR obligatoire, delete et non-fast-forward bloqués, résolution de threads, checks requis Tests Node.js/MySQL + ZIP source, aucun bypass; **0 approbation obligatoire**. Ce paramètre administratif n'a pas été revalidé ni changé durant Run 26. Risque P0 toujours ouvert : demander au propriétaire une configuration de revue indépendante (au moins 1 approbation, approbation après dernier push, reviews obsolètes révoquées).

## 4. PR et lots examinés

### #151 — impression facture A4 — **déjà fusionnée**
- PR `fix(print): preserve full-width invoice banners on A4`, merged 22 nov. 17:02 UTC.
- Merge commit `00d52ca8acdced3d81d39bf592a916d6729c4e98`.
- Comparaison ancestry : main est 68 commits en avance et 0 en retard depuis ce merge commit; #151 est intégrée à main.
- Le diff garde le padding horizontal des bandeaux, neutralise les marges négatives et fixe largeur/box-sizing. Tests ajoutés pour géométrie A4 et détection du rognage.
- Aucune fusion de #151 pendant Run 26.

### #208 — rail mobile des domaines espace professionnel — **CI verte, draft**
- Head exact : `21a3e371eec79eb52ef6962458a1d3ef34aebb0d`, 5 commits / 4 fichiers.
- Tests : [45223260494](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45223260494) success (recette visuelle responsive terminée); ESLint [45223260450](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45223260450) success; ZIP [45223260488](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45223260488) success.
- Diff statique : rail horizontal scroll-snap ≤560 px, région focusable/nommée, description, test structurel et recette visuelle.
- Revue indépendante absente, Draft. **Pas de merge**.

### #209 et #211 — grille responsive des coordonnées entreprise — **doublons, CI verte**
- #209 head `9888f76fcee4a631a6bd33473c6d7fa4a8800b1f`, 3 commits/3 fichiers : Tests [45223608140](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45223608140), ESLint [45223608516](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45223608516), ZIP [45223608500](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45223608500) — success.
- #211 head `4518451df4e887ed584219d282530e3acf4734df`, 3 commits/3 fichiers : Tests [45225973762](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45225973762), ESLint [45225973707](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45225973707), ZIP [45225973680](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45225973680) — success.
- Les deux diff regroupent 9 champs en deux colonnes desktop, une colonne mobile, RIB pleine largeur; conditions/mentions hors grille. #211 ajoute une assertion d'unicité du formulaire et a une revue COMMENTED de l'auteur/owner, pas une approbation indépendante.
- Recommandation : retenir #211 comme candidate, ne pas fusionner #209 et #211 ensemble; garder les deux branches et PR intactes. Validation visuelle manuelle non effectuée dans ce runtime; drafts, aucun merge.

### #210 — devise de base des commandes — **CI verte, validation métier requise**
- Head exact : `fa92faeccf886fa3d67f4c8003fbc7b2f0ccf5ad`, 2 commits/2 fichiers.
- Tests [45224583486](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45224583486), ESLint [45224583453](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45224583453), ZIP [45224583450](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45224583450) — success.
- Cause : la route `POST /api/pro/orders` rejetait les devises non prises en charge mais laissait passer une devise supportée différente de celle du tenant. Correction : verrouillage déjà présent, comparaison à la devise de base, 409 avant insertion. Tests FCFA→EUR rejeté et EUR→FCFA rejeté, aucune commande incohérente stockée.
- Revue indépendante et décision métier OHADA/API requises (confirmer que les clients API ne doivent pas volontairement créer des commandes dans une devise étrangère sans conversion). Draft, aucun merge.

### #142 — intégration trial/comptabilité v21 — **bloquée par divergence**
- Head `decb8da2e48e8f7a93fc63202f00fe0b4170e6e2`, 77 commits en avance, 48 en retard, 48 fichiers; GitHub `mergeable=false`, `dirty`.
- CI sur le head exact : Tests [45027909669](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45027909669), ESLint [45027909637](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45027909637), ZIP [45027909640](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45027909640) — success, mais les tests ne couvrent pas les conflits non résolus.
- Le diff contient intégration trial 15 jours, cycle comptable et protections d'historique; 18 chemins communs en conflit signalés dans le corps PR. Aucune résolution/rebase/merge dans Run 26. Revue humaine obligatoire.

### #145 — rétention contrepassations v22 — **CI verte, DDL critique / empilée**
- Head exact `5b6ba8bf3b05e4155697159c60cf4b5051196bf8`, 15 commits/7 fichiers, base PR #142.
- Tests [45029642007](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45029642007), ESLint [45029642012](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45029642012), ZIP [45029642014](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45029642014) — success.
- Migration v22 retire la FK facture→événement de contrepassation pour conserver les événements lors d'une suppression exceptionnelle, sans modifier les événements existants; tests idempotence et purge tenant. DDL `DROP FOREIGN KEY`, orphelins historiques possibles et PR empilée sur #142 : **validation humaine spécifique comptabilité/audit obligatoire**. Aucun merge.

### #212 — rapport Run 25 — **PR de suivi encore Draft**
- Head `a01f8b8742892499be5e750fa5aecad306575281`.
- Tests [45237464385](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45237464385) success; ZIP [45237464357](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45237464357) success; lint path non déclenché pour le fichier documentation seul.
- Rapport 25 conservé; aucun merge.

## 5. Revue indépendante et décision du Run 26

Revue statique indépendante des diffs #208/#209/#211/#210 : aucun défaut bloquant identifié dans la lecture ciblée; ceci ne remplace pas une approbation GitHub indépendante ni une recette visuelle sur appareil. Les PR #209 et #211 sont duplicatives; la candidate #211 est préférable pour son test d'unicité de formulaire et sa couverture de chemins lint. Les candidats #208, #209, #211, #210 restent Draft et non approuvés.

**Merges Run 26 : 0.** Les critères de fusion ne sont pas tous satisfaits (draft, approbation indépendante absente, visual check manuelle manquante ou validation métier/DDL). Aucun merge, push main, force push, suppression, paiement réel ou déploiement.

## 6. Planning priorisé

| Priorité | Lot | État / prochaine action sûre |
|---|---|---|
| P0 | Protection main | Demander au propriétaire une approbation obligatoire et review-after-last-push; ne pas modifier les règles sans validation. |
| P0 | Isolation multi-tenant #194 | Merged; test post-merge exact main success. Surveiller régressions, pas de doublon #199/#203 à fusionner. |
| P0 | #142/#145 comptabilité, trial, v22 | DDL et historique critiques : revue humaine; résoudre conflits de #142 sur branche dédiée seulement, puis CI fraîche; validation OHADA/audit avant fusion. |
| P1 | #210 devise commandes | CI 3/3 green; décision produit/OHADA/API et revue indépendante avant merge. |
| P1 | #208 rail espace pro mobile | CI 3/3 green; review indépendante + confirmation visuelle responsive avant merge. |
| P2 | #211 grille paramètres | Candidate unique préférée sur #209; revue indépendante et validation visuelle; garder #209 intacte. |
| P2 | PDF/print | #151 déjà intégré; continuer recette visuelle facture/devis A4 sur modèles et cas longs, aucune modification sans reproductions. |
| P3 | UX / docs | Réduire duplications après décision, tests non-régression et rapports append-only. |

## 7. Journal de préservation et limites

- Aucun push direct ou force push sur `main`; aucune branche supprimée ou réécrite.
- Aucun volume, donnée, backup ou historique comptable touché.
- Aucune migration exécutée; aucune écriture comptable historique modifiée.
- Aucun paiement réel, checkout, déploiement ou action production.
- Tests/CI cités uniquement sur SHA exacts indiqués. Aucun test local n'a été exécuté depuis ce runtime.
- Ruleset : constat Run 25 reporté, non revalidé Run 26.
- Aucun merge dans ce run. Les PR draft/non approuvées sont conservées.

## 8. Résultat

Main reste sur `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c`, avec test post-merge success vérifié. Lots UX #208/#209/#211 et devise #210 ont leur CI exacte verte, mais les approbations et/ou validations visuelles/métier manquent. Les intégrations comptables #142/#145 restent bloquées par conflits et validation DDL/audit. La priorité suivante est la revue humaine spécifique #142/#145, puis un candidat UX non dupliqué (#208 ou #211) seulement après review indépendante, validation visuelle et CI exacte.
