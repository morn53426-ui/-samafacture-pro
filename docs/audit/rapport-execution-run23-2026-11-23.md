# Rapport d'exécution Run 23 — SamaFacture Pro
Snapshot : 23 novembre 2026, 16:55 UTC (Dakar)
Dépôt : https://github.com/morn53426-ui/-samafacture-pro

## Décision
**ARRÊT DES FUSIONS.** La PR #194 a été fusionnée sur GitHub par un acteur externe à cette exécution. La CI post-merge de main sur le SHA exact n'est pas terminée. Aucun merge, push direct/force push sur main, déploiement, paiement réel, migration exécutée, donnée/volume/backup/historique comptable supprimé ou modifié par ce run.

## Main et CI
- SHA exact main : `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c`; commit merge PR #194 à 16:53:14 UTC.
- `main` est marqué protégé par l'API branches. L'endpoint branch protection/rulesets courant renvoie 403 `Resource not accessible by integration`; les règles actuelles ne sont pas vérifiables. Un rapport précédent documentait ruleset #27410527, mais cela n'est pas une vérification fraîche.
- CI post-merge #194 : [Tests automatisés #45221526816](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45221526816), SHA exact `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c`, `in_progress`, conclusion null. Au dernier relevé : préparatifs success, tests en cours; restore chiffré, smoke MySQL/Redis, recette responsive et upload captures pas encore terminés. Main n'est pas certifié stable.
- CI main post-#192 : [#45217959532](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45217959532), SHA `60fc886aee3d15993b255a8d4a1ce35a287e9939`, success.
- CI main avant #192 : [#45211700620](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45211700620), SHA `f10d89694e264bc710f1ce534a6418dd792e603a`, success.

## Fusions observées
- PR #192 (currency locking): merge SHA `60fc886aee3d15993b255a8d4a1ce35a287e9939`, 16:34:04 UTC; CI post-merge success.
- PR #194 (tenant isolation): merge SHA `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c`, 16:53:15 UTC; CI exacte du head PR green; CI post-merge en cours.
- Ces fusions sont observées et non réalisées par ce run.

## PR #194 — head pré-merge vérifié
URL : https://github.com/morn53426-ui/-samafacture-pro/pull/194
- Head testé : `970832f4bb45bb348dae99967183e917beeeb7e3`; base testée `60fc886aee3d15993b255a8d4a1ce35a287e9939`; compare 22 ahead/0 behind au snapshot des tests.
- Diff 12 fichiers : routes assistant, clients, dashboard, factures récurrentes/factures, professionnel, public, rapports, tests tenant et historique client, workflow ESLint. Pas de DDL/migration dans le diff.
- Tests Node/MySQL run #45218709676 : success exact head, incluant tests, restore backup chiffré, smoke MySQL/Redis, responsive recette et captures.
- ESLint #45218710123 : success exact head.
- ZIP #45218710373 : success exact head.
- Revue GitHub : six submissions `COMMENTED` par `morn53426-ui`; aucun `APPROVED` par un reviewer indépendant, aucun thread inline retourné. La fusion est donc un risque de gouvernance/sécurité. Aucun rollback automatique ni nouvelle fusion.
- Les tests green du head PR ne remplacent pas la CI post-merge de c32.

## Inventaire API snapshot
- Branches : **215** (100 + 100 + 15, page 4 vide); toutes préservées.
- PR ouvertes : **53**.
- PR fermées : **149** (117 merged; 32 closed sans merge).
- Main seule branche marquée protected dans l'API branches.
- L'inventaire complet des branches, PR ouvertes et PR fermées est annexé à ce rapport (snapshot, pas un nettoyage).

