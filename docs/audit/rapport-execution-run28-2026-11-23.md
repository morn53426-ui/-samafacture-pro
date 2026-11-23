# Rapport d'exécution Audit SamaFacture Pro — Run 28

**Date de vérification :** 23 novembre 2026, 20:55 UTC (Dakar)  
**Dépôt :** https://github.com/morn53426-ui/-samafacture-pro  
**Branche du rapport :** `audit/execution-report-20261123-run28`  
**Base :** `main` SHA `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c`  
**Historique :** nouveau rapport append-only. Aucun rapport Run 1–27 n'a été écrasé.

## 1. Main et stabilité post-fusion

- `main` confirmé sur `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c`, merge PR #194.
- Run push de main **45221526816**, workflow **Tests Node.js et MySQL**, commit exact `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c` : **completed / success**.
- Les étapes du job sont toutes `success`: containers, checkout, Docker/secrets, Node, dépendances, Chromium, vulnérabilités, tests, restore sauvegarde chiffrée, diagnostics, smoke MySQL/Redis, recette responsive et captures.
- Aucun autre workflow push n'est déclenché par les fichiers de workflow actuels (ZIP et ESLint sont PR-triggered).

## 2. Ruleset et blocage gouvernance P0

Ruleset lu : `protect main`, ID `27410527`, enforcement active, ciblant `refs/heads/main`.
- Bloque suppression et non-fast-forward.
- Exige une PR, résolution des threads et checks stricts.
- Checks requis : `Tests Node.js et MySQL`, `Build complete source archive`.
- **Nombre d'approbations obligatoires : 0**; aucune CODEOWNER obligatoire. L'approbation humaine n'est donc pas imposée par le ruleset.
- Endpoint de branch protection classique inaccessible (403 Resource not accessible by integration); ne pas interpréter cela comme absence de protections.

**Décision :** pas de merge automatique. Pour satisfaire la politique de revue, une approbation humaine doit être obtenue et le ruleset doit être renforcé par le propriétaire GitHub. Aucun contournement n'est utilisé.

## 3. Inventaire exhaustif — snapshot après ouverture du rapport

- Branches : **227** (100 + 100 + 27; toutes conservées).
- PR : **212** — **63 ouvertes**, **117 merged**, **32 closed sans merge**.
- PR ouvertes (numéros) : 99, 102, 110, 114, 115, 118, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 145, 153, 154, 155, 156, 157, 166, 169, 170, 171, 172, 175, 176, 177, 178, 179, 180, 182, 183, 185, 188, 190, 193, 195, 196, 198, 199, 201, 203, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216.
- PR fermées sans merge : 3, 9, 11, 13, 14, 20, 22, 30, 33, 34, 41, 62, 65, 76, 78, 85, 90, 113, 122, 143, 144, 146, 147, 149, 159, 164, 173, 174, 184, 186, 189, 191.
- PR merged : 1, 2, 4, 5, 6, 7, 8, 10, 12, 15, 16, 17, 18, 19, 21, 23, 24, 25, 26, 27, 28, 29, 31, 32, 35, 36, 37, 38, 39, 40, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 59, 60, 63, 64, 67, 68, 69, 71, 72, 73, 74, 75, 77, 79, 80, 81, 82, 83, 84, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 100, 101, 103, 104, 105, 106, 107, 108, 109, 111, 112, 116, 117, 119, 120, 121, 123, 124, 125, 148, 150, 151, 152, 158, 160, 161, 162, 163, 165, 167, 168, 181, 187, 192, 194, 197, 200, 202, 204, 205.

### Toutes les PR ouvertes — SHA et état

