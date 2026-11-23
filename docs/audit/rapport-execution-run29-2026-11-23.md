# Rapport d’exécution Audit SamaFacture Pro — Run 29

**Date de vérification :** 23 novembre 2026, 21:55 UTC (Dakar)  
**Dépôt :** https://github.com/morn53426-ui/-samafacture-pro  
**Rapport précédent :** Run 28 (fichier conservé)  
**Base :** `main` SHA `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c`  
**Mode :** inventaire + revue + report append-only; aucun merge.

## 1. Main et CI post-merge

- `main` reste sur `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c`, merge PR #194.
- Run push exact #45221526816 — `Tests Node.js et MySQL`: **completed / success**.
- Suite principale : **620 tests, 619 pass, 0 fail, 1 skip**; suite dédiée de restauration sauvegarde chiffrée : **1 pass, 0 fail, 0 skip**.
- Les étapes CI observées sont toutes réussies : containers, Compose/env, Docker/secrets, dépendances, Chromium, vulnérabilités, tests, restauration réelle chiffrée, smoke MySQL/Redis, recette responsive et publication des captures.
- Sur `main`, le check-run retourné est le test Node/MySQL. ZIP et ESLint sont des workflows PR (pas de run push-main constaté).
- Aucun changement de `main`; stabilité post-fusion vérifiée au SHA ci-dessus.

## 2. Inventaire exhaustif snapshot

- **Branches : 227** — toutes conservées.
- **Pull Requests : 213** — **64 ouvertes**, **117 merged**, **32 closed sans merge**.
- Pages GitHub API utilisées : branches 1–3 et PR all-state 1–3, 100 éléments/page.
- Numéros merged : 1, 2, 4, 5, 6, 7, 8, 10, 12, 15, 16, 17, 18, 19, 21, 23, 24, 25, 26, 27, 28, 29, 31, 32, 35, 36, 37, 38, 39, 40, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 59, 60, 63, 64, 67, 68, 69, 71, 72, 73, 74, 75, 77, 79, 80, 81, 82, 83, 84, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 100, 101, 103, 104, 105, 106, 107, 108, 109, 111, 112, 116, 117, 119, 120, 121, 123, 124, 125, 148, 150, 151, 152, 158, 160, 161, 162, 163, 165, 167, 168, 181, 187, 192, 194, 197, 200, 202, 204, 205.
- Numéros closed sans merge : 3, 9, 11, 13, 14, 20, 22, 30, 33, 34, 41, 62, 65, 76, 78, 85, 90, 113, 122, 143, 144, 146, 147, 149, 159, 164, 173, 174, 184, 186, 189, 191.

### Toutes les PR ouvertes (head/base exacts)