## PR ouvertes
| PR | Titre | Head branch / SHA | Base branch / SHA | Draft | Mise à jour |
|---|---|---|---|---|
| #206 | docs(audit): execution report run 22 — 23 novembre | `audit/execution-report-20261123-run22` `662f5ee5` | `main` `f10d8969` | draft | 2026-11-23T16:43:39Z |
| #203 | security(invoices): redact verification codes from list responses | `security/redact-verification-codes-current-main-run19-20261123` `2059e374` | `main` `f8a61187` | draft | 2026-11-23T14:16:47Z |
| #201 | docs(audit): rapport d'exécution runs 15–17 — 23 novembre | `audit/execution-report-20261123-run15` `63493905` | `main` `f8a61187` | draft | 2026-11-23T14:18:03Z |
| #199 | fix(security): scope client statement refunds to tenant payment | `security/refund-statement-tenant-join-20261123-run14` `b212dbc0` | `main` `b0b52e66` | draft | 2026-11-23T14:16:44Z |
| #198 | docs(audit): execution report run 14 — 23 November | `audit/execution-report-20261123-run14` `e6cc9a40` | `main` `b0b52e66` | draft | 2026-11-23T10:30:52Z |
| #196 | docs(audit): execution report run 13 — 23 November | `audit/execution-report-20261123-run13` `539a9430` | `main` `b0b52e66` | draft | 2026-11-23T16:36:07Z |
| #195 | docs(audit): execution report run 12 — 23 November | `audit/execution-report-20261123-run12` `b54c4b9f` | `main` `b0b52e66` | draft | 2026-11-23T08:47:17Z |
| #193 | security(invoices): redact verification codes from list responses | `security/redact-verification-codes-main-current-20261123-run12` `fb6324d3` | `main` `b0b52e66` | draft | 2026-11-23T14:02:42Z |
| #190 | fix(currency): serialize tenant currency and first business writes | `fix/tenant-currency-atomic-current-main-20261123` `0abc0440` | `main` `b276eba5` | draft | 2026-11-23T08:18:54Z |
| #188 | security(tenant): enforce ownership across invoice-related records | `security/invoice-client-tenant-current-main-after-181-20261123` `39f27a32` | `main` `b276eba5` | draft | 2026-11-23T08:41:55Z |
| #185 | fix(currency): serialize tenant currency changes and first business writes | `fix/tenant-currency-atomic-main-20261123` `50b9fcc2` | `main` `13111355` | draft | 2026-11-23T08:06:28Z |
| #183 | fix(currency): serialize tenant currency changes and orders | `fix/tenant-currency-atomic-lock-main-20261123` `4a73d68d` | `fix/pro-orders-tenant-currency-main-20261123` `1c510123` | draft | 2026-11-23T08:04:18Z |
| #182 | fix(pro): use tenant currency for orders and lock history | `fix/pro-orders-tenant-currency-main-20261123` `a078a351` | `main` `13111355` | draft | 2026-11-23T08:03:58Z |
| #180 | docs(audit): execution report run 11 — 23 November | `audit/execution-report-20261123-run11` `2f1b11e7` | `main` `b43a94fc` | draft | 2026-11-23T07:03:55Z |
| #179 | security(invoices): enforce client and payment tenant ownership | `security/invoice-client-tenant-scope-20261123` `5f554950` | `main` `b43a94fc` | draft | 2026-11-23T08:41:57Z |
| #178 | fix(currency): serialize tenant currency changes and orders | `fix/tenant-currency-atomic-lock-20261123` `70b4c688` | `fix/pro-orders-tenant-currency-20261123` `953489e7` | draft | 2026-11-23T06:34:06Z |
| #177 | security(invoices): redact verification code from list API | `security/invoice-verification-code-redaction-main-20261123-run7` `f68ab94e` | `main` `b43a94fc` | ready | 2026-11-23T16:10:20Z |
| #176 | docs(audit): rapports d'exécution runs 6 à 10 — 23 novembre | `audit/execution-report-20261123-run6` `8083f938` | `main` `b43a94fc` | draft | 2026-11-23T06:19:10Z |
| #175 | docs(audit): rapport d'exécution run 5 — 23 novembre | `audit/execution-report-20261123-run5` `f9f95b73` | `main` `b43a94fc` | draft | 2026-11-23T03:01:37Z |
| #172 | docs(audit): rapport d'exécution run 4 — 23 novembre | `audit/execution-report-20261123-run4` `14688f7a` | `main` `b43a94fc` | draft | 2026-11-23T02:08:30Z |
| #171 | fix(pro): use tenant currency for orders and lock history | `fix/pro-orders-tenant-currency-20261123` `953489e7` | `main` `13111355` | draft | 2026-11-23T07:58:41Z |
| #170 | docs(audit): rapport d'exécution run 3 — 23 novembre | `audit/execution-report-20261123-run3` `6fa59a42` | `main` `b43a94fc` | draft | 2026-11-23T01:03:16Z |
| #169 | docs(audit): rapport d'exécution run 2 — 22 novembre | `audit/execution-report-20261122-run2` `dff61fb4` | `main` `b43a94fc` | draft | 2026-11-23T00:01:19Z |
| #166 | docs(audit): rapport d'exécution initial du 22 novembre | `audit/execution-report-20261122-run1` `dc7e6f55` | `main` `b43a94fc` | draft | 2026-11-22T23:03:13Z |
| #157 | a11y(navigation): fermer le menu mobile avec Échap | `a11y/mobile-sidebar-escape-focus-20261122` `c3740303` | `main` `00d52ca8` | ready | 2026-11-22T22:37:14Z |
| #156 | a11y(dashboard): ajouter un accès clavier au contenu principal | `a11y/dashboard-skip-navigation-20261122` `8f45795c` | `main` `8d0f287f` | ready | 2026-11-22T22:40:40Z |
| #155 | ux(settings): grille responsive pour les coordonnées entreprise | `ux/settings-company-fields-grid-20261122` `99670cdf` | `main` `00d52ca8` | ready | 2026-11-22T22:39:25Z |
| #154 | ux(workspace): navigation mobile compacte par domaine | `ux/pro-workspace-mobile-domain-rail-20261122` `185e0487` | `main` `8d0f287f` | ready | 2026-11-22T22:39:02Z |
| #153 | test(trial): vérifier l'expiration sur la première requête protégée | `test/free-trial-expiry-session-guard-20261122` `29932fbb` | `main` `00d52ca8` | ready | 2026-11-22T22:38:39Z |
| #145 | fix(accounting): retain invoice reversal events (schema v22) | `fix/accounting-event-audit-retention-v22-run2-20261122` `5b6ba8bf` | `integration/schema-v21-accounting-trial-20261122` `decb8da2` | draft | 2026-11-23T09:53:27Z |
| #142 | feat(accounting, trial): integrate invoice lifecycle and 15-day trial on schema v21 | `integration/schema-v21-accounting-trial-20261122` `decb8da2` | `main` `8453ee6d` | draft | 2026-11-23T09:53:25Z |
| #141 | ci: add workspace UI structure regression checks | `ci/workspace-ui-structure-tests-20261122` `2a09ccf8` | `feat/workspace-settings-navigation-20261121` `868027e1` | draft | 2026-11-22T11:26:43Z |
| #140 | ci(lint): couvrir les routes backend et tests de protection | `ci/lint-history-protection-backend-20261122` `32d1c1f5` | `main` `00d52ca8` | draft | 2026-11-22T18:29:37Z |
| #139 | fix(a11y): improve professional workspace status contrast | `fix/pro-workspace-status-contrast-20261122` `baa9ea6a` | `main` `8453ee6d` | draft | 2026-11-22T05:25:30Z |
| #138 | fix(inventory): protect products with stock or history | `fix/product-delete-stock-history-protection-20261122` `27d5a6c2` | `main` `8453ee6d` | draft | 2026-11-22T07:26:57Z |
| #137 | fix(accounting): protect clients with linked history | `fix/client-delete-history-protection-20261122` `f2aada8d` | `main` `8453ee6d` | draft | 2026-11-22T06:32:41Z |
| #136 | fix(accounting): protect posted expenses from edits and deletion | `fix/expense-ledger-protection-20261122` `4e0f2a89` | `main` `8453ee6d` | draft | 2026-11-22T03:36:56Z |
| #135 | fix(accounting): preserve issued invoice history | `fix/invoice-delete-history-guard-20261122` `2c7f3cbd` | `main` `8453ee6d` | draft | 2026-11-22T03:44:16Z |
| #134 | fix(a11y): badge Entreprise lisible en thème sombre | `fix/enterprise-badge-contrast-main-20261122` `52021018` | `main` `8453ee6d` | draft | 2026-11-23T14:00:42Z |
| #133 | fix(a11y): corriger le contraste des aperçus de modèles | `fix/accessibility-template-preview-contrast-20261122` `6b3cd9ff` | `fix/accessibility-contrast-focus-main-20261121` `c607f397` | draft | 2026-11-22T02:48:11Z |
| #132 | docs(audit): état initial et plan priorisé 22 novembre | `audit/initial-review-20261122` `6543b3a7` | `main` `8453ee6d` | draft | 2026-11-22T14:28:41Z |
| #131 | docs: actualiser la feuille de route sur le main courant | `docs/improvement-plan-main-20261122` `3d51f0af` | `main` `8453ee6d` | draft | 2026-11-22T00:16:27Z |
| #130 | fix(a11y): contraste WCAG AA et focus clavier sur les deux thèmes | `fix/accessibility-contrast-focus-main-20261121` `0b819127` | `main` `00d52ca8` | draft | 2026-11-22T18:25:55Z |
| #129 | feat(workspace): navigation par domaines et paramètres structurés | `feat/workspace-settings-navigation-20261121` `868027e1` | `main` `8453ee6d` | draft | 2026-11-22T00:06:15Z |
| #128 | feat(trial,workspace): essai 15 jours et organisation professionnelle | `feat/15-day-trial-entitlements-20261121` `e3b91dc4` | `main` `8453ee6d` | ready | 2026-11-22T14:14:44Z |
| #127 | fix(pdf): pagination A4 du devis Executive (28 lignes) | `fix/quote-executive-a4-pagination-20261121` `400ce60d` | `main` `00d52ca8` | ready | 2026-11-22T19:27:40Z |
| #126 | feat(landing): présentation vidéo Sunupilot — portage sur main actuel | `integration/sunupilot-video-main-20261121` `817b10da` | `main` `8453ee6d` | draft | 2026-11-22T00:16:35Z |
| #118 | feat(landing): vidéo Sunupilot — capture locale automatisée des écrans | `feature/video-presentation-spark-sunupilot` `29dd7ccc` | `main` `f49d3521` | ready | 2026-11-22T00:15:38Z |
| #115 | test(accounting): cover expense posting and tenant isolation | `test/ohada-expense-ledger-integrity-20261121` `3873c1d1` | `main` `f49d3521` | ready | 2026-11-22T02:51:32Z |
| #114 | docs: centralize SamaFacture Pro improvement roadmap | `docs/improvement-plan-20261121` `ff2cae7b` | `main` `5478809e` | ready | 2026-11-22T00:08:08Z |
| #110 | test(accessibility): cover light/dark keyboard navigation and contrast | `test/accessibility-dark-keyboard-rebased-20261120` `722b5bfc` | `main` `f42f69e1` | ready | 2026-11-22T00:07:16Z |
| #102 | test(accessibility): couvrir le thème sombre et le parcours clavier | `test/accessibility-dark-keyboard-20261118` `86aeeb6f` | `main` `b5863a0d` | draft | 2026-11-22T00:07:18Z |
| #99 | Adopt SunuPilot branding — indigo and baobab green | `rebrand/optigest` `3f70466d` | `main` `b5863a0d` | ready | 2026-11-22T00:08:10Z |