| PR | Titre | Head SHA | Draft | Mergeability |
|---|---|---|---|---|
| #99 | Adopt SunuPilot branding — indigo and baobab green | `3f70466d` | Ready | non-mergeable |
| #102 | test(accessibility): couvrir le thème sombre et le parcours clavier | `86aeeb6f` | Draft | non-mergeable |
| #110 | test(accessibility): cover light/dark keyboard navigation and contrast | `722b5bfc` | Ready | non-mergeable |
| #114 | docs: centralize SamaFacture Pro improvement roadmap | `ff2cae7b` | Ready | mergeable |
| #115 | test(accounting): cover expense posting and tenant isolation | `3873c1d1` | Ready | non-mergeable |
| #118 | feat(landing): vidéo Sunupilot — capture locale automatisée des écrans | `29dd7ccc` | Ready | non-mergeable |
| #126 | feat(landing): présentation vidéo Sunupilot — portage sur main actuel | `817b10da` | Draft | non-mergeable |
| #127 | fix(pdf): pagination A4 du devis Executive (28 lignes) | `400ce60d` | Ready | mergeable |
| #128 | feat(trial,workspace): essai 15 jours et organisation professionnelle | `e3b91dc4` | Ready | non-mergeable |
| #129 | feat(workspace): navigation par domaines et paramètres structurés | `868027e1` | Draft | non-mergeable |
| #130 | fix(a11y): contraste WCAG AA et focus clavier sur les deux thèmes | `0b819127` | Draft | non-mergeable |
| #131 | docs: actualiser la feuille de route sur le main courant | `3d51f0af` | Draft | mergeable |
| #132 | docs(audit): état initial et plan priorisé 22 novembre | `6543b3a7` | Draft | mergeable |
| #133 | fix(a11y): corriger le contraste des aperçus de modèles | `6b3cd9ff` | Draft | non-mergeable |
| #134 | fix(a11y): badge Entreprise lisible en thème sombre | `52021018` | Draft | non-mergeable |
| #135 | fix(accounting): preserve issued invoice history | `2c7f3cbd` | Draft | non-mergeable |
| #136 | fix(accounting): protect posted expenses from edits and deletion | `4e0f2a89` | Draft | non-mergeable |
| #137 | fix(accounting): protect clients with linked history | `f2aada8d` | Draft | non-mergeable |
| #138 | fix(inventory): protect products with stock or history | `27d5a6c2` | Draft | non-mergeable |
| #139 | fix(a11y): improve professional workspace status contrast | `baa9ea6a` | Draft | non-mergeable |
| #140 | ci(lint): couvrir les routes backend et tests de protection | `32d1c1f5` | Draft | non-mergeable |
| #141 | ci: add workspace UI structure regression checks | `2a09ccf8` | Draft | mergeable |
| #142 | feat(accounting, trial): integrate invoice lifecycle and 15-day trial on schema v21 | `decb8da2` | Draft | non-mergeable |
| #145 | fix(accounting): retain invoice reversal events (schema v22) | `5b6ba8bf` | Draft | mergeable |
| #153 | test(trial): vérifier l'expiration sur la première requête protégée | `29932fbb` | Ready | non-mergeable |
| #154 | ux(workspace): navigation mobile compacte par domaine | `185e0487` | Ready | mergeable |
| #155 | ux(settings): grille responsive pour les coordonnées entreprise | `99670cdf` | Ready | non-mergeable |
| #156 | a11y(dashboard): ajouter un accès clavier au contenu principal | `8f45795c` | Ready | non-mergeable |
| #157 | a11y(navigation): fermer le menu mobile avec Échap | `c3740303` | Ready | non-mergeable |
| #166 | docs(audit): rapport d'exécution initial du 22 novembre | `dc7e6f55` | Draft | mergeable |
| #169 | docs(audit): rapport d'exécution run 2 — 22 novembre | `dff61fb4` | Draft | mergeable |
| #170 | docs(audit): rapport d'exécution run 3 — 23 novembre | `6fa59a42` | Draft | mergeable |
| #171 | fix(pro): use tenant currency for orders and lock history | `953489e7` | Draft | non-mergeable |
| #172 | docs(audit): rapport d'exécution run 4 — 23 novembre | `14688f7a` | Draft | mergeable |
| #175 | docs(audit): rapport d'exécution run 5 — 23 novembre | `f9f95b73` | Draft | mergeable |
| #176 | docs(audit): rapports d'exécution runs 6 à 10 — 23 novembre | `8083f938` | Draft | mergeable |
| #177 | security(invoices): redact verification code from list API | `f68ab94e` | Ready | non-mergeable |
| #178 | fix(currency): serialize tenant currency changes and orders | `70b4c688` | Draft | mergeable |
| #179 | security(invoices): enforce client and payment tenant ownership | `5f554950` | Draft | non-mergeable |
| #180 | docs(audit): execution report run 11 — 23 November | `2f1b11e7` | Draft | mergeable |
| #182 | fix(pro): use tenant currency for orders and lock history | `a078a351` | Draft | non-mergeable |
| #183 | fix(currency): serialize tenant currency changes and orders | `4a73d68d` | Draft | non-mergeable |
| #185 | fix(currency): serialize tenant currency changes and first business writes | `50b9fcc2` | Draft | non-mergeable |
| #188 | security(tenant): enforce ownership across invoice-related records | `39f27a32` | Draft | non-mergeable |
| #190 | fix(currency): serialize tenant currency and first business writes | `0abc0440` | Draft | non-mergeable |
| #193 | security(invoices): redact verification codes from list responses | `fb6324d3` | Draft | mergeable |
| #195 | docs(audit): execution report run 12 — 23 November | `b54c4b9f` | Draft | mergeable |
| #196 | docs(audit): execution report run 13 — 23 November | `539a9430` | Draft | mergeable |
| #198 | docs(audit): execution report run 14 — 23 November | `e6cc9a40` | Draft | mergeable |
| #199 | fix(security): scope client statement refunds to tenant payment | `b212dbc0` | Draft | non-mergeable |
| #201 | docs(audit): rapport d'exécution runs 15–17 — 23 novembre | `63493905` | Draft | mergeable |
| #203 | security(invoices): redact verification codes from list responses | `2059e374` | Draft | non-mergeable |
| #206 | docs(audit): execution report run 22 — 23 novembre | `6a8e2efe` | Draft | mergeable |
| #207 | docs(audit): execution report run 23 — 23 novembre | `ea7de5bf` | Draft | mergeable |
| #208 | fix(ux): compact professional workspace domains on mobile | `21a3e371` | Draft | mergeable |
| #209 | ux(settings): group company details in responsive grid | `9888f76f` | Draft | mergeable |
| #210 | fix(currency): enforce company base currency for sales orders | `fa92faec` | Draft | mergeable |
| #211 | ux(settings): organiser les coordonnées entreprise en grille responsive | `4518451d` | Draft | mergeable |
| #212 | docs(audit): rapport d'exécution Run 25 — 23 novembre | `a01f8b87` | Draft | mergeable |
| #213 | docs(audit): rapport d'exécution Run 26 — 23 novembre | `858fd88c` | Draft | mergeable |
| #214 | fix(cash): default new cash registers to company currency | `2349f3ab` | Draft | mergeable |
| #215 | docs(audit): rapport d’exécution Run 27 — 23 novembre | `88f85a19` | Draft | mergeable |
| #216 | fix(payment-links): inherit invoice currency and reject mismatch | `3160e225` | Draft | mergeable |

