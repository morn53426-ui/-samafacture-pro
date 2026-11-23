# Audit & développement SamaFacture Pro — Run 11
**Snapshot GitHub : 23 novembre 2026, ~07:01 UTC**  
Repository: https://github.com/morn53426-ui/-samafacture-pro

## Résumé de l'exécution
- `main` observé : **`b43a94fc2937b0108077501a0260358c8569e11f`**, inchangé depuis Run 10.
- **186 branches** recensées via pagination (100 + 86, page finale vide vérifiée).
- **43 PR ouvertes** au snapshot. Les PR fermées sont plafonnées à 100 résultats dans l'API du connecteur; dernier décompte historique documenté Run 10 : 125 fermées (106 merged / 19 closed sans merge), non recalculable ici sans total API.
- CI post-fusion main run **45080802243** : success sur SHA exact `b43a94fc2937b0108077501a0260358c8569e11f`. Job complet avec tests, npm audit, restauration réelle sauvegarde chiffrée, smoke MySQL/Redis et recette responsive.
- Aucun merge, aucun push sur main, aucun force push, aucune branche supprimée, aucune migration exécutée, aucune donnée/volume/backup/historique comptable modifié, aucun paiement réel ni déploiement.

## Main et 20 commits récents
- [`b43a94fc2937b0108077501a0260358c8569e11f`](https://github.com/morn53426-ui/-samafacture-pro/commit/b43a94fc2937b0108077501a0260358c8569e11f) — docs(backup): sécuriser le transfert hors serveur rclone (2026-11-22T23:00:10Z)
- [`e6a2caf04f0648d30419042c97cb63b6a14a05f8`](https://github.com/morn53426-ui/-samafacture-pro/commit/e6a2caf04f0648d30419042c97cb63b6a14a05f8) — Merge pull request #163 from morn53426-ui/fix/backup-directory-permissions-20261122 (2026-11-22T22:43:06Z)
- [`1c3a12bacd9c6a761247756562ea77ebe50ef41d`](https://github.com/morn53426-ui/-samafacture-pro/commit/1c3a12bacd9c6a761247756562ea77ebe50ef41d) — Merge latest main invitation-security test into backup directory hardening (2026-11-22T22:36:47Z)
- [`596b3311f12c41946906b236274d9c8a615393d6`](https://github.com/morn53426-ui/-samafacture-pro/commit/596b3311f12c41946906b236274d9c8a615393d6) — test(security): couvrir expiration et changement email des invitations equipe (#162) (2026-11-22T22:33:54Z)
- [`b8df6bfac18e4eb2776a35887e178af6d8d42bfd`](https://github.com/morn53426-ui/-samafacture-pro/commit/b8df6bfac18e4eb2776a35887e178af6d8d42bfd) — Merge dashboard update and keep backup permission lint target (2026-11-22T22:27:19Z)
- [`cc728a65336a5ad154136c668f3be06256e66ede`](https://github.com/morn53426-ui/-samafacture-pro/commit/cc728a65336a5ad154136c668f3be06256e66ede) — Merge dashboard module rail and main into backup directory permissions fix (2026-11-22T22:26:11Z)
- [`8d0f287f46a96cb0697d7a0be9f6fe055b6e5a51`](https://github.com/morn53426-ui/-samafacture-pro/commit/8d0f287f46a96cb0697d7a0be9f6fe055b6e5a51) — ux(dashboard): réduire le défilement mobile des modules (#161) (2026-11-22T22:24:22Z)
- [`f3844b627efcdf6472ef57bffe3d69283a36bb37`](https://github.com/morn53426-ui/-samafacture-pro/commit/f3844b627efcdf6472ef57bffe3d69283a36bb37) — fix(sync): conserver server/.env.example de main (2026-11-22T22:17:53Z)
- [`1d42ba738607a1f648e3391c051a618061654f69`](https://github.com/morn53426-ui/-samafacture-pro/commit/1d42ba738607a1f648e3391c051a618061654f69) — fix(sync): conserver le modèle .env courant de main (2026-11-22T22:17:22Z)
- [`d6a054483a11a3ebd7020fa8850d59f07dafdc22`](https://github.com/morn53426-ui/-samafacture-pro/commit/d6a054483a11a3ebd7020fa8850d59f07dafdc22) — Merge latest main into backup directory permissions hardening (2026-11-22T22:16:41Z)
- [`06c3589daf5f49405e9a7ead70ee5cc9aece2a12`](https://github.com/morn53426-ui/-samafacture-pro/commit/06c3589daf5f49405e9a7ead70ee5cc9aece2a12) — Merge latest main while preserving private backup directory permissions (2026-11-22T22:16:08Z)
- [`5f1c09d655b340eac687d983e322e740798b7817`](https://github.com/morn53426-ui/-samafacture-pro/commit/5f1c09d655b340eac687d983e322e740798b7817) — docs(security): corriger les conseils CORS et proxy (#158) (2026-11-22T22:15:02Z)
- [`db790c1d25cdedabf19d33cffd5bf489bc77d1ef`](https://github.com/morn53426-ui/-samafacture-pro/commit/db790c1d25cdedabf19d33cffd5bf489bc77d1ef) — refactor(backup): supprimer le mkdir redondant (2026-11-22T22:08:02Z)
- [`620b919b8f317d2fd5116728ff5aa292aa3357b0`](https://github.com/morn53426-ui/-samafacture-pro/commit/620b919b8f317d2fd5116728ff5aa292aa3357b0) — Merge main and MySQL backup permissions into backup-directory-permissions (2026-11-22T22:07:00Z)
- [`d736f90ee00369029146402ac5bb6fbfd9de3def`](https://github.com/morn53426-ui/-samafacture-pro/commit/d736f90ee00369029146402ac5bb6fbfd9de3def) — fix(backup): compatible avec le compte MySQL limité de Docker (#160) (2026-11-22T22:06:18Z)
- [`affc83042f524a7db1c3628f72dd81b751c7c4c8`](https://github.com/morn53426-ui/-samafacture-pro/commit/affc83042f524a7db1c3628f72dd81b751c7c4c8) — Merge main into fix/backup-directory-permissions-20261122 (2026-11-22T21:59:05Z)
- [`7e19eae060f1f223406d21118bdb19c439e14cc5`](https://github.com/morn53426-ui/-samafacture-pro/commit/7e19eae060f1f223406d21118bdb19c439e14cc5) — test(accounting): couvrir les correspondances OHADA des dépenses (#152) (2026-11-22T21:58:19Z)
- [`9820c4dc48814f9a389c3ffbee5a345e55f27fe5`](https://github.com/morn53426-ui/-samafacture-pro/commit/9820c4dc48814f9a389c3ffbee5a345e55f27fe5) — fix(pdf): pagination A4 cohérente factures et devis (2026-11-22T21:49:43Z)
- [`5ec5947b7013e319b8af5f41ab8131357142fef7`](https://github.com/morn53426-ui/-samafacture-pro/commit/5ec5947b7013e319b8af5f41ab8131357142fef7) — test(backup): isoler l’archive du test de permissions (2026-11-22T21:49:17Z)
- [`1a457ca0a77b6b87d0b5995a83586e2d91c12c5d`](https://github.com/morn53426-ui/-samafacture-pro/commit/1a457ca0a77b6b87d0b5995a83586e2d91c12c5d) — ci(lint): vérifier le module et les tests de sauvegarde (2026-11-22T21:43:41Z)

## Inventaire complet des branches (186)
- `a11y/dashboard-skip-navigation-20261122`
- `a11y/mobile-sidebar-escape-focus-20261122`
- `audit/execution-report-20261122-run1`
- `audit/execution-report-20261122-run2`
- `audit/execution-report-20261123-run3`
- `audit/execution-report-20261123-run4`
- `audit/execution-report-20261123-run5`
- `audit/execution-report-20261123-run6`
- `audit/fix-backup-and-runtime-20261110`
- `audit/fix-enterprise-migration-invitation-20261116`
- `audit/fix-nginx-upstream-order-20261116`
- `audit/fix-realtime-company-groups-20261116-run1`
- `audit/fix-reset-email-docs-and-redaction-test-20261116`
- `audit/initial-review-20261122`
- `audit/invoice-pdf-typography-print-20261118`
- `audit/npm-audit-gate-2026-11-16`
- `audit/rapport-approfondi-2026-11-16-run2`
- `audit/securite-2026-11-15`
- `audit/security-multisocietes-review-20261116-run3`
- `audit/ui-runtime-pages-polish-20261113`
- `audit/visual-viewport-offset-regression-20261116`
- `automation/audit-fixes-20261116-0150`
- `automation/visual-viewport-notifications-20261116-0243`
- `brand/sunupilot-identity-foundation`
- `chore/emil-design-skills-20261117`
- `ci/lint-history-protection-backend-20261122`
- `ci/package-main-after-pr39-pr40`
- `ci/real-restore-smoke-20261117`
- `ci/workspace-ui-structure-tests-20261122`
- `docs/backup-offsite-pinned-rclone-20261122`
- `docs/business-plan-samafacture-pro`
- `docs/correct-one-time-plan-billing-2026-11-16`
- `docs/fix-staging-compose-runbook-20261116`
- `docs/improvement-plan-20261121`
- `docs/improvement-plan-main-20261122`
- `docs/local-docker-bootstrap-20261117`
- `docs/production-env-security-guidance-20261122`
- `docs/subscription-monthly-architecture-20261117`
- `docs/subscriptions-current-state-20261117`
- `docs/ui-polish-plans-20261117`
- `feat/abonnement-choix-moyen-paiement`
- `feat/accounting-expense-payment-mode-20261121`
- `feat/dashboard-reference-layout`
- `feat/dashboard-reference-modules-20261119`
- `feat/dashboard-reference-redesign-20261112`
- `feat/enterprise-command-center-20261117`
- `feat/enterprise-company-pagination-20261117`
- `feat/enterprise-multi-company-foundation-20261116`
- `feat/enterprise-page-structure-2026-11-13`
- `feat/enterprise-page-structure-v2-2026-11-13`
- `feat/enterprise-pages-v2-2026-11-13`
- `feat/enterprise-workspace-ux-20261117`
- `feat/invoice-stock-warehouse-20261119`
- `feat/invoice-template-gallery-2026-11-15-v2`
- `feat/invoice-template-gallery-2026-11-15`
- `feat/invoice-templates-pro-enterprise-20261117`
- `feat/invoice-warehouse-stock-20261119`
- `feat/invoice-warehouse-stock-main-20261119`
- `feat/mobile-config-preflight`
- `feat/monthly-invoice-quota-v8-2026-11-15`
- `feat/ohada-account-mappings-20261122`
- `feat/phases-2-4-paiements-compta-achats-20261112`
- `feat/phases-5-7-portal-international-automation-20261112`
- `feat/professional-subscription-page-2026-11-15`
- `feat/responsive-scaling-2026-11-15`
- `feat/sidebar-icon-label-navigation-20261117`
- `feat/sidebar-navigation-visual-refresh-20261117`
- `feat/subscription-engine-local-simulation-20261117`
- `feat/sunupilot-dashboard-reference`
- `feat/templates-factures-devis-complets`
- `feat/topbar-notifications-bell-20261112`
- `feat/ui-motion-visual-recette-20261112`
- `feat/workspace-settings-navigation-20261121`
- `feat/5-nouveaux-modeles-facture`
- `feat/15-day-trial-entitlements-20261121`
- `feature/ohada-expense-account-mappings-20261122`
- `feature/video-presentation-spark-sunupilot`
- `fix/a11y-settings-labels-20261116`
- `fix/accessibility-contrast-focus-main-20261121`
- `fix/accessibility-template-preview-contrast-20261122`
- `fix/accounting-event-audit-retention-v22-20261122`
- `fix/accounting-event-audit-retention-v22-run2-20261122`
- `fix/accounting-invoice-cancellation-reversal-20261121`
- `fix/accounting-refund-journal-reversal-20261121`
- `fix/atomic-backup-publish-2026-11-15`
- `fix/atomic-encrypted-backups-2026-11-15`
- `fix/audit-devise-relances-escape`
- `fix/backup-directory-permissions-20261122`
- `fix/backup-retention-guard-2026-11-16`
- `fix/ci-serial-tests-2026-11-15`
- `fix/client-delete-history-protection-20261122`
- `fix/dashboard-donut-count-20261118`
- `fix/docker-context-secrets-and-lockfile-2026-11-15`
- `fix/docker-local-startup-mysql-redis-swagger`
- `fix/enterprise-badge-contrast-main-20261122`
- `fix/enterprise-invitation-email-proof-20261116`
- `fix/expense-ledger-protection-20261122`
- `fix/invoice-delete-history-guard-20261122`
- `fix/invoice-footer-stamp-mobile-20261121`
- `fix/invoice-mobile-table-cards-20261121`
- `fix/invoice-pdf-continuation-identity-20261121`
- `fix/invoice-print-and-payment-stamp-2026-11-15`
- `fix/invoice-print-banner-geometry-20261121`
- `fix/invoice-print-banner-spacing-20261122`
- `fix/invoice-print-typography-20261118`
- `fix/invoice-settlement-integrity-2026-11-15`
- `fix/invoice-stock-principal-warehouse`
- `fix/light-dark-theme-consistency-20261118`
- `fix/mobile-invoice-line-columns`
- `fix/mobile-nonpublic-hostnames-20261123`
- `fix/monthly-invoice-quota-schema-v8-2026-11-15`
- `fix/mysql-backup-limited-privileges-20261122`
- `fix/navigation-compact-sidebar-2026-11-13`
- `fix/pdf-headless-user-formatting-20261121`
- `fix/pdf-pagination-extras-flow-20261117`
- `fix/pdf-print-pagination-20261117`
- `fix/pdf-stream-ack-payment-disclosures-20261116`
- `fix/pdf-worker-db-readiness-2026-11-16`
- `fix/pdf-worker-health-and-sidebar-icons-2026-11-15`
- `fix/pdf-worker-wait-for-api-health-2026-11-15`
- `fix/pro-orders-tenant-currency-20261123`
- `fix/pro-workspace-status-contrast-20261122`
- `fix/product-delete-stock-history-protection-20261122`
- `fix/purchase-receipt-warehouse-deadlock-20261119`
- `fix/quota-registry-initialization-robustness-2026-11-15`
- `fix/quote-executive-a4-pagination-20261121`
- `fix/quote-warehouse-resilience-20261120`
- `fix/refund-payment-method-mapping-20261122`
- `fix/refund-payment-method-mapping-rebased-20261122`
- `fix/revoke-jwt-on-logout-2026-11-15`
- `fix/session-revocation-and-payment-timeouts-2026-11-15`
- `fix/sidebar-aria-current-2026-11-15`
- `fix/subscription-disabled-state-tests-docs-20261117`
- `fix/subscription-icons-main-2026-11-15`
- `fix/sunupilot-pwa-lifecycle`
- `fix/team-invitation-email-proof-20261117`
- `fix/tenant-currency-atomic-lock-20261123`
- `fix/ui-icons-legibility-2026-11-15`
- `fix/ui-responsive-polish-20261117`
- `fix/visual-qr-fixture-20261121`
- `fix/webhook-local-timezone-dynamic-currency-20261123`
- `fix/whatsapp-country-guard-2026-11-16`
- `improve/pdf-page3-balance-20261121`
- `improve/pdf-page3-balance-main-20261121`
- `integration/main-company-invitation-email-proof-20261117`
- `integration/reconcile-main-v21-20261122`
- `integration/schema-v21-accounting-trial-20261122`
- `integration/schema-v22-main-reconciled-20261122`
- `integration/sunupilot-video-main-20261121`
- `main`
- `qa/test-pdf-24-modeles`
- `rebase/pr106-main-20261121-run1`
- `rebase/pr110-main-20261121-run1`
- `rebrand/optigest`
- `reconciliation/schema-v21-main-base-20261122`
- `security/docker-ignore-local-secrets-2026-11-15`
- `security/immediate-session-revocation-2026-11-16`
- `security/invoice-client-tenant-scope-20261123`
- `security/invoice-list-verification-code-redaction-20261122`
- `security/invoice-verification-code-redaction-main-20261123-run7`
- `security/redact-secret-urls-in-logs-2026-11-16`
- `test/accessibility-audit-business-pages-20261118`
- `test/accessibility-dark-keyboard-20261118`
- `test/accessibility-dark-keyboard-rebased-20261120`
- `test/backup-atomic-visibility-2026-11-15`
- `test/dark-theme-zoom-200-sweep-20261118`
- `test/expense-accounting-mappings-regression-20261122`
- `test/free-trial-expiry-session-guard-20261122`
- `test/invoice-long-pdf-pagination-20261121`
- `test/invoice-short-pdf-one-page-20261121`
- `test/invoice-short-pdf-one-page-main-20261121`
- `test/ohada-expense-ledger-integrity-20261121`
- `test/pdf-font-embedding-and-visual-print-20261118`
- `test/security-auth-reset-token-redaction-20261122`
- `test/team-invitation-expiry-email-change-20261122`
- `test/theme-dark-mobile-sweep-20261118`
- `test/theme-dark-sweep-20261118`
- `test/theme-light-desktop-sweep-20261118`
- `test/theme-light-mobile-sweep-20261118`
- `test/workspace-zoom-200-sweep-20261118`
- `tooling/local-docker-test-bundle-20261112`
- `ui/augmenter-logo-icones-sidebar`
- `ui/modern-responsive-polish`
- `ux/dashboard-mobile-module-rail-20261122`
- `ux/pro-workspace-mobile-domain-rail-20261122`
- `ux/settings-company-fields-grid-20261122`

## Pull Requests ouvertes (43)
- [#179 — security(invoices): enforce client and payment tenant ownership](https://github.com/morn53426-ui/-samafacture-pro/pull/179)
- [#174 — fix(mobile): reject reserved non-public hostnames](https://github.com/morn53426-ui/-samafacture-pro/pull/174)
- [#178 — fix(currency): serialize tenant currency changes and orders](https://github.com/morn53426-ui/-samafacture-pro/pull/178)
- [#176 — docs(audit): rapports d'exécution runs 6 à 10 — 23 novembre](https://github.com/morn53426-ui/-samafacture-pro/pull/176)
- [#177 — security(invoices): redact verification code from list API](https://github.com/morn53426-ui/-samafacture-pro/pull/177)
- [#168 — fix: fuseau local, devise du tenant et isolation des routes](https://github.com/morn53426-ui/-samafacture-pro/pull/168)
- [#175 — docs(audit): rapport d'exécution run 5 — 23 novembre](https://github.com/morn53426-ui/-samafacture-pro/pull/175)
- [#172 — docs(audit): rapport d'exécution run 4 — 23 novembre](https://github.com/morn53426-ui/-samafacture-pro/pull/172)
- [#171 — fix(pro): use tenant currency for orders and lock history](https://github.com/morn53426-ui/-samafacture-pro/pull/171)
- [#170 — docs(audit): rapport d'exécution run 3 — 23 novembre](https://github.com/morn53426-ui/-samafacture-pro/pull/170)
- [#167 — fix: devise des emails, relances impayés et échappement HTML](https://github.com/morn53426-ui/-samafacture-pro/pull/167)
- [#169 — docs(audit): rapport d'exécution run 2 — 22 novembre](https://github.com/morn53426-ui/-samafacture-pro/pull/169)
- [#166 — docs(audit): rapport d'exécution initial du 22 novembre](https://github.com/morn53426-ui/-samafacture-pro/pull/166)
- [#156 — a11y(dashboard): ajouter un accès clavier au contenu principal](https://github.com/morn53426-ui/-samafacture-pro/pull/156)
- [#155 — ux(settings): grille responsive pour les coordonnées entreprise](https://github.com/morn53426-ui/-samafacture-pro/pull/155)
- [#154 — ux(workspace): navigation mobile compacte par domaine](https://github.com/morn53426-ui/-samafacture-pro/pull/154)
- [#153 — test(trial): vérifier l'expiration sur la première requête protégée](https://github.com/morn53426-ui/-samafacture-pro/pull/153)
- [#157 — a11y(navigation): fermer le menu mobile avec Échap](https://github.com/morn53426-ui/-samafacture-pro/pull/157)
- [#164 — test(security): empêcher la divulgation des hashes de réinitialisation](https://github.com/morn53426-ui/-samafacture-pro/pull/164)
- [#127 — fix(pdf): pagination A4 du devis Executive (28 lignes)](https://github.com/morn53426-ui/-samafacture-pro/pull/127)
- [#140 — ci(lint): couvrir les routes backend et tests de protection](https://github.com/morn53426-ui/-samafacture-pro/pull/140)
- [#130 — fix(a11y): contraste WCAG AA et focus clavier sur les deux thèmes](https://github.com/morn53426-ui/-samafacture-pro/pull/130)
- [#145 — fix(accounting): retain invoice reversal events (schema v22)](https://github.com/morn53426-ui/-samafacture-pro/pull/145)
- [#142 — feat(accounting, trial): integrate invoice lifecycle and 15-day trial on schema v21](https://github.com/morn53426-ui/-samafacture-pro/pull/142)
- [#132 — docs(audit): état initial et plan priorisé 22 novembre](https://github.com/morn53426-ui/-samafacture-pro/pull/132)
- [#128 — feat(trial,workspace): essai 15 jours et organisation professionnelle](https://github.com/morn53426-ui/-samafacture-pro/pull/128)
- [#141 — ci: add workspace UI structure regression checks](https://github.com/morn53426-ui/-samafacture-pro/pull/141)
- [#138 — fix(inventory): protect products with stock or history](https://github.com/morn53426-ui/-samafacture-pro/pull/138)
- [#137 — fix(accounting): protect clients with linked history](https://github.com/morn53426-ui/-samafacture-pro/pull/137)
- [#139 — fix(a11y): improve professional workspace status contrast](https://github.com/morn53426-ui/-samafacture-pro/pull/139)
- [#135 — fix(accounting): preserve issued invoice history](https://github.com/morn53426-ui/-samafacture-pro/pull/135)
- [#136 — fix(accounting): protect posted expenses from edits and deletion](https://github.com/morn53426-ui/-samafacture-pro/pull/136)
- [#134 — fix(a11y): badge Entreprise lisible en thème sombre](https://github.com/morn53426-ui/-samafacture-pro/pull/134)
- [#115 — test(accounting): cover expense posting and tenant isolation](https://github.com/morn53426-ui/-samafacture-pro/pull/115)
- [#133 — fix(a11y): corriger le contraste des aperçus de modèles](https://github.com/morn53426-ui/-samafacture-pro/pull/133)
- [#126 — feat(landing): présentation vidéo Sunupilot — portage sur main actuel](https://github.com/morn53426-ui/-samafacture-pro/pull/126)
- [#131 — docs: actualiser la feuille de route sur le main courant](https://github.com/morn53426-ui/-samafacture-pro/pull/131)
- [#118 — feat(landing): vidéo Sunupilot — capture locale automatisée des écrans](https://github.com/morn53426-ui/-samafacture-pro/pull/118)
- [#99 — Adopt SunuPilot branding — indigo and baobab green](https://github.com/morn53426-ui/-samafacture-pro/pull/99)
- [#114 — docs: centralize SamaFacture Pro improvement roadmap](https://github.com/morn53426-ui/-samafacture-pro/pull/114)
- [#102 — test(accessibility): couvrir le thème sombre et le parcours clavier](https://github.com/morn53426-ui/-samafacture-pro/pull/102)
- [#110 — test(accessibility): cover light/dark keyboard navigation and contrast](https://github.com/morn53426-ui/-samafacture-pro/pull/110)
- [#129 — feat(workspace): navigation par domaines et paramètres structurés](https://github.com/morn53426-ui/-samafacture-pro/pull/129)

## PR prioritaires — état exact
| PR | État / base | Head SHA | CI exacte | Décision |
|---|---|---|---|---|
| #179 tenant ownership | Draft, base main | `24e8c0d745789fc08634f3d241c691c4b808f465` | Test #1750 **in progress**; ESLint #702 success; ZIP #1440 success. Run #1748 sur l'ancien head a échoué: 584 tests, 582 pass, 1 fail, 1 skip. | Bloqué : assertion test erronée (700 attendu, 0 demandé) et test API-key incompatible avec fixture read-only; revue COMMENT #6017623591, pas d'approbation. |
| #177 verification-code redaction | Draft, base main | `f68ab94eb1d4c2c01d08331321cda293ab0a264f` | Tests #1715 success; ESLint #671 success; ZIP #1405 success | Correctif sécurité ciblé; validation humaine indépendante requise; chevauchement avec #179 dans factures.js. |
| #174 mobile hostname preflight | Draft, base main | `27fa8c2ec2e2e87b5f6b58a98b07052f5a5bce75` | Tests #1708 success; ESLint #669 success; ZIP #1398 success | Préflight protecteur; hostname public réel, DNS/TLS et appareil non vérifiés; placeholder domaine empêche build natif. |
| #178 devise/lock atomicité | Draft, base #171 | `70b4c68858997f8fcfa61dd40fb415a31b9b3f22` | Tests #1739 success; ESLint #691 success; ZIP #1429 success | Ne pas merger isolément; chaîne #168 → #171 → #178. Contrat multi-devise de POST orders à confirmer. |
| #171 orders currency | Draft, base #168 | `953489e79a9a6779b03e9c436559b925904f5635` | Tests #1702 success; ESLint #665 success; ZIP #1392 success | Dépend de #168; politique devise explicite différente de celle du tenant non confirmée. |
| #168 timezone/currency/tenant | Open non-draft, base main | `b07000daa7663196de68a42bc0ba011f4f4cf7f9` | Tests #1692 success; ESLint #661 success; ZIP #1382 success | 53 commits / 30 fichiers; contient/absorbe #167, synchroniser après intégration séquentielle. |
| #167 emails/reminders/currency/XSS | Open non-draft, base main | `4e848f3b98b1bc93635f0dab01a7d752fd2b18cd` | Tests #1680 success; ESLint #651 success; ZIP #1370 success | CI verte, mais #168 inclut cette base; pas de merge en double. |
| #176 audit reports runs 6–10 | Draft, base main | `8083f938c80ccba4ff499cdf3a6bddef95f29f3f` | Statut de la PR documentaire à revalider | Rapports historiques runs 1–10 conservés. Run 11 ajouté dans ce nouveau fichier. |

### Incident CI #179
- Run #1748, head `1279604aa672a8c2de8d9e8538c435d3c154295a`: **584 tests, 582 pass, 1 fail, 1 skip**. Échec `server/tests/professional-tenant.test.js:131`: `sharedClient.total_facture` vaut 700 (facture saine de A insérée dans la fixture), assertion attendait 0.
- Commit suivant #179 `82f6523f` a ajouté le test public API; commit `24e8c0d` a rétabli les permissions de fixture à `clients.read` uniquement. Le test POST `/api/pro/integrations/api-keys` attend 201 alors que `requirePermission` impose `integrations.manage` : ce membre read-only doit être refusé. Revue COMMENT déposée sur le head exact; pas d'approbation.
- Run #1750 sur `24e8c0d` est en cours à la snapshot; le test reste non confirmé. Les changements route SQL paraissent cohérents statiquement, mais des endpoints modifiés (delivery-notes, credit-notes, deposits, refund statement, payment-links, checkout status, recurring invoices) n'ont pas de test ciblé visible.

## PR fermées pertinentes
- **#151 merged** : correctif bandeaux A4/print; CI post-merge main run #45080802243 green sur `b43a94fc2937b0108077501a0260358c8569e11f`.
- **#149 closed sans merge** : proposition migration 012/schema v23 supersédée par #150/#152; ne pas réouvrir ni fusionner.
- **#173 closed sans merge** : remplacée par #174; ne pas merger les deux.
- **#143 closed sans merge** : mapping chèque/méthode inconnue porté par #148; branche historique conservée.

## Migrations / comptabilité
- `CURRENT_SCHEMA_VERSION = 23` sur main.
- Migrations 003–012 : professional modules; paiements/comptabilité/achats; portail/CRM/international/IA; company groups; email outbox; email proof; invitation proof; subscriptions simulation; contrepassation factures; correspondances comptables.
- Migration 012 actuelle : `012_comptabilite_correspondances.sql`; #149 avait une migration 012 concurrente, conflit résolu par fermeture de #149 et intégrations #150/#152.
- Aucun PR prioritaire (#174/#177/#179/#167/#168/#171/#178) n'ajoute de migration. #142 (schema v21 trial/accounting) et #145 (schema v22 retention/contrepassations) restent des changements critiques nécessitant validation humaine spécifique avant merge.

## Planning P0–P3
### P0 — sécurité / isolation
1. **#179** : corriger les deux tests signalés, attendre CI complète sur le head exact, ajouter tests des routes liées non couvertes, revoir les 8 fichiers; approbation sécurité humaine obligatoire avant merge.
2. **#177** : revue humaine indépendante du secret `verification_code`; CI green mais draft; intégrer avant #179 puis synchroniser/rebaser #179 (diffs chevauchants).
3. Rechercher les autres jointures cross-tenant non couvertes dans API publique, rapports, dashboard, paiements, modules pro et récurrence; tests anti-corruption.

### P1 — règles financières / essai / OHADA
1. Séquence #167 → #168 → #171 → #178; revalider CI, mergeable state, rebase et tests après chaque merge. Décision humaine sur commandes multi-devises avant #171/#178.
2. #142 (trial 15 jours tous plans et intégration cycle facture) et #145 (retention/contrepassation schema v22) : revue métier/comptable et validation humaine; ne pas toucher aux écritures historiques sans autorisation.
3. OHADA #150/#152 déjà intégré sur schema v23; valider configuration par société et compatibilité SYSCOHADA avant extension fournisseurs.

### P2 — facture/PDF, UX et accessibilité
- #151 print bandeau A4 déjà merged et main green.
- Reprendre tests de pagination longs/shorts, continuation, cachet/QR, polices et marges sur les 31 modèles; petites PR indépendantes.
- UX espace professionnel, paramètres sans long scroll, mobile sidebar; tests clavier/zoom/theme et régression.
- Backups/restore: garder les tests réels de restauration, permissions et transfert offsite en gates.

### P3 — branding / vidéo / documentation
- Vidéo Sunupilot #126/#118, logo/brand #99 et plans docs après stabilisation P0/P1. Le MP4 final reste à vérifier/ajouter; pas de publication sans assets/recette réelle.

## Protections et risques
- Dernier rapport Run 10: ruleset #27410527 actif sur main, aucun bypass; endpoint protection classique retournait 403. Non revalidé par API de protections dans ce run.
- Risque principal : #179 a une CI tests rouge précédente et nouvelle CI en cours; ne pas merger.
- Risque financier : devise multi-société/multi-devise, schema v21/v22 et écritures historiques exigent revue humaine.
- CI de branches empilées: synchroniser base et revalider checks exacts; aucun status check combiné visible via connecteur (runs Actions sont la preuve utilisée).

## Addendum de création du rapport
Ce snapshot contient 186 branches et 43 PR ouvertes, avant création de la branche/PR Run 11. Après création du rapport, compter +1 branche et +1 PR; le SHA main reste inchangé.


## Addendum — 23 novembre 2026, ~07:03 UTC

- PR #179 head a avancé de `24e8c0d745789fc08634f3d241c691c4b808f465` à `2d6a67a6d9be58f21fd72a6cfaac58f5586d2998` (4 commits supplémentaires). Le lot ajoute un garde-fou tenant-aware sur les factures récurrentes et un test qui vérifie 409 sans progression du compteur, échéance ni facture. Revue statique : correction route cohérente.
- CI #179 exacte sur `2d6a67a6d9be58f21fd72a6cfaac58f5586d2998`: Tests #1754 **in progress**; ESLint #706 **success**; ZIP #1444 **success**.
- Les deux défauts test de la revue restent visibles : `sharedClient.total_facture` attend 0 malgré la facture A de 700 insérée; le POST de clé API attend 201 avec un membre read-only, alors que `requirePermission` impose `integrations.manage`. Revue COMMENT #6017639254 déposée sur ce head, sans approbation.
- Le snapshot Run 11 et son rapport restent non destructifs; main n'a pas changé.


## Addendum — 23 novembre 2026, ~07:04 UTC

- PR #179 latest head `212cdb9de793690303cad47ceb24756ea718d789` ajoute la correction attendue : total du client A à 700 (facture A valide, facture B de 5 000 exclue). La garde facture récurrente et son test 409 sans mutation ont aussi été portés sur le head précédent `2d6a67a`.
- **Blocage encore présent** : le test API-key attend 201 pour le membre `clients.read` uniquement, alors que le middleware impose `integrations.manage` au POST. Revue COMMENT #6017643104 sur le head `212cdb9`; aucune approbation.
- CI #1754 (head précédent `2d6a67a`) : Tests encore in progress, ESLint #706 success, ZIP #1444 success. **Aucun run CI visible sur le head courant `212cdb9`** au snapshot.