| PR | Titre | Branche head | Head SHA | Base SHA | Draft | Mergeable |
|---|---|---|---|---|---|
| #99 | Adopt SunuPilot branding — indigo and baobab green | `rebrand/optigest` | `3f70466d` | `b5863a0d` | Ready | unknown |
| #102 | test(accessibility): couvrir le thème sombre et le parcours clavier | `test/accessibility-dark-keyboard-20261118` | `86aeeb6f` | `b5863a0d` | Draft | unknown |
| #110 | test(accessibility): cover light/dark keyboard navigation and contrast | `test/accessibility-dark-keyboard-rebased-20261120` | `722b5bfc` | `f42f69e1` | Ready | unknown |
| #114 | docs: centralize SamaFacture Pro improvement roadmap | `docs/improvement-plan-20261121` | `ff2cae7b` | `5478809e` | Ready | unknown |
| #115 | test(accounting): cover expense posting and tenant isolation | `test/ohada-expense-ledger-integrity-20261121` | `3873c1d1` | `f49d3521` | Ready | unknown |
| #118 | feat(landing): vidéo Sunupilot — capture locale automatisée des écrans | `feature/video-presentation-spark-sunupilot` | `29dd7ccc` | `f49d3521` | Ready | unknown |
| #126 | feat(landing): présentation vidéo Sunupilot — portage sur main actuel | `integration/sunupilot-video-main-20261121` | `817b10da` | `8453ee6d` | Draft | unknown |
| #127 | fix(pdf): pagination A4 du devis Executive (28 lignes) | `fix/quote-executive-a4-pagination-20261121` | `400ce60d` | `00d52ca8` | Ready | unknown |
| #128 | feat(trial,workspace): essai 15 jours et organisation professionnelle | `feat/15-day-trial-entitlements-20261121` | `e3b91dc4` | `8453ee6d` | Ready | unknown |
| #129 | feat(workspace): navigation par domaines et paramètres structurés | `feat/workspace-settings-navigation-20261121` | `868027e1` | `8453ee6d` | Draft | unknown |
| #130 | fix(a11y): contraste WCAG AA et focus clavier sur les deux thèmes | `fix/accessibility-contrast-focus-main-20261121` | `0b819127` | `00d52ca8` | Draft | unknown |
| #131 | docs: actualiser la feuille de route sur le main courant | `docs/improvement-plan-main-20261122` | `3d51f0af` | `8453ee6d` | Draft | unknown |
| #132 | docs(audit): état initial et plan priorisé 22 novembre | `audit/initial-review-20261122` | `6543b3a7` | `8453ee6d` | Draft | unknown |
| #133 | fix(a11y): corriger le contraste des aperçus de modèles | `fix/accessibility-template-preview-contrast-20261122` | `6b3cd9ff` | `c607f397` | Draft | unknown |
| #134 | fix(a11y): badge Entreprise lisible en thème sombre | `fix/enterprise-badge-contrast-main-20261122` | `52021018` | `8453ee6d` | Draft | unknown |
| #135 | fix(accounting): preserve issued invoice history | `fix/invoice-delete-history-guard-20261122` | `2c7f3cbd` | `8453ee6d` | Draft | unknown |
| #136 | fix(accounting): protect posted expenses from edits and deletion | `fix/expense-ledger-protection-20261122` | `4e0f2a89` | `8453ee6d` | Draft | unknown |
| #137 | fix(accounting): protect clients with linked history | `fix/client-delete-history-protection-20261122` | `f2aada8d` | `8453ee6d` | Draft | unknown |
| #138 | fix(inventory): protect products with stock or history | `fix/product-delete-stock-history-protection-20261122` | `27d5a6c2` | `8453ee6d` | Draft | unknown |
| #139 | fix(a11y): improve professional workspace status contrast | `fix/pro-workspace-status-contrast-20261122` | `baa9ea6a` | `8453ee6d` | Draft | unknown |
| #140 | ci(lint): couvrir les routes backend et tests de protection | `ci/lint-history-protection-backend-20261122` | `32d1c1f5` | `00d52ca8` | Draft | unknown |
| #141 | ci: add workspace UI structure regression checks | `ci/workspace-ui-structure-tests-20261122` | `2a09ccf8` | `868027e1` | Draft | unknown |
| #142 | feat(accounting, trial): integrate invoice lifecycle and 15-day trial on schema v21 | `integration/schema-v21-accounting-trial-20261122` | `decb8da2` | `8453ee6d` | Draft | unknown |
| #145 | fix(accounting): retain invoice reversal events (schema v22) | `fix/accounting-event-audit-retention-v22-run2-20261122` | `5b6ba8bf` | `decb8da2` | Draft | unknown |
| #153 | test(trial): vérifier l'expiration sur la première requête protégée | `test/free-trial-expiry-session-guard-20261122` | `29932fbb` | `00d52ca8` | Ready | unknown |
| #154 | ux(workspace): navigation mobile compacte par domaine | `ux/pro-workspace-mobile-domain-rail-20261122` | `185e0487` | `8d0f287f` | Ready | unknown |
| #155 | ux(settings): grille responsive pour les coordonnées entreprise | `ux/settings-company-fields-grid-20261122` | `99670cdf` | `00d52ca8` | Ready | unknown |
| #156 | a11y(dashboard): ajouter un accès clavier au contenu principal | `a11y/dashboard-skip-navigation-20261122` | `8f45795c` | `8d0f287f` | Ready | unknown |
| #157 | a11y(navigation): fermer le menu mobile avec Échap | `a11y/mobile-sidebar-escape-focus-20261122` | `c3740303` | `00d52ca8` | Ready | unknown |
| #166 | docs(audit): rapport d'exécution initial du 22 novembre | `audit/execution-report-20261122-run1` | `dc7e6f55` | `b43a94fc` | Draft | unknown |
| #169 | docs(audit): rapport d'exécution run 2 — 22 novembre | `audit/execution-report-20261122-run2` | `dff61fb4` | `b43a94fc` | Draft | unknown |
| #170 | docs(audit): rapport d'exécution run 3 — 23 novembre | `audit/execution-report-20261123-run3` | `6fa59a42` | `b43a94fc` | Draft | unknown |
| #171 | fix(pro): use tenant currency for orders and lock history | `fix/pro-orders-tenant-currency-20261123` | `953489e7` | `13111355` | Draft | unknown |
| #172 | docs(audit): rapport d'exécution run 4 — 23 novembre | `audit/execution-report-20261123-run4` | `14688f7a` | `b43a94fc` | Draft | unknown |
| #175 | docs(audit): rapport d'exécution run 5 — 23 novembre | `audit/execution-report-20261123-run5` | `f9f95b73` | `b43a94fc` | Draft | unknown |
| #176 | docs(audit): rapports d'exécution runs 6 à 10 — 23 novembre | `audit/execution-report-20261123-run6` | `8083f938` | `b43a94fc` | Draft | unknown |
| #177 | security(invoices): redact verification code from list API | `security/invoice-verification-code-redaction-main-20261123-run7` | `f68ab94e` | `b43a94fc` | Ready | unknown |
| #178 | fix(currency): serialize tenant currency changes and orders | `fix/tenant-currency-atomic-lock-20261123` | `70b4c688` | `953489e7` | Draft | unknown |
| #179 | security(invoices): enforce client and payment tenant ownership | `security/invoice-client-tenant-scope-20261123` | `5f554950` | `b43a94fc` | Draft | unknown |
| #180 | docs(audit): execution report run 11 — 23 November | `audit/execution-report-20261123-run11` | `2f1b11e7` | `b43a94fc` | Draft | unknown |
| #182 | fix(pro): use tenant currency for orders and lock history | `fix/pro-orders-tenant-currency-main-20261123` | `a078a351` | `13111355` | Draft | unknown |
| #183 | fix(currency): serialize tenant currency changes and orders | `fix/tenant-currency-atomic-lock-main-20261123` | `4a73d68d` | `1c510123` | Draft | unknown |
| #185 | fix(currency): serialize tenant currency changes and first business writes | `fix/tenant-currency-atomic-main-20261123` | `50b9fcc2` | `13111355` | Draft | unknown |
| #188 | security(tenant): enforce ownership across invoice-related records | `security/invoice-client-tenant-current-main-after-181-20261123` | `39f27a32` | `b276eba5` | Draft | unknown |
| #190 | fix(currency): serialize tenant currency and first business writes | `fix/tenant-currency-atomic-current-main-20261123` | `0abc0440` | `b276eba5` | Draft | unknown |
| #193 | security(invoices): redact verification codes from list responses | `security/redact-verification-codes-main-current-20261123-run12` | `fb6324d3` | `b0b52e66` | Draft | unknown |
| #195 | docs(audit): execution report run 12 — 23 November | `audit/execution-report-20261123-run12` | `b54c4b9f` | `b0b52e66` | Draft | unknown |
| #196 | docs(audit): execution report run 13 — 23 November | `audit/execution-report-20261123-run13` | `539a9430` | `b0b52e66` | Draft | unknown |
| #198 | docs(audit): execution report run 14 — 23 November | `audit/execution-report-20261123-run14` | `e6cc9a40` | `b0b52e66` | Draft | unknown |
| #199 | fix(security): scope client statement refunds to tenant payment | `security/refund-statement-tenant-join-20261123-run14` | `b212dbc0` | `b0b52e66` | Draft | unknown |
| #201 | docs(audit): rapport d'exécution runs 15–17 — 23 novembre | `audit/execution-report-20261123-run15` | `63493905` | `f8a61187` | Draft | unknown |
| #203 | security(invoices): redact verification codes from list responses | `security/redact-verification-codes-current-main-run19-20261123` | `2059e374` | `f8a61187` | Draft | unknown |
| #206 | docs(audit): execution report run 22 — 23 novembre | `audit/execution-report-20261123-run22` | `6a8e2efe` | `f10d8969` | Draft | unknown |
| #207 | docs(audit): execution report run 23 — 23 novembre | `audit/execution-report-20261123-run23` | `ea7de5bf` | `c32ed40a` | Draft | unknown |
| #208 | fix(ux): compact professional workspace domains on mobile | `fix/mobile-workspace-domain-rail-main-20261123` | `21a3e371` | `c32ed40a` | Draft | unknown |
| #209 | ux(settings): group company details in responsive grid | `fix/company-settings-responsive-grid-main-20261123` | `9888f76f` | `c32ed40a` | Draft | unknown |
| #210 | fix(currency): enforce company base currency for sales orders | `fix/pro-orders-base-currency-main-20261123-run23` | `fa92faec` | `c32ed40a` | Draft | unknown |
| #211 | ux(settings): organiser les coordonnées entreprise en grille responsive | `ux/settings-company-fields-grid-main-20261123-run23` | `4518451d` | `c32ed40a` | Draft | unknown |
| #212 | docs(audit): rapport d'exécution Run 25 — 23 novembre | `audit/execution-report-20261123-run25` | `a01f8b87` | `c32ed40a` | Draft | unknown |
| #213 | docs(audit): rapport d'exécution Run 26 — 23 novembre | `audit/execution-report-20261123-run26` | `858fd88c` | `c32ed40a` | Draft | unknown |
| #214 | fix(cash): default new cash registers to company currency | `fix/cash-register-default-base-currency-20261123` | `2349f3ab` | `c32ed40a` | Draft | unknown |
| #215 | docs(audit): rapport d’exécution Run 27 — 23 novembre | `audit/execution-report-20261123-run27` | `88f85a19` | `c32ed40a` | Draft | unknown |
| #216 | fix(payment-links): inherit invoice currency and reject mismatch | `fix/payment-link-invoice-currency-20261123-run28` | `bceecd6b` | `c32ed40a` | Draft | unknown |
| #217 | docs(audit): rapport d’exécution Run 28 — 23 novembre | `audit/execution-report-20261123-run28` | `7fcf6d38` | `c32ed40a` | Draft | unknown |