## PR fermées — historique
| PR | Titre | État | Date UTC | Head branch |
|---|---|---|---|---|
| #205 | docs(audit): execution report run 21 — 23 novembre | merged | 2026-11-23 16:01 | `audit/execution-report-20261123-run21` |
| #204 | docs(audit): rapport d'exécution run 20 — 23 novembre | merged | 2026-11-23 15:35 | `audit/execution-report-20261123-run20` |
| #202 | fix(a11y): badge Entreprise lisible en thème sombre | merged | 2026-11-23 14:35 | `fix/enterprise-badge-contrast-current-main-run19-20261123` |
| #200 | a11y(navigation): close mobile sidebar with Escape on current main | merged | 2026-11-23 11:59 | `a11y/sidebar-escape-main-current-run15` |
| #197 | a11y(dashboard): keyboard skip link on current main | merged | 2026-11-23 14:03 | `a11y/dashboard-skip-link-main-current-run13` |
| #194 | security(tenant): harden invoice, client and payment isolation | merged | 2026-11-23 16:53 | `security/tenant-relations-main-current-20261123-run12` |
| #192 | fix(currency): serialize tenant currency and first business writes | merged | 2026-11-23 16:34 | `fix/tenant-currency-final-main-20261123` |
| #191 | fix(currency): serialize tenant currency and first business writes | closed no merge | 2026-11-23 08:18 | `fix/tenant-currency-atomic-latest-main-20261123` |
| #189 | fix(mobile): validate Capacitor public HTTPS before native builds | closed no merge | 2026-11-23 08:22 | `fix/mobile-preflight-current-main-20261123` |
| #187 | fix(mobile): guard Capacitor native builds on latest main | merged | 2026-11-23 08:22 | `fix/mobile-preflight-main-after-security-20261123` |
| #186 | fix(mobile): block native builds until public HTTPS config is valid | closed no merge | 2026-11-23 08:09 | `fix/mobile-preflight-main-20261123` |
| #184 | fix(mobile): validate Capacitor config before native build | closed no merge | 2026-11-23 08:13 | `fix/mobile-nonpublic-hostnames-current-main-20261123` |
| #181 | test(security): cover reset token redaction on current main | merged | 2026-11-23 08:09 | `security/reset-token-hash-redaction-main-current-20261123` |
| #174 | fix(mobile): reject reserved non-public hostnames | closed no merge | 2026-11-23 08:09 | `fix/mobile-nonpublic-hostnames-20261123` |
| #173 | feat(mobile): block native builds until HTTPS domain is configured | closed no merge | 2026-11-23 06:38 | `feat/mobile-config-preflight` |
| #168 | fix: fuseau local, devise du tenant et isolation des routes | merged | 2026-11-23 07:58 | `fix/webhook-local-timezone-dynamic-currency-20261123` |
| #167 | fix: devise des emails, relances impayés et échappement HTML | merged | 2026-11-23 07:57 | `fix/audit-devise-relances-escape` |
| #165 | docs(backup): sécuriser le transfert hors serveur rclone | merged | 2026-11-22 23:00 | `docs/backup-offsite-pinned-rclone-20261122` |
| #164 | test(security): empêcher la divulgation des hashes de réinitialisation | closed no merge | 2026-11-23 08:09 | `test/security-auth-reset-token-redaction-20261122` |
| #163 | security(backup): restreindre les permissions du dossier de sauvegarde | merged | 2026-11-22 22:43 | `fix/backup-directory-permissions-20261122` |
| #162 | test(security): couvrir expiration et changement email des invitations equipe | merged | 2026-11-22 22:33 | `test/team-invitation-expiry-email-change-20261122` |
| #161 | ux(dashboard): réduire le défilement mobile des modules | merged | 2026-11-22 22:24 | `ux/dashboard-mobile-module-rail-20261122` |
| #160 | fix(backup): compatible avec le compte MySQL limité de Docker | merged | 2026-11-22 22:06 | `fix/mysql-backup-limited-privileges-20261122` |
| #159 | security(invoices): retirer le code public de la liste paginée | closed no merge | 2026-11-23 06:39 | `security/invoice-list-verification-code-redaction-20261122` |
| #158 | docs(security): corriger les conseils CORS et proxy | merged | 2026-11-22 22:15 | `docs/production-env-security-guidance-20261122` |
| #152 | test(accounting): couvrir les correspondances OHADA des dépenses | merged | 2026-11-22 21:58 | `test/expense-accounting-mappings-regression-20261122` |
| #151 | fix(print): preserve full-width invoice banners on A4 | merged | 2026-11-22 17:02 | `fix/invoice-print-banner-spacing-20261122` |
| #150 | feat(accounting): configure OHADA sales and expense mappings | merged | 2026-11-22 16:29 | `feat/ohada-account-mappings-20261122` |
| #149 | feat(accounting): configure expense category account mappings (schema v23) | closed no merge | 2026-11-23 06:38 | `feature/ohada-expense-account-mappings-20261122` |
| #148 | reconcile: port trial and accounting protections (schema v22) onto current main | merged | 2026-11-22 15:11 | `reconciliation/schema-v21-main-base-20261122` |
| #147 | integration: réconcilier comptabilité OHADA et essai gratuit v21 avec main actuel | closed no merge | 2026-11-23 06:41 | `integration/reconcile-main-v21-20261122` |
| #146 | fix(integration): reconcile OHADA, 15-day trial and audit retention on current main | closed no merge | 2026-11-23 06:41 | `integration/schema-v22-main-reconciled-20261122` |
| #144 | fix(accounting): retain invoice reversal events on invoice deletion (schema v22) | closed no merge | 2026-11-23 06:41 | `fix/accounting-event-audit-retention-v22-20261122` |
| #143 | fix(accounting): map cheque payments to bank and reject unknown methods | closed no merge | 2026-11-23 06:41 | `fix/refund-payment-method-mapping-rebased-20261122` |
| #125 | fix(pdf): pagination A4 cohérente des factures et devis longs | merged | 2026-11-22 21:49 | `improve/pdf-page3-balance-main-20261121` |
| #124 | fix(invoice): afficher les montants des lignes sans scroll mobile | merged | 2026-11-21 18:49 | `fix/invoice-mobile-table-cards-20261121` |
| #123 | test(pdf): garantir une facture courte sur une page A4 | merged | 2026-11-21 19:20 | `test/invoice-short-pdf-one-page-20261121` |
| #122 | test(visual): fournir un QR code aux fixtures mobiles facture/devis | closed no merge | 2026-11-21 17:22 | `fix/visual-qr-fixture-20261121` |
| #121 | fix(pdf): préserver le cachet sur les écrans mobiles | merged | 2026-11-21 19:06 | `fix/invoice-footer-stamp-mobile-20261121` |
| #120 | fix(accounting): reverse refund entries in cash and bank journals | merged | 2026-11-21 19:21 | `fix/accounting-refund-journal-reversal-20261121` |
| #119 | feat(accounting): distinguish cash and bank expense payments | merged | 2026-11-21 19:21 | `feat/accounting-expense-payment-mode-20261121` |
| #117 | fix(accounting): reverse invoice entries on cancellation and reactivation | merged | 2026-11-22 14:14 | `fix/accounting-invoice-cancellation-reversal-20261121` |
| #116 | test(pdf): couvrir la pagination des factures longues | merged | 2026-11-21 18:52 | `test/invoice-long-pdf-pagination-20261121` |
| #113 | fix(pdf): preserve company date and number formats in headless PDFs | closed no merge | 2026-11-21 15:07 | `fix/pdf-headless-user-formatting-20261121` |
| #112 | fix(pdf): repeat company and document identity on continuation pages | merged | 2026-11-21 15:07 | `fix/invoice-pdf-continuation-identity-20261121` |
| #111 | fix(invoice): keep print banners inside the A4 printable area | merged | 2026-11-21 13:57 | `fix/invoice-print-banner-geometry-20261121` |
| #109 | fix(invoice): keep quotes available during warehouse API outages | merged | 2026-11-20 11:32 | `fix/quote-warehouse-resilience-20261120` |
| #108 | fix(stock): éviter les deadlocks lors de l'initialisation du magasin principal | merged | 2026-11-19 23:30 | `fix/purchase-receipt-warehouse-deadlock-20261119` |
| #107 | feat(stock): route invoice movements to the selected warehouse | merged | 2026-11-20 10:23 | `feat/invoice-stock-warehouse-20261119` |
| #106 | test(stock): validate invoice warehouse routing | merged | 2026-11-21 14:53 | `fix/invoice-stock-principal-warehouse` |
| #105 | feat(dashboard): rapprocher les raccourcis de la référence Sunupilot | merged | 2026-11-19 17:39 | `feat/dashboard-reference-modules-20261119` |
| #104 | fix(pwa): fiabiliser le cycle de vie du service worker | merged | 2026-11-19 01:45 | `fix/sunupilot-pwa-lifecycle` |
| #103 | feat(brand): intégrer les fondations visuelles SUNUPILOT | merged | 2026-11-19 01:05 | `brand/sunupilot-identity-foundation` |
| #101 | fix(accessibility): corriger les contrastes et auditer les 17 pages | merged | 2026-11-18 16:33 | `test/accessibility-audit-business-pages-20261118` |
| #100 | test(visual): couvrir le zoom 200 % en thème sombre | merged | 2026-11-18 15:44 | `test/dark-theme-zoom-200-sweep-20261118` |
| #98 | fix(responsive): corriger les tableaux au zoom 200 % | merged | 2026-11-18 15:28 | `test/workspace-zoom-200-sweep-20261118` |
| #97 | fix(dashboard): améliorer la lisibilité du total des factures | merged | 2026-11-18 14:57 | `fix/dashboard-donut-count-20261118` |
| #96 | test(theme): vérifier le mode clair sur bureau | merged | 2026-11-18 14:43 | `test/theme-light-desktop-sweep-20261118` |
| #95 | test(theme): vérifier le mode clair sur mobile | merged | 2026-11-18 14:28 | `test/theme-light-mobile-sweep-20261118` |
| #94 | test(theme): vérifier le mode sombre sur mobile | merged | 2026-11-18 14:13 | `test/theme-dark-mobile-sweep-20261118` |
| #93 | fix(theme): garantir le contraste de l’aperçu facture en mode sombre | merged | 2026-11-18 13:47 | `test/theme-dark-sweep-20261118` |
| #92 | test(pdf): vérifier les polices incorporées et les marges A4 réelles | merged | 2026-11-18 13:02 | `test/pdf-font-embedding-and-visual-print-20261118` |
| #91 | fix(invoice): améliorer les polices et l’impression A4 des factures et devis | merged | 2026-11-18 11:49 | `fix/invoice-print-typography-20261118` |
| #90 | fix(print): vérifier la typographie et l'impression A4 des 31 modèles | closed no merge | 2026-11-18 11:49 | `audit/invoice-pdf-typography-print-20261118` |
| #89 | fix(ui): corriger la cohérence des thèmes clair et sombre | merged | 2026-11-18 06:05 | `fix/light-dark-theme-consistency-20261118` |
| #88 | docs(docker): clarifier le démarrage local avec Docker | merged | 2026-11-17 23:43 | `docs/local-docker-bootstrap-20261117` |
| #87 | feat(invoice): ajouter 3 modèles Pro et 4 modèles Entreprise | merged | 2026-11-17 22:25 | `feat/invoice-templates-pro-enterprise-20261117` |
| #86 | fix(ui): améliorer les interactions sidebar et Entreprise sur mobile | merged | 2026-11-17 19:46 | `fix/ui-responsive-polish-20261117` |
| #85 | docs(ui): préparer les corrections responsive et animations | closed no merge | 2026-11-18 12:00 | `docs/ui-polish-plans-20261117` |
| #84 | feat(billing): préparer le moteur d'abonnement mensuel en simulation locale | merged | 2026-11-17 19:15 | `feat/subscription-engine-local-simulation-20261117` |
| #83 | docs(billing): cadrer l'architecture des abonnements mensuels | merged | 2026-11-18 13:11 | `docs/subscription-monthly-architecture-20261117` |
| #82 | chore(agents): intégrer les skills design engineering | merged | 2026-11-18 13:19 | `chore/emil-design-skills-20261117` |
| #81 | feat(nav): moderniser le rail latéral avec libellés | merged | 2026-11-17 16:50 | `feat/sidebar-icon-label-navigation-20261117` |
| #80 | feat(entreprise): paginer la liste des sociétés du groupe | merged | 2026-11-17 14:46 | `feat/enterprise-company-pagination-20261117` |
| #79 | feat(nav): moderniser la barre latérale et les icônes | merged | 2026-11-17 14:01 | `feat/sidebar-navigation-visual-refresh-20261117` |
| #78 | docs(billing): clarifier l’état réel des abonnements mensuels | closed no merge | 2026-11-17 14:49 | `docs/subscriptions-current-state-20261117` |
| #77 | test(billing): verrouiller les abonnements récurrents non activés | merged | 2026-11-17 15:01 | `fix/subscription-disabled-state-tests-docs-20261117` |
| #76 | fix(pdf): améliorer la pagination des devis et factures | closed no merge | 2026-11-17 12:50 | `fix/pdf-pagination-extras-flow-20261117` |
| #75 | fix(pdf): éviter les pages isolées dans les devis volumineux | merged | 2026-11-17 12:42 | `fix/pdf-print-pagination-20261117` |
| #74 | ci: exécuter le test réel de restauration des sauvegardes chiffrées | merged | 2026-11-17 12:01 | `ci/real-restore-smoke-20261117` |
| #73 | feat(ui): simplifier les espaces Entreprise et professionnel | merged | 2026-11-17 12:06 | `feat/enterprise-workspace-ux-20261117` |
| #72 | fix(team): sécuriser les invitations classiques par preuve email | merged | 2026-11-17 12:16 | `fix/team-invitation-email-proof-20261117` |
| #71 | feat(entreprise): centre de pilotage consolidé du groupe | merged | 2026-11-17 07:16 | `feat/enterprise-command-center-20261117` |
| #69 | fix(security): vérifier l’adresse email avant le rattachement multi-sociétés | merged | 2026-11-17 01:13 | `fix/enterprise-invitation-email-proof-20261116` |
| #68 | feat: laisser le client choisir son moyen de paiement | merged | 2026-11-17 00:25 | `feat/abonnement-choix-moyen-paiement` |
| #67 | docs(email): corriger le comportement SMTP local et tester la redaction | merged | 2026-11-17 00:56 | `audit/fix-reset-email-docs-and-redaction-test-20261116` |
| #65 | docs(billing): distinguer achat ponctuel et abonnement récurrent | closed no merge | 2026-11-17 00:41 | `docs/correct-one-time-plan-billing-2026-11-16` |
| #64 | docs(audit): documenter le risque de vérification des invitations multi-sociétés | merged | 2026-11-17 01:05 | `audit/security-multisocietes-review-20261116-run3` |
| #63 | fix(realtime): autoriser les groupes Entreprise dans les notifications | merged | 2026-11-17 01:24 | `audit/fix-realtime-company-groups-20261116-run1` |
| #62 | fix(entreprise): corriger la migration v10 et les invitations | closed no merge | 2026-11-16 16:33 | `audit/fix-enterprise-migration-invitation-20261116` |
| #60 | feat(entreprise): socle multi-sociétés et cadrage de l’abonnement mensuel | merged | 2026-11-17 06:08 | `feat/enterprise-multi-company-foundation-20261116` |
| #59 | docs(staging): corriger la procédure Docker Compose et HTTPS | merged | 2026-11-17 00:50 | `docs/fix-staging-compose-runbook-20261116` |
| #57 | fix(a11y): associer les libellés de la page Paramètres | merged | 2026-11-17 00:45 | `fix/a11y-settings-labels-20261116` |
| #56 | fix(pdf): file durable avec acquittement et reprise, mentions paiement exactes | merged | 2026-11-17 00:40 | `fix/pdf-stream-ack-payment-disclosures-20261116` |
| #55 | audit: corriger la conservation des tâches PDF en attente | merged | 2026-11-16 12:22 | `audit/rapport-approfondi-2026-11-16-run2` |
| #54 | fix: remove Nginx upstream balancing warning | merged | 2026-11-16 11:38 | `audit/fix-nginx-upstream-order-20261116` |
| #53 | docs: ajouter le plan d’entreprise et la stratégie de lancement | merged | 2026-11-16 17:38 | `docs/business-plan-samafacture-pro` |
| #52 | security: redact sensitive tokens from HTTP access logs | merged | 2026-11-16 11:29 | `security/redact-secret-urls-in-logs-2026-11-16` |
| #51 | CI: bloquer les dépendances présentant une vulnérabilité npm | merged | 2026-11-16 10:24 | `audit/npm-audit-gate-2026-11-16` |
| #50 | Fix: éviter la concurrence d'initialisation MySQL du worker PDF | merged | 2026-11-16 10:13 | `fix/pdf-worker-db-readiness-2026-11-16` |
| #49 | test(ui): cover notification placement with visual viewport offsets | merged | 2026-11-16 05:06 | `audit/visual-viewport-offset-regression-20261116` |
| #48 | fix(ui): keep notifications visible above the mobile keyboard | merged | 2026-11-16 02:58 | `automation/visual-viewport-notifications-20261116-0243` |
| #47 | Éviter les mauvais destinataires WhatsApp pour les numéros locaux | merged | 2026-11-16 02:00 | `fix/whatsapp-country-guard-2026-11-16` |
| #46 | fix(ui): keep mobile notifications inside viewport | merged | 2026-11-16 02:14 | `automation/audit-fixes-20261116-0150` |
| #45 | Sécuriser la sauvegarde, la rétention et la restauration de la base | merged | 2026-11-16 01:34 | `fix/backup-retention-guard-2026-11-16` |
| #44 | Sécurité : rendre la révocation des sessions immédiate entre workers | merged | 2026-11-16 01:14 | `security/immediate-session-revocation-2026-11-16` |
| #43 | Améliorer le mobile, les aperçus A4 et l’espace professionnel | merged | 2026-11-16 01:15 | `fix/mobile-invoice-line-columns` |
| #42 | Fiabiliser les PDF et corriger le thème système à l'impression | merged | 2026-11-15 22:51 | `qa/test-pdf-24-modeles` |
| #41 | Préparer l’archive du code fusionné sur main | closed no merge | 2026-11-15 22:04 | `ci/package-main-after-pr39-pr40` |
| #40 | Ajouter cinq modèles modernes de facture et de devis | merged | 2026-11-15 21:59 | `feat/5-nouveaux-modeles-facture` |
| #39 | Agrandir légèrement le logo et les icônes de navigation | merged | 2026-11-15 21:59 | `ui/augmenter-logo-icones-sidebar` |
| #38 | Make monthly invoice quota initialization deterministic | merged | 2026-11-15 19:39 | `fix/quota-registry-initialization-robustness-2026-11-15` |
| #37 | Exclude local secrets from Docker and require npm lockfile | merged | 2026-11-15 18:56 | `fix/docker-context-secrets-and-lockfile-2026-11-15` |
| #36 | Harden invoice settlement, paid status and payment idempotency | merged | 2026-11-15 18:57 | `fix/invoice-settlement-integrity-2026-11-15` |
| #35 | Test that backup archives stay temporary until dump completion | merged | 2026-11-15 18:02 | `test/backup-atomic-visibility-2026-11-15` |
| #34 | Prevent local environment secrets from entering Docker images | closed no merge | 2026-11-15 18:49 | `security/docker-ignore-local-secrets-2026-11-15` |
| #33 | Publish database backups only after atomic validation | closed no merge | 2026-11-15 17:54 | `fix/atomic-backup-publish-2026-11-15` |
| #32 | Publish complete database backups atomically | merged | 2026-11-15 17:51 | `fix/atomic-encrypted-backups-2026-11-15` |
| #31 | Harden session revocation and payment provider timeouts | merged | 2026-11-15 17:45 | `fix/session-revocation-and-payment-timeouts-2026-11-15` |
| #30 | Add transactional monthly invoice quota with schema migration v8 | closed no merge | 2026-11-15 17:48 | `feat/monthly-invoice-quota-v8-2026-11-15` |
| #29 | Fix monthly invoice quota with schema migration v8 | merged | 2026-11-15 17:57 | `fix/monthly-invoice-quota-schema-v8-2026-11-15` |
| #28 | Improve sidebar navigation accessibility | merged | 2026-11-15 17:32 | `fix/sidebar-aria-current-2026-11-15` |
| #27 | Improve sidebar icon semantics and enforce full icon coverage | merged | 2026-11-15 18:56 | `fix/pdf-worker-health-and-sidebar-icons-2026-11-15` |
| #26 | Fix PDF worker startup ordering after API readiness | merged | 2026-11-15 17:21 | `fix/pdf-worker-wait-for-api-health-2026-11-15` |
| #25 | Fix subscription page icons and visual regression checks | merged | 2026-11-15 17:16 | `fix/subscription-icons-main-2026-11-15` |
| #24 | Sécurité : révocation des sessions, correctif liaison Google, filtrag… | merged | 2026-11-15 16:22 | `audit/securite-2026-11-15` |
| #23 | Galerie de 19 modèles, impression fiable, WhatsApp et audit transversal | merged | 2026-11-15 16:38 | `feat/invoice-template-gallery-2026-11-15-v2` |
| #22 | Présenter les modèles de facture dans une galerie visuelle | closed no merge | 2026-11-15 14:33 | `feat/invoice-template-gallery-2026-11-15` |
| #21 | Finaliser les factures et devis imprimés en A4 | merged | 2026-11-15 14:29 | `fix/invoice-print-and-payment-stamp-2026-11-15` |
| #20 | Professionnaliser la page Abonnement et ses icônes | closed no merge | 2026-11-15 17:08 | `feat/professional-subscription-page-2026-11-15` |
| #19 | Stabiliser la CI avec des tests MySQL séquentiels | merged | 2026-11-15 14:12 | `fix/ci-serial-tests-2026-11-15` |
| #18 | Professionnaliser l’interface et les documents, renforcer la responsivité et la montée en charge | merged | 2026-11-15 13:48 | `feat/responsive-scaling-2026-11-15` |
| #17 | Améliorer la visibilité et la cohérence des icônes | merged | 2026-11-15 11:15 | `fix/ui-icons-legibility-2026-11-15` |
| #16 | Fix Docker startup: single MySQL schema init and Redis readiness | merged | 2026-11-15 17:11 | `fix/docker-local-startup-mysql-redis-swagger` |
| #15 | UI : harmoniser les pages métier pour un logiciel de gestion professionnel | merged | 2026-11-14 11:22 | `feat/enterprise-pages-v2-2026-11-13` |
| #14 | UI : finaliser la structure professionnelle des pages métier | closed no merge | 2026-11-15 17:10 | `feat/enterprise-page-structure-v2-2026-11-13` |
| #13 | UI : organiser les pages métier comme un logiciel professionnel | closed no merge | 2026-11-13 11:22 | `feat/enterprise-page-structure-2026-11-13` |
| #12 | UI : organisation professionnelle des pages métier | merged | 2026-11-13 11:11 | `feat/enterprise-page-structure-2026-11-13` |
| #11 | Audit UI — navigation compacte et amélioration de la visibilité | closed no merge | 2026-11-15 17:16 | `audit/ui-runtime-pages-polish-20261113` |
| #10 | UI : navigation compacte et espace de travail élargi | merged | 2026-11-13 10:59 | `fix/navigation-compact-sidebar-2026-11-13` |
| #9 | Build a temporary local Docker test ZIP | closed no merge | 2026-11-12 22:25 | `tooling/local-docker-test-bundle-20261112` |
| #8 | Phases 5 à 7 — Portail client, CRM, internationalisation et IA | merged | 2026-11-12 22:02 | `feat/phases-5-7-portal-international-automation-20261112` |
| #7 | Phases 2 à 4 — Paiements réels, comptabilité OHADA et achats/stocks | merged | 2026-11-12 20:13 | `feat/phases-2-4-paiements-compta-achats-20261112` |
| #6 | Ajouter une cloche de notifications à la barre supérieure | merged | 2026-11-12 17:27 | `feat/topbar-notifications-bell-20261112` |
| #5 | Refonte du tableau de bord SamaFacture Pro — palette et navigation | merged | 2026-11-12 16:10 | `feat/dashboard-reference-redesign-20261112` |
| #4 | UI polish: animations accessibles et recette visuelle responsive | merged | 2026-11-12 16:10 | `feat/ui-motion-visual-recette-20261112` |
| #3 | Audit correctif : sauvegardes, sécurité des sessions, paiements et quotas | closed no merge | 2026-11-15 17:59 | `audit/fix-backup-and-runtime-20261110` |
| #2 | Modèles de factures et devis — enrichissement des informations et du rendu | merged | 2026-11-10 11:50 | `feat/templates-factures-devis-complets` |
| #1 | SamaFacture Pro — modernisation UI et modules professionnels | merged | 2026-11-10 10:46 | `ui/modern-responsive-polish` |