### Toutes les branches

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

## 4. Migrations / schéma

- `server/config/db.js` : `CURRENT_SCHEMA_VERSION = 23`.
- Migrations SQL dans `server/database/migrations` : 003 à 012 (détails ci-dessous).
- `schema.sql` est la source idempotente de base; migrations appliquées uniquement au démarrage sur base marquée plus ancienne, sous verrou.
- v21 : essais gratuits 15 jours, sans attribution rétroactive.
- v22 : rétention des événements de contrepassation de facture.
- v23 : correspondances comptables par entreprise.
- Migration 012 `comptabilite_correspondances` : table `pro_compta_correspondances`, FK tenant/account, sans modification des écritures validées.
- Aucune migration n'est exécutée pendant ce run.

Migrations présentes : `003_professional_modules.sql`, `004_paiements_comptabilite_achats.sql`, `005_portail_crm_international_ia.sql`, `006_company_groups.sql`, `007_email_outbox.sql`, `008_company_group_email_proof.sql`, `009_team_invitation_email_proof.sql`, `010_saas_subscriptions_simulation.sql`, `011_comptabilite_contrepas_factures.sql`, `012_comptabilite_correspondances.sql`.

Scripts SQL historiques à la racine : `migration_2026_08_30_stabilite.sql`, `migration_2026_11_15_token_version.sql`, `migration_facture_personnalisation.sql`, `migration_index_reset_token.sql`, `migration_scalabilite_30_41.sql`. Ne pas les rejouer sans vérification de leur état d'application.

## 5. Workflows CI