### Inventaire des 227 branches

- `a11y/dashboard-skip-link-main-current-run13`
- `a11y/dashboard-skip-navigation-20261122`
- `a11y/mobile-sidebar-escape-focus-20261122`
- `a11y/sidebar-escape-main-current-run15`
- `audit/execution-report-20261122-run1`
- `audit/execution-report-20261122-run2`
- `audit/execution-report-20261123-run11`
- `audit/execution-report-20261123-run12`
- `audit/execution-report-20261123-run13`
- `audit/execution-report-20261123-run14`
- `audit/execution-report-20261123-run15`
- `audit/execution-report-20261123-run20`
- `audit/execution-report-20261123-run21`
- `audit/execution-report-20261123-run22`
- `audit/execution-report-20261123-run23`
- `audit/execution-report-20261123-run25`
- `audit/execution-report-20261123-run26`
- `audit/execution-report-20261123-run27`
- `audit/execution-report-20261123-run28`
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
- `feat/15-day-trial-entitlements-20261121`
- `feat/5-nouveaux-modeles-facture`
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
- `feat/invoice-template-gallery-2026-11-15`
- `feat/invoice-template-gallery-2026-11-15-v2`
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
- `fix/cash-register-default-base-currency-20261123`
- `fix/ci-serial-tests-2026-11-15`
- `fix/client-delete-history-protection-20261122`
- `fix/company-settings-responsive-grid-main-20261123`
- `fix/dashboard-donut-count-20261118`
- `fix/docker-context-secrets-and-lockfile-2026-11-15`
- `fix/docker-local-startup-mysql-redis-swagger`
- `fix/enterprise-badge-contrast-current-main-run19-20261123`
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
- `fix/mobile-nonpublic-hostnames-current-main-20261123`
- `fix/mobile-preflight-current-main-20261123`
- `fix/mobile-preflight-main-20261123`
- `fix/mobile-preflight-main-after-security-20261123`
- `fix/mobile-workspace-domain-rail-main-20261123`
- `fix/monthly-invoice-quota-schema-v8-2026-11-15`
- `fix/mysql-backup-limited-privileges-20261122`
- `fix/navigation-compact-sidebar-2026-11-13`
- `fix/payment-link-invoice-currency-20261123-run28`
- `fix/pdf-headless-user-formatting-20261121`
- `fix/pdf-pagination-extras-flow-20261117`
- `fix/pdf-print-pagination-20261117`
- `fix/pdf-stream-ack-payment-disclosures-20261116`
- `fix/pdf-worker-db-readiness-2026-11-16`
- `fix/pdf-worker-health-and-sidebar-icons-2026-11-15`
- `fix/pdf-worker-wait-for-api-health-2026-11-15`
- `fix/pro-orders-base-currency-main-20261123-run23`
- `fix/pro-orders-tenant-currency-20261123`
- `fix/pro-orders-tenant-currency-main-20261123`
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
- `fix/tenant-currency-atomic-current-main-20261123`
- `fix/tenant-currency-atomic-latest-main-20261123`
- `fix/tenant-currency-atomic-lock-20261123`
- `fix/tenant-currency-atomic-lock-main-20261123`
- `fix/tenant-currency-atomic-main-20261123`
- `fix/tenant-currency-final-main-20261123`
- `fix/ui-icons-legibility-2026-11-15`
- `fix/ui-responsive-polish-20261117`
- `fix/visual-qr-fixture-20261121`
- `fix/webhook-local-timezone-dynamic-currency-20261123`
- `fix/whatsapp-country-guard-2026-11-16`
- `improve/pdf-page3-balance-20261121`
- `improve/pdf-page3-balance-main-20261121`
- `integration/main-company-invitation-email-proof-20261117`
- `integration/pr210-schema-v23-main-current-20261123`
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
- `security/invoice-client-tenant-current-main-after-181-20261123`
- `security/invoice-client-tenant-scope-20261123`
- `security/invoice-client-tenant-scope-current-main-20261123`
- `security/invoice-list-verification-code-redaction-20261122`
- `security/invoice-tenant-scope-final-main-20261123`
- `security/invoice-verification-code-redaction-main-20261123-run7`
- `security/redact-secret-urls-in-logs-2026-11-16`
- `security/redact-verification-codes-current-main-run19-20261123`
- `security/redact-verification-codes-main-current-20261123-run12`
- `security/refund-statement-tenant-join-20261123-run14`
- `security/reset-token-hash-redaction-main-current-20261123`
- `security/tenant-relations-main-current-20261123-run12`
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
- `ux/settings-company-fields-grid-main-20261123-run23`