## Branches (215; SHA court)
| Branche | SHA | Protection |
|---|---|---|
| `a11y/dashboard-skip-link-main-current-run13` | `c2ba2ffb15` | — |
| `a11y/dashboard-skip-navigation-20261122` | `8f45795c3d` | — |
| `a11y/mobile-sidebar-escape-focus-20261122` | `c37403034a` | — |
| `a11y/sidebar-escape-main-current-run15` | `69180203cc` | — |
| `audit/execution-report-20261122-run1` | `dc7e6f55c5` | — |
| `audit/execution-report-20261122-run2` | `dff61fb42a` | — |
| `audit/execution-report-20261123-run3` | `6fa59a42eb` | — |
| `audit/execution-report-20261123-run4` | `14688f7a8f` | — |
| `audit/execution-report-20261123-run5` | `f9f95b734d` | — |
| `audit/execution-report-20261123-run6` | `8083f938c8` | — |
| `audit/execution-report-20261123-run11` | `2f1b11e77d` | — |
| `audit/execution-report-20261123-run12` | `b54c4b9fa1` | — |
| `audit/execution-report-20261123-run13` | `539a9430c7` | — |
| `audit/execution-report-20261123-run14` | `e6cc9a40ab` | — |
| `audit/execution-report-20261123-run15` | `6349390549` | — |
| `audit/execution-report-20261123-run20` | `78dab3e621` | — |
| `audit/execution-report-20261123-run21` | `55ac9a0bc2` | — |
| `audit/execution-report-20261123-run22` | `662f5ee56a` | — |
| `audit/fix-backup-and-runtime-20261110` | `9ea9a9aa00` | — |
| `audit/fix-enterprise-migration-invitation-20261116` | `0b93cf9e37` | — |
| `audit/fix-nginx-upstream-order-20261116` | `5e93abdc37` | — |
| `audit/fix-realtime-company-groups-20261116-run1` | `e5c3d8020b` | — |
| `audit/fix-reset-email-docs-and-redaction-test-20261116` | `a53c96daa1` | — |
| `audit/initial-review-20261122` | `6543b3a701` | — |
| `audit/invoice-pdf-typography-print-20261118` | `7cb2d43cf3` | — |
| `audit/npm-audit-gate-2026-11-16` | `63a344d915` | — |
| `audit/rapport-approfondi-2026-11-16-run2` | `1aee933103` | — |
| `audit/securite-2026-11-15` | `9939413ad4` | — |
| `audit/security-multisocietes-review-20261116-run3` | `4acf4d365c` | — |
| `audit/ui-runtime-pages-polish-20261113` | `094c34f33a` | — |
| `audit/visual-viewport-offset-regression-20261116` | `f744b20396` | — |
| `automation/audit-fixes-20261116-0150` | `a423dca17e` | — |
| `automation/visual-viewport-notifications-20261116-0243` | `64f5b2c2ec` | — |
| `brand/sunupilot-identity-foundation` | `63f8eb27a5` | — |
| `chore/emil-design-skills-20261117` | `70f8ea190b` | — |
| `ci/lint-history-protection-backend-20261122` | `32d1c1f56c` | — |
| `ci/package-main-after-pr39-pr40` | `8c725a00cd` | — |
| `ci/real-restore-smoke-20261117` | `8864ab9478` | — |
| `ci/workspace-ui-structure-tests-20261122` | `2a09ccf8bf` | — |
| `docs/backup-offsite-pinned-rclone-20261122` | `76aa447d8b` | — |
| `docs/business-plan-samafacture-pro` | `ac07f0788e` | — |
| `docs/correct-one-time-plan-billing-2026-11-16` | `43592f99b6` | — |
| `docs/fix-staging-compose-runbook-20261116` | `22c0dae280` | — |
| `docs/improvement-plan-20261121` | `ff2cae7bd3` | — |
| `docs/improvement-plan-main-20261122` | `3d51f0afb6` | — |
| `docs/local-docker-bootstrap-20261117` | `eeea9c4a71` | — |
| `docs/production-env-security-guidance-20261122` | `be0f2789cc` | — |
| `docs/subscription-monthly-architecture-20261117` | `430e2010b1` | — |
| `docs/subscriptions-current-state-20261117` | `e618e88c7b` | — |
| `docs/ui-polish-plans-20261117` | `137a9b01d3` | — |
| `feat/abonnement-choix-moyen-paiement` | `3f32787dd5` | — |
| `feat/accounting-expense-payment-mode-20261121` | `08a1c02574` | — |
| `feat/dashboard-reference-layout` | `11d55850b6` | — |
| `feat/dashboard-reference-modules-20261119` | `f3cbbc6696` | — |
| `feat/dashboard-reference-redesign-20261112` | `6cf80f4c54` | — |
| `feat/enterprise-command-center-20261117` | `ae7e0e8e59` | — |
| `feat/enterprise-company-pagination-20261117` | `3b8d8ebc17` | — |
| `feat/enterprise-multi-company-foundation-20261116` | `c19e12959d` | — |
| `feat/enterprise-page-structure-2026-11-13` | `e39910166b` | — |
| `feat/enterprise-page-structure-v2-2026-11-13` | `745a98b586` | — |
| `feat/enterprise-pages-v2-2026-11-13` | `e9992176d7` | — |
| `feat/enterprise-workspace-ux-20261117` | `14cdd3c48c` | — |
| `feat/invoice-stock-warehouse-20261119` | `30bcfaa58e` | — |
| `feat/invoice-template-gallery-2026-11-15-v2` | `570bf60cad` | — |
| `feat/invoice-template-gallery-2026-11-15` | `70d95aac18` | — |
| `feat/invoice-templates-pro-enterprise-20261117` | `4de3da4409` | — |
| `feat/invoice-warehouse-stock-20261119` | `e9ac3c69d9` | — |
| `feat/invoice-warehouse-stock-main-20261119` | `158a9e0663` | — |
| `feat/mobile-config-preflight` | `23c1cf95bf` | — |
| `feat/monthly-invoice-quota-v8-2026-11-15` | `f3b2690913` | — |
| `feat/ohada-account-mappings-20261122` | `ca3cb8fbf5` | — |
| `feat/phases-2-4-paiements-compta-achats-20261112` | `f028da5802` | — |
| `feat/phases-5-7-portal-international-automation-20261112` | `a3a43402f5` | — |
| `feat/professional-subscription-page-2026-11-15` | `cf58665a90` | — |
| `feat/responsive-scaling-2026-11-15` | `f7d10afed8` | — |
| `feat/sidebar-icon-label-navigation-20261117` | `c8bc6af918` | — |
| `feat/sidebar-navigation-visual-refresh-20261117` | `314c06e7e9` | — |
| `feat/subscription-engine-local-simulation-20261117` | `c077af1465` | — |
| `feat/sunupilot-dashboard-reference` | `11d55850b6` | — |
| `feat/templates-factures-devis-complets` | `81aa9fa670` | — |
| `feat/topbar-notifications-bell-20261112` | `a36472e66f` | — |
| `feat/ui-motion-visual-recette-20261112` | `1ae8c307b3` | — |
| `feat/workspace-settings-navigation-20261121` | `868027e1ed` | — |
| `feat/5-nouveaux-modeles-facture` | `342a3e43c5` | — |
| `feat/15-day-trial-entitlements-20261121` | `e3b91dc4ae` | — |
| `feature/ohada-expense-account-mappings-20261122` | `6f82b82dfa` | — |
| `feature/video-presentation-spark-sunupilot` | `29dd7ccc80` | — |
| `fix/a11y-settings-labels-20261116` | `4b275916ee` | — |
| `fix/accessibility-contrast-focus-main-20261121` | `0b819127cc` | — |
| `fix/accessibility-template-preview-contrast-20261122` | `6b3cd9ffd5` | — |
| `fix/accounting-event-audit-retention-v22-20261122` | `90b718abcb` | — |
| `fix/accounting-event-audit-retention-v22-run2-20261122` | `5b6ba8bf3b` | — |
| `fix/accounting-invoice-cancellation-reversal-20261121` | `ba756d0988` | — |
| `fix/accounting-refund-journal-reversal-20261121` | `b45f479754` | — |
| `fix/atomic-backup-publish-2026-11-15` | `081d931236` | — |
| `fix/atomic-encrypted-backups-2026-11-15` | `03a36a61b7` | — |
| `fix/audit-devise-relances-escape` | `4e848f3b98` | — |
| `fix/backup-directory-permissions-20261122` | `1c3a12bacd` | — |
| `fix/backup-retention-guard-2026-11-16` | `e277ca8a84` | — |
| `fix/ci-serial-tests-2026-11-15` | `4a74afa8dc` | — |
| `fix/client-delete-history-protection-20261122` | `f2aada8d5c` | — |
| `fix/dashboard-donut-count-20261118` | `2d4d761935` | — |
| `fix/docker-context-secrets-and-lockfile-2026-11-15` | `52d4b81b3f` | — |
| `fix/docker-local-startup-mysql-redis-swagger` | `2f02154866` | — |
| `fix/enterprise-badge-contrast-current-main-run19-20261123` | `268ccf303e` | — |
| `fix/enterprise-badge-contrast-main-20261122` | `52021018d7` | — |
| `fix/enterprise-invitation-email-proof-20261116` | `4347d572f4` | — |
| `fix/expense-ledger-protection-20261122` | `4e0f2a8938` | — |
| `fix/invoice-delete-history-guard-20261122` | `2c7f3cbde9` | — |
| `fix/invoice-footer-stamp-mobile-20261121` | `7c562612e8` | — |
| `fix/invoice-mobile-table-cards-20261121` | `67f7721d51` | — |
| `fix/invoice-pdf-continuation-identity-20261121` | `885b7b42a7` | — |
| `fix/invoice-print-and-payment-stamp-2026-11-15` | `ed6c1467af` | — |
| `fix/invoice-print-banner-geometry-20261121` | `0ec7c3eeb5` | — |
| `fix/invoice-print-banner-spacing-20261122` | `4eec7b2269` | — |
| `fix/invoice-print-typography-20261118` | `d8805a202d` | — |
| `fix/invoice-settlement-integrity-2026-11-15` | `30318cf3cf` | — |
| `fix/invoice-stock-principal-warehouse` | `383c885a96` | — |
| `fix/light-dark-theme-consistency-20261118` | `bf497de04d` | — |
| `fix/mobile-invoice-line-columns` | `9019ec2dfc` | — |
| `fix/mobile-nonpublic-hostnames-20261123` | `27fa8c2ec2` | — |
| `fix/mobile-nonpublic-hostnames-current-main-20261123` | `c0bc6a6531` | — |
| `fix/mobile-preflight-current-main-20261123` | `f9bb3b9b63` | — |
| `fix/mobile-preflight-main-20261123` | `8971961468` | — |
| `fix/mobile-preflight-main-after-security-20261123` | `6fc60bdca4` | — |
| `fix/monthly-invoice-quota-schema-v8-2026-11-15` | `69028f5946` | — |
| `fix/mysql-backup-limited-privileges-20261122` | `bdca6bec1c` | — |
| `fix/navigation-compact-sidebar-2026-11-13` | `508607c7cc` | — |
| `fix/pdf-headless-user-formatting-20261121` | `862d31a763` | — |
| `fix/pdf-pagination-extras-flow-20261117` | `2e7dd32a3e` | — |
| `fix/pdf-print-pagination-20261117` | `b8e344915c` | — |
| `fix/pdf-stream-ack-payment-disclosures-20261116` | `a576e5e1fe` | — |
| `fix/pdf-worker-db-readiness-2026-11-16` | `59d341a154` | — |
| `fix/pdf-worker-health-and-sidebar-icons-2026-11-15` | `04304461ca` | — |
| `fix/pdf-worker-wait-for-api-health-2026-11-15` | `941f235f5f` | — |
| `fix/pro-orders-tenant-currency-20261123` | `953489e79a` | — |
| `fix/pro-orders-tenant-currency-main-20261123` | `a078a351d7` | — |
| `fix/pro-workspace-status-contrast-20261122` | `baa9ea6a68` | — |
| `fix/product-delete-stock-history-protection-20261122` | `27d5a6c27d` | — |
| `fix/purchase-receipt-warehouse-deadlock-20261119` | `f0f43c3d1e` | — |
| `fix/quota-registry-initialization-robustness-2026-11-15` | `c8ea3204dc` | — |
| `fix/quote-executive-a4-pagination-20261121` | `400ce60ddb` | — |
| `fix/quote-warehouse-resilience-20261120` | `8d0a4d2990` | — |
| `fix/refund-payment-method-mapping-20261122` | `3265810b25` | — |
| `fix/refund-payment-method-mapping-rebased-20261122` | `17d25a5e36` | — |
| `fix/revoke-jwt-on-logout-2026-11-15` | `a209392784` | — |
| `fix/session-revocation-and-payment-timeouts-2026-11-15` | `46f280761b` | — |
| `fix/sidebar-aria-current-2026-11-15` | `1066c1c4d0` | — |
| `fix/subscription-disabled-state-tests-docs-20261117` | `60f57e272b` | — |
| `fix/subscription-icons-main-2026-11-15` | `3316731d61` | — |
| `fix/sunupilot-pwa-lifecycle` | `86da24a1c6` | — |
| `fix/team-invitation-email-proof-20261117` | `8e1b84dffe` | — |
| `fix/tenant-currency-atomic-current-main-20261123` | `0abc0440d1` | — |
| `fix/tenant-currency-atomic-latest-main-20261123` | `198480fe89` | — |
| `fix/tenant-currency-atomic-lock-20261123` | `70b4c68858` | — |
| `fix/tenant-currency-atomic-lock-main-20261123` | `4a73d68d91` | — |
| `fix/tenant-currency-atomic-main-20261123` | `50b9fcc21b` | — |
| `fix/tenant-currency-final-main-20261123` | `0c046f9ed6` | — |
| `fix/ui-icons-legibility-2026-11-15` | `0d7c5390f4` | — |
| `fix/ui-responsive-polish-20261117` | `5efe69b698` | — |
| `fix/visual-qr-fixture-20261121` | `df6070e367` | — |
| `fix/webhook-local-timezone-dynamic-currency-20261123` | `b07000daa7` | — |
| `fix/whatsapp-country-guard-2026-11-16` | `a49756cd21` | — |
| `improve/pdf-page3-balance-20261121` | `115ab9f0e2` | — |
| `improve/pdf-page3-balance-main-20261121` | `3bab7c7700` | — |
| `integration/main-company-invitation-email-proof-20261117` | `70750be430` | — |
| `integration/reconcile-main-v21-20261122` | `e8b2dc9c6f` | — |
| `integration/schema-v21-accounting-trial-20261122` | `decb8da2e4` | — |
| `integration/schema-v22-main-reconciled-20261122` | `62ea473892` | — |
| `integration/sunupilot-video-main-20261121` | `817b10da7b` | — |
| `main` | `c32ed40a6f` | protected |
| `qa/test-pdf-24-modeles` | `d3b70a09c5` | — |
| `rebase/pr106-main-20261121-run1` | `383c885a96` | — |
| `rebase/pr110-main-20261121-run1` | `ca1d1abdc9` | — |
| `rebrand/optigest` | `3f70466d0b` | — |
| `reconciliation/schema-v21-main-base-20261122` | `d9c428aaa9` | — |
| `security/docker-ignore-local-secrets-2026-11-15` | `4d2c20e28e` | — |
| `security/immediate-session-revocation-2026-11-16` | `d6887ce043` | — |
| `security/invoice-client-tenant-current-main-after-181-20261123` | `39f27a3244` | — |
| `security/invoice-client-tenant-scope-20261123` | `5f554950cb` | — |
| `security/invoice-client-tenant-scope-current-main-20261123` | `4a13eea209` | — |
| `security/invoice-list-verification-code-redaction-20261122` | `1c6bf875b9` | — |
| `security/invoice-tenant-scope-final-main-20261123` | `41cc7eac79` | — |
| `security/invoice-verification-code-redaction-main-20261123-run7` | `f68ab94eb1` | — |
| `security/redact-secret-urls-in-logs-2026-11-16` | `d27f55b581` | — |
| `security/redact-verification-codes-current-main-run19-20261123` | `2059e3744c` | — |
| `security/redact-verification-codes-main-current-20261123-run12` | `fb6324d34b` | — |
| `security/refund-statement-tenant-join-20261123-run14` | `b212dbc0ba` | — |
| `security/reset-token-hash-redaction-main-current-20261123` | `262707e11d` | — |
| `security/tenant-relations-main-current-20261123-run12` | `970832f4bb` | — |
| `test/accessibility-audit-business-pages-20261118` | `468caba298` | — |
| `test/accessibility-dark-keyboard-20261118` | `86aeeb6f4b` | — |
| `test/accessibility-dark-keyboard-rebased-20261120` | `722b5bfce0` | — |
| `test/backup-atomic-visibility-2026-11-15` | `f4c463e5ec` | — |
| `test/dark-theme-zoom-200-sweep-20261118` | `6fe85dfd30` | — |
| `test/expense-accounting-mappings-regression-20261122` | `46d95cfd1e` | — |
| `test/free-trial-expiry-session-guard-20261122` | `29932fbbef` | — |
| `test/invoice-long-pdf-pagination-20261121` | `41fb9896ab` | — |
| `test/invoice-short-pdf-one-page-20261121` | `c592c7046f` | — |
| `test/invoice-short-pdf-one-page-main-20261121` | `f49d352125` | — |
| `test/ohada-expense-ledger-integrity-20261121` | `3873c1d1db` | — |
| `test/pdf-font-embedding-and-visual-print-20261118` | `42b5a0bcf4` | — |
| `test/security-auth-reset-token-redaction-20261122` | `a10bc748a3` | — |
| `test/team-invitation-expiry-email-change-20261122` | `4fa9a6878a` | — |
| `test/theme-dark-mobile-sweep-20261118` | `55c985deec` | — |
| `test/theme-dark-sweep-20261118` | `7bd4d2e94f` | — |
| `test/theme-light-desktop-sweep-20261118` | `dfe8ce45fd` | — |
| `test/theme-light-mobile-sweep-20261118` | `b77108576d` | — |
| `test/workspace-zoom-200-sweep-20261118` | `dd64ea0274` | — |
| `tooling/local-docker-test-bundle-20261112` | `b88eeebb65` | — |
| `ui/augmenter-logo-icones-sidebar` | `63af3d94dc` | — |
| `ui/modern-responsive-polish` | `a2faa30e32` | — |
| `ux/dashboard-mobile-module-rail-20261122` | `53eadfe851` | — |
| `ux/pro-workspace-mobile-domain-rail-20261122` | `185e0487c9` | — |
| `ux/settings-company-fields-grid-20261122` | `99670cdf29` | — |