- `.github/workflows/test.yml` : PR vers main et push main; job MySQL/Redis et tests.
- `.github/workflows/package-source-zip.yml` : PR opened/synchronize/reopened; archive source ZIP et vérification ZIP.
- `.github/workflows/lint.yml` : PR avec filtre de chemins; ESLint sur fichiers JS concernés.
- Les résultats ci-dessous sont liés aux SHA exacts.

## 6. PR candidates et résultats exacts

### #215 — Rapport Run 27
Head `88f85a19d21c832916ebf0b069488657141abe96`.
- Tests run **45254762883** : success; 620 tests, 619 pass, 0 fail, 1 skip.
- Restore chiffrée dédié : 1 pass, 0 fail, 0 skip.
- ZIP run **45254762672** : success.
- Draft, non fusionnée.

### #214 — Devise par défaut caisse
Head `2349f3abc9f8fa8304616143dfff9e93299b4fa2`.
- Tests **45250410943** : success; 622 tests, 621 pass, 0 fail, 1 skip.
- ESLint **45250411138** : success.
- ZIP **45250410915** : success.
- 3 commits, 0 behind, Draft. Aucune migration; aucune modification historique.

### #210 — Devise des commandes
Head `fa92faeccf886fa3d67f4c8003fbc7b2f0ccf5ad`.
- Tests **45224583486** : success; 622/621 pass, 0 fail, 1 skip.
- ESLint **45224583453** : success.
- ZIP **45224583450** : success.
- Draft; validation métier/comptable requise.

### #216 — Devise des liens de paiement (nouveau lot)
Head `3160e225053caaaa7491c9106129f2a776e30f54`, branche `fix/payment-link-invoice-currency-20261123-run28`, 2 commits.
- Diff relu : `server/routes/professionnel.js` (+14/−1) et `server/tests/phases-2-4.test.js` (+49).
- Cause : devise FCFA codée en fallback pour un lien de paiement même lorsque la facture est EUR/USD.
- Correction : devise omise hérite de facture; devise non supportée → 400; mismatch → 409 transaction annulée; même devise explicite acceptée.
- Tests ajoutés : facture EUR, lien sans devise, lecture publique EUR; mismatch USD et code ZZZ rejetés sans insertion; EUR explicite accepté.
- CI initiale : Tests run **45264699456** en cours au moment du snapshot; ZIP **45264698546** success; ESLint **45264698495** success.
- PR #216 Draft; aucune migration ni paiement réel. Validation humaine du comportement monétaire requise avant merge.

## 7. Suivi P0–P3

| Priorité | Lot | État / action |
|---|---|---|
| P0 | Main post-merge CI | **Résolu pour ce snapshot** : push run #45221526816 success sur SHA main exact. |
| P0 | Approbation obligatoire et revue | **Bloqué humain** : ruleset 0 approbation requise; demander configuration owner/review avant merge. |
| P0 | Isolation tenant #188/#199/#203 | #188/#199 non mergeable; #203 non mergeable. Synchroniser seulement sur branche dédiée, tests exacts, revue sécurité; pas de merge. |
| P1 | #214 caisse devise | CI verte; Draft; revue humaine. |
| P1 | #210 commandes devise | CI verte; validation métier OHADA nécessaire. |
| P1 | #216 liens paiement devise | CI test en cours; ZIP/ESLint green; revue monétaire humaine. |
| P1 | #142/#145 écritures/migrations | Divergence schema v21/v22 vs v23; validation comptable spécifique et tests upgrade; pas de merge. |
| P2 | #208 navigation mobile, #209/#211 grille paramètres | #209/#211 sont portages proches; comparer et consolider, éviter double merge. |
| P2 | Impression/PDF, accessibilité, responsive | Revue des branches dédiées; ne pas intégrer des branches stale sans portage/test. |
| P3 | Runbooks, documentation, CI maintenance | Traiter après P0/P1, conserver rapports append-only. |

## 8. Revue de diff et risques

- Diff #216 relu sur commits exacts : transaction rollback avant 400/409, comparaison normalisée avec devise facture, liste de devises supportées; aucun insert sur refus.
- Test couvre réponse publique, devise, montant et solde; aucune confirmation ni transaction de paiement.
- Risque résiduel : le cumul des liens de paiement actifs n'est pas vérifié par cette correction (les liens restent des demandes, non des paiements). À examiner séparément si besoin.
- Aucun merge effectué; main reste inchangé.
- Aucun push direct/force-push, branche supprimée, volume/donnée/backup/historique comptable modifié, paiement réel ou déploiement.