## 3. Commits récents de main (10)

| SHA | Date UTC | Message |
|---|---|---|
| `c32ed40a` | 2026-11-23T16:53:14Z | [Merge pull request #194 from morn53426-ui/security/tenant-relations-main-current-20261123-run12](https://github.com/morn53426-ui/-samafacture-pro/commit/c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c) |
| `970832f4` | 2026-11-23T16:37:53Z | [Merge branch 'main' into security/tenant-relations-main-current-20261123-run12](https://github.com/morn53426-ui/-samafacture-pro/commit/970832f4bb45bb348dae99967183e917beeeb7e3) |
| `60fc886a` | 2026-11-23T16:34:03Z | [Merge pull request #192 from morn53426-ui/fix/tenant-currency-final-main-20261123](https://github.com/morn53426-ui/-samafacture-pro/commit/60fc886aee3d15993b255a8d4a1ce35a287e9939) |
| `0c046f9e` | 2026-11-23T16:14:16Z | [Merge branch 'main' into fix/tenant-currency-final-main-20261123](https://github.com/morn53426-ui/-samafacture-pro/commit/0c046f9ed60a097889fe2d27158ab87c41a3233c) |
| `250141bd` | 2026-11-23T16:08:46Z | [Merge branch 'main' into security/tenant-relations-main-current-20261123-run12](https://github.com/morn53426-ui/-samafacture-pro/commit/250141bd649cd773462813bd99b098c5f62a6374) |
| `f10d8969` | 2026-11-23T16:01:06Z | [docs(audit): execution report run 21](https://github.com/morn53426-ui/-samafacture-pro/commit/f10d89694e264bc710f1ce534a6418dd792e603a) |
| `8df06519` | 2026-11-23T15:35:13Z | [docs(audit): merge execution report run 20](https://github.com/morn53426-ui/-samafacture-pro/commit/8df0651951884623d4f5d4cd7ebc48b9c26f79e0) |
| `047e7bad` | 2026-11-23T14:35:22Z | [fix(a11y): badge Entreprise lisible en thème sombre](https://github.com/morn53426-ui/-samafacture-pro/commit/047e7badf4fccd91644af74e0968089b23246c93) |
| `f8a61187` | 2026-11-23T14:03:46Z | [a11y(dashboard): keyboard skip link on current main](https://github.com/morn53426-ui/-samafacture-pro/commit/f8a61187e8b8df7dc319d611dd58fb02dd0aa336) |
| `90016322` | 2026-11-23T13:55:04Z | [merge current main into security isolation candidate](https://github.com/morn53426-ui/-samafacture-pro/commit/900163220356db9c443e11e5f6208760d49a62f2) |

Dernier merge : PR #194 (`c32ed40a`), suivi des merges #192 et commits de synchronisation des branches d’audit.

## 4. Schéma et migrations

- Version actuelle confirmée dans `server/config/db.js`: **23**.
- Migrations versionnées visibles dans `server/database/migrations`:
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
- Les versions 8–23 sont appliquées par le runner de migrations dans `server/config/db.js`; v21 concerne l’essai 15 jours, v22 la rétention des événements comptables, v23 les correspondances comptables par entreprise.
- Migration 011 journalise les contrepassations/réactivations facture; 012 crée les correspondances par entreprise.
- #142 (v21) et #145 (v22) restent sur branches/base anciennes et ne sont pas à merger directement. Réconciliation + validation comptable humaine obligatoire.
- Aucune migration exécutée pendant Run 29.

## 5. Workflows CI

Fichiers observés :
- `.github/workflows/lint.yml`
- `.github/workflows/package-source-zip.yml`
- `.github/workflows/test.yml`

- `test.yml`: PR ciblées et push sur `main`; Node, MySQL 8, Redis, tests, sauvegarde/restauration, smoke et recette visuelle.
- `package-source-zip.yml`: PR, construit et vérifie l’archive ZIP.
- `lint.yml`: PR sur chemins JS/HTML/tests ciblés, ESLint.
- Ruleset actif #27410527 `protect main`: PR requise, threads résolus, checks stricts, suppression/non-fast-forward bloqués. Checks requis : `Tests Node.js et MySQL` et `Build complete source archive`.
- **Approbations requises : 0** et CODEOWNER non requis. La revue humaine est donc une exigence de gouvernance à appliquer hors enforcement actuel; aucun contournement.

## 6. CI exact des PR candidates

| PR | Head SHA | Tests | ESLint | ZIP | État / décision |
|---|---|---|---|---|---|
| #216 | `bceecd6b` | #45265614664 success — 621 tests, 620 pass, 0 fail, 1 skip; restore dédié 1 pass | #45265614600 success | #45265614566 success | Draft; revue COMMENT ajoutée, validation comptable/policy humaine |
| #214 | `2349f3ab` | #45250410943 success | #45250411138 success | #45250410915 success | Draft; revue humaine |
| #210 | `fa92faec` | #45224583486 success | #45224583453 success | #45224583450 success | Draft; validation OHADA/multi-devises humaine |
| #211 | `4518451d` | #45225973762 success | #45225973707 success | #45225973680 success | Draft; candidate settings grid |
| #209 | `9888f76f` | #45223608140 success | #45223608516 success | #45223608500 success | Draft; doublon #211 |
| #208 | `21a3e371` | #45223260494 success | #45223260450 success | #45223260488 success | Draft; rail mobile |
| #217 (Run 28) | `7fcf6d38` | #45265664300 success — 620, 619 pass, 0 fail, 1 skip; restore 1 pass | non applicable docs | #45265664277 success | Run 28 CI verte; Run 29 en attente après ajout |

#216 a d’abord échoué sur un test voisin de quota (head `3160e225`), puis la fixture a été isolée au plan Pro et le head ci-dessus est vert. #208 avait une tentative précédente échouée sur `f4b126e8`; le head `21a3e371` est corrigé et vert.

## 7. Revue indépendante et consolidations

- **#216** : transaction avec verrou tenant-scoped de facture; devise absente hérite; code non supporté 400; mismatch 409; rollback sans insertion. Tests vérifient lien public et cohérence montant/devise. Commentaire review COMMENT au commit exact; pas d’approbation.
- **#210** : tests/ESLint/ZIP verts; règle devise commande nécessite validation métier OHADA avant merge.
- **#211 et #209** : mêmes fichiers et fonction de grille responsive. #211 possède une couverture de test plus complète; recommandation de garder #211 comme candidate canonique. Commentaires de revue ajoutés aux deux, sans fermer #209.
- **#208** : rail mobile horizontal limité au breakpoint, scroll-snap, région accessible focusable; tests exacts verts, revue COMMENT ajoutée. Vérification tactile/clavier sur appareils réels encore recommandée.
- #214 : correctif caisse déjà audité, CI exacte verte, reste Draft.
- #188/#199/#193/#203 : la réconciliation précédente a conclu que les corrections principales sont déjà sur main; éviter les doublons, sans fermeture/suppression.

## 8. Branche webhook candidate — non intégrable

`fix/webhook-local-timezone-dynamic-currency-20261123`, head `b07000da` : compare main indique **53 ahead / 47 behind**, diverged, 30 fichiers modifiés et un diff transversal (workflows, auth, factures, API publique, professionnel, scheduler, webhook). Pas de PR ouverte correspondante trouvée. Ne pas merger, rebaser, ni cherry-pick sans analyse lot par lot.

## 9. Planning P0–P3

| Priorité | Action | Statut |
|---|---|---|
| P0 | Maintenir main stable et vérifier CI post-merge exacte | **Main stable** |
| P0 | Renforcer l’approbation requise / CODEOWNER dans le ruleset | **Bloqué propriétaire GitHub** (0 approval) |
| P0 | Revue humaine sécurité et financières | COMMENT techniques ajoutés; approbations humaines requises |
| P1 | #216 liens de paiement devises | CI verte; Draft; validation politique |
| P1 | #214 caisse devise par défaut | CI verte; revue |
| P1 | #210 commandes devise | CI verte; validation OHADA |
| P1 | #142/#145 migrations comptables | stale; réconciliation et approbation comptable |
| P2 | Consolidation #211/#209; #208 mobile | CI verte; #211 préférable, doublon à conserver jusqu’autorisation |
| P2 | Impression/PDF, responsive, accessibilité | poursuivre petits lots |
| P3 | Runbooks, CI, documentation | poursuivre |

## 10. Préservation et actions

- Aucun merge ni fermeture de PR.
- Aucun push direct/force-push sur main.
- Aucun branche supprimée.
- Aucune donnée, volume, backup, historique comptable ou migration touchée.
- Aucun paiement réel ni déploiement production.
- Commentaires/revues COMMENT uniquement (aucune APPROVE).
- Run 29 ajouté dans un **nouveau fichier**, Run 28 et les rapports précédents conservés.

**Conclusion :** main stable et plusieurs PR candidates avec CI verte. La gouvernance (approbation 0), validation métier des règles devise et consolidation des doublons restent les bloqueurs avant toute fusion.