## 10 commits main récents
| SHA | Message | Date UTC |
|---|---|---|
| `c32ed40a6f` | Merge pull request #194 from morn53426-ui/security/tenant-relations-main-current-20261123-run12 | 2026-11-23T16:53:14Z |
| `970832f4bb` | Merge branch 'main' into security/tenant-relations-main-current-20261123-run12 | 2026-11-23T16:37:53Z |
| `60fc886aee` | Merge pull request #192 from morn53426-ui/fix/tenant-currency-final-main-20261123 | 2026-11-23T16:34:03Z |
| `0c046f9ed6` | Merge branch 'main' into fix/tenant-currency-final-main-20261123 | 2026-11-23T16:14:16Z |
| `250141bd64` | Merge branch 'main' into security/tenant-relations-main-current-20261123-run12 | 2026-11-23T16:08:46Z |
| `f10d89694e` | docs(audit): execution report run 21 | 2026-11-23T16:01:06Z |
| `8df0651951` | docs(audit): merge execution report run 20 | 2026-11-23T15:35:13Z |
| `047e7badf4` | fix(a11y): badge Entreprise lisible en thème sombre | 2026-11-23T14:35:22Z |
| `f8a61187e8` | a11y(dashboard): keyboard skip link on current main | 2026-11-23T14:03:46Z |
| `9001632203` | merge current main into security isolation candidate | 2026-11-23T13:55:04Z |

