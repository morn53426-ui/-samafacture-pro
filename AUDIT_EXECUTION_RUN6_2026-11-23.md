# Audit & développement SamaFacture Pro — Run 6
**Snapshot GitHub : 23 novembre 2026, vers 04:00 UTC (avant création de la PR #176)**  
Repository: https://github.com/morn53426-ui/-samafacture-pro

## Résumé de l'exécution
- Main observé : `b43a94fc2937b0108077501a0260358c8569e11f` (aucun push/merge sur main).
- Inventaire : **182 branches**, **46 PR ouvertes**, **125 PR fermées** (dont **106 fusionnées**, **19 fermées sans fusion**).
- Après création de la branche et de la PR #176 du rapport Run 6, l'état vivant re-vérifié est **183 branches / 47 PR ouvertes**; le snapshot détaillé ci-dessous reste celui juste avant cette création.
- Branches, données, volumes, sauvegardes et historique comptable préservés; aucune migration exécutée.
- Main CI : run **45080802243**, « Tests automatisés », success sur SHA `b43a94fc2937b0108077501a0260358c8569e11f`; job Node/MySQL et toutes les étapes listées terminés avec succès.
- Ruleset #27410527 actif sur main; aucun bypass. Protection classique non lisible (403).

## Main, commits récents et CI
### 20 commits récents
- `b43a94fc2937b0108077501a0260358c8569e11f` — docs(backup): sécuriser le transfert hors serveur rclone (2026-11-22T23:00:10Z)
- `e6a2caf04f0648d30419042c97cb63b6a14a05f8` — Merge pull request #163 from morn53426-ui/fix/backup-directory-permissions-20261122 (2026-11-22T22:43:06Z)
- `1c3a12bacd9c6a761247756562ea77ebe50ef41d` — Merge latest main invitation-security test into backup directory hardening (2026-11-22T22:36:47Z)
- `596b3311f12c41946906b236274d9c8a615393d6` — test(security): couvrir expiration et changement email des invitations equipe (#162) (2026-11-22T22:33:54Z)
- `b8df6bfac18e4eb2776a35887e178af6d8d42bfd` — Merge dashboard update and keep backup permission lint target (2026-11-22T22:27:19Z)
- `cc728a65336a5ad154136c668f3be06256e66ede` — Merge dashboard module rail and main into backup directory permissions fix (2026-11-22T22:26:11Z)
- `8d0f287f46a96cb0697d7a0be9f6fe055b6e5a51` — ux(dashboard): réduire le défilement mobile des modules (#161) (2026-11-22T22:24:22Z)
- `f3844b627efcdf6472ef57bffe3d69283a36bb37` — fix(sync): conserver server/.env.example de main (2026-11-22T22:17:53Z)
- `1d42ba738607a1f648e3391c051a618061654f69` — fix(sync): conserver le modèle .env courant de main (2026-11-22T22:17:22Z)
- `d6a054483a11a3ebd7020fa8850d59f07dafdc22` — Merge latest main into backup directory permissions hardening (2026-11-22T22:16:41Z)
- `06c3589daf5f49405e9a7ead70ee5cc9aece2a12` — Merge latest main while preserving private backup directory permissions (2026-11-22T22:16:08Z)
- `5f1c09d655b340eac687d983e322e740798b7817` — docs(security): corriger les conseils CORS et proxy (#158) (2026-11-22T22:15:02Z)
- `db790c1d25cdedabf19d33cffd5bf489bc77d1ef` — refactor(backup): supprimer le mkdir redondant (2026-11-22T22:08:02Z)
- `620b919b8f317d2fd5116728ff5aa292aa3357b0` — Merge main and MySQL backup permissions into backup-directory-permissions (2026-11-22T22:07:00Z)
- `d736f90ee00369029146402ac5bb6fbfd9de3def` — fix(backup): compatible avec le compte MySQL limité de Docker (#160) (2026-11-22T22:06:18Z)
- `affc83042f524a7db1c3628f72dd81b751c7c4c8` — Merge main into fix/backup-directory-permissions-20261122 (2026-11-22T21:59:05Z)
- `7e19eae060f1f223406d21118bdb19c439e14cc5` — test(accounting): couvrir les correspondances OHADA des dépenses (#152) (2026-11-22T21:58:19Z)
- `9820c4dc48814f9a389c3ffbee5a345e55f27fe5` — fix(pdf): pagination A4 cohérente factures et devis (2026-11-22T21:49:43Z)
- `5ec5947b7013e319b8af5f41ab8131357142fef7` — test(backup): isoler l’archive du test de permissions (2026-11-22T21:49:17Z)
- `1a457ca0a77b6b87d0b5995a83586e2d91c12c5d` — ci(lint): vérifier le module et les tests de sauvegarde (2026-11-22T21:43:41Z)

### Runs récents sur main
```
45080802243 | Tests automatisés | completed/success | b43a94fc29 | 2026-11-22T23:00:14Z
45079271982 | Tests automatisés | completed/success | e6a2caf04f | 2026-11-22T22:43:08Z
45078430540 | Tests automatisés | completed/success | 596b3311f1 | 2026-11-22T22:33:57Z
45077540254 | Tests automatisés | completed/success | 8d0f287f46 | 2026-11-22T22:24:25Z
45076649631 | Tests automatisés | completed/success | 5f1c09d655 | 2026-11-22T22:15:04Z
45075808620 | Tests automatisés | completed/success | d736f90ee0 | 2026-11-22T22:06:21Z
45075028316 | Tests automatisés | completed/success | 7e19eae060 | 2026-11-22T21:58:21Z
45074265222 | Tests automatisés | completed/success | 9820c4dc48 | 2026-11-22T21:49:46Z
45047210026 | Tests automatisés | completed/success | 00d52ca8ac | 2026-11-22T17:02:57Z
45044150337 | Tests automatisés | completed/success | e8a030d5a4 | 2026-11-22T16:29:50Z
45036963535 | Tests automatisés | completed/success | 41aea0f684 | 2026-11-22T15:11:56Z
45031708395 | Tests automatisés | completed/success | f0ae8b08c4 | 2026-11-22T14:14:08Z
44940440289 | Tests automatisés | completed/success | 8453ee6d8e | 2026-11-21T19:20:48Z
44939123930 | Tests automatisés | completed/success | 95adbf61e0 | 2026-11-21T19:06:20Z
44937895072 | Tests automatisés | completed/success | adb7a71e38 | 2026-11-21T18:52:40Z
44917503655 | Tests automatisés | completed/success | f49d352125 | 2026-11-21T15:07:36Z
44916284949 | Tests automatisés | completed/success | 5478809ee7 | 2026-11-21T14:53:45Z
44911463449 | Tests automatisés | completed/success | f42f69e184 | 2026-11-21T13:57:56Z
44728462097 | Tests automatisés | completed/success | b07ceba600 | 2026-11-20T11:32:39Z
44718766330 | Tests automatisés | completed/success | 370604b5e0 | 2026-11-20T10:23:04Z
```
Le run #45080802243 est vérifié; les autres runs sont listés comme inventaire, pas comme preuve de CI du SHA actuel.

## Inventaire complet des branches (182)
- `a11y/dashboard-skip-navigation-20261122` — `8f45795c3df521ffb021947d5376bfaa22a832ca`
- `a11y/mobile-sidebar-escape-focus-20261122` — `c37403034a25bad6d4ecd0867066ce8c258bdd9c`
- `audit/execution-report-20261122-run1` — `dc7e6f55c5f7d357400f78c26dcfa469b75c3cef`
- `audit/execution-report-20261122-run2` — `dff61fb42a429fce93ed1fc6f0a3c9f355ced6f4`
- `audit/execution-report-20261123-run3` — `6fa59a42ebb12bb9d6f8a266059125b81991ff95`
- `audit/execution-report-20261123-run4` — `14688f7a8fd8fe5d9b3cdde50bb546ac7485f30e`
- `audit/execution-report-20261123-run5` — `f9f95b734deb3fe9ecacfbb257686085b3fa53a6`
- `audit/fix-backup-and-runtime-20261110` — `9ea9a9aa00d4c3d4ef6e0a9a46f771a1912bedb5`
- `audit/fix-enterprise-migration-invitation-20261116` — `0b93cf9e37feb94d2b317924f16f3045db45a9e4`
- `audit/fix-nginx-upstream-order-20261116` — `5e93abdc37d49cdb4c458c9963eeb7998aa018c8`
- `audit/fix-realtime-company-groups-20261116-run1` — `e5c3d8020b40079021aa678db9dbcb4969831e92`
- `audit/fix-reset-email-docs-and-redaction-test-20261116` — `a53c96daa1c2052fa19ca270d574d948fab81f30`
- `audit/initial-review-20261122` — `6543b3a701753341dae348032f9d08f003e2d796`
- `audit/invoice-pdf-typography-print-20261118` — `7cb2d43cf3aadccb38e1a1a5d6c664a8db014c41`
- `audit/npm-audit-gate-2026-11-16` — `63a344d9154b5f5879689fa632dc697148afe2e7`
- `audit/rapport-approfondi-2026-11-16-run2` — `1aee933103049ca9e0049ed76f00e4ff641c8aaa`
- `audit/securite-2026-11-15` — `9939413ad492d89af41fc28ce4d05c8130f45d03`
- `audit/security-multisocietes-review-20261116-run3` — `4acf4d365c89d3152892d49515e9570d0be98eed`
- `audit/ui-runtime-pages-polish-20261113` — `094c34f33a457633e334b46538ff3bba606a4597`
- `audit/visual-viewport-offset-regression-20261116` — `f744b20396781fde17daa074380ca02c6a9e2d3c`
- `automation/audit-fixes-20261116-0150` — `a423dca17e30edf84e6708cc470a6bf2ea995edb`
- `automation/visual-viewport-notifications-20261116-0243` — `64f5b2c2ec8eb5e86f83a9661ff9596f329522d0`
- `brand/sunupilot-identity-foundation` — `63f8eb27a5ff410c7f1c96e844f8114289531b40`
- `chore/emil-design-skills-20261117` — `70f8ea190bfd00316cfe8de2ccf5d9bcc83b193a`
- `ci/lint-history-protection-backend-20261122` — `32d1c1f56cb9c2b46890aae5b0b72136b13660a8`
- `ci/package-main-after-pr39-pr40` — `8c725a00cd3b353684033e3c7219737af487d437`
- `ci/real-restore-smoke-20261117` — `8864ab9478d019205f2c5a58fc206712c7129070`
- `ci/workspace-ui-structure-tests-20261122` — `2a09ccf8bfdb3b26b84482b7445902f266fb1dbf`
- `docs/backup-offsite-pinned-rclone-20261122` — `76aa447d8beefa49dc7da11d334144bd2c75427f`
- `docs/business-plan-samafacture-pro` — `ac07f0788ee60f1db6fc3a8a68bf4d0784b9e2a7`
- `docs/correct-one-time-plan-billing-2026-11-16` — `43592f99b6f72cadc369b76c9489d4a831e21094`
- `docs/fix-staging-compose-runbook-20261116` — `22c0dae280e3e7ee7305bd8b761c5cfebe2969bf`
- `docs/improvement-plan-20261121` — `ff2cae7bd378680ec20a9998851665a166c539c8`
- `docs/improvement-plan-main-20261122` — `3d51f0afb669ebdddc18c2601cd123d89c206683`
- `docs/local-docker-bootstrap-20261117` — `eeea9c4a71001f32889bf302a78cff65e360a353`
- `docs/production-env-security-guidance-20261122` — `be0f2789ccebd103c9fbf8da28bd1586eddb1549`
- `docs/subscription-monthly-architecture-20261117` — `430e2010b1bee958b1b26435c1f8462a6e503ad2`
- `docs/subscriptions-current-state-20261117` — `e618e88c7be3178be3f9d8bd0c2229fba53b3767`
- `docs/ui-polish-plans-20261117` — `137a9b01d3ea60ffeb7ec3a0338607638871acd2`
- `feat/abonnement-choix-moyen-paiement` — `3f32787dd561d01e91b1f784fb238376b2220b50`
- `feat/accounting-expense-payment-mode-20261121` — `08a1c025744a7af2d795c7a761607ac1bf71b424`
- `feat/dashboard-reference-layout` — `11d55850b64702302a922185af02440394131541`
- `feat/dashboard-reference-modules-20261119` — `f3cbbc669629fa730783bdbfbe6baf72ab5d81c0`
- `feat/dashboard-reference-redesign-20261112` — `6cf80f4c547b62d41bd428b44bbf87be3b50f3c4`
- `feat/enterprise-command-center-20261117` — `ae7e0e8e59f0dfbe7ea8a7fee49b8ea375379e00`
- `feat/enterprise-company-pagination-20261117` — `3b8d8ebc171b7c5053d865c0a29b589793094a20`
- `feat/enterprise-multi-company-foundation-20261116` — `c19e12959de8895a8ecf59e4d0e3319c74e95bbe`
- `feat/enterprise-page-structure-2026-11-13` — `e39910166ba43eaa1852844883c5ddc649b170cf`
- `feat/enterprise-page-structure-v2-2026-11-13` — `745a98b586ef19f7747df9dfa1c19af97ee233d2`
- `feat/enterprise-pages-v2-2026-11-13` — `e9992176d76f18f9e48f7d1d98378b1d9070cb78`
- `feat/enterprise-workspace-ux-20261117` — `14cdd3c48c0b089bc35493bf93d4b4349c88ff1a`
- `feat/invoice-stock-warehouse-20261119` — `30bcfaa58ebf4960c2308390b586cb13c5adb466`
- `feat/invoice-template-gallery-2026-11-15-v2` — `570bf60cad5f73bb7f1fe3e65646f29e65068b9f`
- `feat/invoice-template-gallery-2026-11-15` — `70d95aac18e38b1aac466f1f184f8fa536caa638`
- `feat/invoice-templates-pro-enterprise-20261117` — `4de3da4409263f2ff1deff7350c488d18a5f7fb2`
- `feat/invoice-warehouse-stock-20261119` — `e9ac3c69d928be8ba3d8d6800f5e70ea84230a68`
- `feat/invoice-warehouse-stock-main-20261119` — `158a9e0663d1e105ccc11ab60402041295c333a6`
- `feat/mobile-config-preflight` — `23c1cf95bf459118324dfece3580ece4470b9b34`
- `feat/monthly-invoice-quota-v8-2026-11-15` — `f3b2690913b9897c8aa9b6a55dee08e5fc1d18aa`
- `feat/ohada-account-mappings-20261122` — `ca3cb8fbf594f41c39cfe5958e3bb04520825864`
- `feat/phases-2-4-paiements-compta-achats-20261112` — `f028da5802241ccd8df687875a2ba4787a5145b6`
- `feat/phases-5-7-portal-international-automation-20261112` — `a3a43402f59d54be7f0c4cc1e5ac23d04f9f333b`
- `feat/professional-subscription-page-2026-11-15` — `cf58665a9083cb4e52dc24cce75cdb2291632d6e`
- `feat/responsive-scaling-2026-11-15` — `f7d10afed88a1cf03baac276836dc6f0165e09d6`
- `feat/sidebar-icon-label-navigation-20261117` — `c8bc6af9181bc124d95e361d350422f49821eea3`
- `feat/sidebar-navigation-visual-refresh-20261117` — `314c06e7e9ec2fc39145b1216058fddf4043c418`
- `feat/subscription-engine-local-simulation-20261117` — `c077af1465c262e19f309c746ff3c84f332b7f5e`
- `feat/sunupilot-dashboard-reference` — `11d55850b64702302a922185af02440394131541`
- `feat/templates-factures-devis-complets` — `81aa9fa67012f19b69c2df4a0c72490b14dea285`
- `feat/topbar-notifications-bell-20261112` — `a36472e66f180124a699c01d10b26012e4b8b079`
- `feat/ui-motion-visual-recette-20261112` — `1ae8c307b3cf394e8103f5e40237494723c4dae1`
- `feat/workspace-settings-navigation-20261121` — `868027e1edc8c0e7ad1d5f25e78d90d24b50c5f4`
- `feat/5-nouveaux-modeles-facture` — `342a3e43c5b8801411892d72d04be6faa2ee7d5d`
- `feat/15-day-trial-entitlements-20261121` — `e3b91dc4ae459fc4fdd65b63dd440f632ccd4217`
- `feature/ohada-expense-account-mappings-20261122` — `6f82b82dfab5c6d4a8b0fc0a466b331a2ebab3c7`
- `feature/video-presentation-spark-sunupilot` — `29dd7ccc8084ce91f9c7eee975610fdd039a67f4`
- `fix/a11y-settings-labels-20261116` — `4b275916eefa7253b2cc11b3c0a150d9050a918d`
- `fix/accessibility-contrast-focus-main-20261121` — `0b819127cc8bdbf8410611642d51b257431e84a6`
- `fix/accessibility-template-preview-contrast-20261122` — `6b3cd9ffd5446b13e71ca9108c61ade2fde4af5e`
- `fix/accounting-event-audit-retention-v22-20261122` — `90b718abcbef7cbd01ec39dcf368488d0eafdf65`
- `fix/accounting-event-audit-retention-v22-run2-20261122` — `5b6ba8bf3b05e4155697159c60cf4b5051196bf8`
- `fix/accounting-invoice-cancellation-reversal-20261121` — `ba756d09888474477a19c182b42c1298ef092dd8`
- `fix/accounting-refund-journal-reversal-20261121` — `b45f479754341f8111e5233a09cec21f76a762da`
- `fix/atomic-backup-publish-2026-11-15` — `081d931236086aca8f53eebb312540c73a9934b7`
- `fix/atomic-encrypted-backups-2026-11-15` — `03a36a61b7c4e30321066c78babe95c67bda363e`
- `fix/audit-devise-relances-escape` — `4e848f3b98b1bc93635f0dab01a7d752fd2b18cd`
- `fix/backup-directory-permissions-20261122` — `1c3a12bacd9c6a761247756562ea77ebe50ef41d`
- `fix/backup-retention-guard-2026-11-16` — `e277ca8a841204b0cdfd98d497311ffe87a5c28e`
- `fix/ci-serial-tests-2026-11-15` — `4a74afa8dceaebc1dcb7dbaf6e88b175e6438fde`
- `fix/client-delete-history-protection-20261122` — `f2aada8d5c016998591fc0b31771de11c3b8ed50`
- `fix/dashboard-donut-count-20261118` — `2d4d7619350a6fe5ddc50868cb7e4d3ca5d4cb39`
- `fix/docker-context-secrets-and-lockfile-2026-11-15` — `52d4b81b3ff86b73e9b7956cb31e217d87a8160b`
- `fix/docker-local-startup-mysql-redis-swagger` — `2f021548666e2575035ff4d45ca9936f4ceaf7b7`
- `fix/enterprise-badge-contrast-main-20261122` — `52021018d7894b637d311af7d036cea220248195`
- `fix/enterprise-invitation-email-proof-20261116` — `4347d572f4e78fe057fc3595d677619abe74e745`
- `fix/expense-ledger-protection-20261122` — `4e0f2a893812df88a2dd4a9bed2c26224ea9f656`
- `fix/invoice-delete-history-guard-20261122` — `2c7f3cbde915e19ea484236c7a76ad7008f485ae`
- `fix/invoice-footer-stamp-mobile-20261121` — `7c562612e897e2ed7af93e494a4cf79bbb8da5e1`
- `fix/invoice-mobile-table-cards-20261121` — `67f7721d512370db3b40413a12f212226324ca76`
- `fix/invoice-pdf-continuation-identity-20261121` — `885b7b42a7d4dc56ba2c3dc6a69b5b3bcf7a8b1d`
- `fix/invoice-print-and-payment-stamp-2026-11-15` — `ed6c1467affe76a6e055af95b943a44cedc09891`
- `fix/invoice-print-banner-geometry-20261121` — `0ec7c3eeb59fa70465d4a0037e6c3c2d461bb2df`
- `fix/invoice-print-banner-spacing-20261122` — `4eec7b226911cea55d47ecffba9473a5456fa51e`
- `fix/invoice-print-typography-20261118` — `d8805a202dd96748e83e3d3a43b48e2787b41b63`
- `fix/invoice-settlement-integrity-2026-11-15` — `30318cf3cf48be4f0a6ccd9bda0cdac699211341`
- `fix/invoice-stock-principal-warehouse` — `383c885a969bf3da2ce8e06acc8829a5f1d1e60b`
- `fix/light-dark-theme-consistency-20261118` — `bf497de04d01096648f201619c29b63b7321b7a4`
- `fix/mobile-invoice-line-columns` — `9019ec2dfca2c067532f493fb49f7dbb33ba9f0a`
- `fix/mobile-nonpublic-hostnames-20261123` — `27fa8c2ec2e2e87b5f6b58a98b07052f5a5bce75`
- `fix/monthly-invoice-quota-schema-v8-2026-11-15` — `69028f5946e93f259fdcd69cb7d3f9c913b99d31`
- `fix/mysql-backup-limited-privileges-20261122` — `bdca6bec1c5b98747571907dffa91195c15293b7`
- `fix/navigation-compact-sidebar-2026-11-13` — `508607c7cc69e560b539438c44cbc2330b035a6e`
- `fix/pdf-headless-user-formatting-20261121` — `862d31a76342f47c4df9dbe2690dcaf914360921`
- `fix/pdf-pagination-extras-flow-20261117` — `2e7dd32a3eec318051d5891e8c03f6447ae2afba`
- `fix/pdf-print-pagination-20261117` — `b8e344915ceaf843a79fee82f0f9aba784cf2d9f`
- `fix/pdf-stream-ack-payment-disclosures-20261116` — `a576e5e1fec88c5a0e7eb8272e791cdb2a49bcab`
- `fix/pdf-worker-db-readiness-2026-11-16` — `59d341a154621ef4e15acb77a402a1a85534e969`
- `fix/pdf-worker-health-and-sidebar-icons-2026-11-15` — `04304461cafad9c2576015e10dc59abf7437f329`
- `fix/pdf-worker-wait-for-api-health-2026-11-15` — `941f235f5f4b625af5038b1dc17710fe5db02acf`
- `fix/pro-orders-tenant-currency-20261123` — `953489e79a9a6779b03e9c436559b925904f5635`
- `fix/pro-workspace-status-contrast-20261122` — `baa9ea6a688121c580b9f95c1933a2a15663f07f`
- `fix/product-delete-stock-history-protection-20261122` — `27d5a6c27d5d3066c1f6aaa04e03945caa165974`
- `fix/purchase-receipt-warehouse-deadlock-20261119` — `f0f43c3d1e7a920b470894275f5d9754f306dae1`
- `fix/quota-registry-initialization-robustness-2026-11-15` — `c8ea3204dcdc805619a5e3bb83f318ffa97638a3`
- `fix/quote-executive-a4-pagination-20261121` — `400ce60ddb8f23e4f37fe836058f180682c2f0c7`
- `fix/quote-warehouse-resilience-20261120` — `8d0a4d2990174f950dcb334fbe1e6323a7d5e86f`
- `fix/refund-payment-method-mapping-20261122` — `3265810b25f3cb11cf416eca8ecb8852cfd9f547`
- `fix/refund-payment-method-mapping-rebased-20261122` — `17d25a5e3686f0016e94da9fe354b2f6e23b7afe`
- `fix/revoke-jwt-on-logout-2026-11-15` — `a209392784175e725ef82c1e73dab3240da9d19e`
- `fix/session-revocation-and-payment-timeouts-2026-11-15` — `46f280761b6149260eeca0e1bbab3ab5304d3118`
- `fix/sidebar-aria-current-2026-11-15` — `1066c1c4d02ebeebd571fc45534c6539b374963c`
- `fix/subscription-disabled-state-tests-docs-20261117` — `60f57e272b273364a556781c18bc71fdee4806e3`
- `fix/subscription-icons-main-2026-11-15` — `3316731d6119e6b43a9cdef8c935083f0b4a6979`
- `fix/sunupilot-pwa-lifecycle` — `86da24a1c6e8fc6d6b1dc57d648d1c2cbaa0722f`
- `fix/team-invitation-email-proof-20261117` — `8e1b84dffe598350c88ed2442e8df06339507c7e`
- `fix/ui-icons-legibility-2026-11-15` — `0d7c5390f47444a13eae765a083e7bc2cdafb5c0`
- `fix/ui-responsive-polish-20261117` — `5efe69b69853850e99e11626b3272cc2e57a9fb8`
- `fix/visual-qr-fixture-20261121` — `df6070e367ae720a789e1c190408819e56db86cd`
- `fix/webhook-local-timezone-dynamic-currency-20261123` — `b07000daa7663196de68a42bc0ba011f4f4cf7f9`
- `fix/whatsapp-country-guard-2026-11-16` — `a49756cd21ec95f952044412b0538c1938564a90`
- `improve/pdf-page3-balance-20261121` — `115ab9f0e2f15a90807434612edac6b49d084103`
- `improve/pdf-page3-balance-main-20261121` — `3bab7c770052a811b14273b380196c63940fa466`
- `integration/main-company-invitation-email-proof-20261117` — `70750be430c83c4bf3ff369ad453c7b1fd1af511`
- `integration/reconcile-main-v21-20261122` — `e8b2dc9c6f20ed40d0b49327f276366afe45a8b5`
- `integration/schema-v21-accounting-trial-20261122` — `decb8da2e48e8f7a93fc63202f00fe0b4170e6e2`
- `integration/schema-v22-main-reconciled-20261122` — `62ea473892b11439074b75ea58e674e2f60e5a81`
- `integration/sunupilot-video-main-20261121` — `817b10da7b85ce9ca3eb0d4a8312f258349b5647`
- `main` — `b43a94fc2937b0108077501a0260358c8569e11f`
- `qa/test-pdf-24-modeles` — `d3b70a09c598195713cc7e9b49d03b7db52a1404`
- `rebase/pr106-main-20261121-run1` — `383c885a969bf3da2ce8e06acc8829a5f1d1e60b`
- `rebase/pr110-main-20261121-run1` — `ca1d1abdc9c6deef1a6dce9c36f27d0a2486df58`
- `rebrand/optigest` — `3f70466d0b6bc1ab41f082e31324d5702bd39966`
- `reconciliation/schema-v21-main-base-20261122` — `d9c428aaa916a54994d4d5064543facf4eead29c`
- `security/docker-ignore-local-secrets-2026-11-15` — `4d2c20e28ee29d9c18538d8775e64a73772ea8ce`
- `security/immediate-session-revocation-2026-11-16` — `d6887ce043b8c3871a03342943ee270375f7aff9`
- `security/invoice-list-verification-code-redaction-20261122` — `1c6bf875b98273cac0c00ac5c306aa22dcafb8d3`
- `security/redact-secret-urls-in-logs-2026-11-16` — `d27f55b581ba7db3da5decd411d26c399531bc94`
- `test/accessibility-audit-business-pages-20261118` — `468caba29865f38eaa788f043f2ae164b4b965f9`
- `test/accessibility-dark-keyboard-20261118` — `86aeeb6f4be28ad4d76622e3a26ac0304326dc73`
- `test/accessibility-dark-keyboard-rebased-20261120` — `722b5bfce06704a645dbe27b1516333e980dd920`
- `test/backup-atomic-visibility-2026-11-15` — `f4c463e5ec768eee125a7d0f623f0ae4626ea38d`
- `test/dark-theme-zoom-200-sweep-20261118` — `6fe85dfd3076e8024a854405bed4f5051bd1af72`
- `test/expense-accounting-mappings-regression-20261122` — `46d95cfd1e0dba639c31661e48f2b27026f6b20f`
- `test/free-trial-expiry-session-guard-20261122` — `29932fbbefe39bad5bb5c3a187a6ade99cafafd3`
- `test/invoice-long-pdf-pagination-20261121` — `41fb9896ab4b1393f35082a5fb988e5bc9bceb5d`
- `test/invoice-short-pdf-one-page-20261121` — `c592c7046f78ebfb127ce5490b4e08d31419d49f`
- `test/invoice-short-pdf-one-page-main-20261121` — `f49d352125352d009da9abebd2ceecbb122c6d6b`
- `test/ohada-expense-ledger-integrity-20261121` — `3873c1d1dbaa114af2aec991b1f49e48702f82a1`
- `test/pdf-font-embedding-and-visual-print-20261118` — `42b5a0bcf4393a6b4c513c2a621c9a3b7576efa6`
- `test/security-auth-reset-token-redaction-20261122` — `a10bc748a38b05a80caf21c9f2f16da5e729d2e1`
- `test/team-invitation-expiry-email-change-20261122` — `4fa9a6878a9804683581133e63ef8ef19dd28cd7`
- `test/theme-dark-mobile-sweep-20261118` — `55c985deecd6b225030c2f6129afc446f97106ca`
- `test/theme-dark-sweep-20261118` — `7bd4d2e94fe00a0de6413e4545bdc23895d49745`
- `test/theme-light-desktop-sweep-20261118` — `dfe8ce45fdb4bed07a6d88c679ff46c601208a69`
- `test/theme-light-mobile-sweep-20261118` — `b77108576d2ccaa14fbf618e6707cb903a99f73a`
- `test/workspace-zoom-200-sweep-20261118` — `dd64ea0274ce4d01f30e5fe9a4097ba006d967b1`
- `tooling/local-docker-test-bundle-20261112` — `b88eeebb659dc119848094f8ddc6d9894a3be569`
- `ui/augmenter-logo-icones-sidebar` — `63af3d94dc35cc3534a58f467201f3dda3803493`
- `ui/modern-responsive-polish` — `a2faa30e320e1ad09b4537201a4627dc909f5514`
- `ux/dashboard-mobile-module-rail-20261122` — `53eadfe851b4ee3faf7122d485299025ea300808`
- `ux/pro-workspace-mobile-domain-rail-20261122` — `185e0487c95489b8748c1d33418317c5aaf77eb7`
- `ux/settings-company-fields-grid-20261122` — `99670cdf29694c73e0a09038380af250704e89c3`

## PR ouvertes (46)
- #175 **docs(audit): rapport d'exécution run 5 — 23 novembre** — `audit/execution-report-20261123-run5` `f9f95b734deb3fe9ecacfbb257686085b3fa53a6` → `main`; draft=true; updated=2026-11-23T03:01:37Z
- #174 **fix(mobile): reject reserved non-public hostnames** — `fix/mobile-nonpublic-hostnames-20261123` `27fa8c2ec2e2e87b5f6b58a98b07052f5a5bce75` → `main`; draft=true; updated=2026-11-23T04:00:11Z
- #173 **feat(mobile): block native builds until HTTPS domain is configured** — `feat/mobile-config-preflight` `23c1cf95bf459118324dfece3580ece4470b9b34` → `main`; draft=false; updated=2026-11-23T03:59:22Z
- #172 **docs(audit): rapport d'exécution run 4 — 23 novembre** — `audit/execution-report-20261123-run4` `14688f7a8fd8fe5d9b3cdde50bb546ac7485f30e` → `main`; draft=true; updated=2026-11-23T02:08:30Z
- #171 **fix(pro): use tenant currency for orders and lock history** — `fix/pro-orders-tenant-currency-20261123` `953489e79a9a6779b03e9c436559b925904f5635` → `fix/webhook-local-timezone-dynamic-currency-20261123`; draft=true; updated=2026-11-23T02:08:15Z
- #170 **docs(audit): rapport d'exécution run 3 — 23 novembre** — `audit/execution-report-20261123-run3` `6fa59a42ebb12bb9d6f8a266059125b81991ff95` → `main`; draft=true; updated=2026-11-23T01:03:16Z
- #169 **docs(audit): rapport d'exécution run 2 — 22 novembre** — `audit/execution-report-20261122-run2` `dff61fb42a429fce93ed1fc6f0a3c9f355ced6f4` → `main`; draft=true; updated=2026-11-23T00:01:19Z
- #168 **fix: fuseau local, devise du tenant et isolation des routes** — `fix/webhook-local-timezone-dynamic-currency-20261123` `b07000daa7663196de68a42bc0ba011f4f4cf7f9` → `main`; draft=false; updated=2026-11-23T02:37:38Z
- #167 **fix: devise des emails, relances impayés et échappement HTML** — `fix/audit-devise-relances-escape` `4e848f3b98b1bc93635f0dab01a7d752fd2b18cd` → `main`; draft=false; updated=2026-11-23T00:57:05Z
- #166 **docs(audit): rapport d'exécution initial du 22 novembre** — `audit/execution-report-20261122-run1` `dc7e6f55c5f7d357400f78c26dcfa469b75c3cef` → `main`; draft=true; updated=2026-11-22T23:03:13Z
- #164 **test(security): empêcher la divulgation des hashes de réinitialisation** — `test/security-auth-reset-token-redaction-20261122` `a10bc748a38b05a80caf21c9f2f16da5e729d2e1` → `main`; draft=false; updated=2026-11-22T22:30:46Z
- #159 **security(invoices): retirer le code public de la liste paginée** — `security/invoice-list-verification-code-redaction-20261122` `1c6bf875b98273cac0c00ac5c306aa22dcafb8d3` → `main`; draft=false; updated=2026-11-22T22:40:16Z
- #157 **a11y(navigation): fermer le menu mobile avec Échap** — `a11y/mobile-sidebar-escape-focus-20261122` `c37403034a25bad6d4ecd0867066ce8c258bdd9c` → `main`; draft=false; updated=2026-11-22T22:37:14Z
- #156 **a11y(dashboard): ajouter un accès clavier au contenu principal** — `a11y/dashboard-skip-navigation-20261122` `8f45795c3df521ffb021947d5376bfaa22a832ca` → `main`; draft=false; updated=2026-11-22T22:40:40Z
- #155 **ux(settings): grille responsive pour les coordonnées entreprise** — `ux/settings-company-fields-grid-20261122` `99670cdf29694c73e0a09038380af250704e89c3` → `main`; draft=false; updated=2026-11-22T22:39:25Z
- #154 **ux(workspace): navigation mobile compacte par domaine** — `ux/pro-workspace-mobile-domain-rail-20261122` `185e0487c95489b8748c1d33418317c5aaf77eb7` → `main`; draft=false; updated=2026-11-22T22:39:02Z
- #153 **test(trial): vérifier l'expiration sur la première requête protégée** — `test/free-trial-expiry-session-guard-20261122` `29932fbbefe39bad5bb5c3a187a6ade99cafafd3` → `main`; draft=false; updated=2026-11-22T22:38:39Z
- #149 **feat(accounting): configure expense category account mappings (schema v23)** — `feature/ohada-expense-account-mappings-20261122` `6f82b82dfab5c6d4a8b0fc0a466b331a2ebab3c7` → `main`; draft=true; updated=2026-11-22T23:58:05Z
- #147 **integration: réconcilier comptabilité OHADA et essai gratuit v21 avec main actuel** — `integration/reconcile-main-v21-20261122` `e8b2dc9c6f20ed40d0b49327f276366afe45a8b5` → `main`; draft=true; updated=2026-11-22T14:53:47Z
- #146 **fix(integration): reconcile OHADA, 15-day trial and audit retention on current main** — `integration/schema-v22-main-reconciled-20261122` `62ea473892b11439074b75ea58e674e2f60e5a81` → `main`; draft=true; updated=2026-11-22T14:48:07Z
- #145 **fix(accounting): retain invoice reversal events (schema v22)** — `fix/accounting-event-audit-retention-v22-run2-20261122` `5b6ba8bf3b05e4155697159c60cf4b5051196bf8` → `integration/schema-v21-accounting-trial-20261122`; draft=true; updated=2026-11-22T14:48:24Z
- #144 **fix(accounting): retain invoice reversal events on invoice deletion (schema v22)** — `fix/accounting-event-audit-retention-v22-20261122` `90b718abcbef7cbd01ec39dcf368488d0eafdf65` → `integration/schema-v21-accounting-trial-20261122`; draft=true; updated=2026-11-22T13:32:39Z
- #143 **fix(accounting): map cheque payments to bank and reject unknown methods** — `fix/refund-payment-method-mapping-rebased-20261122` `17d25a5e3686f0016e94da9fe354b2f6e23b7afe` → `integration/schema-v21-accounting-trial-20261122`; draft=true; updated=2026-11-22T13:27:10Z
- #142 **feat(accounting, trial): integrate invoice lifecycle and 15-day trial on schema v21** — `integration/schema-v21-accounting-trial-20261122` `decb8da2e48e8f7a93fc63202f00fe0b4170e6e2` → `main`; draft=true; updated=2026-11-22T14:48:22Z
- #141 **ci: add workspace UI structure regression checks** — `ci/workspace-ui-structure-tests-20261122` `2a09ccf8bfdb3b26b84482b7445902f266fb1dbf` → `feat/workspace-settings-navigation-20261121`; draft=true; updated=2026-11-22T11:26:43Z
- #140 **ci(lint): couvrir les routes backend et tests de protection** — `ci/lint-history-protection-backend-20261122` `32d1c1f56cb9c2b46890aae5b0b72136b13660a8` → `main`; draft=true; updated=2026-11-22T18:29:37Z
- #139 **fix(a11y): improve professional workspace status contrast** — `fix/pro-workspace-status-contrast-20261122` `baa9ea6a688121c580b9f95c1933a2a15663f07f` → `main`; draft=true; updated=2026-11-22T05:25:30Z
- #138 **fix(inventory): protect products with stock or history** — `fix/product-delete-stock-history-protection-20261122` `27d5a6c27d5d3066c1f6aaa04e03945caa165974` → `main`; draft=true; updated=2026-11-22T07:26:57Z
- #137 **fix(accounting): protect clients with linked history** — `fix/client-delete-history-protection-20261122` `f2aada8d5c016998591fc0b31771de11c3b8ed50` → `main`; draft=true; updated=2026-11-22T06:32:41Z
- #136 **fix(accounting): protect posted expenses from edits and deletion** — `fix/expense-ledger-protection-20261122` `4e0f2a893812df88a2dd4a9bed2c26224ea9f656` → `main`; draft=true; updated=2026-11-22T03:36:56Z
- #135 **fix(accounting): preserve issued invoice history** — `fix/invoice-delete-history-guard-20261122` `2c7f3cbde915e19ea484236c7a76ad7008f485ae` → `main`; draft=true; updated=2026-11-22T03:44:16Z
- #134 **fix(a11y): badge Entreprise lisible en thème sombre** — `fix/enterprise-badge-contrast-main-20261122` `52021018d7894b637d311af7d036cea220248195` → `main`; draft=true; updated=2026-11-22T03:30:08Z
- #133 **fix(a11y): corriger le contraste des aperçus de modèles** — `fix/accessibility-template-preview-contrast-20261122` `6b3cd9ffd5446b13e71ca9108c61ade2fde4af5e` → `fix/accessibility-contrast-focus-main-20261121`; draft=true; updated=2026-11-22T02:48:11Z
- #132 **docs(audit): état initial et plan priorisé 22 novembre** — `audit/initial-review-20261122` `6543b3a701753341dae348032f9d08f003e2d796` → `main`; draft=true; updated=2026-11-22T14:28:41Z
- #131 **docs: actualiser la feuille de route sur le main courant** — `docs/improvement-plan-main-20261122` `3d51f0afb669ebdddc18c2601cd123d89c206683` → `main`; draft=true; updated=2026-11-22T00:16:27Z
- #130 **fix(a11y): contraste WCAG AA et focus clavier sur les deux thèmes** — `fix/accessibility-contrast-focus-main-20261121` `0b819127cc8bdbf8410611642d51b257431e84a6` → `main`; draft=true; updated=2026-11-22T18:25:55Z
- #129 **feat(workspace): navigation par domaines et paramètres structurés** — `feat/workspace-settings-navigation-20261121` `868027e1edc8c0e7ad1d5f25e78d90d24b50c5f4` → `main`; draft=true; updated=2026-11-22T00:06:15Z
- #128 **feat(trial,workspace): essai 15 jours et organisation professionnelle** — `feat/15-day-trial-entitlements-20261121` `e3b91dc4ae459fc4fdd65b63dd440f632ccd4217` → `main`; draft=false; updated=2026-11-22T14:14:44Z
- #127 **fix(pdf): pagination A4 du devis Executive (28 lignes)** — `fix/quote-executive-a4-pagination-20261121` `400ce60ddb8f23e4f37fe836058f180682c2f0c7` → `main`; draft=false; updated=2026-11-22T19:27:40Z
- #126 **feat(landing): présentation vidéo Sunupilot — portage sur main actuel** — `integration/sunupilot-video-main-20261121` `817b10da7b85ce9ca3eb0d4a8312f258349b5647` → `main`; draft=true; updated=2026-11-22T00:16:35Z
- #118 **feat(landing): vidéo Sunupilot — capture locale automatisée des écrans** — `feature/video-presentation-spark-sunupilot` `29dd7ccc8084ce91f9c7eee975610fdd039a67f4` → `main`; draft=false; updated=2026-11-22T00:15:38Z
- #115 **test(accounting): cover expense posting and tenant isolation** — `test/ohada-expense-ledger-integrity-20261121` `3873c1d1dbaa114af2aec991b1f49e48702f82a1` → `main`; draft=false; updated=2026-11-22T02:51:32Z
- #114 **docs: centralize SamaFacture Pro improvement roadmap** — `docs/improvement-plan-20261121` `ff2cae7bd378680ec20a9998851665a166c539c8` → `main`; draft=false; updated=2026-11-22T00:08:08Z
- #110 **test(accessibility): cover light/dark keyboard navigation and contrast** — `test/accessibility-dark-keyboard-rebased-20261120` `722b5bfce06704a645dbe27b1516333e980dd920` → `main`; draft=false; updated=2026-11-22T00:07:16Z
- #102 **test(accessibility): couvrir le thème sombre et le parcours clavier** — `test/accessibility-dark-keyboard-20261118` `86aeeb6f4be28ad4d76622e3a26ac0304326dc73` → `main`; draft=true; updated=2026-11-22T00:07:18Z
- #99 **Adopt SunuPilot branding — indigo and baobab green** — `rebrand/optigest` `3f70466d0b6bc1ab41f082e31324d5702bd39966` → `main`; draft=false; updated=2026-11-22T00:08:10Z

## PR fermées (125)
- #165 docs(backup): sécuriser le transfert hors serveur rclone — merged 2026-11-22T23:00:11Z; head `docs/backup-offsite-pinned-rclone-20261122` `76aa447d8beefa49dc7da11d334144bd2c75427f`; base `main`
- #163 security(backup): restreindre les permissions du dossier de sauvegarde — merged 2026-11-22T22:43:06Z; head `fix/backup-directory-permissions-20261122` `1c3a12bacd9c6a761247756562ea77ebe50ef41d`; base `main`
- #162 test(security): couvrir expiration et changement email des invitations equipe — merged 2026-11-22T22:33:55Z; head `test/team-invitation-expiry-email-change-20261122` `4fa9a6878a9804683581133e63ef8ef19dd28cd7`; base `main`
- #161 ux(dashboard): réduire le défilement mobile des modules — merged 2026-11-22T22:24:23Z; head `ux/dashboard-mobile-module-rail-20261122` `53eadfe851b4ee3faf7122d485299025ea300808`; base `main`
- #160 fix(backup): compatible avec le compte MySQL limité de Docker — merged 2026-11-22T22:06:19Z; head `fix/mysql-backup-limited-privileges-20261122` `bdca6bec1c5b98747571907dffa91195c15293b7`; base `main`
- #158 docs(security): corriger les conseils CORS et proxy — merged 2026-11-22T22:15:02Z; head `docs/production-env-security-guidance-20261122` `be0f2789ccebd103c9fbf8da28bd1586eddb1549`; base `main`
- #152 test(accounting): couvrir les correspondances OHADA des dépenses — merged 2026-11-22T21:58:19Z; head `test/expense-accounting-mappings-regression-20261122` `46d95cfd1e0dba639c31661e48f2b27026f6b20f`; base `main`
- #151 fix(print): preserve full-width invoice banners on A4 — merged 2026-11-22T17:02:54Z; head `fix/invoice-print-banner-spacing-20261122` `4eec7b226911cea55d47ecffba9473a5456fa51e`; base `main`
- #150 feat(accounting): configure OHADA sales and expense mappings — merged 2026-11-22T16:29:47Z; head `feat/ohada-account-mappings-20261122` `ca3cb8fbf594f41c39cfe5958e3bb04520825864`; base `main`
- #148 reconcile: port trial and accounting protections (schema v22) onto current main — merged 2026-11-22T15:11:54Z; head `reconciliation/schema-v21-main-base-20261122` `d9c428aaa916a54994d4d5064543facf4eead29c`; base `main`
- #125 fix(pdf): pagination A4 cohérente des factures et devis longs — merged 2026-11-22T21:49:43Z; head `improve/pdf-page3-balance-main-20261121` `3bab7c770052a811b14273b380196c63940fa466`; base `main`
- #124 fix(invoice): afficher les montants des lignes sans scroll mobile — merged 2026-11-21T18:49:21Z; head `fix/invoice-mobile-table-cards-20261121` `67f7721d512370db3b40413a12f212226324ca76`; base `fix/invoice-footer-stamp-mobile-20261121`
- #123 test(pdf): garantir une facture courte sur une page A4 — merged 2026-11-21T19:20:45Z; head `test/invoice-short-pdf-one-page-20261121` `c592c7046f78ebfb127ce5490b4e08d31419d49f`; base `main`
- #122 test(visual): fournir un QR code aux fixtures mobiles facture/devis — closed without merge; head `fix/visual-qr-fixture-20261121` `df6070e367ae720a789e1c190408819e56db86cd`; base `fix/invoice-footer-stamp-mobile-20261121`
- #121 fix(pdf): préserver le cachet sur les écrans mobiles — merged 2026-11-21T19:06:17Z; head `fix/invoice-footer-stamp-mobile-20261121` `7c562612e897e2ed7af93e494a4cf79bbb8da5e1`; base `main`
- #120 fix(accounting): reverse refund entries in cash and bank journals — merged 2026-11-21T19:21:29Z; head `fix/accounting-refund-journal-reversal-20261121` `b45f479754341f8111e5233a09cec21f76a762da`; base `feat/accounting-expense-payment-mode-20261121`
- #119 feat(accounting): distinguish cash and bank expense payments — merged 2026-11-21T19:21:58Z; head `feat/accounting-expense-payment-mode-20261121` `08a1c025744a7af2d795c7a761607ac1bf71b424`; base `fix/accounting-invoice-cancellation-reversal-20261121`
- #117 fix(accounting): reverse invoice entries on cancellation and reactivation — merged 2026-11-22T14:14:05Z; head `fix/accounting-invoice-cancellation-reversal-20261121` `ba756d09888474477a19c182b42c1298ef092dd8`; base `main`
- #116 test(pdf): couvrir la pagination des factures longues — merged 2026-11-21T18:52:37Z; head `test/invoice-long-pdf-pagination-20261121` `41fb9896ab4b1393f35082a5fb988e5bc9bceb5d`; base `main`
- #113 fix(pdf): preserve company date and number formats in headless PDFs — closed without merge; head `fix/pdf-headless-user-formatting-20261121` `862d31a76342f47c4df9dbe2690dcaf914360921`; base `fix/invoice-pdf-continuation-identity-20261121`
- #112 fix(pdf): repeat company and document identity on continuation pages — merged 2026-11-21T15:07:33Z; head `fix/invoice-pdf-continuation-identity-20261121` `885b7b42a7d4dc56ba2c3dc6a69b5b3bcf7a8b1d`; base `main`
- #111 fix(invoice): keep print banners inside the A4 printable area — merged 2026-11-21T13:57:53Z; head `fix/invoice-print-banner-geometry-20261121` `0ec7c3eeb59fa70465d4a0037e6c3c2d461bb2df`; base `main`
- #109 fix(invoice): keep quotes available during warehouse API outages — merged 2026-11-20T11:32:36Z; head `fix/quote-warehouse-resilience-20261120` `8d0a4d2990174f950dcb334fbe1e6323a7d5e86f`; base `main`
- #108 fix(stock): éviter les deadlocks lors de l'initialisation du magasin principal — merged 2026-11-19T23:30:48Z; head `fix/purchase-receipt-warehouse-deadlock-20261119` `f0f43c3d1e7a920b470894275f5d9754f306dae1`; base `main`
- #107 feat(stock): route invoice movements to the selected warehouse — merged 2026-11-20T10:23:02Z; head `feat/invoice-stock-warehouse-20261119` `30bcfaa58ebf4960c2308390b586cb13c5adb466`; base `main`
- #106 test(stock): validate invoice warehouse routing — merged 2026-11-21T14:53:43Z; head `fix/invoice-stock-principal-warehouse` `383c885a969bf3da2ce8e06acc8829a5f1d1e60b`; base `main`
- #105 feat(dashboard): rapprocher les raccourcis de la référence Sunupilot — merged 2026-11-19T17:39:09Z; head `feat/dashboard-reference-modules-20261119` `f3cbbc669629fa730783bdbfbe6baf72ab5d81c0`; base `main`
- #104 fix(pwa): fiabiliser le cycle de vie du service worker — merged 2026-11-19T01:45:03Z; head `fix/sunupilot-pwa-lifecycle` `86da24a1c6e8fc6d6b1dc57d648d1c2cbaa0722f`; base `main`
- #103 feat(brand): intégrer les fondations visuelles SUNUPILOT — merged 2026-11-19T01:05:12Z; head `brand/sunupilot-identity-foundation` `63f8eb27a5ff410c7f1c96e844f8114289531b40`; base `main`
- #101 fix(accessibility): corriger les contrastes et auditer les 17 pages — merged 2026-11-18T16:33:14Z; head `test/accessibility-audit-business-pages-20261118` `468caba29865f38eaa788f043f2ae164b4b965f9`; base `main`
- #100 test(visual): couvrir le zoom 200 % en thème sombre — merged 2026-11-18T15:44:48Z; head `test/dark-theme-zoom-200-sweep-20261118` `6fe85dfd3076e8024a854405bed4f5051bd1af72`; base `main`
- #98 fix(responsive): corriger les tableaux au zoom 200 % — merged 2026-11-18T15:28:59Z; head `test/workspace-zoom-200-sweep-20261118` `dd64ea0274ce4d01f30e5fe9a4097ba006d967b1`; base `main`
- #97 fix(dashboard): améliorer la lisibilité du total des factures — merged 2026-11-18T14:57:01Z; head `fix/dashboard-donut-count-20261118` `2d4d7619350a6fe5ddc50868cb7e4d3ca5d4cb39`; base `main`
- #96 test(theme): vérifier le mode clair sur bureau — merged 2026-11-18T14:43:38Z; head `test/theme-light-desktop-sweep-20261118` `dfe8ce45fdb4bed07a6d88c679ff46c601208a69`; base `main`
- #95 test(theme): vérifier le mode clair sur mobile — merged 2026-11-18T14:28:28Z; head `test/theme-light-mobile-sweep-20261118` `b77108576d2ccaa14fbf618e6707cb903a99f73a`; base `main`
- #94 test(theme): vérifier le mode sombre sur mobile — merged 2026-11-18T14:13:13Z; head `test/theme-dark-mobile-sweep-20261118` `55c985deecd6b225030c2f6129afc446f97106ca`; base `main`
- #93 fix(theme): garantir le contraste de l’aperçu facture en mode sombre — merged 2026-11-18T13:47:04Z; head `test/theme-dark-sweep-20261118` `7bd4d2e94fe00a0de6413e4545bdc23895d49745`; base `main`
- #92 test(pdf): vérifier les polices incorporées et les marges A4 réelles — merged 2026-11-18T13:02:11Z; head `test/pdf-font-embedding-and-visual-print-20261118` `42b5a0bcf4393a6b4c513c2a621c9a3b7576efa6`; base `main`
- #91 fix(invoice): améliorer les polices et l’impression A4 des factures et devis — merged 2026-11-18T11:49:06Z; head `fix/invoice-print-typography-20261118` `d8805a202dd96748e83e3d3a43b48e2787b41b63`; base `main`
- #90 fix(print): vérifier la typographie et l'impression A4 des 31 modèles — closed without merge; head `audit/invoice-pdf-typography-print-20261118` `7cb2d43cf3aadccb38e1a1a5d6c664a8db014c41`; base `main`
- #89 fix(ui): corriger la cohérence des thèmes clair et sombre — merged 2026-11-18T06:05:43Z; head `fix/light-dark-theme-consistency-20261118` `bf497de04d01096648f201619c29b63b7321b7a4`; base `main`
- #88 docs(docker): clarifier le démarrage local avec Docker — merged 2026-11-17T23:43:35Z; head `docs/local-docker-bootstrap-20261117` `eeea9c4a71001f32889bf302a78cff65e360a353`; base `main`
- #87 feat(invoice): ajouter 3 modèles Pro et 4 modèles Entreprise — merged 2026-11-17T22:25:53Z; head `feat/invoice-templates-pro-enterprise-20261117` `4de3da4409263f2ff1deff7350c488d18a5f7fb2`; base `main`
- #86 fix(ui): améliorer les interactions sidebar et Entreprise sur mobile — merged 2026-11-17T19:46:57Z; head `fix/ui-responsive-polish-20261117` `5efe69b69853850e99e11626b3272cc2e57a9fb8`; base `main`
- #85 docs(ui): préparer les corrections responsive et animations — closed without merge; head `docs/ui-polish-plans-20261117` `137a9b01d3ea60ffeb7ec3a0338607638871acd2`; base `chore/emil-design-skills-20261117`
- #84 feat(billing): préparer le moteur d'abonnement mensuel en simulation locale — merged 2026-11-17T19:15:14Z; head `feat/subscription-engine-local-simulation-20261117` `c077af1465c262e19f309c746ff3c84f332b7f5e`; base `main`
- #83 docs(billing): cadrer l'architecture des abonnements mensuels — merged 2026-11-18T13:11:12Z; head `docs/subscription-monthly-architecture-20261117` `430e2010b1bee958b1b26435c1f8462a6e503ad2`; base `main`
- #82 chore(agents): intégrer les skills design engineering — merged 2026-11-18T13:19:13Z; head `chore/emil-design-skills-20261117` `70f8ea190bfd00316cfe8de2ccf5d9bcc83b193a`; base `main`
- #81 feat(nav): moderniser le rail latéral avec libellés — merged 2026-11-17T16:50:40Z; head `feat/sidebar-icon-label-navigation-20261117` `f3ce7ed158e7cb83ddcad347983ed1ff17af9f3e`; base `main`
- #80 feat(entreprise): paginer la liste des sociétés du groupe — merged 2026-11-17T14:46:45Z; head `feat/enterprise-company-pagination-20261117` `3b8d8ebc171b7c5053d865c0a29b589793094a20`; base `main`
- #79 feat(nav): moderniser la barre latérale et les icônes — merged 2026-11-17T14:01:03Z; head `feat/sidebar-navigation-visual-refresh-20261117` `314c06e7e9ec2fc39145b1216058fddf4043c418`; base `main`
- #78 docs(billing): clarifier l’état réel des abonnements mensuels — closed without merge; head `docs/subscriptions-current-state-20261117` `e618e88c7be3178be3f9d8bd0c2229fba53b3767`; base `main`
- #77 test(billing): verrouiller les abonnements récurrents non activés — merged 2026-11-17T15:01:56Z; head `fix/subscription-disabled-state-tests-docs-20261117` `60f57e272b273364a556781c18bc71fdee4806e3`; base `main`
- #76 fix(pdf): améliorer la pagination des devis et factures — closed without merge; head `fix/pdf-pagination-extras-flow-20261117` `2e7dd32a3eec318051d5891e8c03f6447ae2afba`; base `main`
- #75 fix(pdf): éviter les pages isolées dans les devis volumineux — merged 2026-11-17T12:42:24Z; head `fix/pdf-print-pagination-20261117` `b8e344915ceaf843a79fee82f0f9aba784cf2d9f`; base `main`
- #74 ci: exécuter le test réel de restauration des sauvegardes chiffrées — merged 2026-11-17T12:01:52Z; head `ci/real-restore-smoke-20261117` `8864ab9478d019205f2c5a58fc206712c7129070`; base `main`
- #73 feat(ui): simplifier les espaces Entreprise et professionnel — merged 2026-11-17T12:06:43Z; head `feat/enterprise-workspace-ux-20261117` `14cdd3c48c0b089bc35493bf93d4b4349c88ff1a`; base `main`
- #72 fix(team): sécuriser les invitations classiques par preuve email — merged 2026-11-17T12:16:53Z; head `fix/team-invitation-email-proof-20261117` `8e1b84dffe598350c88ed2442e8df06339507c7e`; base `main`
- #71 feat(entreprise): centre de pilotage consolidé du groupe — merged 2026-11-17T07:16:32Z; head `feat/enterprise-command-center-20261117` `ae7e0e8e59f0dfbe7ea8a7fee49b8ea375379e00`; base `main`
- #69 fix(security): vérifier l’adresse email avant le rattachement multi-sociétés — merged 2026-11-17T01:13:13Z; head `fix/enterprise-invitation-email-proof-20261116` `4347d572f4e78fe057fc3595d677619abe74e745`; base `feat/enterprise-multi-company-foundation-20261116`
- #68 feat: laisser le client choisir son moyen de paiement — merged 2026-11-17T00:25:30Z; head `feat/abonnement-choix-moyen-paiement` `3f32787dd561d01e91b1f784fb238376b2220b50`; base `main`
- #67 docs(email): corriger le comportement SMTP local et tester la redaction — merged 2026-11-17T00:56:27Z; head `audit/fix-reset-email-docs-and-redaction-test-20261116` `a53c96daa1c2052fa19ca270d574d948fab81f30`; base `main`
- #65 docs(billing): distinguer achat ponctuel et abonnement récurrent — closed without merge; head `docs/correct-one-time-plan-billing-2026-11-16` `43592f99b6f72cadc369b76c9489d4a831e21094`; base `main`
- #64 docs(audit): documenter le risque de vérification des invitations multi-sociétés — merged 2026-11-17T01:05:35Z; head `audit/security-multisocietes-review-20261116-run3` `4acf4d365c89d3152892d49515e9570d0be98eed`; base `main`
- #63 fix(realtime): autoriser les groupes Entreprise dans les notifications — merged 2026-11-17T01:24:59Z; head `audit/fix-realtime-company-groups-20261116-run1` `e5c3d8020b40079021aa678db9dbcb4969831e92`; base `feat/enterprise-multi-company-foundation-20261116`
- #62 fix(entreprise): corriger la migration v10 et les invitations — closed without merge; head `audit/fix-enterprise-migration-invitation-20261116` `0b93cf9e37feb94d2b317924f16f3045db45a9e4`; base `feat/enterprise-multi-company-foundation-20261116`
- #60 feat(entreprise): socle multi-sociétés et cadrage de l’abonnement mensuel — merged 2026-11-17T06:08:44Z; head `feat/enterprise-multi-company-foundation-20261116` `c19e12959de8895a8ecf59e4d0e3319c74e95bbe`; base `main`
- #59 docs(staging): corriger la procédure Docker Compose et HTTPS — merged 2026-11-17T00:50:53Z; head `docs/fix-staging-compose-runbook-20261116` `22c0dae280e3e7ee7305bd8b761c5cfebe2969bf`; base `main`
- #57 fix(a11y): associer les libellés de la page Paramètres — merged 2026-11-17T00:45:08Z; head `fix/a11y-settings-labels-20261116` `4b275916eefa7253b2cc11b3c0a150d9050a918d`; base `main`
- #56 fix(pdf): file durable avec acquittement et reprise, mentions paiement exactes — merged 2026-11-17T00:40:40Z; head `fix/pdf-stream-ack-payment-disclosures-20261116` `a576e5e1fec88c5a0e7eb8272e791cdb2a49bcab`; base `main`
- #55 audit: corriger la conservation des tâches PDF en attente — merged 2026-11-16T12:22:39Z; head `audit/rapport-approfondi-2026-11-16-run2` `1aee933103049ca9e0049ed76f00e4ff641c8aaa`; base `main`
- #54 fix: remove Nginx upstream balancing warning — merged 2026-11-16T11:38:12Z; head `audit/fix-nginx-upstream-order-20261116` `5e93abdc37d49cdb4c458c9963eeb7998aa018c8`; base `main`
- #53 docs: ajouter le plan d’entreprise et la stratégie de lancement — merged 2026-11-16T17:38:25Z; head `docs/business-plan-samafacture-pro` `ac07f0788ee60f1db6fc3a8a68bf4d0784b9e2a7`; base `main`
- #52 security: redact sensitive tokens from HTTP access logs — merged 2026-11-16T11:29:33Z; head `security/redact-secret-urls-in-logs-2026-11-16` `d27f55b581ba7db3da5decd411d26c399531bc94`; base `main`
- #51 CI: bloquer les dépendances présentant une vulnérabilité npm — merged 2026-11-16T10:24:42Z; head `audit/npm-audit-gate-2026-11-16` `63a344d9154b5f5879689fa632dc697148afe2e7`; base `main`
- #50 Fix: éviter la concurrence d'initialisation MySQL du worker PDF — merged 2026-11-16T10:13:36Z; head `fix/pdf-worker-db-readiness-2026-11-16` `59d341a154621ef4e15acb77a402a1a85534e969`; base `main`
- #49 test(ui): cover notification placement with visual viewport offsets — merged 2026-11-16T05:06:15Z; head `audit/visual-viewport-offset-regression-20261116` `f744b20396781fde17daa074380ca02c6a9e2d3c`; base `main`
- #48 fix(ui): keep notifications visible above the mobile keyboard — merged 2026-11-16T02:58:38Z; head `automation/visual-viewport-notifications-20261116-0243` `64f5b2c2ec8eb5e86f83a9661ff9596f329522d0`; base `main`
- #47 Éviter les mauvais destinataires WhatsApp pour les numéros locaux — merged 2026-11-16T02:00:15Z; head `fix/whatsapp-country-guard-2026-11-16` `a49756cd21ec95f952044412b0538c1938564a90`; base `main`
- #46 fix(ui): keep mobile notifications inside viewport — merged 2026-11-16T02:14:33Z; head `automation/audit-fixes-20261116-0150` `a423dca17e30edf84e6708cc470a6bf2ea995edb`; base `main`
- #45 Sécuriser la sauvegarde, la rétention et la restauration de la base — merged 2026-11-16T01:34:09Z; head `fix/backup-retention-guard-2026-11-16` `e277ca8a841204b0cdfd98d497311ffe87a5c28e`; base `main`
- #44 Sécurité : rendre la révocation des sessions immédiate entre workers — merged 2026-11-16T01:14:22Z; head `security/immediate-session-revocation-2026-11-16` `d6887ce043b8c3871a03342943ee270375f7aff9`; base `main`
- #43 Améliorer le mobile, les aperçus A4 et l’espace professionnel — merged 2026-11-16T01:15:46Z; head `fix/mobile-invoice-line-columns` `38a365581a31fdd996411ea44fff5db03b6c6c1d`; base `main`
- #42 Fiabiliser les PDF et corriger le thème système à l'impression — merged 2026-11-15T22:51:26Z; head `qa/test-pdf-24-modeles` `d3b70a09c598195713cc7e9b49d03b7db52a1404`; base `main`
- #41 Préparer l’archive du code fusionné sur main — closed without merge; head `ci/package-main-after-pr39-pr40` `8c725a00cd3b353684033e3c7219737af487d437`; base `main`
- #40 Ajouter cinq modèles modernes de facture et de devis — merged 2026-11-15T21:59:45Z; head `feat/5-nouveaux-modeles-facture` `342a3e43c5b8801411892d72d04be6faa2ee7d5d`; base `main`
- #39 Agrandir légèrement le logo et les icônes de navigation — merged 2026-11-15T21:59:13Z; head `ui/augmenter-logo-icones-sidebar` `63af3d94dc35cc3534a58f467201f3dda3803493`; base `main`
- #38 Make monthly invoice quota initialization deterministic — merged 2026-11-15T19:39:01Z; head `fix/quota-registry-initialization-robustness-2026-11-15` `c8ea3204dcdc805619a5e3bb83f318ffa97638a3`; base `main`
- #37 Exclude local secrets from Docker and require npm lockfile — merged 2026-11-15T18:56:44Z; head `fix/docker-context-secrets-and-lockfile-2026-11-15` `52d4b81b3ff86b73e9b7956cb31e217d87a8160b`; base `main`
- #36 Harden invoice settlement, paid status and payment idempotency — merged 2026-11-15T18:57:18Z; head `fix/invoice-settlement-integrity-2026-11-15` `30318cf3cf48be4f0a6ccd9bda0cdac699211341`; base `main`
- #35 Test that backup archives stay temporary until dump completion — merged 2026-11-15T18:02:23Z; head `test/backup-atomic-visibility-2026-11-15` `f4c463e5ec768eee125a7d0f623f0ae4626ea38d`; base `main`
- #34 Prevent local environment secrets from entering Docker images — closed without merge; head `security/docker-ignore-local-secrets-2026-11-15` `4d2c20e28ee29d9c18538d8775e64a73772ea8ce`; base `main`
- #33 Publish database backups only after atomic validation — closed without merge; head `fix/atomic-backup-publish-2026-11-15` `081d931236086aca8f53eebb312540c73a9934b7`; base `main`
- #32 Publish complete database backups atomically — merged 2026-11-15T17:51:27Z; head `fix/atomic-encrypted-backups-2026-11-15` `03a36a61b7c4e30321066c78babe95c67bda363e`; base `main`
- #31 Harden session revocation and payment provider timeouts — merged 2026-11-15T17:45:12Z; head `fix/session-revocation-and-payment-timeouts-2026-11-15` `46f280761b6149260eeca0e1bbab3ab5304d3118`; base `main`
- #30 Add transactional monthly invoice quota with schema migration v8 — closed without merge; head `feat/monthly-invoice-quota-v8-2026-11-15` `f3b2690913b9897c8aa9b6a55dee08e5fc1d18aa`; base `main`
- #29 Fix monthly invoice quota with schema migration v8 — merged 2026-11-15T17:57:19Z; head `fix/monthly-invoice-quota-schema-v8-2026-11-15` `69028f5946e93f259fdcd69cb7d3f9c913b99d31`; base `main`
- #28 Improve sidebar navigation accessibility — merged 2026-11-15T17:32:39Z; head `fix/sidebar-aria-current-2026-11-15` `1066c1c4d02ebeebd571fc45534c6539b374963c`; base `main`
- #27 Improve sidebar icon semantics and enforce full icon coverage — merged 2026-11-15T18:56:07Z; head `fix/pdf-worker-health-and-sidebar-icons-2026-11-15` `04304461cafad9c2576015e10dc59abf7437f329`; base `main`
- #26 Fix PDF worker startup ordering after API readiness — merged 2026-11-15T17:21:56Z; head `fix/pdf-worker-wait-for-api-health-2026-11-15` `941f235f5f4b625af5038b1dc17710fe5db02acf`; base `main`
- #25 Fix subscription page icons and visual regression checks — merged 2026-11-15T17:16:26Z; head `fix/subscription-icons-main-2026-11-15` `3316731d6119e6b43a9cdef8c935083f0b4a6979`; base `main`
- #24 Sécurité : révocation des sessions, correctif liaison Google, filtrag… — merged 2026-11-15T16:22:04Z; head `audit/securite-2026-11-15` `9939413ad492d89af41fc28ce4d05c8130f45d03`; base `main`
- #23 Galerie de 19 modèles, impression fiable, WhatsApp et audit transversal — merged 2026-11-15T16:38:23Z; head `feat/invoice-template-gallery-2026-11-15-v2` `570bf60cad5f73bb7f1fe3e65646f29e65068b9f`; base `main`
- #22 Présenter les modèles de facture dans une galerie visuelle — closed without merge; head `feat/invoice-template-gallery-2026-11-15` `70d95aac18e38b1aac466f1f184f8fa536caa638`; base `main`
- #21 Finaliser les factures et devis imprimés en A4 — merged 2026-11-15T14:29:32Z; head `fix/invoice-print-and-payment-stamp-2026-11-15` `ed6c1467affe76a6e055af95b943a44cedc09891`; base `main`
- #20 Professionnaliser la page Abonnement et ses icônes — closed without merge; head `feat/professional-subscription-page-2026-11-15` `cf58665a9083cb4e52dc24cce75cdb2291632d6e`; base `main`
- #19 Stabiliser la CI avec des tests MySQL séquentiels — merged 2026-11-15T14:12:16Z; head `fix/ci-serial-tests-2026-11-15` `4a74afa8dceaebc1dcb7dbaf6e88b175e6438fde`; base `main`
- #18 Professionnaliser l’interface et les documents, renforcer la responsivité et la montée en charge — merged 2026-11-15T13:48:58Z; head `feat/responsive-scaling-2026-11-15` `f7d10afed88a1cf03baac276836dc6f0165e09d6`; base `main`
- #17 Améliorer la visibilité et la cohérence des icônes — merged 2026-11-15T11:15:28Z; head `fix/ui-icons-legibility-2026-11-15` `0d7c5390f47444a13eae765a083e7bc2cdafb5c0`; base `main`
- #16 Fix Docker startup: single MySQL schema init and Redis readiness — merged 2026-11-15T17:11:00Z; head `fix/docker-local-startup-mysql-redis-swagger` `2f021548666e2575035ff4d45ca9936f4ceaf7b7`; base `main`
- #15 UI : harmoniser les pages métier pour un logiciel de gestion professionnel — merged 2026-11-14T11:22:02Z; head `feat/enterprise-pages-v2-2026-11-13` `e9992176d76f18f9e48f7d1d98378b1d9070cb78`; base `main`
- #14 UI : finaliser la structure professionnelle des pages métier — closed without merge; head `feat/enterprise-page-structure-v2-2026-11-13` `745a98b586ef19f7747df9dfa1c19af97ee233d2`; base `main`
- #13 UI : organiser les pages métier comme un logiciel professionnel — closed without merge; head `feat/enterprise-page-structure-2026-11-13` `e39910166ba43eaa1852844883c5ddc649b170cf`; base `main`
- #12 UI : organisation professionnelle des pages métier — merged 2026-11-13T11:11:21Z; head `feat/enterprise-page-structure-2026-11-13` `abb2f78187944a4dab48c37efe2ff35500a9fd81`; base `main`
- #11 Audit UI — navigation compacte et amélioration de la visibilité — closed without merge; head `audit/ui-runtime-pages-polish-20261113` `094c34f33a457633e334b46538ff3bba606a4597`; base `main`
- #10 UI : navigation compacte et espace de travail élargi — merged 2026-11-13T10:59:18Z; head `fix/navigation-compact-sidebar-2026-11-13` `508607c7cc69e560b539438c44cbc2330b035a6e`; base `main`
- #9 Build a temporary local Docker test ZIP — closed without merge; head `tooling/local-docker-test-bundle-20261112` `b88eeebb659dc119848094f8ddc6d9894a3be569`; base `main`
- #8 Phases 5 à 7 — Portail client, CRM, internationalisation et IA — merged 2026-11-12T22:02:46Z; head `feat/phases-5-7-portal-international-automation-20261112` `a3a43402f59d54be7f0c4cc1e5ac23d04f9f333b`; base `main`
- #7 Phases 2 à 4 — Paiements réels, comptabilité OHADA et achats/stocks — merged 2026-11-12T20:13:25Z; head `feat/phases-2-4-paiements-compta-achats-20261112` `f028da5802241ccd8df687875a2ba4787a5145b6`; base `main`
- #6 Ajouter une cloche de notifications à la barre supérieure — merged 2026-11-12T17:27:44Z; head `feat/topbar-notifications-bell-20261112` `a36472e66f180124a699c01d10b26012e4b8b079`; base `main`
- #5 Refonte du tableau de bord SamaFacture Pro — palette et navigation — merged 2026-11-12T16:10:54Z; head `feat/dashboard-reference-redesign-20261112` `6cf80f4c547b62d41bd428b44bbf87be3b50f3c4`; base `main`
- #4 UI polish: animations accessibles et recette visuelle responsive — merged 2026-11-12T16:10:56Z; head `feat/ui-motion-visual-recette-20261112` `1ae8c307b3cf394e8103f5e40237494723c4dae1`; base `main`
- #3 Audit correctif : sauvegardes, sécurité des sessions, paiements et quotas — closed without merge; head `audit/fix-backup-and-runtime-20261110` `9ea9a9aa00d4c3d4ef6e0a9a46f771a1912bedb5`; base `main`
- #2 Modèles de factures et devis — enrichissement des informations et du rendu — merged 2026-11-10T11:50:14Z; head `feat/templates-factures-devis-complets` `81aa9fa67012f19b69c2df4a0c72490b14dea285`; base `main`
- #1 SamaFacture Pro — modernisation UI et modules professionnels — merged 2026-11-10T10:46:42Z; head `ui/modern-responsive-polish` `a2faa30e320e1ad09b4537201a4627dc909f5514`; base `main`

## Migrations
Version actuelle vérifiée dans `server/config/db.js`: `CURRENT_SCHEMA_VERSION = 23`. Main contient les migrations:
- `server/database/migrations/003_professional_modules.sql`
- `server/database/migrations/004_paiements_comptabilite_achats.sql`
- `server/database/migrations/005_portail_crm_international_ia.sql`
- `server/database/migrations/006_company_groups.sql`
- `server/database/migrations/007_email_outbox.sql`
- `server/database/migrations/008_company_group_email_proof.sql`
- `server/database/migrations/009_team_invitation_email_proof.sql`
- `server/database/migrations/010_saas_subscriptions_simulation.sql`
- `server/database/migrations/011_comptabilite_contrepas_factures.sql`
- `server/database/migrations/012_comptabilite_correspondances.sql`
La migration 012 sur main est `012_comptabilite_correspondances.sql`. PR #149 propose une migration 012 concurrente et la version 23; ce conflit est un blocage, et aucune migration n'est appliquée.

## Workflows CI inventoriés sur main
- `.github/workflows/lint.yml`
- `.github/workflows/package-source-zip.yml`
- `.github/workflows/test.yml`
Les workflows pertinents sont Tests Node/MySQL, ESLint ciblé et archive source. Les filtres de branches base avaient empêché CI de #174 lorsqu'elle ciblait une base de branche; #174 a été retargetée sur main afin que les contrôles puissent tourner.

## Statuts exacts des SHA prioritaires
- Main `b43a94fc2937b0108077501a0260358c8569e11f`: Tests Node.js et MySQL completed/success; run #45080802243.
- PR #173 head `23c1cf95bf459118324dfece3580ece4470b9b34`: Tests, ESLint, ZIP completed/success (observé auparavant sur le head exact).
- PR #174 head `27fa8c2ec2e2e87b5f6b58a98b07052f5a5bce75`: Tests Node.js et MySQL: in_progress/pending (SHA 27fa8c2ec2); ESLint — fichiers JavaScript ciblés: completed/success (SHA 27fa8c2ec2); Build complete source archive: completed/success (SHA 27fa8c2ec2).
- PR #175 head `f9f95b734deb3fe9ecacfbb257686085b3fa53a6`: Build complete source archive: completed/success (SHA f9f95b734d); Tests Node.js et MySQL: completed/success (SHA f9f95b734d).
- PR #171 `953489e79a9a6779b03e9c436559b925904f5635`, #168 `b07000daa7663196de68a42bc0ba011f4f4cf7f9`, #167 `4e848f3b98b1bc93635f0dab01a7d752fd2b18cd`, #149 `6f82b82dfab5`, #159 `1c6bf875b982`, #164 `a10bc748a38b`: trois checks green sur les SHA précédemment vérifiés; branches empilées/stale et approbation humaine requise avant merge.

## Findings et actions de ce run
### P0 — mobile preflight
- Revue statique de #174 : les suffixes réservés/non-publics `.arpa` et `.localdomain` étaient absents; ajoutés à `NON_PUBLIC_HOST_SUFFIXES` et aux tests.
- Head #174 actualisé: `27fa8c2ec2e2e87b5f6b58a98b07052f5a5bce75`.
- PR #174 retargetée vers main pour déclencher CI exacte; elle contient les changements de #173 + hardening. #173 reste ouverte et chevauche #174; ne pas fusionner les deux indépendamment.
- CI #174: ESLint et ZIP success; Tests Node/MySQL en cours au snapshot. Aucun test local exécuté (clone Git impossible, DNS github.com non résolu dans l'environnement).
- Revue COMMENT publiée sur le SHA exact; pas d'approbation indépendante.

### P0 — devise et sécurité
- #168: race entre verrou de devise et créations de documents encore non résolue; exige transaction/lock cohérent et test concurrent.
- #171: devise tenant pour commandes et verrou historique; CI green sur head exact précédent, empilé sur #168.
- #167: échappement HTML et relances; CI green, tests hostiles XSS et scheduler multi-devises/idempotence restent gate.
- #159 et #164: CI green sur heads exacts mais rebase/diff et revue humaine requise.

### P1 — OHADA
- #149: schema v23 et migration 012 en conflit avec main; exiger migration 013/version 24, test upgrade v23→v24, replay/idempotence, FK tenant composée, CI et validation humaine OHADA.
- PR #142–#148 et #143–#147: réconciliation des versions comptables; vérifier idempotence, contrepassations et historique, demander validation comptable.

## Ruleset main
- ID 27410527, `protect main`, enforcement active, include `refs/heads/main`.
- Règles: deletion interdite, non-fast-forward interdit, PR obligatoire, conversations résolues, checks requis `Tests Node.js et MySQL` et `Build complete source archive`, strict checks activés.
- Approbations requises par le ruleset: **0**. Aucun acteur de bypass; current_user_can_bypass `never`.
- Endpoint branch protection classique: 403 Resource not accessible by integration; non vérifié.

## Plan P0–P3
| Priorité | Lot | Gate |
|---|---|---|
| P0 | #174 mobile preflight | Tests exacts green + review humaine; domaine réel et test appareil avant publication |
| P0 | #168/#171 race devise | Transaction/lock, test concurrent, CI exacte, review indépendante |
| P0 | #167 XSS/scheduler | Tests XSS, multi-devises, idempotence; review humaine sécurité |
| P0 | #159/#164 sécurité | Rebase, diff, CI exacte, approbation |
| P1 | #149 OHADA | Migration 013/v24, tests upgrade/replay, validation OHADA |
| P1 | branches accounting v21/v22 | Réconciliation et validation des écritures historiques |
| P2 | PDF/print, UX, accessibilité | PR ciblées, recette responsive/print |
| P3 | branding, vidéo, documentation | Après stabilisation |

## Bilan de sécurité et merges
- **0 merge, 0 push direct main, 0 force push, 0 branche supprimée.**
- **0 migration ou opération destructive exécutée.**
- Aucun paiement réel, déploiement production ou modification de données comptables.
- Aucun test local sur ce run; CI GitHub exacte #174 est partiellement en cours. Ne pas présenter les contrôles en cours comme green.

## Addendum Run 7 — 23 novembre 2026, 05:03 UTC

### Inventaire actualisé
- `main` inchangé : `b43a94fc2937b0108077501a0260358c8569e11f`.
- Branches : **183** (100 sur la première page, 83 sur la seconde; la page de continuation suivante est vide). Après le rapport Run 6, aucune branche de code nouvelle n'a été créée pendant ce snapshot.
- PR ouvertes : **47** (recherche repo-scoped actuelle).
- PR fermées : **125**, re-vérifiées par quatre plages de création (16 + 86 + 13 + 10). Numéros manquants/non créés identifiés dans l'inventaire précédent.
- Aucun merge ou changement de main pendant cette exécution.

### CI post-merge main
- SHA main reste le même. Le run post-merge précédemment vérifié `45080802243` a son job `Tests Node.js et MySQL` completed/success. Aucun nouveau merge n'a déclenché une CI post-merge; je n'invente pas un run plus récent.

### PR #174 — état exact après fin de CI
- Head : `27fa8c2ec2e2e87b5f6b58a98b07052f5a5bce75`; branche `fix/mobile-nonpublic-hostnames-20261123`; base `main`; draft; mergeable; 11 commits; 5 fichiers.
- Runs exacts : Tests #45109124536 **success**; ESLint #45109124614 **success**; ZIP #45109124542 **success**.
- Tests Node/MySQL : **589 tests, 588 pass, 0 fail, 1 skipped**; audit npm: **0 vulnérabilité**. Restauration réelle backup chiffrée : **1/1 pass**. Smoke cluster MySQL/Redis : success. Recette visuelle : 147 captures/7 largeurs, artifact publié.
- Revue enregistrée : COMMENT de `morn53426-ui`, pas une approbation; aucune approbation indépendante. La PR reste draft.
- Revue statique du diff : suffixes DNS réservés `.arpa` et `.localdomain` ajoutés et testés. Limite restante : le préflight ne résout pas le DNS; un hostname public peut pointer vers une IP privée. TLS, disponibilité et test appareil ne sont pas vérifiés. Configuration actuelle reste placeholder `https://votredomaine.com`, donc le préflight bloque volontairement la génération native.
- PR #173 est toujours ouverte et chevauche #174; ne pas fusionner les deux séparément. #174 contient le préflight initial et son hardening, retargeté main.

### PR #176 — rapport Run 6
- Head `639fd3e4ef0a49b265a426710e8285d28be7e0e5`; draft, mergeable, 2 commits, 1 fichier, aucune review.
- Tests #45109394856 **success** : 584 tests, 583 pass, 0 fail, 1 skipped; restore chiffré 1/1; smoke cluster et recette visuelle 147/7 success.
- ZIP #45109394857 **success**.
- PR #175 (Run 5) vérifiée : Tests #45103510033 success et ZIP #45103509982 success.

### Migrations/workflows confirmés
- `CURRENT_SCHEMA_VERSION = 23` dans `server/config/db.js`.
- Migrations présentes 003–012; migration 011 `comptabilite_contrepas_factures`, 012 `comptabilite_correspondances` (SHA blob 012 `bb3ec6e6b35dcb0a3975417d92aef39cd5629f4a`). Aucun SQL exécuté.
- Workflows main : tests Node/MySQL (`.github/workflows/test.yml`), ESLint ciblé (`lint.yml`), archive source (`package-source-zip.yml`). Les workflows déclenchent sur PR ciblant main; PR #174 est retargetée main.

### Décisions / gates
- #174 : CI complète green mais **pas mergeable par notre processus** (draft + revue indépendante manquante + domaine réel/DNS/TLS/appareil non vérifiés). Aucun merge.
- #168/#171 : race de changement de devise/création document non résolue; transaction/verrou et tests concurrents requis.
- #167 : tests XSS hostile, multi-devise scheduler/idempotence et review indépendante requis.
- #159/#164 : rebase, CI sur SHA rebasé et review indépendante.
- #149 : migration 013/version 24, tests v23→v24/replay et validation OHADA requises.
- Ruleset #27410527 actif selon snapshot Run 6, bypass never, 0 approbation exigée par GitHub; l'endpoint branch protection classique reste 403.

### Bilan de sécurité Run 7
- 0 merge, 0 push direct main, 0 force push, 0 branche supprimée, 0 migration, 0 écriture comptable historique, 0 paiement réel, 0 déploiement.
- Les tests locaux n'ont pas été exécutés (clone local précédemment bloqué par DNS). CI GitHub exactes #174/#176 sont, elles, vérifiées completed/success.


## Addendum Run 7 — PR sécurité #177 et inventaire final (05:08 UTC)

### Inventaire actualisé après création de #177
- Branches: **184** (183 au début du Run 7 + branche dédiée #177). Branches préservées; aucune suppression.
- PR ouvertes: **48** (47 au snapshot précédent + #177).
- PR fermées: **125**, comptage revalidé par plages de création : 16 (≤14 nov), 86 (15–19 nov), 13 (20–21 nov), 10 (22–23 nov). Total 125; 106 fusionnées et 19 non fusionnées selon l'inventaire précédent.
- Main SHA inchangé: `b43a94fc2937b0108077501a0260358c8569e11f`. Pas de merge/push direct.

### Comparaison des branches prioritaires avec main
| PR | Ahead | Behind | État/risque |
|---|---:|---:|---|
| #167 | 26 | 0 | CI green, candidate parent, review humaine requise |
| #168 | 53 | 0 | CI green; inclut #167, race devise non résolue |
| #171 | 63 | 0 | CI green; branch stack sur #168 (diff propre de 7 fichiers relative à sa base), ne pas fusionner seule |
| #149 | 4 | 42 | Diverged, non mergeable; migration v23/012 conflit |
| #159 | 12 | 15 | Diverged, non mergeable; sécurité code vérification, stale |
| #164 | 3 | 16 | Diverged; CI green mais synchronisation et review requises |
| #173 | 7 | 0 | CI green, chevauchement avec #174 |
| #174 | 11 | 0 | CI green, draft; préflight initial + hardening DNS |
| #176 | 3 | 0 (rapport) | CI Run 6 green sur head initial; addendum Run 7 ajouté sur branche |

### Nouveau lot de sécurité porté sur main — PR #177
- Branche `security/invoice-verification-code-redaction-main-20261123-run7`, créée depuis SHA main exact `b43a94fc2937b0108077501a0260358c8569e11f`.
- Head après 2 commits : `b27099a408c150547e5d4aac69f71ade4bb16ce9`; diff `ahead 2 / behind 0`, 2 fichiers, +48/-1.
- Cause: `GET /api/factures` fait `SELECT f.*`, puis renvoie les lignes, ce qui exposait `verification_code` dans la liste paginée.
- Correctif: copie de chaque row et retrait du seul `verification_code` dans la réponse list; aucun changement DB. Test vérifie la liste sans code, le détail authentifié et URL QR conservent le code, la réponse de consultation publique ne le reflète pas.
- Revue statique de second passage publiée sur le SHA exact en COMMENT (pas approval). PR #177 draft; GitHub indiquait `mergeable=false` au snapshot. CI n'a pas encore été retournée par l'API pour ce SHA; tests locaux non exécutés. **Validation humaine sécurité obligatoire avant fusion.**
- PR #159 conservée inchangée; #177 est le portage propre, pas une fermeture/remplacement automatique de #159.

### CI exacte — états au snapshot
- Main #45080802243: job Node/MySQL success, SHA main exact (dernier post-merge run confirmé; main n'a pas changé depuis).
- #174 head `27fa8c2ec2e2e87b5f6b58a98b07052f5a5bce75`: Tests #45109124536 success (589 tests, 588 pass, 0 fail, 1 skipped), npm audit 0 vulnérabilité; restauration chiffrée 1/1; cluster MySQL/Redis success; recette visuelle 147 captures/7 largeurs; ESLint #45109124614 success; ZIP #45109124542 success.
- #175 head `f9f95b734deb3fe9ecacfbb257686085b3fa53a6`: Tests #45103510033 success; ZIP #45103509982 success.
- #176 head initial `639fd3e4ef0a49b265a426710e8285d28be7e0e5`: tests #45109394856 success (584, 583 pass, 0 fail, 1 skipped), restore 1/1, cluster/visuel success; ZIP #45109394857 success. Après ajout du Run 7, head `2a6e79b09e953938d5171176842e9063b70604e0`: Tests #45115640434 in_progress, ZIP #45115640427 success. Ce head n'est pas green complet.
- #177 head `b27099a408c150547e5d4aac69f71ade4bb16ce9`: aucun run CI retourné, aucun check success à revendiquer.
- #167/#168/#171/#149/#159/#164/#173: leurs trois workflows observés completed/success sur les SHA exacts listés au tableau précédent; ces résultats ne valident pas rebases.

### Décision merge / risques restants
- **0 merge Run 7.** #177 et #174 restent drafts sans approval indépendante; #176 CI après addendum incomplète au snapshot.
- #174: domaine placeholder, DNS/TLS et device validation non faits; #173 overlap.
- #168/#171: race devise requiert verrou/transaction et tests concurrents.
- #167: tests XSS hostiles, scheduler multi-devises/idempotence et review humaine.
- #149: migration 013/schema v24, upgrade v23→24, replay/idempotence, FK tenant composée et validation OHADA.
- #159/#164: stale; rebase, CI exacte et review humaine.
- Ruleset #27410527 actif selon Run 6; 0 approbation exigée par GitHub, bypass never; protection classique 403/non vérifiée.
- Aucun test local; DNS GitHub clone précédemment bloqué. Les CI exactes green sont distinguées de celles pending/absentes.
- 0 migration, 0 suppression, 0 modification de données/volumes/backups/écritures historiques, 0 paiement réel, 0 déploiement.

---

# Addendum Run 8 — 23 novembre 2026, 06:00 UTC

## Snapshot frais
- Main: `b43a94fc2937b0108077501a0260358c8569e11f`, inchangé; dernier post-merge confirmé précédent #45080802243 green. Aucun nouveau run post-merge main récupéré ce tour.
- **185 branches** (100 + 85; curseur final `MTg1`).
- **49 PR ouvertes**, **125 PR fermées** re-comptées par segments de création (16, 86, 13, 10).
- Split 106 merged/19 closed-no-merge repris de l'audit précédent, non recalculé sur les segments Run 8.

## Toutes les branches (API, ordre alphabétique)
```
a11y/dashboard-skip-navigation-20261122
a11y/mobile-sidebar-escape-focus-20261122
audit/execution-report-20261122-run1
audit/execution-report-20261122-run2
audit/execution-report-20261123-run3
audit/execution-report-20261123-run4
audit/execution-report-20261123-run5
audit/execution-report-20261123-run6
audit/fix-backup-and-runtime-20261110
audit/fix-enterprise-migration-invitation-20261116
audit/fix-nginx-upstream-order-20261116
audit/fix-realtime-company-groups-20261116-run1
audit/fix-reset-email-docs-and-redaction-test-20261116
audit/initial-review-20261122
audit/invoice-pdf-typography-print-20261118
audit/npm-audit-gate-2026-11-16
audit/rapport-approfondi-2026-11-16-run2
audit/securite-2026-11-15
audit/security-multisocietes-review-20261116-run3
audit/ui-runtime-pages-polish-20261113
audit/visual-viewport-offset-regression-20261116
automation/audit-fixes-20261116-0150
automation/visual-viewport-notifications-20261116-0243
brand/sunupilot-identity-foundation
chore/emil-design-skills-20261117
ci/lint-history-protection-backend-20261122
ci/package-main-after-pr39-pr40
ci/real-restore-smoke-20261117
ci/workspace-ui-structure-tests-20261122
docs/backup-offsite-pinned-rclone-20261122
docs/business-plan-samafacture-pro
docs/correct-one-time-plan-billing-2026-11-16
docs/fix-staging-compose-runbook-20261116
docs/improvement-plan-20261121
docs/improvement-plan-main-20261122
docs/local-docker-bootstrap-20261117
docs/production-env-security-guidance-20261122
docs/subscription-monthly-architecture-20261117
docs/subscriptions-current-state-20261117
docs/ui-polish-plans-20261117
feat/abonnement-choix-moyen-paiement
feat/accounting-expense-payment-mode-20261121
feat/dashboard-reference-layout
feat/dashboard-reference-modules-20261119
feat/dashboard-reference-redesign-20261112
feat/enterprise-command-center-20261117
feat/enterprise-company-pagination-20261117
feat/enterprise-multi-company-foundation-20261116
feat/enterprise-page-structure-2026-11-13
feat/enterprise-page-structure-v2-2026-11-13
feat/enterprise-pages-v2-2026-11-13
feat/enterprise-workspace-ux-20261117
feat/invoice-stock-warehouse-20261119
feat/invoice-template-gallery-2026-11-15-v2
feat/invoice-template-gallery-2026-11-15
feat/invoice-templates-pro-enterprise-20261117
feat/invoice-warehouse-stock-20261119
feat/invoice-warehouse-stock-main-20261119
feat/mobile-config-preflight
feat/monthly-invoice-quota-v8-2026-11-15
feat/ohada-account-mappings-20261122
feat/phases-2-4-paiements-compta-achats-20261112
feat/phases-5-7-portal-international-automation-20261112
feat/professional-subscription-page-2026-11-15
feat/responsive-scaling-2026-11-15
feat/sidebar-icon-label-navigation-20261117
feat/sidebar-navigation-visual-refresh-20261117
feat/subscription-engine-local-simulation-20261117
feat/sunupilot-dashboard-reference
feat/templates-factures-devis-complets
feat/topbar-notifications-bell-20261112
feat/ui-motion-visual-recette-20261112
feat/workspace-settings-navigation-20261121
feat/5-nouveaux-modeles-facture
feat/15-day-trial-entitlements-20261121
feature/ohada-expense-account-mappings-20261122
feature/video-presentation-spark-sunupilot
fix/a11y-settings-labels-20261116
fix/accessibility-contrast-focus-main-20261121
fix/accessibility-template-preview-contrast-20261122
fix/accounting-event-audit-retention-v22-20261122
fix/accounting-event-audit-retention-v22-run2-20261122
fix/accounting-invoice-cancellation-reversal-20261121
fix/accounting-refund-journal-reversal-20261121
fix/atomic-backup-publish-2026-11-15
fix/atomic-encrypted-backups-2026-11-15
fix/audit-devise-relances-escape
fix/backup-directory-permissions-20261122
fix/backup-retention-guard-2026-11-16
fix/ci-serial-tests-2026-11-15
fix/client-delete-history-protection-20261122
fix/dashboard-donut-count-20261118
fix/docker-context-secrets-and-lockfile-2026-11-15
fix/docker-local-startup-mysql-redis-swagger
fix/enterprise-badge-contrast-main-20261122
fix/enterprise-invitation-email-proof-20261116
fix/expense-ledger-protection-20261122
fix/invoice-delete-history-guard-20261122
fix/invoice-footer-stamp-mobile-20261121
fix/invoice-mobile-table-cards-20261121
fix/invoice-pdf-continuation-identity-20261121
fix/invoice-print-and-payment-stamp-2026-11-15
fix/invoice-print-banner-geometry-20261121
fix/invoice-print-banner-spacing-20261122
fix/invoice-print-typography-20261118
fix/invoice-settlement-integrity-2026-11-15
fix/invoice-stock-principal-warehouse
fix/light-dark-theme-consistency-20261118
fix/mobile-invoice-line-columns
fix/mobile-nonpublic-hostnames-20261123
fix/monthly-invoice-quota-schema-v8-2026-11-15
fix/mysql-backup-limited-privileges-20261122
fix/navigation-compact-sidebar-2026-11-13
fix/pdf-headless-user-formatting-20261121
fix/pdf-pagination-extras-flow-20261117
fix/pdf-print-pagination-20261117
fix/pdf-stream-ack-payment-disclosures-20261116
fix/pdf-worker-db-readiness-2026-11-16
fix/pdf-worker-health-and-sidebar-icons-2026-11-15
fix/pdf-worker-wait-for-api-health-2026-11-15
fix/pro-orders-tenant-currency-20261123
fix/pro-workspace-status-contrast-20261122
fix/product-delete-stock-history-protection-20261122
fix/purchase-receipt-warehouse-deadlock-20261119
fix/quota-registry-initialization-robustness-2026-11-15
fix/quote-executive-a4-pagination-20261121
fix/quote-warehouse-resilience-20261120
fix/refund-payment-method-mapping-20261122
fix/refund-payment-method-mapping-rebased-20261122
fix/revoke-jwt-on-logout-2026-11-15
fix/session-revocation-and-payment-timeouts-2026-11-15
fix/sidebar-aria-current-2026-11-15
fix/subscription-disabled-state-tests-docs-20261117
fix/subscription-icons-main-2026-11-15
fix/sunupilot-pwa-lifecycle
fix/team-invitation-email-proof-20261117
fix/tenant-currency-atomic-lock-20261123
fix/ui-icons-legibility-2026-11-15
fix/ui-responsive-polish-20261117
fix/visual-qr-fixture-20261121
fix/webhook-local-timezone-dynamic-currency-20261123
fix/whatsapp-country-guard-2026-11-16
improve/pdf-page3-balance-20261121
improve/pdf-page3-balance-main-20261121
integration/main-company-invitation-email-proof-20261117
integration/reconcile-main-v21-20261122
integration/schema-v21-accounting-trial-20261122
integration/schema-v22-main-reconciled-20261122
integration/sunupilot-video-main-20261121
main
qa/test-pdf-24-modeles
rebase/pr106-main-20261121-run1
rebase/pr110-main-20261121-run1
rebrand/optigest
reconciliation/schema-v21-main-base-20261122
security/docker-ignore-local-secrets-2026-11-15
security/immediate-session-revocation-2026-11-16
security/invoice-list-verification-code-redaction-20261122
security/invoice-verification-code-redaction-main-20261123-run7
security/redact-secret-urls-in-logs-2026-11-16
test/accessibility-audit-business-pages-20261118
test/accessibility-dark-keyboard-20261118
test/accessibility-dark-keyboard-rebased-20261120
test/backup-atomic-visibility-2026-11-15
test/dark-theme-zoom-200-sweep-20261118
test/expense-accounting-mappings-regression-20261122
test/free-trial-expiry-session-guard-20261122
test/invoice-long-pdf-pagination-20261121
test/invoice-short-pdf-one-page-20261121
test/invoice-short-pdf-one-page-main-20261121
test/ohada-expense-ledger-integrity-20261121
test/pdf-font-embedding-and-visual-print-20261118
test/security-auth-reset-token-redaction-20261122
test/team-invitation-expiry-email-change-20261122
test/theme-dark-mobile-sweep-20261118
test/theme-dark-sweep-20261118
test/theme-light-desktop-sweep-20261118
test/theme-light-mobile-sweep-20261118
test/workspace-zoom-200-sweep-20261118
tooling/local-docker-test-bundle-20261112
ui/augmenter-logo-icones-sidebar
ui/modern-responsive-polish
ux/dashboard-mobile-module-rail-20261122
ux/pro-workspace-mobile-domain-rail-20261122
ux/settings-company-fields-grid-20261122
```

## PR ouvertes (49)
- #178 — fix(currency): serialize tenant currency changes and orders
- #177 — security(invoices): redact verification code from list API
- #176 — docs(audit): rapports d'exécution runs 6–7 — 23 novembre
- #159 — security(invoices): retirer le code public de la liste paginée
- #174 — fix(mobile): reject reserved non-public hostnames
- #168 — fix: fuseau local, devise du tenant et isolation des routes
- #173 — feat(mobile): block native builds until HTTPS domain is configured
- #175 — docs(audit): rapport d'exécution run 5 — 23 novembre
- #172 — docs(audit): rapport d'exécution run 4 — 23 novembre
- #171 — fix(pro): use tenant currency for orders and lock history
- #170 — docs(audit): rapport d'exécution run 3 — 23 novembre
- #167 — fix: devise des emails, relances impayés et échappement HTML
- #169 — docs(audit): rapport d'exécution run 2 — 22 novembre
- #149 — feat(accounting): configure expense category account mappings (schema v23)
- #166 — docs(audit): rapport d'exécution initial du 22 novembre
- #156 — a11y(dashboard): ajouter un accès clavier au contenu principal
- #155 — ux(settings): grille responsive pour les coordonnées entreprise
- #154 — ux(workspace): navigation mobile compacte par domaine
- #153 — test(trial): vérifier l'expiration sur la première requête protégée
- #157 — a11y(navigation): fermer le menu mobile avec Échap
- #164 — test(security): empêcher la divulgation des hashes de réinitialisation
- #127 — fix(pdf): pagination A4 du devis Executive (28 lignes)
- #140 — ci(lint): couvrir les routes backend et tests de protection
- #130 — fix(a11y): contraste WCAG AA et focus clavier sur les deux thèmes
- #147 — integration: réconcilier comptabilité OHADA et essai gratuit v21 avec main actuel
- #145 — fix(accounting): retain invoice reversal events (schema v22)
- #142 — feat(accounting, trial): integrate invoice lifecycle and 15-day trial on schema v21
- #146 — fix(integration): reconcile OHADA, 15-day trial and audit retention on current main
- #132 — docs(audit): état initial et plan priorisé 22 novembre
- #128 — feat(trial,workspace): essai 15 jours et organisation professionnelle
- #144 — fix(accounting): retain invoice reversal events on invoice deletion (schema v22)
- #143 — fix(accounting): map cheque payments to bank and reject unknown methods
- #141 — ci: add workspace UI structure regression checks
- #138 — fix(inventory): protect products with stock or history
- #137 — fix(accounting): protect clients with linked history
- #139 — fix(a11y): improve professional workspace status contrast
- #135 — fix(accounting): preserve issued invoice history
- #136 — fix(accounting): protect posted expenses from edits and deletion
- #134 — fix(a11y): badge Entreprise lisible en thème sombre
- #115 — test(accounting): cover expense posting and tenant isolation
- #133 — fix(a11y): corriger le contraste des aperçus de modèles
- #126 — feat(landing): présentation vidéo Sunupilot — portage sur main actuel
- #131 — docs: actualiser la feuille de route sur le main courant
- #118 — feat(landing): vidéo Sunupilot — capture locale automatisée des écrans
- #99 — Adopt SunuPilot branding — indigo and baobab green
- #114 — docs: centralize SamaFacture Pro improvement roadmap
- #102 — test(accessibility): couvrir le thème sombre et le parcours clavier
- #110 — test(accessibility): cover light/dark keyboard navigation and contrast
- #129 — feat(workspace): navigation par domaines et paramètres structurés

## PR fermées (125), segments et numéros
- Jusqu'au 14 nov. (16): #3, #11, #16, #14, #15, #13, #12, #10, #9, #8, #7, #6, #4, #5, #2, #1
- 15–19 nov. (86): #106, #107, #108, #105, #104, #103, #101, #100, #98, #97, #96, #95, #94, #93, #82, #83, #92, #85, #90, #91, #89, #88, #87, #86, #84, #81, #77, #78, #80, #79, #76, #75, #72, #73, #74, #71, #60, #63, #69, #64, #67, #59, #57, #65, #56, #68, #53, #62, #55, #54, #52, #51, #50, #49, #48, #46, #47, #45, #43, #44, #42, #41, #40, #39, #38, #36, #37, #27, #34, #35, #29, #33, #32, #30, #31, #28, #26, #25, #20, #23, #24, #22, #21, #19, #18, #17
- 20–21 nov. (13): #125, #117, #119, #120, #123, #121, #116, #124, #122, #113, #112, #111, #109
- 22–23 nov. (10): #165, #163, #162, #161, #158, #160, #152, #151, #150, #148

## Main, commits et migrations
- Main SHA confirmé par recherche commits récente: `b43a94fc2937b0108077501a0260358c8569e11f`.
- 10 derniers SHAs: `b43a94fc2937b0108077501a0260358c8569e11f`, `e6a2caf04f0648d30419042c97cb63b6a14a05f8`, `1c3a12bacd9c6a761247756562ea77ebe50ef41d`, `596b3311f12c41946906b236274d9c8a615393d6`, `b8df6bfac18e4eb2776a35887e178af6d8d42bfd`, `cc728a65336a5ad154136c668f3be06256e66ede`, `8d0f287f46a96cb0697d7a0be9f6fe055b6e5a51`, `f3844b627efcdf6472ef57bffe3d69283a36bb37`, `1d42ba738607a1f648e3391c051a618061654f69`, `d6a054483a11a3ebd7020fa8850d59f07dafdc22`.
- Schema v23; migrations 003–012, migration 012 `comptabilite_correspondances.sql`. Aucun SQL exécuté.

## CI exacte
- **#174** head `27fa8c2ec2e2e87b5f6b58a98b07052f5a5bce75`: tests #45109124536 success (589 tests, 588 pass, 1 skip), ESLint #45109124614 success, ZIP #45109124542 success; restore chiffrée 1/1, cluster smoke, visual 147 captures/7 widths, npm audit 0 vuln. Draft; DNS/TLS/device non testés; overlap #173.
- **#177** head `f68ab94eb1d4c2c01d08331321cda293ab0a264f`: tests #45118980192 success (586 tests, 585 pass, 1 skip), ESLint #45118980187 success, ZIP #45118980228 success. Redaction `verification_code` dans la liste facture et historique client; détail auth conserve le QR/code. Draft; validation humaine sécurité.
- **#178** base #171 `953489e79a9a6779b03e9c436559b925904f5635`; head initial `003ccada94e772ce1e6fdb971acaba9eb468b94d`: run #45120681619 failed (605 total, 603 pass, 1 fail, 1 skip). Échec unique: assertion statique catalogue-type attendait l'initialisation du stock dans `if(stockManaged)`.
- Correctif sur #178: commit `e657bb8201f8dc323c084acc3c6f0a5a898002e9`, produit + stock initial + lecture dans la transaction, améliore atomicité. ZIP #45121938066 success; tests #45121938072 et ESLint #45121938074 in_progress au snapshot. COMMENT de revue #6017218096, pas d'approbation; tests concurrence utilisent pauses 200/60/120 ms et peuvent flaker, signal déterministe recommandé.
- **#176** head `02abdb2607d7dbd24d3bc92a403ae51ae29904f3`: tests #45115823961 success et ZIP #45115823952 success. Rapport documentaire draft; addendum Run 8 ajouté à la suite.

## Workflows et protections
- `.github/workflows/test.yml`, `lint.yml`, `package-source-zip.yml`; tests Node/MySQL, Docker secret-exclusion, npm audit, backup restore, cluster, recette visuelle.
- Ruleset #27410527 actif selon vérification précédente, bypass never; protection classique 403/non vérifiée. Pas de nouvelle lecture ruleset Run 8.
- Checks #167/#168/#171/#149/#159/#164 précédemment rapportés green, non revalidés sur leurs heads pendant Run 8.

## Findings et gates
- **P0 #177**: code de vérification exposé par deux endpoints list; CI green exact mais approbation sécurité indépendante obligatoire.
- **P0 #178**: race devise; correction atomicité stock faite, CI corrected head pending; tests timing-based à renforcer.
- **P0 #174**: CI green, choisir entre #173/#174; domaine public DNS/TLS et device test requis.
- **P1 #149**: 42 commits behind, mergeable false; migration 012 conflict/schema 23; migration 013/v24, upgrade/replay, FK tenant, validation OHADA.
- **P1 #168/#171**: stack currency; tests exactes et revue de stack à revalider.
- **P1 #159/#164**: stale, rebase/diff/checks exactes nécessaires.
- **P2** PDF/impression/accessibilité/UX; **P3** branding/vidéo/docs après stabilisation.

## Merge/safety
- Run 8: 0 merge, main inchangé; 0 push direct/force push main; 0 branch deletion; 0 migration; 0 opération destructive; 0 modification données, volumes, backups ou historique comptable; 0 paiement réel; 0 déploiement.