## 9. Décision de ce run

Main est stable selon le run de tests post-fusion exact, mais **les merges restent suspendus** tant qu'une revue humaine requise par la politique de projet n'est pas obtenue et que les règles de protection ne rendent pas l'approbation obligatoire. Les lots sûrs continuent sur branches/PR dédiées.


## Addendum — réconciliation après ouverture de PR #217 (23 novembre, 21:05 UTC)

### Inventaire corrigé incluant cette PR
- Branches : **227**, dont `audit/execution-report-20261123-run28` et `fix/payment-link-invoice-currency-20261123-run28`.
- PR : **213** — **64 ouvertes**, **117 merged**, **32 closed sans merge**.
- PR #217 (rapport Run 28) : ouverte en Draft, head initial `f6c1350128e1635deec5f4d2a39fa69a5b3f11db`; cet addendum est un commit de suivi sur la même branche.
- Numéros ouverts corrigés : 99, 102, 110, 114, 115, 118, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 145, 153, 154, 155, 156, 157, 166, 169, 170, 171, 172, 175, 176, 177, 178, 179, 180, 182, 183, 185, 188, 190, 193, 195, 196, 198, 199, 201, 203, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217.

### Revue indépendante des PR sécurité stale — redondance constatée
Relecture des diffs #188, #199, #193 et #203 contre le code de `main` confirme que leurs corrections principales sont déjà présentes sur `main` :
- #188 : joins tenant dans dashboard, factures, factures récurrentes, rapports, route checkout; garde du client lors de génération récurrente; filtres paiements; chemins lint et tests de tenant. Les équivalents ont été vérifiés dans les fichiers actuels.
- #199 : jointures de remboursement par `user_id` entre remboursement, paiement et facture déjà présentes dans `server/routes/professionnel.js`; test de régression cross-tenant déjà dans `server/tests/professional-tenant.test.js`.
- #193/#203 : codes `verification_code` retirés des listes de factures et fiche client sur main; tests couvrent liste, détail authentifié et consultation publique; lint paths déjà inclus.

**Décision :** ne pas porter de doublons et ne pas merger ces branches stale. Les PR restent ouvertes (aucune fermeture autorisée). Si des différences supplémentaires sont proposées ultérieurement, les comparer à main avant toute action.

### CI au moment de cet addendum
- PR #216, head `3160e225053caaaa7491c9106129f2a776e30f54`: Tests Node/MySQL run **45264699456 en cours**; ESLint **45264698495 success**; ZIP **45264698546 success**.
- PR #217 (head initial ci-dessus) : Tests run **45265040281 en cours**; ZIP **45265039871 success**. Après cet addendum, les checks doivent être revalidés sur le nouveau head.
- Main push test run exact : **45221526816 success**, 620 tests, 619 pass, 0 fail, 1 skipped; restore sauvegarde chiffrée dédié 1 pass.


## Addendum — CI #216, échec et correction de fixture (23 novembre)

- Head testé `3160e225053caaaa7491c9106129f2a776e30f54`: Tests Node/MySQL run **45264699456 failure**. Résultat: 621 tests, 619 pass, 1 fail, 1 skip. Le nouveau test « liens de paiement héritent de la devise facture » **a réussi**.
- Échec isolé : test comptable existant de remboursement contre-passé, parce que la suite `phases-2-4` utilisait un compte Free et l'ajout d'une facture a fait dépasser le quota mensuel de 10. Réponse observée : HTTP 403 `QUOTA_DEPASSE`; pas une erreur du correctif paiement.
- Correction test-only sur head `bceecd6b388178116ef78f1492633fa75586ab5f`: la fixture de la suite `phases-2-4` passe en plan Pro afin que cette suite teste les flux comptables et non le quota Free. Aucun code applicatif ni politique de quota ne change.
- CI sur le nouveau head **pas encore observée** au moment de l'addendum; il faut rerun/attendre Tests, ESLint et ZIP sur le SHA exact. PR #216 reste Draft.
- CI #217 report : les runs sur l'ancien head `f6c1350128e1635deec5f4d2a39fa69a5b3f11db` sont en cours; le head du rapport a changé depuis. Les checks exacts du nouveau head doivent être vérifiés après publication.