## Workflows CI présents
- `.github/workflows/test.yml`: Tests Node.js et MySQL; services MySQL 8/Redis 7, tests automatisés, restore backup chiffré, diagnostics, smoke cluster, recette visuelle responsive.
- `.github/workflows/lint.yml`: ESLint ciblé par chemins.
- `.github/workflows/package-source-zip.yml`: archive source complète, test ZIP, artifact 14 jours.
- Endpoint de liste workflows non exposé par le connecteur; fichiers sont inspectés sur main.

## Migrations / schema
Fichiers liés aux migrations/schema sur tree main :
- `migration_2026_08_30_stabilite.sql`
- `migration_2026_11_15_token_version.sql`
- `migration_facture_personnalisation.sql`
- `migration_index_reset_token.sql`
- `migration_scalabilite_30_41.sql`
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
- `server/database/schema.sql`
- `server/tests/invoice-quota-migration-v8.test.js`
- `server/tests/schema-v21-upgrade-compatibility.test.js`
- `server/tests/subscription-schema.test.js`
- Migration 011 : événements de contrepassation facture.
- Migration 012 : correspondances comptables tenant-aware; commentaire indique que les écritures déjà validées ne sont pas modifiées par les réglages.
- Aucun DDL dans #192 ou #194; aucune migration exécutée dans ce run.
- Changements destructifs, écritures comptables historiques et sécurité critique exigent validation humaine.

