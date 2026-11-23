# Audit et exécution — Run 25 — 23 novembre 2026

> Rapport append-only. Les rapports historiques ne sont ni remplacés ni réécrits. Snapshot GitHub vérifié le 23 novembre 2026 à 18:16 UTC puis complété pendant le Run 25. Aucune fusion, migration ou opération sur des données n'a été exécutée pendant ce run.

## 1. Snapshot du dépôt

- Dépôt : `morn53426-ui/-samafacture-pro` (public).
- Branche par défaut : `main`.
- SHA main observé : `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c`.
- Ce commit correspond à la fusion de la PR #194.
- Branches : **220** (pages REST : 100 + 100 + 20). Toutes conservées.
- Pull Requests : **207** (pages REST : 100 + 100 + 7).
  - ouvertes : **58** ;
  - fusionnées : **117** ;
  - fermées sans fusion : **32**.
- Aucun branchement, commit ou historique n'a été supprimé.

## 2. Main et CI après la PR #194

PR #194 — sécurité des relations multi-tenant facture/client/paiement :
- head fusionné : `970832f4bb45bb348dae99967183e917beeeb7e3` ;
- commit de fusion / main observé : `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c` ;
- statut GitHub : merged le 23 novembre 2026 à 16:53:15 UTC.

Checks de la PR #194 sur le head exact `970832f4bb45bb348dae99967183e917beeeb7e3` :
- Tests Node.js et MySQL : success — run [45218709676](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45218709676) ;
- ESLint : success — run [45218710123](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45218710123) ;
- Build complete source archive : success — run [45218710373](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45218710373).

CI post-fusion de main :
- check `Tests Node.js et MySQL` sur le SHA exact `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c` : completed / success — [run 45221526816](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45221526816).
- Le check-runs API sur le SHA de main n'expose qu'un check post-fusion (Tests Node.js et MySQL). Aucun statut post-fusion distinct ESLint/ZIP n'est revendiqué ici.
- Aucun nouveau merge effectué au Run 25.

## 3. Workflows et migrations repérés sur main

Workflows présents :
- `.github/workflows/test.yml`
- `.github/workflows/lint.yml`
- `.github/workflows/package-source-zip.yml`

Migrations sous `server/database/migrations/` :
- `003_professional_modules.sql`
- `004_paiements_comptabilite_achats.sql`
- `005_portail_crm_international_ia.sql`
- `006_company_groups.sql`
- `007_email_outbox.sql`
- `008_company_group_email_proof.sql`
- `009_team_invitation_email_proof.sql`
- `010_saas_subscriptions_simulation.sql`
- `011_comptabilite_contrepas_factures.sql`
- `012_comptabilite_correspondances.sql`

Autres fichiers de migration historiques repérés à la racine :
- `migration_2026_08_30_stabilite.sql`
- `migration_2026_11_15_token_version.sql`
- `migration_facture_personnalisation.sql`
- `migration_index_reset_token.sql`
- `migration_scalabilite_30_41.sql`

Inventaire uniquement en lecture. **Aucune migration n'a été exécutée** au Run 25.

## 4. P0 — règles de protection GitHub

Ruleset `protect main`, id `27410527`, état `active`, ciblant `refs/heads/main`.

Règles lues :
- suppression de branche : interdite ;
- non-fast-forward / force push : interdit ;
- Pull Request obligatoire ;
- résolution des threads : obligatoire ;
- checks requis : `Tests Node.js et MySQL` et `Build complete source archive` ;
- `required_approving_review_count = 0` ;
- `require_code_owner_review = false` ;
- `require_last_push_approval = false` ;
- aucun acteur de bypass (current_user_can_bypass = never).

**Risque P0 :** le ruleset bloque les suppressions et force push mais n'exige pas d'approbation humaine. Cette configuration administrative n'a pas été modifiée. Une validation spécifique du propriétaire est requise avant tout changement de règles de protection ; recommandation à étudier : au moins une approbation indépendante et une approbation après le dernier push, avec révocation des reviews obsolètes.

## 5. Sécurité multi-tenant — consolidation après #194

Code relu sur `main` SHA `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c` :
- `server/routes/professionnel.js` : le relevé client joint `pro_refund_requests` au paiement par `p.user_id = r.user_id`, puis la facture par `f.user_id = p.user_id`.
- `server/tests/professional-tenant.test.js` : test de non-régression simulant une référence de paiement cross-tenant, avec restauration de la fixture dans un bloc `finally`.
- `server/routes/factures.js` : relation facture/client avec égalité des propriétaires et retrait de `verification_code` des réponses de liste ; le détail authentifié conserve le code requis pour le QR.
- `server/routes/clients.js` : historique client renvoyé sans `verification_code`.

Les PR historiques suivantes sont désormais couvertes en tout ou partie par #194. Elles sont conservées ouvertes, sans fermeture ni suppression de branche :
| PR | Comparaison `main...head` | Décision |
|---|---:|---|
| #177 | diverged, 6 commits ahead / 47 behind | redondante : redaction des codes déjà intégrée |
| #199 | diverged, 3 ahead / 41 behind | correctif relevé remboursements intégré par #194 |
| #179 | diverged, 23 ahead / 47 behind | supersédée par la consolidation #194 |
| #188 | diverged, 10 ahead / 42 behind | supersédée par la consolidation #194 |
| #203 | diverged, 6 ahead / 39 behind | redondante : redaction déjà intégrée |

Pour ces cinq PR, les checks combinés du head n'ont pas retourné de statut exploitable au moment du Run 25. Les validations historiques ne sont pas transférées. Des commentaires d'audit Run 25 ont été publiés sur chacune :
- #177 comment 7109947043 ;
- #199 comment 7109947841 ;
- #179 comment 7109948778 ;
- #188 comment 7109949613 ;
- #203 comment 7109950311.

Ne pas rebaser ou fusionner ces branches à l'aveugle : elles divergent fortement de main et leur objectif est déjà couvert par #194.

## 6. P1 — cycle comptable et migrations v21/v22

### PR #142 — cycle de vie facture, comptabilité et essai de 15 jours
- base historique : `8453ee6d8e633f151523236eecff1bc0e0cf877b` ;
- head historique : `decb8da2e48e8f7a93fc63202f00fe0b4170e6e2` ;
- comparaison avec main courant : diverged, **77 commits ahead / 140 behind**, 48 chemins modifiés.
- Checks sur le head historique exact : Tests run 45027909669 success, ESLint run 45027909637 success, ZIP run 45027909640 success.
- Le lot inclut les changements de cycle de vie comptable, essai gratuit 15 jours et migration v21 (011).

Les anciens checks sont verts sur leur ancien SHA, mais ne couvrent aucune synchronisation sur main courant. Aucun rebase automatique, aucune exécution de migration et aucune fusion. Une reprise devra être faite sur branche dédiée, avec revue des conflits sur les 48 chemins, CI complète sur le nouveau SHA et validation humaine spécifique comptabilité/migration.

Commentaire d'audit publié : #142, comment 7109969249.

### PR #145 — conservation des événements de contrepassation, schéma v22
- base empilée : PR #142 / head `decb8da2e48e8f7a93fc63202f00fe0b4170e6e2` ;
- head historique : `5b6ba8bf3b05e4155697159c60cf4b5051196bf8` ;
- comparaison main courant : diverged, **92 commits ahead / 140 behind**.
- Checks sur ce head historique exact : Tests run 45029642007 success, ESLint run 45029642012 success, ZIP run 45029642014 success.

Risque précis : la migration v22 retire la FK `fk_pro_compta_facture_events_invoice` de la table des événements de contrepassation afin de conserver l'événement après une suppression SQL de facture. `facture_id` peut alors rester orphelin ; les événements sont toujours rattachés au tenant par `user_id`. Il s'agit d'un changement de schéma affectant une piste d'audit comptable. L'ancienne CI verte ne suffit pas à autoriser la migration.

**Blocage conservatoire :** validation humaine spécifique du propriétaire métier/comptable requise avant toute fusion ; revue de la migration et des scénarios de conservation/purge nécessaire. Aucune migration n'a été lancée.

Commentaire d'audit publié : #145, comment 7109969931.

## 7. P1 — devise des commandes commerciales

PR #210 — `fix(currency): enforce company base currency for sales orders` :
- base SHA : `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c` (main du snapshot) ;
- head exact : `fa92faeccf886fa3d67f4c8003fbc7b2f0ccf5ad` ;
- 2 fichiers modifiés ;
- Test Node/MySQL : success — [45224583486](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45224583486) ;
- ESLint : success — [45224583453](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45224583453) ;
- ZIP : success — [45224583450](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45224583450).

Revue statique : le endpoint `POST /api/pro/orders` refuse avec HTTP 409 une devise supportée différente de la devise de base, avant insertion. Deux tests couvrent FCFA→EUR et EUR→FCFA et vérifient l'absence d'insertion incohérente. Aucun enregistrement historique, calcul de montant, TVA ou écriture comptable n'est modifié.

**Décision restante :** confirmer côté produit/comptabilité que les commandes multi-devises doivent rester interdites jusqu'à la disponibilité d'un moteur de conversion, notamment pour les intégrations API externes. CI verte ne constitue pas cette décision. PR maintenue en Draft, pas d'approbation ni fusion.

Commentaire de revue publié : #210, comment 7109970724.

## 8. Plan de suivi P0–P3

| Priorité | Lot | État au Run 25 | Étape sûre suivante |
|---|---|---|---|
| P0 | Approbation indépendante / ruleset main | protection active mais 0 approbation requise | demander validation du propriétaire avant changement administratif |
| P0 | Isolation multi-tenant factures/paiements/remboursements | consolidation #194 fusionnée, CI du head et test post-merge vert | poursuivre la revue de chemins non couverts sans dupliquer les corrections |
| P1 | Cycle comptable et essai 15 jours v21 (#142) | head ancien, 140 commits derrière | plan de reprise dédié, analyse de conflits, revue humaine |
| P1 | Conservation événement contrepassation v22 (#145) | head ancien, migration critique | validation comptable spécifique avant reprise/fusion |
| P1 | Devise commandes (#210) | CI complète verte sur le head courant | arbitrage métier/comptable avant sortie de Draft |
| P2 | Paramètres responsive (#211/#209/#155) | candidats en concurrence | comparer les diffs et effectuer recette navigateur multi-largeurs/zoom avant de choisir un seul lot |
| P2 | Navigation mobile (#208/#154) | candidats en concurrence | vérifier accessibilité clavier, focus, Escape et responsive avant intégration |
| P2 | Impression/PDF A4 | plusieurs corrections déjà intégrées auparavant | recette visuelle réelle : largeur du bandeau, titre FACTURE non coupé, polices, pages longues |
| P3 | Documentation et CI | rapports précédents conservés | continuer les rapports append-only et consolider les critères de recette |

## 9. Journal d'exécution Run 25

Actions réalisées :
- [x] Snapshot main vérifié sur SHA exact.
- [x] Inventaire paginé de 220 branches et 207 PR.
- [x] Vérification workflows, migrations et ruleset.
- [x] Vérification des checks exacts de la PR #194 et du commit post-merge main.
- [x] Relecture statique des jointures de remboursement, des listes facture et de l'historique client.
- [x] Comparaison des cinq PR de sécurité historiques avec main et commentaires conservatoires publiés.
- [x] Vérification des checks exacts et de la divergence des PR #142, #145 et #210.
- [x] Rapport Run 25 créé dans un nouveau fichier, sans écraser les rapports historiques.
- [ ] Aucun merge réalisé au Run 25.
- [ ] Aucun test exécuté localement depuis ce runtime.
- [ ] Aucune recette navigateur manuelle réalisée au Run 25.
- [ ] Aucune migration exécutée.

Garanties de préservation :
- aucun push direct ou force push sur `main` ;
- aucune branche ou PR supprimée ou fermée ;
- aucune donnée, écriture comptable historique, sauvegarde ou volume modifié ;
- aucun secret ou moyen de paiement réel activé ;
- aucun déploiement en production ;
- aucune modification de protection GitHub sans validation spécifique.

**Décision Run 25 :** main reste stable sur le SHA vérifié et le test post-fusion est vert. Les lots de sécurité déjà absorbés ne seront pas fusionnés une seconde fois. Les migrations v21/v22 et la règle de devise restent bloquées aux validations métier/humaines requises. Les prochaines actions doivent commencer par la gouvernance P0 et la planification de reprise des branches divergentes, sans toucher aux données historiques.


> **Datation des annexes A–C :** inventaire exhaustif récupéré après création de la branche Run 25 et de la PR #212. Il comprend la branche documentaire `audit/execution-report-20261123-run25` et la PR #212. Totaux actualisés : **221 branches et 208 PR**, dont **59 ouvertes**, **117 fusionnées** et **32 fermées sans fusion**. Les totaux du §1 correspondent au snapshot initial avant création de #212 (220 branches / 207 PR).

## Annexe A — inventaire exhaustif des branches (221)

Chaque ligne reprend le nom, le SHA du dernier commit observé et l'indicateur `protected` de l'API GitHub au snapshot. Aucune branche n'a été modifiée ni supprimée par cet inventaire.

| Branche | Head SHA | Protected |
|---|---|---|
| `a11y/dashboard-skip-link-main-current-run13` | `c2ba2ffb156d1aac7a418cba9e6cce73b362a86a` | no |
| `a11y/dashboard-skip-navigation-20261122` | `8f45795c3df521ffb021947d5376bfaa22a832ca` | no |
| `a11y/mobile-sidebar-escape-focus-20261122` | `c37403034a25bad6d4ecd0867066ce8c258bdd9c` | no |
| `a11y/sidebar-escape-main-current-run15` | `69180203cc2c694c3de029873b360d43d0b487ca` | no |
| `audit/execution-report-20261122-run1` | `dc7e6f55c5f7d357400f78c26dcfa469b75c3cef` | no |
| `audit/execution-report-20261122-run2` | `dff61fb42a429fce93ed1fc6f0a3c9f355ced6f4` | no |
| `audit/execution-report-20261123-run3` | `6fa59a42ebb12bb9d6f8a266059125b81991ff95` | no |
| `audit/execution-report-20261123-run4` | `14688f7a8fd8fe5d9b3cdde50bb546ac7485f30e` | no |
| `audit/execution-report-20261123-run5` | `f9f95b734deb3fe9ecacfbb257686085b3fa53a6` | no |
| `audit/execution-report-20261123-run6` | `8083f938c80ccba4ff499cdf3a6bddef95f29f3f` | no |
| `audit/execution-report-20261123-run11` | `2f1b11e77d5120fc14f4124460c4dda632e1850e` | no |
| `audit/execution-report-20261123-run12` | `b54c4b9fa1334b00663beb2ee26762a7f58e2853` | no |
| `audit/execution-report-20261123-run13` | `539a9430c78f83908ce7b404d98804309b19d578` | no |
| `audit/execution-report-20261123-run14` | `e6cc9a40ab92f0eaf9fa9f5c1aa02150d449fb62` | no |
| `audit/execution-report-20261123-run15` | `63493905494fc1e1a54d9e277c03aba34c1e2b31` | no |
| `audit/execution-report-20261123-run20` | `78dab3e621bc78b1e96e31c36ec73bde8ae5120b` | no |
| `audit/execution-report-20261123-run21` | `55ac9a0bc2af9df5136f0a09b4ab358a74b414ed` | no |
| `audit/execution-report-20261123-run22` | `6a8e2efea1468ce6636a9580ada38a66c9a8d09c` | no |
| `audit/execution-report-20261123-run23` | `ea7de5bf856affcf35fb2c9c960237533f22b3ae` | no |
| `audit/execution-report-20261123-run25` | `250599ffbe4cb2021597033688588c95591f336a` | no |
| `audit/fix-backup-and-runtime-20261110` | `9ea9a9aa00d4c3d4ef6e0a9a46f771a1912bedb5` | no |
| `audit/fix-enterprise-migration-invitation-20261116` | `0b93cf9e37feb94d2b317924f16f3045db45a9e4` | no |
| `audit/fix-nginx-upstream-order-20261116` | `5e93abdc37d49cdb4c458c9963eeb7998aa018c8` | no |
| `audit/fix-realtime-company-groups-20261116-run1` | `e5c3d8020b40079021aa678db9dbcb4969831e92` | no |
| `audit/fix-reset-email-docs-and-redaction-test-20261116` | `a53c96daa1c2052fa19ca270d574d948fab81f30` | no |
| `audit/initial-review-20261122` | `6543b3a701753341dae348032f9d08f003e2d796` | no |
| `audit/invoice-pdf-typography-print-20261118` | `7cb2d43cf3aadccb38e1a1a5d6c664a8db014c41` | no |
| `audit/npm-audit-gate-2026-11-16` | `63a344d9154b5f5879689fa632dc697148afe2e7` | no |
| `audit/rapport-approfondi-2026-11-16-run2` | `1aee933103049ca9e0049ed76f00e4ff641c8aaa` | no |
| `audit/securite-2026-11-15` | `9939413ad492d89af41fc28ce4d05c8130f45d03` | no |
| `audit/security-multisocietes-review-20261116-run3` | `4acf4d365c89d3152892d49515e9570d0be98eed` | no |
| `audit/ui-runtime-pages-polish-20261113` | `094c34f33a457633e334b46538ff3bba606a4597` | no |
| `audit/visual-viewport-offset-regression-20261116` | `f744b20396781fde17daa074380ca02c6a9e2d3c` | no |
| `automation/audit-fixes-20261116-0150` | `a423dca17e30edf84e6708cc470a6bf2ea995edb` | no |
| `automation/visual-viewport-notifications-20261116-0243` | `64f5b2c2ec8eb5e86f83a9661ff9596f329522d0` | no |
| `brand/sunupilot-identity-foundation` | `63f8eb27a5ff410c7f1c96e844f8114289531b40` | no |
| `chore/emil-design-skills-20261117` | `70f8ea190bfd00316cfe8de2ccf5d9bcc83b193a` | no |
| `ci/lint-history-protection-backend-20261122` | `32d1c1f56cb9c2b46890aae5b0b72136b13660a8` | no |
| `ci/package-main-after-pr39-pr40` | `8c725a00cd3b353684033e3c7219737af487d437` | no |
| `ci/real-restore-smoke-20261117` | `8864ab9478d019205f2c5a58fc206712c7129070` | no |
| `ci/workspace-ui-structure-tests-20261122` | `2a09ccf8bfdb3b26b84482b7445902f266fb1dbf` | no |
| `docs/backup-offsite-pinned-rclone-20261122` | `76aa447d8beefa49dc7da11d334144bd2c75427f` | no |
| `docs/business-plan-samafacture-pro` | `ac07f0788ee60f1db6fc3a8a68bf4d0784b9e2a7` | no |
| `docs/correct-one-time-plan-billing-2026-11-16` | `43592f99b6f72cadc369b76c9489d4a831e21094` | no |
| `docs/fix-staging-compose-runbook-20261116` | `22c0dae280e3e7ee7305bd8b761c5cfebe2969bf` | no |
| `docs/improvement-plan-20261121` | `ff2cae7bd378680ec20a9998851665a166c539c8` | no |
| `docs/improvement-plan-main-20261122` | `3d51f0afb669ebdddc18c2601cd123d89c206683` | no |
| `docs/local-docker-bootstrap-20261117` | `eeea9c4a71001f32889bf302a78cff65e360a353` | no |
| `docs/production-env-security-guidance-20261122` | `be0f2789ccebd103c9fbf8da28bd1586eddb1549` | no |
| `docs/subscription-monthly-architecture-20261117` | `430e2010b1bee958b1b26435c1f8462a6e503ad2` | no |
| `docs/subscriptions-current-state-20261117` | `e618e88c7be3178be3f9d8bd0c2229fba53b3767` | no |
| `docs/ui-polish-plans-20261117` | `137a9b01d3ea60ffeb7ec3a0338607638871acd2` | no |
| `feat/abonnement-choix-moyen-paiement` | `3f32787dd561d01e91b1f784fb238376b2220b50` | no |
| `feat/accounting-expense-payment-mode-20261121` | `08a1c025744a7af2d795c7a761607ac1bf71b424` | no |
| `feat/dashboard-reference-layout` | `11d55850b64702302a922185af02440394131541` | no |
| `feat/dashboard-reference-modules-20261119` | `f3cbbc669629fa730783bdbfbe6baf72ab5d81c0` | no |
| `feat/dashboard-reference-redesign-20261112` | `6cf80f4c547b62d41bd428b44bbf87be3b50f3c4` | no |
| `feat/enterprise-command-center-20261117` | `ae7e0e8e59f0dfbe7ea8a7fee49b8ea375379e00` | no |
| `feat/enterprise-company-pagination-20261117` | `3b8d8ebc171b7c5053d865c0a29b589793094a20` | no |
| `feat/enterprise-multi-company-foundation-20261116` | `c19e12959de8895a8ecf59e4d0e3319c74e95bbe` | no |
| `feat/enterprise-page-structure-2026-11-13` | `e39910166ba43eaa1852844883c5ddc649b170cf` | no |
| `feat/enterprise-page-structure-v2-2026-11-13` | `745a98b586ef19f7747df9dfa1c19af97ee233d2` | no |
| `feat/enterprise-pages-v2-2026-11-13` | `e9992176d76f18f9e48f7d1d98378b1d9070cb78` | no |
| `feat/enterprise-workspace-ux-20261117` | `14cdd3c48c0b089bc35493bf93d4b4349c88ff1a` | no |
| `feat/invoice-stock-warehouse-20261119` | `30bcfaa58ebf4960c2308390b586cb13c5adb466` | no |
| `feat/invoice-template-gallery-2026-11-15-v2` | `570bf60cad5f73bb7f1fe3e65646f29e65068b9f` | no |
| `feat/invoice-template-gallery-2026-11-15` | `70d95aac18e38b1aac466f1f184f8fa536caa638` | no |
| `feat/invoice-templates-pro-enterprise-20261117` | `4de3da4409263f2ff1deff7350c488d18a5f7fb2` | no |
| `feat/invoice-warehouse-stock-20261119` | `e9ac3c69d928be8ba3d8d6800f5e70ea84230a68` | no |
| `feat/invoice-warehouse-stock-main-20261119` | `158a9e0663d1e105ccc11ab60402041295c333a6` | no |
| `feat/mobile-config-preflight` | `23c1cf95bf459118324dfece3580ece4470b9b34` | no |
| `feat/monthly-invoice-quota-v8-2026-11-15` | `f3b2690913b9897c8aa9b6a55dee08e5fc1d18aa` | no |
| `feat/ohada-account-mappings-20261122` | `ca3cb8fbf594f41c39cfe5958e3bb04520825864` | no |
| `feat/phases-2-4-paiements-compta-achats-20261112` | `f028da5802241ccd8df687875a2ba4787a5145b6` | no |
| `feat/phases-5-7-portal-international-automation-20261112` | `a3a43402f59d54be7f0c4cc1e5ac23d04f9f333b` | no |
| `feat/professional-subscription-page-2026-11-15` | `cf58665a9083cb4e52dc24cce75cdb2291632d6e` | no |
| `feat/responsive-scaling-2026-11-15` | `f7d10afed88a1cf03baac276836dc6f0165e09d6` | no |
| `feat/sidebar-icon-label-navigation-20261117` | `c8bc6af9181bc124d95e361d350422f49821eea3` | no |
| `feat/sidebar-navigation-visual-refresh-20261117` | `314c06e7e9ec2fc39145b1216058fddf4043c418` | no |
| `feat/subscription-engine-local-simulation-20261117` | `c077af1465c262e19f309c746ff3c84f332b7f5e` | no |
| `feat/sunupilot-dashboard-reference` | `11d55850b64702302a922185af02440394131541` | no |
| `feat/templates-factures-devis-complets` | `81aa9fa67012f19b69c2df4a0c72490b14dea285` | no |
| `feat/topbar-notifications-bell-20261112` | `a36472e66f180124a699c01d10b26012e4b8b079` | no |
| `feat/ui-motion-visual-recette-20261112` | `1ae8c307b3cf394e8103f5e40237494723c4dae1` | no |
| `feat/workspace-settings-navigation-20261121` | `868027e1edc8c0e7ad1d5f25e78d90d24b50c5f4` | no |
| `feat/5-nouveaux-modeles-facture` | `342a3e43c5b8801411892d72d04be6faa2ee7d5d` | no |
| `feat/15-day-trial-entitlements-20261121` | `e3b91dc4ae459fc4fdd65b63dd440f632ccd4217` | no |
| `feature/ohada-expense-account-mappings-20261122` | `6f82b82dfab5c6d4a8b0fc0a466b331a2ebab3c7` | no |
| `feature/video-presentation-spark-sunupilot` | `29dd7ccc8084ce91f9c7eee975610fdd039a67f4` | no |
| `fix/a11y-settings-labels-20261116` | `4b275916eefa7253b2cc11b3c0a150d9050a918d` | no |
| `fix/accessibility-contrast-focus-main-20261121` | `0b819127cc8bdbf8410611642d51b257431e84a6` | no |
| `fix/accessibility-template-preview-contrast-20261122` | `6b3cd9ffd5446b13e71ca9108c61ade2fde4af5e` | no |
| `fix/accounting-event-audit-retention-v22-20261122` | `90b718abcbef7cbd01ec39dcf368488d0eafdf65` | no |
| `fix/accounting-event-audit-retention-v22-run2-20261122` | `5b6ba8bf3b05e4155697159c60cf4b5051196bf8` | no |
| `fix/accounting-invoice-cancellation-reversal-20261121` | `ba756d09888474477a19c182b42c1298ef092dd8` | no |
| `fix/accounting-refund-journal-reversal-20261121` | `b45f479754341f8111e5233a09cec21f76a762da` | no |
| `fix/atomic-backup-publish-2026-11-15` | `081d931236086aca8f53eebb312540c73a9934b7` | no |
| `fix/atomic-encrypted-backups-2026-11-15` | `03a36a61b7c4e30321066c78babe95c67bda363e` | no |
| `fix/audit-devise-relances-escape` | `4e848f3b98b1bc93635f0dab01a7d752fd2b18cd` | no |
| `fix/backup-directory-permissions-20261122` | `1c3a12bacd9c6a761247756562ea77ebe50ef41d` | no |
| `fix/backup-retention-guard-2026-11-16` | `e277ca8a841204b0cdfd98d497311ffe87a5c28e` | no |
| `fix/ci-serial-tests-2026-11-15` | `4a74afa8dceaebc1dcb7dbaf6e88b175e6438fde` | no |
| `fix/client-delete-history-protection-20261122` | `f2aada8d5c016998591fc0b31771de11c3b8ed50` | no |
| `fix/company-settings-responsive-grid-main-20261123` | `9888f76fcee4a631a6bd33473c6d7fa4a8800b1f` | no |
| `fix/dashboard-donut-count-20261118` | `2d4d7619350a6fe5ddc50868cb7e4d3ca5d4cb39` | no |
| `fix/docker-context-secrets-and-lockfile-2026-11-15` | `52d4b81b3ff86b73e9b7956cb31e217d87a8160b` | no |
| `fix/docker-local-startup-mysql-redis-swagger` | `2f021548666e2575035ff4d45ca9936f4ceaf7b7` | no |
| `fix/enterprise-badge-contrast-current-main-run19-20261123` | `268ccf303e4332f47e73910043f601e4083b97e0` | no |
| `fix/enterprise-badge-contrast-main-20261122` | `52021018d7894b637d311af7d036cea220248195` | no |
| `fix/enterprise-invitation-email-proof-20261116` | `4347d572f4e78fe057fc3595d677619abe74e745` | no |
| `fix/expense-ledger-protection-20261122` | `4e0f2a893812df88a2dd4a9bed2c26224ea9f656` | no |
| `fix/invoice-delete-history-guard-20261122` | `2c7f3cbde915e19ea484236c7a76ad7008f485ae` | no |
| `fix/invoice-footer-stamp-mobile-20261121` | `7c562612e897e2ed7af93e494a4cf79bbb8da5e1` | no |
| `fix/invoice-mobile-table-cards-20261121` | `67f7721d512370db3b40413a12f212226324ca76` | no |
| `fix/invoice-pdf-continuation-identity-20261121` | `885b7b42a7d4dc56ba2c3dc6a69b5b3bcf7a8b1d` | no |
| `fix/invoice-print-and-payment-stamp-2026-11-15` | `ed6c1467affe76a6e055af95b943a44cedc09891` | no |
| `fix/invoice-print-banner-geometry-20261121` | `0ec7c3eeb59fa70465d4a0037e6c3c2d461bb2df` | no |
| `fix/invoice-print-banner-spacing-20261122` | `4eec7b226911cea55d47ecffba9473a5456fa51e` | no |
| `fix/invoice-print-typography-20261118` | `d8805a202dd96748e83e3d3a43b48e2787b41b63` | no |
| `fix/invoice-settlement-integrity-2026-11-15` | `30318cf3cf48be4f0a6ccd9bda0cdac699211341` | no |
| `fix/invoice-stock-principal-warehouse` | `383c885a969bf3da2ce8e06acc8829a5f1d1e60b` | no |
| `fix/light-dark-theme-consistency-20261118` | `bf497de04d01096648f201619c29b63b7321b7a4` | no |
| `fix/mobile-invoice-line-columns` | `9019ec2dfca2c067532f493fb49f7dbb33ba9f0a` | no |
| `fix/mobile-nonpublic-hostnames-20261123` | `27fa8c2ec2e2e87b5f6b58a98b07052f5a5bce75` | no |
| `fix/mobile-nonpublic-hostnames-current-main-20261123` | `c0bc6a6531e5ad76804878d98059f1e64acc1df9` | no |
| `fix/mobile-preflight-current-main-20261123` | `f9bb3b9b63313663883a27bf35629ce0e6a2a7cd` | no |
| `fix/mobile-preflight-main-20261123` | `8971961468b831e25e1751d2619ec3b7ed8094e0` | no |
| `fix/mobile-preflight-main-after-security-20261123` | `6fc60bdca4a311822a0333f83a02000c495f4d36` | no |
| `fix/mobile-workspace-domain-rail-main-20261123` | `21a3e371eec79eb52ef6962458a1d3ef34aebb0d` | no |
| `fix/monthly-invoice-quota-schema-v8-2026-11-15` | `69028f5946e93f259fdcd69cb7d3f9c913b99d31` | no |
| `fix/mysql-backup-limited-privileges-20261122` | `bdca6bec1c5b98747571907dffa91195c15293b7` | no |
| `fix/navigation-compact-sidebar-2026-11-13` | `508607c7cc69e560b539438c44cbc2330b035a6e` | no |
| `fix/pdf-headless-user-formatting-20261121` | `862d31a76342f47c4df9dbe2690dcaf914360921` | no |
| `fix/pdf-pagination-extras-flow-20261117` | `2e7dd32a3eec318051d5891e8c03f6447ae2afba` | no |
| `fix/pdf-print-pagination-20261117` | `b8e344915ceaf843a79fee82f0f9aba784cf2d9f` | no |
| `fix/pdf-stream-ack-payment-disclosures-20261116` | `a576e5e1fec88c5a0e7eb8272e791cdb2a49bcab` | no |
| `fix/pdf-worker-db-readiness-2026-11-16` | `59d341a154621ef4e15acb77a402a1a85534e969` | no |
| `fix/pdf-worker-health-and-sidebar-icons-2026-11-15` | `04304461cafad9c2576015e10dc59abf7437f329` | no |
| `fix/pdf-worker-wait-for-api-health-2026-11-15` | `941f235f5f4b625af5038b1dc17710fe5db02acf` | no |
| `fix/pro-orders-base-currency-main-20261123-run23` | `fa92faeccf886fa3d67f4c8003fbc7b2f0ccf5ad` | no |
| `fix/pro-orders-tenant-currency-20261123` | `953489e79a9a6779b03e9c436559b925904f5635` | no |
| `fix/pro-orders-tenant-currency-main-20261123` | `a078a351d714fa05e4ecf5901040135e06dc6383` | no |
| `fix/pro-workspace-status-contrast-20261122` | `baa9ea6a688121c580b9f95c1933a2a15663f07f` | no |
| `fix/product-delete-stock-history-protection-20261122` | `27d5a6c27d5d3066c1f6aaa04e03945caa165974` | no |
| `fix/purchase-receipt-warehouse-deadlock-20261119` | `f0f43c3d1e7a920b470894275f5d9754f306dae1` | no |
| `fix/quota-registry-initialization-robustness-2026-11-15` | `c8ea3204dcdc805619a5e3bb83f318ffa97638a3` | no |
| `fix/quote-executive-a4-pagination-20261121` | `400ce60ddb8f23e4f37fe836058f180682c2f0c7` | no |
| `fix/quote-warehouse-resilience-20261120` | `8d0a4d2990174f950dcb334fbe1e6323a7d5e86f` | no |
| `fix/refund-payment-method-mapping-20261122` | `3265810b25f3cb11cf416eca8ecb8852cfd9f547` | no |
| `fix/refund-payment-method-mapping-rebased-20261122` | `17d25a5e3686f0016e94da9fe354b2f6e23b7afe` | no |
| `fix/revoke-jwt-on-logout-2026-11-15` | `a209392784175e725ef82c1e73dab3240da9d19e` | no |
| `fix/session-revocation-and-payment-timeouts-2026-11-15` | `46f280761b6149260eeca0e1bbab3ab5304d3118` | no |
| `fix/sidebar-aria-current-2026-11-15` | `1066c1c4d02ebeebd571fc45534c6539b374963c` | no |
| `fix/subscription-disabled-state-tests-docs-20261117` | `60f57e272b273364a556781c18bc71fdee4806e3` | no |
| `fix/subscription-icons-main-2026-11-15` | `3316731d6119e6b43a9cdef8c935083f0b4a6979` | no |
| `fix/sunupilot-pwa-lifecycle` | `86da24a1c6e8fc6d6b1dc57d648d1c2cbaa0722f` | no |
| `fix/team-invitation-email-proof-20261117` | `8e1b84dffe598350c88ed2442e8df06339507c7e` | no |
| `fix/tenant-currency-atomic-current-main-20261123` | `0abc0440d11b67ad513bc1e2793d7bb558d37229` | no |
| `fix/tenant-currency-atomic-latest-main-20261123` | `198480fe89ddaf8bba3216d9a14fe6fec06bae21` | no |
| `fix/tenant-currency-atomic-lock-20261123` | `70b4c68858997f8fcfa61dd40fb415a31b9b3f22` | no |
| `fix/tenant-currency-atomic-lock-main-20261123` | `4a73d68d91ff3d7360e868d034bc6a1d8816966f` | no |
| `fix/tenant-currency-atomic-main-20261123` | `50b9fcc21b6655347d4feac1eb319dad38982996` | no |
| `fix/tenant-currency-final-main-20261123` | `0c046f9ed60a097889fe2d27158ab87c41a3233c` | no |
| `fix/ui-icons-legibility-2026-11-15` | `0d7c5390f47444a13eae765a083e7bc2cdafb5c0` | no |
| `fix/ui-responsive-polish-20261117` | `5efe69b69853850e99e11626b3272cc2e57a9fb8` | no |
| `fix/visual-qr-fixture-20261121` | `df6070e367ae720a789e1c190408819e56db86cd` | no |
| `fix/webhook-local-timezone-dynamic-currency-20261123` | `b07000daa7663196de68a42bc0ba011f4f4cf7f9` | no |
| `fix/whatsapp-country-guard-2026-11-16` | `a49756cd21ec95f952044412b0538c1938564a90` | no |
| `improve/pdf-page3-balance-20261121` | `115ab9f0e2f15a90807434612edac6b49d084103` | no |
| `improve/pdf-page3-balance-main-20261121` | `3bab7c770052a811b14273b380196c63940fa466` | no |
| `integration/main-company-invitation-email-proof-20261117` | `70750be430c83c4bf3ff369ad453c7b1fd1af511` | no |
| `integration/reconcile-main-v21-20261122` | `e8b2dc9c6f20ed40d0b49327f276366afe45a8b5` | no |
| `integration/schema-v21-accounting-trial-20261122` | `decb8da2e48e8f7a93fc63202f00fe0b4170e6e2` | no |
| `integration/schema-v22-main-reconciled-20261122` | `62ea473892b11439074b75ea58e674e2f60e5a81` | no |
| `integration/sunupilot-video-main-20261121` | `817b10da7b85ce9ca3eb0d4a8312f258349b5647` | no |
| `main` | `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c` | yes |
| `qa/test-pdf-24-modeles` | `d3b70a09c598195713cc7e9b49d03b7db52a1404` | no |
| `rebase/pr106-main-20261121-run1` | `383c885a969bf3da2ce8e06acc8829a5f1d1e60b` | no |
| `rebase/pr110-main-20261121-run1` | `ca1d1abdc9c6deef1a6dce9c36f27d0a2486df58` | no |
| `rebrand/optigest` | `3f70466d0b6bc1ab41f082e31324d5702bd39966` | no |
| `reconciliation/schema-v21-main-base-20261122` | `d9c428aaa916a54994d4d5064543facf4eead29c` | no |
| `security/docker-ignore-local-secrets-2026-11-15` | `4d2c20e28ee29d9c18538d8775e64a73772ea8ce` | no |
| `security/immediate-session-revocation-2026-11-16` | `d6887ce043b8c3871a03342943ee270375f7aff9` | no |
| `security/invoice-client-tenant-current-main-after-181-20261123` | `39f27a324412cefae046181e22430ba79f24b5c5` | no |
| `security/invoice-client-tenant-scope-20261123` | `5f554950cba1c4f0ea5dc6383b4f4588f7b61c64` | no |
| `security/invoice-client-tenant-scope-current-main-20261123` | `4a13eea209a8b02cf0096bb1f99d287be529653e` | no |
| `security/invoice-list-verification-code-redaction-20261122` | `1c6bf875b98273cac0c00ac5c306aa22dcafb8d3` | no |
| `security/invoice-tenant-scope-final-main-20261123` | `41cc7eac79faeca8e061122cfccc4d4eb6bccb00` | no |
| `security/invoice-verification-code-redaction-main-20261123-run7` | `f68ab94eb1d4c2c01d08331321cda293ab0a264f` | no |
| `security/redact-secret-urls-in-logs-2026-11-16` | `d27f55b581ba7db3da5decd411d26c399531bc94` | no |
| `security/redact-verification-codes-current-main-run19-20261123` | `2059e3744ce88eface5c00e52c459c7e6edc5235` | no |
| `security/redact-verification-codes-main-current-20261123-run12` | `fb6324d34b024072f98d7c1347a0da330922aba4` | no |
| `security/refund-statement-tenant-join-20261123-run14` | `b212dbc0bac111c77023c1ad42c58514786aeaca` | no |
| `security/reset-token-hash-redaction-main-current-20261123` | `262707e11d6f362820bf07018647df4312791444` | no |
| `security/tenant-relations-main-current-20261123-run12` | `970832f4bb45bb348dae99967183e917beeeb7e3` | no |
| `test/accessibility-audit-business-pages-20261118` | `468caba29865f38eaa788f043f2ae164b4b965f9` | no |
| `test/accessibility-dark-keyboard-20261118` | `86aeeb6f4be28ad4d76622e3a26ac0304326dc73` | no |
| `test/accessibility-dark-keyboard-rebased-20261120` | `722b5bfce06704a645dbe27b1516333e980dd920` | no |
| `test/backup-atomic-visibility-2026-11-15` | `f4c463e5ec768eee125a7d0f623f0ae4626ea38d` | no |
| `test/dark-theme-zoom-200-sweep-20261118` | `6fe85dfd3076e8024a854405bed4f5051bd1af72` | no |
| `test/expense-accounting-mappings-regression-20261122` | `46d95cfd1e0dba639c31661e48f2b27026f6b20f` | no |
| `test/free-trial-expiry-session-guard-20261122` | `29932fbbefe39bad5bb5c3a187a6ade99cafafd3` | no |
| `test/invoice-long-pdf-pagination-20261121` | `41fb9896ab4b1393f35082a5fb988e5bc9bceb5d` | no |
| `test/invoice-short-pdf-one-page-20261121` | `c592c7046f78ebfb127ce5490b4e08d31419d49f` | no |
| `test/invoice-short-pdf-one-page-main-20261121` | `f49d352125352d009da9abebd2ceecbb122c6d6b` | no |
| `test/ohada-expense-ledger-integrity-20261121` | `3873c1d1dbaa114af2aec991b1f49e48702f82a1` | no |
| `test/pdf-font-embedding-and-visual-print-20261118` | `42b5a0bcf4393a6b4c513c2a621c9a3b7576efa6` | no |
| `test/security-auth-reset-token-redaction-20261122` | `a10bc748a38b05a80caf21c9f2f16da5e729d2e1` | no |
| `test/team-invitation-expiry-email-change-20261122` | `4fa9a6878a9804683581133e63ef8ef19dd28cd7` | no |
| `test/theme-dark-mobile-sweep-20261118` | `55c985deecd6b225030c2f6129afc446f97106ca` | no |
| `test/theme-dark-sweep-20261118` | `7bd4d2e94fe00a0de6413e4545bdc23895d49745` | no |
| `test/theme-light-desktop-sweep-20261118` | `dfe8ce45fdb4bed07a6d88c679ff46c601208a69` | no |
| `test/theme-light-mobile-sweep-20261118` | `b77108576d2ccaa14fbf618e6707cb903a99f73a` | no |
| `test/workspace-zoom-200-sweep-20261118` | `dd64ea0274ce4d01f30e5fe9a4097ba006d967b1` | no |
| `tooling/local-docker-test-bundle-20261112` | `b88eeebb659dc119848094f8ddc6d9894a3be569` | no |
| `ui/augmenter-logo-icones-sidebar` | `63af3d94dc35cc3534a58f467201f3dda3803493` | no |
| `ui/modern-responsive-polish` | `a2faa30e320e1ad09b4537201a4627dc909f5514` | no |
| `ux/dashboard-mobile-module-rail-20261122` | `53eadfe851b4ee3faf7122d485299025ea300808` | no |
| `ux/pro-workspace-mobile-domain-rail-20261122` | `185e0487c95489b8748c1d33418317c5aaf77eb7` | no |
| `ux/settings-company-fields-grid-20261122` | `99670cdf29694c73e0a09038380af250704e89c3` | no |
| `ux/settings-company-fields-grid-main-20261123-run23` | `4518451df4e887ed584219d282530e3acf4734df` | no |

## Annexe B — inventaire exhaustif des Pull Requests (208)

Liste REST paginée (`state=all`, 3 pages). L'état `closed / merged` indique une PR dont `merged_at` est renseigné. Les références head et base sont celles du snapshot de l'annexe.

| PR | Titre | État | Head branch | Base | Head SHA |
|---|---|---|---|---|---|
| [#212](https://github.com/morn53426-ui/-samafacture-pro/pull/212) | docs(audit): rapport d'exécution Run 25 — 23 novembre | open | `audit/execution-report-20261123-run25` | `main` | `250599ffbe4cb2021597033688588c95591f336a` |
| [#211](https://github.com/morn53426-ui/-samafacture-pro/pull/211) | ux(settings): organiser les coordonnées entreprise en grille responsive | open | `ux/settings-company-fields-grid-main-20261123-run23` | `main` | `4518451df4e887ed584219d282530e3acf4734df` |
| [#210](https://github.com/morn53426-ui/-samafacture-pro/pull/210) | fix(currency): enforce company base currency for sales orders | open | `fix/pro-orders-base-currency-main-20261123-run23` | `main` | `fa92faeccf886fa3d67f4c8003fbc7b2f0ccf5ad` |
| [#209](https://github.com/morn53426-ui/-samafacture-pro/pull/209) | ux(settings): group company details in responsive grid | open | `fix/company-settings-responsive-grid-main-20261123` | `main` | `9888f76fcee4a631a6bd33473c6d7fa4a8800b1f` |
| [#208](https://github.com/morn53426-ui/-samafacture-pro/pull/208) | fix(ux): compact professional workspace domains on mobile | open | `fix/mobile-workspace-domain-rail-main-20261123` | `main` | `21a3e371eec79eb52ef6962458a1d3ef34aebb0d` |
| [#207](https://github.com/morn53426-ui/-samafacture-pro/pull/207) | docs(audit): execution report run 23 — 23 novembre | open | `audit/execution-report-20261123-run23` | `main` | `ea7de5bf856affcf35fb2c9c960237533f22b3ae` |
| [#206](https://github.com/morn53426-ui/-samafacture-pro/pull/206) | docs(audit): execution report run 22 — 23 novembre | open | `audit/execution-report-20261123-run22` | `main` | `6a8e2efea1468ce6636a9580ada38a66c9a8d09c` |
| [#205](https://github.com/morn53426-ui/-samafacture-pro/pull/205) | docs(audit): execution report run 21 — 23 novembre | closed / merged | `audit/execution-report-20261123-run21` | `main` | `55ac9a0bc2af9df5136f0a09b4ab358a74b414ed` |
| [#204](https://github.com/morn53426-ui/-samafacture-pro/pull/204) | docs(audit): rapport d'exécution run 20 — 23 novembre | closed / merged | `audit/execution-report-20261123-run20` | `main` | `78dab3e621bc78b1e96e31c36ec73bde8ae5120b` |
| [#203](https://github.com/morn53426-ui/-samafacture-pro/pull/203) | security(invoices): redact verification codes from list responses | open | `security/redact-verification-codes-current-main-run19-20261123` | `main` | `2059e3744ce88eface5c00e52c459c7e6edc5235` |
| [#202](https://github.com/morn53426-ui/-samafacture-pro/pull/202) | fix(a11y): badge Entreprise lisible en thème sombre | closed / merged | `fix/enterprise-badge-contrast-current-main-run19-20261123` | `main` | `268ccf303e4332f47e73910043f601e4083b97e0` |
| [#201](https://github.com/morn53426-ui/-samafacture-pro/pull/201) | docs(audit): rapport d'exécution runs 15–17 — 23 novembre | open | `audit/execution-report-20261123-run15` | `main` | `63493905494fc1e1a54d9e277c03aba34c1e2b31` |
| [#200](https://github.com/morn53426-ui/-samafacture-pro/pull/200) | a11y(navigation): close mobile sidebar with Escape on current main | closed / merged | `a11y/sidebar-escape-main-current-run15` | `main` | `69180203cc2c694c3de029873b360d43d0b487ca` |
| [#199](https://github.com/morn53426-ui/-samafacture-pro/pull/199) | fix(security): scope client statement refunds to tenant payment | open | `security/refund-statement-tenant-join-20261123-run14` | `main` | `b212dbc0bac111c77023c1ad42c58514786aeaca` |
| [#198](https://github.com/morn53426-ui/-samafacture-pro/pull/198) | docs(audit): execution report run 14 — 23 November | open | `audit/execution-report-20261123-run14` | `main` | `e6cc9a40ab92f0eaf9fa9f5c1aa02150d449fb62` |
| [#197](https://github.com/morn53426-ui/-samafacture-pro/pull/197) | a11y(dashboard): keyboard skip link on current main | closed / merged | `a11y/dashboard-skip-link-main-current-run13` | `main` | `c2ba2ffb156d1aac7a418cba9e6cce73b362a86a` |
| [#196](https://github.com/morn53426-ui/-samafacture-pro/pull/196) | docs(audit): execution report run 13 — 23 November | open | `audit/execution-report-20261123-run13` | `main` | `539a9430c78f83908ce7b404d98804309b19d578` |
| [#195](https://github.com/morn53426-ui/-samafacture-pro/pull/195) | docs(audit): execution report run 12 — 23 November | open | `audit/execution-report-20261123-run12` | `main` | `b54c4b9fa1334b00663beb2ee26762a7f58e2853` |
| [#194](https://github.com/morn53426-ui/-samafacture-pro/pull/194) | security(tenant): harden invoice, client and payment isolation | closed / merged | `security/tenant-relations-main-current-20261123-run12` | `main` | `970832f4bb45bb348dae99967183e917beeeb7e3` |
| [#193](https://github.com/morn53426-ui/-samafacture-pro/pull/193) | security(invoices): redact verification codes from list responses | open | `security/redact-verification-codes-main-current-20261123-run12` | `main` | `fb6324d34b024072f98d7c1347a0da330922aba4` |
| [#192](https://github.com/morn53426-ui/-samafacture-pro/pull/192) | fix(currency): serialize tenant currency and first business writes | closed / merged | `fix/tenant-currency-final-main-20261123` | `main` | `0c046f9ed60a097889fe2d27158ab87c41a3233c` |
| [#191](https://github.com/morn53426-ui/-samafacture-pro/pull/191) | fix(currency): serialize tenant currency and first business writes | closed | `fix/tenant-currency-atomic-latest-main-20261123` | `main` | `198480fe89ddaf8bba3216d9a14fe6fec06bae21` |
| [#190](https://github.com/morn53426-ui/-samafacture-pro/pull/190) | fix(currency): serialize tenant currency and first business writes | open | `fix/tenant-currency-atomic-current-main-20261123` | `main` | `0abc0440d11b67ad513bc1e2793d7bb558d37229` |
| [#189](https://github.com/morn53426-ui/-samafacture-pro/pull/189) | fix(mobile): validate Capacitor public HTTPS before native builds | closed | `fix/mobile-preflight-current-main-20261123` | `main` | `f9bb3b9b63313663883a27bf35629ce0e6a2a7cd` |
| [#188](https://github.com/morn53426-ui/-samafacture-pro/pull/188) | security(tenant): enforce ownership across invoice-related records | open | `security/invoice-client-tenant-current-main-after-181-20261123` | `main` | `39f27a324412cefae046181e22430ba79f24b5c5` |
| [#187](https://github.com/morn53426-ui/-samafacture-pro/pull/187) | fix(mobile): guard Capacitor native builds on latest main | closed / merged | `fix/mobile-preflight-main-after-security-20261123` | `main` | `6fc60bdca4a311822a0333f83a02000c495f4d36` |
| [#186](https://github.com/morn53426-ui/-samafacture-pro/pull/186) | fix(mobile): block native builds until public HTTPS config is valid | closed | `fix/mobile-preflight-main-20261123` | `main` | `8971961468b831e25e1751d2619ec3b7ed8094e0` |
| [#185](https://github.com/morn53426-ui/-samafacture-pro/pull/185) | fix(currency): serialize tenant currency changes and first business writes | open | `fix/tenant-currency-atomic-main-20261123` | `main` | `50b9fcc21b6655347d4feac1eb319dad38982996` |
| [#184](https://github.com/morn53426-ui/-samafacture-pro/pull/184) | fix(mobile): validate Capacitor config before native build | closed | `fix/mobile-nonpublic-hostnames-current-main-20261123` | `main` | `c0bc6a6531e5ad76804878d98059f1e64acc1df9` |
| [#183](https://github.com/morn53426-ui/-samafacture-pro/pull/183) | fix(currency): serialize tenant currency changes and orders | open | `fix/tenant-currency-atomic-lock-main-20261123` | `fix/pro-orders-tenant-currency-main-20261123` | `4a73d68d91ff3d7360e868d034bc6a1d8816966f` |
| [#182](https://github.com/morn53426-ui/-samafacture-pro/pull/182) | fix(pro): use tenant currency for orders and lock history | open | `fix/pro-orders-tenant-currency-main-20261123` | `main` | `a078a351d714fa05e4ecf5901040135e06dc6383` |
| [#181](https://github.com/morn53426-ui/-samafacture-pro/pull/181) | test(security): cover reset token redaction on current main | closed / merged | `security/reset-token-hash-redaction-main-current-20261123` | `main` | `262707e11d6f362820bf07018647df4312791444` |
| [#180](https://github.com/morn53426-ui/-samafacture-pro/pull/180) | docs(audit): execution report run 11 — 23 November | open | `audit/execution-report-20261123-run11` | `main` | `2f1b11e77d5120fc14f4124460c4dda632e1850e` |
| [#179](https://github.com/morn53426-ui/-samafacture-pro/pull/179) | security(invoices): enforce client and payment tenant ownership | open | `security/invoice-client-tenant-scope-20261123` | `main` | `5f554950cba1c4f0ea5dc6383b4f4588f7b61c64` |
| [#178](https://github.com/morn53426-ui/-samafacture-pro/pull/178) | fix(currency): serialize tenant currency changes and orders | open | `fix/tenant-currency-atomic-lock-20261123` | `fix/pro-orders-tenant-currency-20261123` | `70b4c68858997f8fcfa61dd40fb415a31b9b3f22` |
| [#177](https://github.com/morn53426-ui/-samafacture-pro/pull/177) | security(invoices): redact verification code from list API | open | `security/invoice-verification-code-redaction-main-20261123-run7` | `main` | `f68ab94eb1d4c2c01d08331321cda293ab0a264f` |
| [#176](https://github.com/morn53426-ui/-samafacture-pro/pull/176) | docs(audit): rapports d'exécution runs 6 à 10 — 23 novembre | open | `audit/execution-report-20261123-run6` | `main` | `8083f938c80ccba4ff499cdf3a6bddef95f29f3f` |
| [#175](https://github.com/morn53426-ui/-samafacture-pro/pull/175) | docs(audit): rapport d'exécution run 5 — 23 novembre | open | `audit/execution-report-20261123-run5` | `main` | `f9f95b734deb3fe9ecacfbb257686085b3fa53a6` |
| [#174](https://github.com/morn53426-ui/-samafacture-pro/pull/174) | fix(mobile): reject reserved non-public hostnames | closed | `fix/mobile-nonpublic-hostnames-20261123` | `main` | `27fa8c2ec2e2e87b5f6b58a98b07052f5a5bce75` |
| [#173](https://github.com/morn53426-ui/-samafacture-pro/pull/173) | feat(mobile): block native builds until HTTPS domain is configured | closed | `feat/mobile-config-preflight` | `main` | `23c1cf95bf459118324dfece3580ece4470b9b34` |
| [#172](https://github.com/morn53426-ui/-samafacture-pro/pull/172) | docs(audit): rapport d'exécution run 4 — 23 novembre | open | `audit/execution-report-20261123-run4` | `main` | `14688f7a8fd8fe5d9b3cdde50bb546ac7485f30e` |
| [#171](https://github.com/morn53426-ui/-samafacture-pro/pull/171) | fix(pro): use tenant currency for orders and lock history | open | `fix/pro-orders-tenant-currency-20261123` | `main` | `953489e79a9a6779b03e9c436559b925904f5635` |
| [#170](https://github.com/morn53426-ui/-samafacture-pro/pull/170) | docs(audit): rapport d'exécution run 3 — 23 novembre | open | `audit/execution-report-20261123-run3` | `main` | `6fa59a42ebb12bb9d6f8a266059125b81991ff95` |
| [#169](https://github.com/morn53426-ui/-samafacture-pro/pull/169) | docs(audit): rapport d'exécution run 2 — 22 novembre | open | `audit/execution-report-20261122-run2` | `main` | `dff61fb42a429fce93ed1fc6f0a3c9f355ced6f4` |
| [#168](https://github.com/morn53426-ui/-samafacture-pro/pull/168) | fix: fuseau local, devise du tenant et isolation des routes | closed / merged | `fix/webhook-local-timezone-dynamic-currency-20261123` | `main` | `b07000daa7663196de68a42bc0ba011f4f4cf7f9` |
| [#167](https://github.com/morn53426-ui/-samafacture-pro/pull/167) | fix: devise des emails, relances impayés et échappement HTML | closed / merged | `fix/audit-devise-relances-escape` | `main` | `4e848f3b98b1bc93635f0dab01a7d752fd2b18cd` |
| [#166](https://github.com/morn53426-ui/-samafacture-pro/pull/166) | docs(audit): rapport d'exécution initial du 22 novembre | open | `audit/execution-report-20261122-run1` | `main` | `dc7e6f55c5f7d357400f78c26dcfa469b75c3cef` |
| [#165](https://github.com/morn53426-ui/-samafacture-pro/pull/165) | docs(backup): sécuriser le transfert hors serveur rclone | closed / merged | `docs/backup-offsite-pinned-rclone-20261122` | `main` | `76aa447d8beefa49dc7da11d334144bd2c75427f` |
| [#164](https://github.com/morn53426-ui/-samafacture-pro/pull/164) | test(security): empêcher la divulgation des hashes de réinitialisation | closed | `test/security-auth-reset-token-redaction-20261122` | `main` | `a10bc748a38b05a80caf21c9f2f16da5e729d2e1` |
| [#163](https://github.com/morn53426-ui/-samafacture-pro/pull/163) | security(backup): restreindre les permissions du dossier de sauvegarde | closed / merged | `fix/backup-directory-permissions-20261122` | `main` | `1c3a12bacd9c6a761247756562ea77ebe50ef41d` |
| [#162](https://github.com/morn53426-ui/-samafacture-pro/pull/162) | test(security): couvrir expiration et changement email des invitations equipe | closed / merged | `test/team-invitation-expiry-email-change-20261122` | `main` | `4fa9a6878a9804683581133e63ef8ef19dd28cd7` |
| [#161](https://github.com/morn53426-ui/-samafacture-pro/pull/161) | ux(dashboard): réduire le défilement mobile des modules | closed / merged | `ux/dashboard-mobile-module-rail-20261122` | `main` | `53eadfe851b4ee3faf7122d485299025ea300808` |
| [#160](https://github.com/morn53426-ui/-samafacture-pro/pull/160) | fix(backup): compatible avec le compte MySQL limité de Docker | closed / merged | `fix/mysql-backup-limited-privileges-20261122` | `main` | `bdca6bec1c5b98747571907dffa91195c15293b7` |
| [#159](https://github.com/morn53426-ui/-samafacture-pro/pull/159) | security(invoices): retirer le code public de la liste paginée | closed | `security/invoice-list-verification-code-redaction-20261122` | `main` | `1c6bf875b98273cac0c00ac5c306aa22dcafb8d3` |
| [#158](https://github.com/morn53426-ui/-samafacture-pro/pull/158) | docs(security): corriger les conseils CORS et proxy | closed / merged | `docs/production-env-security-guidance-20261122` | `main` | `be0f2789ccebd103c9fbf8da28bd1586eddb1549` |
| [#157](https://github.com/morn53426-ui/-samafacture-pro/pull/157) | a11y(navigation): fermer le menu mobile avec Échap | open | `a11y/mobile-sidebar-escape-focus-20261122` | `main` | `c37403034a25bad6d4ecd0867066ce8c258bdd9c` |
| [#156](https://github.com/morn53426-ui/-samafacture-pro/pull/156) | a11y(dashboard): ajouter un accès clavier au contenu principal | open | `a11y/dashboard-skip-navigation-20261122` | `main` | `8f45795c3df521ffb021947d5376bfaa22a832ca` |
| [#155](https://github.com/morn53426-ui/-samafacture-pro/pull/155) | ux(settings): grille responsive pour les coordonnées entreprise | open | `ux/settings-company-fields-grid-20261122` | `main` | `99670cdf29694c73e0a09038380af250704e89c3` |
| [#154](https://github.com/morn53426-ui/-samafacture-pro/pull/154) | ux(workspace): navigation mobile compacte par domaine | open | `ux/pro-workspace-mobile-domain-rail-20261122` | `main` | `185e0487c95489b8748c1d33418317c5aaf77eb7` |
| [#153](https://github.com/morn53426-ui/-samafacture-pro/pull/153) | test(trial): vérifier l'expiration sur la première requête protégée | open | `test/free-trial-expiry-session-guard-20261122` | `main` | `29932fbbefe39bad5bb5c3a187a6ade99cafafd3` |
| [#152](https://github.com/morn53426-ui/-samafacture-pro/pull/152) | test(accounting): couvrir les correspondances OHADA des dépenses | closed / merged | `test/expense-accounting-mappings-regression-20261122` | `main` | `46d95cfd1e0dba639c31661e48f2b27026f6b20f` |
| [#151](https://github.com/morn53426-ui/-samafacture-pro/pull/151) | fix(print): preserve full-width invoice banners on A4 | closed / merged | `fix/invoice-print-banner-spacing-20261122` | `main` | `4eec7b226911cea55d47ecffba9473a5456fa51e` |
| [#150](https://github.com/morn53426-ui/-samafacture-pro/pull/150) | feat(accounting): configure OHADA sales and expense mappings | closed / merged | `feat/ohada-account-mappings-20261122` | `main` | `ca3cb8fbf594f41c39cfe5958e3bb04520825864` |
| [#149](https://github.com/morn53426-ui/-samafacture-pro/pull/149) | feat(accounting): configure expense category account mappings (schema v23) | closed | `feature/ohada-expense-account-mappings-20261122` | `main` | `6f82b82dfab5c6d4a8b0fc0a466b331a2ebab3c7` |
| [#148](https://github.com/morn53426-ui/-samafacture-pro/pull/148) | reconcile: port trial and accounting protections (schema v22) onto current main | closed / merged | `reconciliation/schema-v21-main-base-20261122` | `main` | `d9c428aaa916a54994d4d5064543facf4eead29c` |
| [#147](https://github.com/morn53426-ui/-samafacture-pro/pull/147) | integration: réconcilier comptabilité OHADA et essai gratuit v21 avec main actuel | closed | `integration/reconcile-main-v21-20261122` | `main` | `e8b2dc9c6f20ed40d0b49327f276366afe45a8b5` |
| [#146](https://github.com/morn53426-ui/-samafacture-pro/pull/146) | fix(integration): reconcile OHADA, 15-day trial and audit retention on current main | closed | `integration/schema-v22-main-reconciled-20261122` | `main` | `62ea473892b11439074b75ea58e674e2f60e5a81` |
| [#145](https://github.com/morn53426-ui/-samafacture-pro/pull/145) | fix(accounting): retain invoice reversal events (schema v22) | open | `fix/accounting-event-audit-retention-v22-run2-20261122` | `integration/schema-v21-accounting-trial-20261122` | `5b6ba8bf3b05e4155697159c60cf4b5051196bf8` |
| [#144](https://github.com/morn53426-ui/-samafacture-pro/pull/144) | fix(accounting): retain invoice reversal events on invoice deletion (schema v22) | closed | `fix/accounting-event-audit-retention-v22-20261122` | `integration/schema-v21-accounting-trial-20261122` | `90b718abcbef7cbd01ec39dcf368488d0eafdf65` |
| [#143](https://github.com/morn53426-ui/-samafacture-pro/pull/143) | fix(accounting): map cheque payments to bank and reject unknown methods | closed | `fix/refund-payment-method-mapping-rebased-20261122` | `integration/schema-v21-accounting-trial-20261122` | `17d25a5e3686f0016e94da9fe354b2f6e23b7afe` |
| [#142](https://github.com/morn53426-ui/-samafacture-pro/pull/142) | feat(accounting, trial): integrate invoice lifecycle and 15-day trial on schema v21 | open | `integration/schema-v21-accounting-trial-20261122` | `main` | `decb8da2e48e8f7a93fc63202f00fe0b4170e6e2` |
| [#141](https://github.com/morn53426-ui/-samafacture-pro/pull/141) | ci: add workspace UI structure regression checks | open | `ci/workspace-ui-structure-tests-20261122` | `feat/workspace-settings-navigation-20261121` | `2a09ccf8bfdb3b26b84482b7445902f266fb1dbf` |
| [#140](https://github.com/morn53426-ui/-samafacture-pro/pull/140) | ci(lint): couvrir les routes backend et tests de protection | open | `ci/lint-history-protection-backend-20261122` | `main` | `32d1c1f56cb9c2b46890aae5b0b72136b13660a8` |
| [#139](https://github.com/morn53426-ui/-samafacture-pro/pull/139) | fix(a11y): improve professional workspace status contrast | open | `fix/pro-workspace-status-contrast-20261122` | `main` | `baa9ea6a688121c580b9f95c1933a2a15663f07f` |
| [#138](https://github.com/morn53426-ui/-samafacture-pro/pull/138) | fix(inventory): protect products with stock or history | open | `fix/product-delete-stock-history-protection-20261122` | `main` | `27d5a6c27d5d3066c1f6aaa04e03945caa165974` |
| [#137](https://github.com/morn53426-ui/-samafacture-pro/pull/137) | fix(accounting): protect clients with linked history | open | `fix/client-delete-history-protection-20261122` | `main` | `f2aada8d5c016998591fc0b31771de11c3b8ed50` |
| [#136](https://github.com/morn53426-ui/-samafacture-pro/pull/136) | fix(accounting): protect posted expenses from edits and deletion | open | `fix/expense-ledger-protection-20261122` | `main` | `4e0f2a893812df88a2dd4a9bed2c26224ea9f656` |
| [#135](https://github.com/morn53426-ui/-samafacture-pro/pull/135) | fix(accounting): preserve issued invoice history | open | `fix/invoice-delete-history-guard-20261122` | `main` | `2c7f3cbde915e19ea484236c7a76ad7008f485ae` |
| [#134](https://github.com/morn53426-ui/-samafacture-pro/pull/134) | fix(a11y): badge Entreprise lisible en thème sombre | open | `fix/enterprise-badge-contrast-main-20261122` | `main` | `52021018d7894b637d311af7d036cea220248195` |
| [#133](https://github.com/morn53426-ui/-samafacture-pro/pull/133) | fix(a11y): corriger le contraste des aperçus de modèles | open | `fix/accessibility-template-preview-contrast-20261122` | `fix/accessibility-contrast-focus-main-20261121` | `6b3cd9ffd5446b13e71ca9108c61ade2fde4af5e` |
| [#132](https://github.com/morn53426-ui/-samafacture-pro/pull/132) | docs(audit): état initial et plan priorisé 22 novembre | open | `audit/initial-review-20261122` | `main` | `6543b3a701753341dae348032f9d08f003e2d796` |
| [#131](https://github.com/morn53426-ui/-samafacture-pro/pull/131) | docs: actualiser la feuille de route sur le main courant | open | `docs/improvement-plan-main-20261122` | `main` | `3d51f0afb669ebdddc18c2601cd123d89c206683` |
| [#130](https://github.com/morn53426-ui/-samafacture-pro/pull/130) | fix(a11y): contraste WCAG AA et focus clavier sur les deux thèmes | open | `fix/accessibility-contrast-focus-main-20261121` | `main` | `0b819127cc8bdbf8410611642d51b257431e84a6` |
| [#129](https://github.com/morn53426-ui/-samafacture-pro/pull/129) | feat(workspace): navigation par domaines et paramètres structurés | open | `feat/workspace-settings-navigation-20261121` | `main` | `868027e1edc8c0e7ad1d5f25e78d90d24b50c5f4` |
| [#128](https://github.com/morn53426-ui/-samafacture-pro/pull/128) | feat(trial,workspace): essai 15 jours et organisation professionnelle | open | `feat/15-day-trial-entitlements-20261121` | `main` | `e3b91dc4ae459fc4fdd65b63dd440f632ccd4217` |
| [#127](https://github.com/morn53426-ui/-samafacture-pro/pull/127) | fix(pdf): pagination A4 du devis Executive (28 lignes) | open | `fix/quote-executive-a4-pagination-20261121` | `main` | `400ce60ddb8f23e4f37fe836058f180682c2f0c7` |
| [#126](https://github.com/morn53426-ui/-samafacture-pro/pull/126) | feat(landing): présentation vidéo Sunupilot — portage sur main actuel | open | `integration/sunupilot-video-main-20261121` | `main` | `817b10da7b85ce9ca3eb0d4a8312f258349b5647` |
| [#125](https://github.com/morn53426-ui/-samafacture-pro/pull/125) | fix(pdf): pagination A4 cohérente des factures et devis longs | closed / merged | `improve/pdf-page3-balance-main-20261121` | `main` | `3bab7c770052a811b14273b380196c63940fa466` |
| [#124](https://github.com/morn53426-ui/-samafacture-pro/pull/124) | fix(invoice): afficher les montants des lignes sans scroll mobile | closed / merged | `fix/invoice-mobile-table-cards-20261121` | `fix/invoice-footer-stamp-mobile-20261121` | `67f7721d512370db3b40413a12f212226324ca76` |
| [#123](https://github.com/morn53426-ui/-samafacture-pro/pull/123) | test(pdf): garantir une facture courte sur une page A4 | closed / merged | `test/invoice-short-pdf-one-page-20261121` | `main` | `c592c7046f78ebfb127ce5490b4e08d31419d49f` |
| [#122](https://github.com/morn53426-ui/-samafacture-pro/pull/122) | test(visual): fournir un QR code aux fixtures mobiles facture/devis | closed | `fix/visual-qr-fixture-20261121` | `fix/invoice-footer-stamp-mobile-20261121` | `df6070e367ae720a789e1c190408819e56db86cd` |
| [#121](https://github.com/morn53426-ui/-samafacture-pro/pull/121) | fix(pdf): préserver le cachet sur les écrans mobiles | closed / merged | `fix/invoice-footer-stamp-mobile-20261121` | `main` | `7c562612e897e2ed7af93e494a4cf79bbb8da5e1` |
| [#120](https://github.com/morn53426-ui/-samafacture-pro/pull/120) | fix(accounting): reverse refund entries in cash and bank journals | closed / merged | `fix/accounting-refund-journal-reversal-20261121` | `feat/accounting-expense-payment-mode-20261121` | `b45f479754341f8111e5233a09cec21f76a762da` |
| [#119](https://github.com/morn53426-ui/-samafacture-pro/pull/119) | feat(accounting): distinguish cash and bank expense payments | closed / merged | `feat/accounting-expense-payment-mode-20261121` | `fix/accounting-invoice-cancellation-reversal-20261121` | `08a1c025744a7af2d795c7a761607ac1bf71b424` |
| [#118](https://github.com/morn53426-ui/-samafacture-pro/pull/118) | feat(landing): vidéo Sunupilot — capture locale automatisée des écrans | open | `feature/video-presentation-spark-sunupilot` | `main` | `29dd7ccc8084ce91f9c7eee975610fdd039a67f4` |
| [#117](https://github.com/morn53426-ui/-samafacture-pro/pull/117) | fix(accounting): reverse invoice entries on cancellation and reactivation | closed / merged | `fix/accounting-invoice-cancellation-reversal-20261121` | `main` | `ba756d09888474477a19c182b42c1298ef092dd8` |
| [#116](https://github.com/morn53426-ui/-samafacture-pro/pull/116) | test(pdf): couvrir la pagination des factures longues | closed / merged | `test/invoice-long-pdf-pagination-20261121` | `main` | `41fb9896ab4b1393f35082a5fb988e5bc9bceb5d` |
| [#115](https://github.com/morn53426-ui/-samafacture-pro/pull/115) | test(accounting): cover expense posting and tenant isolation | open | `test/ohada-expense-ledger-integrity-20261121` | `main` | `3873c1d1dbaa114af2aec991b1f49e48702f82a1` |
| [#114](https://github.com/morn53426-ui/-samafacture-pro/pull/114) | docs: centralize SamaFacture Pro improvement roadmap | open | `docs/improvement-plan-20261121` | `main` | `ff2cae7bd378680ec20a9998851665a166c539c8` |
| [#113](https://github.com/morn53426-ui/-samafacture-pro/pull/113) | fix(pdf): preserve company date and number formats in headless PDFs | closed | `fix/pdf-headless-user-formatting-20261121` | `fix/invoice-pdf-continuation-identity-20261121` | `862d31a76342f47c4df9dbe2690dcaf914360921` |
| [#112](https://github.com/morn53426-ui/-samafacture-pro/pull/112) | fix(pdf): repeat company and document identity on continuation pages | closed / merged | `fix/invoice-pdf-continuation-identity-20261121` | `main` | `885b7b42a7d4dc56ba2c3dc6a69b5b3bcf7a8b1d` |
| [#111](https://github.com/morn53426-ui/-samafacture-pro/pull/111) | fix(invoice): keep print banners inside the A4 printable area | closed / merged | `fix/invoice-print-banner-geometry-20261121` | `main` | `0ec7c3eeb59fa70465d4a0037e6c3c2d461bb2df` |
| [#110](https://github.com/morn53426-ui/-samafacture-pro/pull/110) | test(accessibility): cover light/dark keyboard navigation and contrast | open | `test/accessibility-dark-keyboard-rebased-20261120` | `main` | `722b5bfce06704a645dbe27b1516333e980dd920` |
| [#109](https://github.com/morn53426-ui/-samafacture-pro/pull/109) | fix(invoice): keep quotes available during warehouse API outages | closed / merged | `fix/quote-warehouse-resilience-20261120` | `main` | `8d0a4d2990174f950dcb334fbe1e6323a7d5e86f` |
| [#108](https://github.com/morn53426-ui/-samafacture-pro/pull/108) | fix(stock): éviter les deadlocks lors de l'initialisation du magasin principal | closed / merged | `fix/purchase-receipt-warehouse-deadlock-20261119` | `main` | `f0f43c3d1e7a920b470894275f5d9754f306dae1` |
| [#107](https://github.com/morn53426-ui/-samafacture-pro/pull/107) | feat(stock): route invoice movements to the selected warehouse | closed / merged | `feat/invoice-stock-warehouse-20261119` | `main` | `30bcfaa58ebf4960c2308390b586cb13c5adb466` |
| [#106](https://github.com/morn53426-ui/-samafacture-pro/pull/106) | test(stock): validate invoice warehouse routing | closed / merged | `fix/invoice-stock-principal-warehouse` | `main` | `383c885a969bf3da2ce8e06acc8829a5f1d1e60b` |
| [#105](https://github.com/morn53426-ui/-samafacture-pro/pull/105) | feat(dashboard): rapprocher les raccourcis de la référence Sunupilot | closed / merged | `feat/dashboard-reference-modules-20261119` | `main` | `f3cbbc669629fa730783bdbfbe6baf72ab5d81c0` |
| [#104](https://github.com/morn53426-ui/-samafacture-pro/pull/104) | fix(pwa): fiabiliser le cycle de vie du service worker | closed / merged | `fix/sunupilot-pwa-lifecycle` | `main` | `86da24a1c6e8fc6d6b1dc57d648d1c2cbaa0722f` |
| [#103](https://github.com/morn53426-ui/-samafacture-pro/pull/103) | feat(brand): intégrer les fondations visuelles SUNUPILOT | closed / merged | `brand/sunupilot-identity-foundation` | `main` | `63f8eb27a5ff410c7f1c96e844f8114289531b40` |
| [#102](https://github.com/morn53426-ui/-samafacture-pro/pull/102) | test(accessibility): couvrir le thème sombre et le parcours clavier | open | `test/accessibility-dark-keyboard-20261118` | `main` | `86aeeb6f4be28ad4d76622e3a26ac0304326dc73` |
| [#101](https://github.com/morn53426-ui/-samafacture-pro/pull/101) | fix(accessibility): corriger les contrastes et auditer les 17 pages | closed / merged | `test/accessibility-audit-business-pages-20261118` | `main` | `468caba29865f38eaa788f043f2ae164b4b965f9` |
| [#100](https://github.com/morn53426-ui/-samafacture-pro/pull/100) | test(visual): couvrir le zoom 200 % en thème sombre | closed / merged | `test/dark-theme-zoom-200-sweep-20261118` | `main` | `6fe85dfd3076e8024a854405bed4f5051bd1af72` |
| [#99](https://github.com/morn53426-ui/-samafacture-pro/pull/99) | Adopt SunuPilot branding — indigo and baobab green | open | `rebrand/optigest` | `main` | `3f70466d0b6bc1ab41f082e31324d5702bd39966` |
| [#98](https://github.com/morn53426-ui/-samafacture-pro/pull/98) | fix(responsive): corriger les tableaux au zoom 200 % | closed / merged | `test/workspace-zoom-200-sweep-20261118` | `main` | `dd64ea0274ce4d01f30e5fe9a4097ba006d967b1` |
| [#97](https://github.com/morn53426-ui/-samafacture-pro/pull/97) | fix(dashboard): améliorer la lisibilité du total des factures | closed / merged | `fix/dashboard-donut-count-20261118` | `main` | `2d4d7619350a6fe5ddc50868cb7e4d3ca5d4cb39` |
| [#96](https://github.com/morn53426-ui/-samafacture-pro/pull/96) | test(theme): vérifier le mode clair sur bureau | closed / merged | `test/theme-light-desktop-sweep-20261118` | `main` | `dfe8ce45fdb4bed07a6d88c679ff46c601208a69` |
| [#95](https://github.com/morn53426-ui/-samafacture-pro/pull/95) | test(theme): vérifier le mode clair sur mobile | closed / merged | `test/theme-light-mobile-sweep-20261118` | `main` | `b77108576d2ccaa14fbf618e6707cb903a99f73a` |
| [#94](https://github.com/morn53426-ui/-samafacture-pro/pull/94) | test(theme): vérifier le mode sombre sur mobile | closed / merged | `test/theme-dark-mobile-sweep-20261118` | `main` | `55c985deecd6b225030c2f6129afc446f97106ca` |
| [#93](https://github.com/morn53426-ui/-samafacture-pro/pull/93) | fix(theme): garantir le contraste de l’aperçu facture en mode sombre | closed / merged | `test/theme-dark-sweep-20261118` | `main` | `7bd4d2e94fe00a0de6413e4545bdc23895d49745` |
| [#92](https://github.com/morn53426-ui/-samafacture-pro/pull/92) | test(pdf): vérifier les polices incorporées et les marges A4 réelles | closed / merged | `test/pdf-font-embedding-and-visual-print-20261118` | `main` | `42b5a0bcf4393a6b4c513c2a621c9a3b7576efa6` |
| [#91](https://github.com/morn53426-ui/-samafacture-pro/pull/91) | fix(invoice): améliorer les polices et l’impression A4 des factures et devis | closed / merged | `fix/invoice-print-typography-20261118` | `main` | `d8805a202dd96748e83e3d3a43b48e2787b41b63` |
| [#90](https://github.com/morn53426-ui/-samafacture-pro/pull/90) | fix(print): vérifier la typographie et l'impression A4 des 31 modèles | closed | `audit/invoice-pdf-typography-print-20261118` | `main` | `7cb2d43cf3aadccb38e1a1a5d6c664a8db014c41` |
| [#89](https://github.com/morn53426-ui/-samafacture-pro/pull/89) | fix(ui): corriger la cohérence des thèmes clair et sombre | closed / merged | `fix/light-dark-theme-consistency-20261118` | `main` | `bf497de04d01096648f201619c29b63b7321b7a4` |
| [#88](https://github.com/morn53426-ui/-samafacture-pro/pull/88) | docs(docker): clarifier le démarrage local avec Docker | closed / merged | `docs/local-docker-bootstrap-20261117` | `main` | `eeea9c4a71001f32889bf302a78cff65e360a353` |
| [#87](https://github.com/morn53426-ui/-samafacture-pro/pull/87) | feat(invoice): ajouter 3 modèles Pro et 4 modèles Entreprise | closed / merged | `feat/invoice-templates-pro-enterprise-20261117` | `main` | `4de3da4409263f2ff1deff7350c488d18a5f7fb2` |
| [#86](https://github.com/morn53426-ui/-samafacture-pro/pull/86) | fix(ui): améliorer les interactions sidebar et Entreprise sur mobile | closed / merged | `fix/ui-responsive-polish-20261117` | `main` | `5efe69b69853850e99e11626b3272cc2e57a9fb8` |
| [#85](https://github.com/morn53426-ui/-samafacture-pro/pull/85) | docs(ui): préparer les corrections responsive et animations | closed | `docs/ui-polish-plans-20261117` | `chore/emil-design-skills-20261117` | `137a9b01d3ea60ffeb7ec3a0338607638871acd2` |
| [#84](https://github.com/morn53426-ui/-samafacture-pro/pull/84) | feat(billing): préparer le moteur d'abonnement mensuel en simulation locale | closed / merged | `feat/subscription-engine-local-simulation-20261117` | `main` | `c077af1465c262e19f309c746ff3c84f332b7f5e` |
| [#83](https://github.com/morn53426-ui/-samafacture-pro/pull/83) | docs(billing): cadrer l'architecture des abonnements mensuels | closed / merged | `docs/subscription-monthly-architecture-20261117` | `main` | `430e2010b1bee958b1b26435c1f8462a6e503ad2` |
| [#82](https://github.com/morn53426-ui/-samafacture-pro/pull/82) | chore(agents): intégrer les skills design engineering | closed / merged | `chore/emil-design-skills-20261117` | `main` | `70f8ea190bfd00316cfe8de2ccf5d9bcc83b193a` |
| [#81](https://github.com/morn53426-ui/-samafacture-pro/pull/81) | feat(nav): moderniser le rail latéral avec libellés | closed / merged | `feat/sidebar-icon-label-navigation-20261117` | `main` | `f3ce7ed158e7cb83ddcad347983ed1ff17af9f3e` |
| [#80](https://github.com/morn53426-ui/-samafacture-pro/pull/80) | feat(entreprise): paginer la liste des sociétés du groupe | closed / merged | `feat/enterprise-company-pagination-20261117` | `main` | `3b8d8ebc171b7c5053d865c0a29b589793094a20` |
| [#79](https://github.com/morn53426-ui/-samafacture-pro/pull/79) | feat(nav): moderniser la barre latérale et les icônes | closed / merged | `feat/sidebar-navigation-visual-refresh-20261117` | `main` | `314c06e7e9ec2fc39145b1216058fddf4043c418` |
| [#78](https://github.com/morn53426-ui/-samafacture-pro/pull/78) | docs(billing): clarifier l’état réel des abonnements mensuels | closed | `docs/subscriptions-current-state-20261117` | `main` | `e618e88c7be3178be3f9d8bd0c2229fba53b3767` |
| [#77](https://github.com/morn53426-ui/-samafacture-pro/pull/77) | test(billing): verrouiller les abonnements récurrents non activés | closed / merged | `fix/subscription-disabled-state-tests-docs-20261117` | `main` | `60f57e272b273364a556781c18bc71fdee4806e3` |
| [#76](https://github.com/morn53426-ui/-samafacture-pro/pull/76) | fix(pdf): améliorer la pagination des devis et factures | closed | `fix/pdf-pagination-extras-flow-20261117` | `main` | `2e7dd32a3eec318051d5891e8c03f6447ae2afba` |
| [#75](https://github.com/morn53426-ui/-samafacture-pro/pull/75) | fix(pdf): éviter les pages isolées dans les devis volumineux | closed / merged | `fix/pdf-print-pagination-20261117` | `main` | `b8e344915ceaf843a79fee82f0f9aba784cf2d9f` |
| [#74](https://github.com/morn53426-ui/-samafacture-pro/pull/74) | ci: exécuter le test réel de restauration des sauvegardes chiffrées | closed / merged | `ci/real-restore-smoke-20261117` | `main` | `8864ab9478d019205f2c5a58fc206712c7129070` |
| [#73](https://github.com/morn53426-ui/-samafacture-pro/pull/73) | feat(ui): simplifier les espaces Entreprise et professionnel | closed / merged | `feat/enterprise-workspace-ux-20261117` | `main` | `14cdd3c48c0b089bc35493bf93d4b4349c88ff1a` |
| [#72](https://github.com/morn53426-ui/-samafacture-pro/pull/72) | fix(team): sécuriser les invitations classiques par preuve email | closed / merged | `fix/team-invitation-email-proof-20261117` | `main` | `8e1b84dffe598350c88ed2442e8df06339507c7e` |
| [#71](https://github.com/morn53426-ui/-samafacture-pro/pull/71) | feat(entreprise): centre de pilotage consolidé du groupe | closed / merged | `feat/enterprise-command-center-20261117` | `main` | `ae7e0e8e59f0dfbe7ea8a7fee49b8ea375379e00` |
| [#69](https://github.com/morn53426-ui/-samafacture-pro/pull/69) | fix(security): vérifier l’adresse email avant le rattachement multi-sociétés | closed / merged | `fix/enterprise-invitation-email-proof-20261116` | `feat/enterprise-multi-company-foundation-20261116` | `4347d572f4e78fe057fc3595d677619abe74e745` |
| [#68](https://github.com/morn53426-ui/-samafacture-pro/pull/68) | feat: laisser le client choisir son moyen de paiement | closed / merged | `feat/abonnement-choix-moyen-paiement` | `main` | `3f32787dd561d01e91b1f784fb238376b2220b50` |
| [#67](https://github.com/morn53426-ui/-samafacture-pro/pull/67) | docs(email): corriger le comportement SMTP local et tester la redaction | closed / merged | `audit/fix-reset-email-docs-and-redaction-test-20261116` | `main` | `a53c96daa1c2052fa19ca270d574d948fab81f30` |
| [#65](https://github.com/morn53426-ui/-samafacture-pro/pull/65) | docs(billing): distinguer achat ponctuel et abonnement récurrent | closed | `docs/correct-one-time-plan-billing-2026-11-16` | `main` | `43592f99b6f72cadc369b76c9489d4a831e21094` |
| [#64](https://github.com/morn53426-ui/-samafacture-pro/pull/64) | docs(audit): documenter le risque de vérification des invitations multi-sociétés | closed / merged | `audit/security-multisocietes-review-20261116-run3` | `main` | `4acf4d365c89d3152892d49515e9570d0be98eed` |
| [#63](https://github.com/morn53426-ui/-samafacture-pro/pull/63) | fix(realtime): autoriser les groupes Entreprise dans les notifications | closed / merged | `audit/fix-realtime-company-groups-20261116-run1` | `feat/enterprise-multi-company-foundation-20261116` | `e5c3d8020b40079021aa678db9dbcb4969831e92` |
| [#62](https://github.com/morn53426-ui/-samafacture-pro/pull/62) | fix(entreprise): corriger la migration v10 et les invitations | closed | `audit/fix-enterprise-migration-invitation-20261116` | `feat/enterprise-multi-company-foundation-20261116` | `0b93cf9e37feb94d2b317924f16f3045db45a9e4` |
| [#60](https://github.com/morn53426-ui/-samafacture-pro/pull/60) | feat(entreprise): socle multi-sociétés et cadrage de l’abonnement mensuel | closed / merged | `feat/enterprise-multi-company-foundation-20261116` | `main` | `c19e12959de8895a8ecf59e4d0e3319c74e95bbe` |
| [#59](https://github.com/morn53426-ui/-samafacture-pro/pull/59) | docs(staging): corriger la procédure Docker Compose et HTTPS | closed / merged | `docs/fix-staging-compose-runbook-20261116` | `main` | `22c0dae280e3e7ee7305bd8b761c5cfebe2969bf` |
| [#57](https://github.com/morn53426-ui/-samafacture-pro/pull/57) | fix(a11y): associer les libellés de la page Paramètres | closed / merged | `fix/a11y-settings-labels-20261116` | `main` | `4b275916eefa7253b2cc11b3c0a150d9050a918d` |
| [#56](https://github.com/morn53426-ui/-samafacture-pro/pull/56) | fix(pdf): file durable avec acquittement et reprise, mentions paiement exactes | closed / merged | `fix/pdf-stream-ack-payment-disclosures-20261116` | `main` | `a576e5e1fec88c5a0e7eb8272e791cdb2a49bcab` |
| [#55](https://github.com/morn53426-ui/-samafacture-pro/pull/55) | audit: corriger la conservation des tâches PDF en attente | closed / merged | `audit/rapport-approfondi-2026-11-16-run2` | `main` | `1aee933103049ca9e0049ed76f00e4ff641c8aaa` |
| [#54](https://github.com/morn53426-ui/-samafacture-pro/pull/54) | fix: remove Nginx upstream balancing warning | closed / merged | `audit/fix-nginx-upstream-order-20261116` | `main` | `5e93abdc37d49cdb4c458c9963eeb7998aa018c8` |
| [#53](https://github.com/morn53426-ui/-samafacture-pro/pull/53) | docs: ajouter le plan d’entreprise et la stratégie de lancement | closed / merged | `docs/business-plan-samafacture-pro` | `main` | `ac07f0788ee60f1db6fc3a8a68bf4d0784b9e2a7` |
| [#52](https://github.com/morn53426-ui/-samafacture-pro/pull/52) | security: redact sensitive tokens from HTTP access logs | closed / merged | `security/redact-secret-urls-in-logs-2026-11-16` | `main` | `d27f55b581ba7db3da5decd411d26c399531bc94` |
| [#51](https://github.com/morn53426-ui/-samafacture-pro/pull/51) | CI: bloquer les dépendances présentant une vulnérabilité npm | closed / merged | `audit/npm-audit-gate-2026-11-16` | `main` | `63a344d9154b5f5879689fa632dc697148afe2e7` |
| [#50](https://github.com/morn53426-ui/-samafacture-pro/pull/50) | Fix: éviter la concurrence d'initialisation MySQL du worker PDF | closed / merged | `fix/pdf-worker-db-readiness-2026-11-16` | `main` | `59d341a154621ef4e15acb77a402a1a85534e969` |
| [#49](https://github.com/morn53426-ui/-samafacture-pro/pull/49) | test(ui): cover notification placement with visual viewport offsets | closed / merged | `audit/visual-viewport-offset-regression-20261116` | `main` | `f744b20396781fde17daa074380ca02c6a9e2d3c` |
| [#48](https://github.com/morn53426-ui/-samafacture-pro/pull/48) | fix(ui): keep notifications visible above the mobile keyboard | closed / merged | `automation/visual-viewport-notifications-20261116-0243` | `main` | `64f5b2c2ec8eb5e86f83a9661ff9596f329522d0` |
| [#47](https://github.com/morn53426-ui/-samafacture-pro/pull/47) | Éviter les mauvais destinataires WhatsApp pour les numéros locaux | closed / merged | `fix/whatsapp-country-guard-2026-11-16` | `main` | `a49756cd21ec95f952044412b0538c1938564a90` |
| [#46](https://github.com/morn53426-ui/-samafacture-pro/pull/46) | fix(ui): keep mobile notifications inside viewport | closed / merged | `automation/audit-fixes-20261116-0150` | `main` | `a423dca17e30edf84e6708cc470a6bf2ea995edb` |
| [#45](https://github.com/morn53426-ui/-samafacture-pro/pull/45) | Sécuriser la sauvegarde, la rétention et la restauration de la base | closed / merged | `fix/backup-retention-guard-2026-11-16` | `main` | `e277ca8a841204b0cdfd98d497311ffe87a5c28e` |
| [#44](https://github.com/morn53426-ui/-samafacture-pro/pull/44) | Sécurité : rendre la révocation des sessions immédiate entre workers | closed / merged | `security/immediate-session-revocation-2026-11-16` | `main` | `d6887ce043b8c3871a03342943ee270375f7aff9` |
| [#43](https://github.com/morn53426-ui/-samafacture-pro/pull/43) | Améliorer le mobile, les aperçus A4 et l’espace professionnel | closed / merged | `fix/mobile-invoice-line-columns` | `main` | `38a365581a31fdd996411ea44fff5db03b6c6c1d` |
| [#42](https://github.com/morn53426-ui/-samafacture-pro/pull/42) | Fiabiliser les PDF et corriger le thème système à l'impression | closed / merged | `qa/test-pdf-24-modeles` | `main` | `d3b70a09c598195713cc7e9b49d03b7db52a1404` |
| [#41](https://github.com/morn53426-ui/-samafacture-pro/pull/41) | Préparer l’archive du code fusionné sur main | closed | `ci/package-main-after-pr39-pr40` | `main` | `8c725a00cd3b353684033e3c7219737af487d437` |
| [#40](https://github.com/morn53426-ui/-samafacture-pro/pull/40) | Ajouter cinq modèles modernes de facture et de devis | closed / merged | `feat/5-nouveaux-modeles-facture` | `main` | `342a3e43c5b8801411892d72d04be6faa2ee7d5d` |
| [#39](https://github.com/morn53426-ui/-samafacture-pro/pull/39) | Agrandir légèrement le logo et les icônes de navigation | closed / merged | `ui/augmenter-logo-icones-sidebar` | `main` | `63af3d94dc35cc3534a58f467201f3dda3803493` |
| [#38](https://github.com/morn53426-ui/-samafacture-pro/pull/38) | Make monthly invoice quota initialization deterministic | closed / merged | `fix/quota-registry-initialization-robustness-2026-11-15` | `main` | `c8ea3204dcdc805619a5e3bb83f318ffa97638a3` |
| [#37](https://github.com/morn53426-ui/-samafacture-pro/pull/37) | Exclude local secrets from Docker and require npm lockfile | closed / merged | `fix/docker-context-secrets-and-lockfile-2026-11-15` | `main` | `52d4b81b3ff86b73e9b7956cb31e217d87a8160b` |
| [#36](https://github.com/morn53426-ui/-samafacture-pro/pull/36) | Harden invoice settlement, paid status and payment idempotency | closed / merged | `fix/invoice-settlement-integrity-2026-11-15` | `main` | `30318cf3cf48be4f0a6ccd9bda0cdac699211341` |
| [#35](https://github.com/morn53426-ui/-samafacture-pro/pull/35) | Test that backup archives stay temporary until dump completion | closed / merged | `test/backup-atomic-visibility-2026-11-15` | `main` | `f4c463e5ec768eee125a7d0f623f0ae4626ea38d` |
| [#34](https://github.com/morn53426-ui/-samafacture-pro/pull/34) | Prevent local environment secrets from entering Docker images | closed | `security/docker-ignore-local-secrets-2026-11-15` | `main` | `4d2c20e28ee29d9c18538d8775e64a73772ea8ce` |
| [#33](https://github.com/morn53426-ui/-samafacture-pro/pull/33) | Publish database backups only after atomic validation | closed | `fix/atomic-backup-publish-2026-11-15` | `main` | `081d931236086aca8f53eebb312540c73a9934b7` |
| [#32](https://github.com/morn53426-ui/-samafacture-pro/pull/32) | Publish complete database backups atomically | closed / merged | `fix/atomic-encrypted-backups-2026-11-15` | `main` | `03a36a61b7c4e30321066c78babe95c67bda363e` |
| [#31](https://github.com/morn53426-ui/-samafacture-pro/pull/31) | Harden session revocation and payment provider timeouts | closed / merged | `fix/session-revocation-and-payment-timeouts-2026-11-15` | `main` | `46f280761b6149260eeca0e1bbab3ab5304d3118` |
| [#30](https://github.com/morn53426-ui/-samafacture-pro/pull/30) | Add transactional monthly invoice quota with schema migration v8 | closed | `feat/monthly-invoice-quota-v8-2026-11-15` | `main` | `f3b2690913b9897c8aa9b6a55dee08e5fc1d18aa` |
| [#29](https://github.com/morn53426-ui/-samafacture-pro/pull/29) | Fix monthly invoice quota with schema migration v8 | closed / merged | `fix/monthly-invoice-quota-schema-v8-2026-11-15` | `main` | `69028f5946e93f259fdcd69cb7d3f9c913b99d31` |
| [#28](https://github.com/morn53426-ui/-samafacture-pro/pull/28) | Improve sidebar navigation accessibility | closed / merged | `fix/sidebar-aria-current-2026-11-15` | `main` | `1066c1c4d02ebeebd571fc45534c6539b374963c` |
| [#27](https://github.com/morn53426-ui/-samafacture-pro/pull/27) | Improve sidebar icon semantics and enforce full icon coverage | closed / merged | `fix/pdf-worker-health-and-sidebar-icons-2026-11-15` | `main` | `04304461cafad9c2576015e10dc59abf7437f329` |
| [#26](https://github.com/morn53426-ui/-samafacture-pro/pull/26) | Fix PDF worker startup ordering after API readiness | closed / merged | `fix/pdf-worker-wait-for-api-health-2026-11-15` | `main` | `941f235f5f4b625af5038b1dc17710fe5db02acf` |
| [#25](https://github.com/morn53426-ui/-samafacture-pro/pull/25) | Fix subscription page icons and visual regression checks | closed / merged | `fix/subscription-icons-main-2026-11-15` | `main` | `3316731d6119e6b43a9cdef8c935083f0b4a6979` |
| [#24](https://github.com/morn53426-ui/-samafacture-pro/pull/24) | Sécurité : révocation des sessions, correctif liaison Google, filtrag… | closed / merged | `audit/securite-2026-11-15` | `main` | `9939413ad492d89af41fc28ce4d05c8130f45d03` |
| [#23](https://github.com/morn53426-ui/-samafacture-pro/pull/23) | Galerie de 19 modèles, impression fiable, WhatsApp et audit transversal | closed / merged | `feat/invoice-template-gallery-2026-11-15-v2` | `main` | `570bf60cad5f73bb7f1fe3e65646f29e65068b9f` |
| [#22](https://github.com/morn53426-ui/-samafacture-pro/pull/22) | Présenter les modèles de facture dans une galerie visuelle | closed | `feat/invoice-template-gallery-2026-11-15` | `main` | `70d95aac18e38b1aac466f1f184f8fa536caa638` |
| [#21](https://github.com/morn53426-ui/-samafacture-pro/pull/21) | Finaliser les factures et devis imprimés en A4 | closed / merged | `fix/invoice-print-and-payment-stamp-2026-11-15` | `main` | `ed6c1467affe76a6e055af95b943a44cedc09891` |
| [#20](https://github.com/morn53426-ui/-samafacture-pro/pull/20) | Professionnaliser la page Abonnement et ses icônes | closed | `feat/professional-subscription-page-2026-11-15` | `main` | `cf58665a9083cb4e52dc24cce75cdb2291632d6e` |
| [#19](https://github.com/morn53426-ui/-samafacture-pro/pull/19) | Stabiliser la CI avec des tests MySQL séquentiels | closed / merged | `fix/ci-serial-tests-2026-11-15` | `main` | `4a74afa8dceaebc1dcb7dbaf6e88b175e6438fde` |
| [#18](https://github.com/morn53426-ui/-samafacture-pro/pull/18) | Professionnaliser l’interface et les documents, renforcer la responsivité et la montée en charge | closed / merged | `feat/responsive-scaling-2026-11-15` | `main` | `f7d10afed88a1cf03baac276836dc6f0165e09d6` |
| [#17](https://github.com/morn53426-ui/-samafacture-pro/pull/17) | Améliorer la visibilité et la cohérence des icônes | closed / merged | `fix/ui-icons-legibility-2026-11-15` | `main` | `0d7c5390f47444a13eae765a083e7bc2cdafb5c0` |
| [#16](https://github.com/morn53426-ui/-samafacture-pro/pull/16) | Fix Docker startup: single MySQL schema init and Redis readiness | closed / merged | `fix/docker-local-startup-mysql-redis-swagger` | `main` | `2f021548666e2575035ff4d45ca9936f4ceaf7b7` |
| [#15](https://github.com/morn53426-ui/-samafacture-pro/pull/15) | UI : harmoniser les pages métier pour un logiciel de gestion professionnel | closed / merged | `feat/enterprise-pages-v2-2026-11-13` | `main` | `e9992176d76f18f9e48f7d1d98378b1d9070cb78` |
| [#14](https://github.com/morn53426-ui/-samafacture-pro/pull/14) | UI : finaliser la structure professionnelle des pages métier | closed | `feat/enterprise-page-structure-v2-2026-11-13` | `main` | `745a98b586ef19f7747df9dfa1c19af97ee233d2` |
| [#13](https://github.com/morn53426-ui/-samafacture-pro/pull/13) | UI : organiser les pages métier comme un logiciel professionnel | closed | `feat/enterprise-page-structure-2026-11-13` | `main` | `e39910166ba43eaa1852844883c5ddc649b170cf` |
| [#12](https://github.com/morn53426-ui/-samafacture-pro/pull/12) | UI : organisation professionnelle des pages métier | closed / merged | `feat/enterprise-page-structure-2026-11-13` | `main` | `abb2f78187944a4dab48c37efe2ff35500a9fd81` |
| [#11](https://github.com/morn53426-ui/-samafacture-pro/pull/11) | Audit UI — navigation compacte et amélioration de la visibilité | closed | `audit/ui-runtime-pages-polish-20261113` | `main` | `094c34f33a457633e334b46538ff3bba606a4597` |
| [#10](https://github.com/morn53426-ui/-samafacture-pro/pull/10) | UI : navigation compacte et espace de travail élargi | closed / merged | `fix/navigation-compact-sidebar-2026-11-13` | `main` | `508607c7cc69e560b539438c44cbc2330b035a6e` |
| [#9](https://github.com/morn53426-ui/-samafacture-pro/pull/9) | Build a temporary local Docker test ZIP | closed | `tooling/local-docker-test-bundle-20261112` | `main` | `b88eeebb659dc119848094f8ddc6d9894a3be569` |
| [#8](https://github.com/morn53426-ui/-samafacture-pro/pull/8) | Phases 5 à 7 — Portail client, CRM, internationalisation et IA | closed / merged | `feat/phases-5-7-portal-international-automation-20261112` | `main` | `a3a43402f59d54be7f0c4cc1e5ac23d04f9f333b` |
| [#7](https://github.com/morn53426-ui/-samafacture-pro/pull/7) | Phases 2 à 4 — Paiements réels, comptabilité OHADA et achats/stocks | closed / merged | `feat/phases-2-4-paiements-compta-achats-20261112` | `main` | `f028da5802241ccd8df687875a2ba4787a5145b6` |
| [#6](https://github.com/morn53426-ui/-samafacture-pro/pull/6) | Ajouter une cloche de notifications à la barre supérieure | closed / merged | `feat/topbar-notifications-bell-20261112` | `main` | `a36472e66f180124a699c01d10b26012e4b8b079` |
| [#5](https://github.com/morn53426-ui/-samafacture-pro/pull/5) | Refonte du tableau de bord SamaFacture Pro — palette et navigation | closed / merged | `feat/dashboard-reference-redesign-20261112` | `main` | `6cf80f4c547b62d41bd428b44bbf87be3b50f3c4` |
| [#4](https://github.com/morn53426-ui/-samafacture-pro/pull/4) | UI polish: animations accessibles et recette visuelle responsive | closed / merged | `feat/ui-motion-visual-recette-20261112` | `main` | `1ae8c307b3cf394e8103f5e40237494723c4dae1` |
| [#3](https://github.com/morn53426-ui/-samafacture-pro/pull/3) | Audit correctif : sauvegardes, sécurité des sessions, paiements et quotas | closed | `audit/fix-backup-and-runtime-20261110` | `main` | `9ea9a9aa00d4c3d4ef6e0a9a46f771a1912bedb5` |
| [#2](https://github.com/morn53426-ui/-samafacture-pro/pull/2) | Modèles de factures et devis — enrichissement des informations et du rendu | closed / merged | `feat/templates-factures-devis-complets` | `main` | `81aa9fa67012f19b69c2df4a0c72490b14dea285` |
| [#1](https://github.com/morn53426-ui/-samafacture-pro/pull/1) | SamaFacture Pro — modernisation UI et modules professionnels | closed / merged | `ui/modern-responsive-polish` | `main` | `a2faa30e320e1ad09b4537201a4627dc909f5514` |

## Annexe C — commits récents sur main (10)

| SHA | Date UTC | Sujet |
|---|---|---|
| `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c` | 2026-11-23T16:53:14Z | Merge pull request #194 from morn53426-ui/security/tenant-relations-main-current-20261123-run12 |
| `970832f4bb45bb348dae99967183e917beeeb7e3` | 2026-11-23T16:37:53Z | Merge branch 'main' into security/tenant-relations-main-current-20261123-run12 |
| `60fc886aee3d15993b255a8d4a1ce35a287e9939` | 2026-11-23T16:34:03Z | Merge pull request #192 from morn53426-ui/fix/tenant-currency-final-main-20261123 |
| `0c046f9ed60a097889fe2d27158ab87c41a3233c` | 2026-11-23T16:14:16Z | Merge branch 'main' into fix/tenant-currency-final-main-20261123 |
| `250141bd649cd773462813bd99b098c5f62a6374` | 2026-11-23T16:08:46Z | Merge branch 'main' into security/tenant-relations-main-current-20261123-run12 |
| `f10d89694e264bc710f1ce534a6418dd792e603a` | 2026-11-23T16:01:06Z | docs(audit): execution report run 21 |
| `8df0651951884623d4f5d4cd7ebc48b9c26f79e0` | 2026-11-23T15:35:13Z | docs(audit): merge execution report run 20 |
| `047e7badf4fccd91644af74e0968089b23246c93` | 2026-11-23T14:35:22Z | fix(a11y): badge Entreprise lisible en thème sombre |
| `f8a61187e8b8df7dc319d611dd58fb02dd0aa336` | 2026-11-23T14:03:46Z | a11y(dashboard): keyboard skip link on current main |
| `900163220356db9c443e11e5f6208760d49a62f2` | 2026-11-23T13:55:04Z | merge current main into security isolation candidate |