## Risques / lots P0-P3
### P0 — Isolation tenant et gouvernance
#194 est merge, mais review indépendante absente dans les reviews retournées. Attendre CI post-merge exact c32. Vérifier l'accès tenant pour routes factures/clients/paiements, liens publics et remboursements. Le code main lu confirme redaction verification_code des listes et join tenant-aware du relevé/remboursement; cette lecture statique ne remplace pas CI ou revue indépendante.
### P0 — Codes de consultation publique
Main exact supprime `verification_code` des listes factures et historique client; détail authentifié conserve le champ. #203 et #177 sont doublons/fallback obsolètes et divergents.
### P1 — Remboursements/relevés tenant
Main exact filtre remboursements par user_id cohérent entre request, paiement et facture; PR #199 stale/doublon.
### P1 — Commandes et devise
PR #192 a verrouillé le changement de devise et les premières écritures; CI post-merge green. Le code main de `POST /api/pro/orders` accepte encore `req.body.devise` supportée distincte de la devise entreprise. Conversions non activées. Ne pas choisir refus/conversion sans décision métier/comptable.
### P1 — OHADA / historique
Migrations 011/012, contrepassations, mappings et journaux; préserver les écritures, aucune correction historique sans approbation humaine.
### P1 — Docker/backup/restore
Continuer tests non destructifs; ne pas restaurer sur volumes utilisateur; aucune modification données/backups dans ce run.
### P2 — Responsive / PDF
Candidats stale : #155, #154, #127; attendre main stable, synchronisation non destructive, CI exacte et revue.
### P3 — Documentation
PR #206 Run 22 doc-only, head `662f5ee56a104510a60b0123d2e1302011ad6020`, base `f10d89694e264bc710f1ce534a6418dd792e603a`, 4 ahead/36 behind c32, Draft. Tests #45219751725 success et ZIP #45219751786 success sur head exact. Ne pas merge avant main stable et sync. Run22 conservé.

### Comparaison candidats (base = c32)
| PR | Lot | Head | Différence | Décision |
|---|---|---|---|---|
| #203 | redact verification_code lists | `2059e374` | 6 ahead / 39 behind | Redaction already verified in main; duplicate, stale |
| #199 | refund statement tenant join | `b212dbc0` | 3 ahead / 41 behind | Tenant-aware joins already verified in main; duplicate, stale |
| #177 | verification_code redaction | `f68ab94e` | 6 ahead / 47 behind | Duplicate of #203 and already in main |
| #182 | tenant currency orders | `a078a351` | 10 ahead / 45 behind | Valid currency override still accepted; business decision needed |
| #155 | responsive company settings grid | `99670cdf` | 9 ahead / 62 behind | UI candidate stale; wait for main CI, then rebase and test |
| #154 | mobile workspace rail | `185e0487` | 8 ahead / 62 behind | UI candidate stale; wait for main CI, then rebase and test |
| #127 | A4 Executive quote pagination | `400ce60d` | 6 ahead / 68 behind | PDF candidate stale; wait for main CI, then rebase and test |

## Planning
1. P0 : attendre CI #45221526816 sur c32; si failure, stop et diagnostiquer sur branche dédiée, CI/revue exactes.
2. P0 : exiger revue sécurité indépendante pour les prochains merges; vérifier protections/ruleset depuis UI/permission autorisée. #194 déjà merge, pas de rollback auto.
3. P1 : clarifier règle devise commandes (pas de conversion) avec décision produit/comptable; reproduire avec test avant correction.
4. P1 : audit OHADA, migrations, contrepassations et remboursements; validation humaine avant toute migration ou historique.
5. P2 : synchroniser #155/#154/#127 après stabilité, tests visuels/PDF sur head exact.
6. P3 : synchroniser PR documentation #206; préserver tous les rapports antérieurs.

## Préservation et actions
- Aucun code/migration/data/volume/backup/historique comptable modifié.
- Aucun merge ou push main, aucun force push, paiement réel ou déploiement.
- Aucune branche/PR supprimée/fermée.
- Inventaire lecture seule et création de ce rapport Run 23 sur branche dédiée depuis c32; PR draft. CI du nouveau rapport à vérifier sur son head exact avant tout merge.


## Addendum — main post-#194 green et lot responsive mobile (17:01 UTC)

- Main post-merge #194, SHA exact `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c`: run #45221526816 completed **success** à 17:00:44 UTC. Toutes les étapes green : tests, restauration chiffrée, smoke MySQL/Redis, recette responsive et publication captures. Main est stable pour la prochaine étape; cette exécution n'a pas fusionné de PR.
- PR #207 (ce rapport) : head `2ffe6cee56cb10b02f08ab0ed8985b07324e237b`; ZIP #45222784006 success, Tests #45222784004 in_progress. La CI n'est pas encore concluante sur ce head.
- PR #127 (pagination Executive 28 lignes) : correction déjà présente sur main c32; CSS/classes `sf-executive-*` et test « devis Executive de 28 lignes » sont présents. Pas de portage, éviter doublon.
- PR #154 mobile workspace : portage ciblé sur branche `fix/mobile-workspace-domain-rail-main-20261123`, PR #208 Draft, head courant `21a3e371eec79eb52ef6962458a1d3ef34aebb0d`, base c32. Diff 4 fichiers (CSS rail, région HTML accessible, recette visuelle et test structurel), 59 additions/6 suppressions. Revue statique : rail <=560px, scroll-snap, role=region, tabindex=0, aria-label. Une assertion regex trop échappée a été repérée et remplacée par des assertions `includes` avant finalisation. Checks du head exact : ESLint #45223260450 et ZIP #45223260488 in_progress; run tests sur le head final encore absent au dernier relevé (run #45223179384 est sur l'ancien head `f4b126e8...`). Ne pas merger avant CI complète sur `21a3e371...` et revue.
- PR #155 paramètres : compare vers c32 ne conserve que 3 fichiers (lint workflow, `public/parametres.html`, test accessibilité). Branche stale 9 ahead/62 behind. Revue ciblée à poursuivre; ne pas synchroniser/merger avant CI et diff exact.
- PR #154/#155/#127 restent en branches d'origine préservées; #208 est un portage dédié, aucun merge effectué.


## Addendum — PR responsive/settings préparées (17:03 UTC)

### PR #208 — rail mobile professionnel
- Draft, base c32, head exact `21a3e371eec79eb52ef6962458a1d3ef34aebb0d`, 4 fichiers, 59 additions/6 suppressions.
- ESLint #45223260450 success; ZIP #45223260488 success; Tests #45223260494 in_progress (exact head), étapes install dependencies en cours, tests et recette visuelle pas encore exécutés. Aucun merge.
- Revue statique : CSS rail 84vw/300px, scroll-snap et overflow auto; région focusable/nommée; recette visuelle vérifie scrollWidth/clientWidth et clavier. Assertion regex initiale overescaped corrigée avant ce head.

### PR #209 — grille coordonnées entreprise
- Draft, base c32, head exact `9888f76fcee4a631a6bd33473c6d7fa4a8800b1f`, 3 fichiers, 39 additions/1 suppression.
- Portage ciblé de la grille responsive de #155 : 2 colonnes desktop, 1 mobile, RIB pleine largeur, conditions et mentions légales hors grille. Test structurel ajouté; ESLint workflow couvre path et commande.
- Revue statique : préserver `escapeHtml(err.message)` du main. Le head stale #155 contient `innerHTML = ... ${err.message}` sans escaping (risque XSS si message contrôlé); cette ligne n'a pas été portée. ESLint #45223608516 success; Tests #45223608140 et ZIP #45223608500 in_progress sur head exact. Aucun merge.

### P2 candidats / décision
- #127 : la pagination Executive 28 lignes et ses classes sont déjà sur main; duplicate, pas de portage.
- #155 : stale (9 ahead/62 behind); uniquement grille settings à portage ciblé, autre code du branch stale non réutilisé. La régression d'escaping est à corriger/éviter.
- #154 : stale (8 ahead/62 behind); portage #208 séparé.
- #208 et #209 sont indépendantes et Draft; les fusionner une par une après CI exacte, revue et vérification des protections. Main c32 reste green.
