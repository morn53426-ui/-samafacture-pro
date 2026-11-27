# Audit et exécution — Run 21 — 23 novembre 2026

> Rapport append-only. Runs 1–20 conservés. Snapshot GitHub pris après #204 et avant la création de cette branche. Les branches sont exhaustives (3 pages; 4e vide). Les PR ouvertes et fermées ont été récupérées via listing paginé.

## 1. Main et fusion #204

- Main avant #204 : `047e7badf4fccd91644af74e0968089b23246c93`.
- PR #204 rapport Run 20 : merged squash; commit main actuel au snapshot `8df0651951884623d4f5d4cd7ebc48b9c26f79e0`.
- [PR #204](https://github.com/morn53426-ui/-samafacture-pro/pull/204) — doc uniquement, un fichier Markdown, 410 additions / 0 deletion; aucun code applicatif, DDL, données, paiement ou déploiement.
- Head PR #204 `78dab3e621bc78b1e96e31c36ec73bde8ae5120b`: Tests #45197214266 success; archive #45197214258 success. Revue documentaire COMMENT #6023628813, aucun thread non résolu.
- Merge squash #204 : `8df0651951884623d4f5d4cd7ebc48b9c26f79e0`.

## 2. CI post-fusion — état non final

- Run Tests automatisés push #45206892048 : https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45206892048
- SHA exact `8df0651951884623d4f5d4cd7ebc48b9c26f79e0`.
- Snapshot à la rédaction : **in_progress**, job Tests Node.js/MySQL; étape Initialize containers en cours, autres étapes pending.
- Aucun résultat final green revendiqué sur ce SHA.
- **Stop fusions** jusqu'à conclusion de ce run; si failure, diagnostiquer avant tout autre lot.

## 3. Inventaire branches

- 213 branches (100 + 100 + 13, 4e page vide). Aucune supprimée.
| Branche |
|---|
| `a11y/dashboard-skip-link-main-current-run13` |
| `a11y/dashboard-skip-navigation-20261122` |
| `a11y/mobile-sidebar-escape-focus-20261122` |
| `a11y/sidebar-escape-main-current-run15` |
| `audit/execution-report-20261122-run1` |
| `audit/execution-report-20261122-run2` |
| `audit/execution-report-20261123-run11` |
| `audit/execution-report-20261123-run12` |
| `audit/execution-report-20261123-run13` |
| `audit/execution-report-20261123-run14` |
| `audit/execution-report-20261123-run15` |
| `audit/execution-report-20261123-run20` |
| `audit/execution-report-20261123-run3` |
| `audit/execution-report-20261123-run4` |
| `audit/execution-report-20261123-run5` |
| `audit/execution-report-20261123-run6` |
| `audit/fix-backup-and-runtime-20261110` |
| `audit/fix-enterprise-migration-invitation-20261116` |
| `audit/fix-nginx-upstream-order-20261116` |
| `audit/fix-realtime-company-groups-20261116-run1` |
| `audit/fix-reset-email-docs-and-redaction-test-20261116` |
| `audit/initial-review-20261122` |
| `audit/invoice-pdf-typography-print-20261118` |
| `audit/npm-audit-gate-2026-11-16` |
| `audit/rapport-approfondi-2026-11-16-run2` |
| `audit/securite-2026-11-15` |
| `audit/security-multisocietes-review-20261116-run3` |
| `audit/ui-runtime-pages-polish-20261113` |
| `audit/visual-viewport-offset-regression-20261116` |
| `automation/audit-fixes-20261116-0150` |
| `automation/visual-viewport-notifications-20261116-0243` |
| `brand/sunupilot-identity-foundation` |
| `chore/emil-design-skills-20261117` |
| `ci/lint-history-protection-backend-20261122` |
| `ci/package-main-after-pr39-pr40` |
| `ci/real-restore-smoke-20261117` |
| `ci/workspace-ui-structure-tests-20261122` |
| `docs/backup-offsite-pinned-rclone-20261122` |
| `docs/business-plan-samafacture-pro` |
| `docs/correct-one-time-plan-billing-2026-11-16` |
| `docs/fix-staging-compose-runbook-20261116` |
| `docs/improvement-plan-20261121` |
| `docs/improvement-plan-main-20261122` |
| `docs/local-docker-bootstrap-20261117` |
| `docs/production-env-security-guidance-20261122` |
| `docs/subscription-monthly-architecture-20261117` |
| `docs/subscriptions-current-state-20261117` |
| `docs/ui-polish-plans-20261117` |
| `feat/15-day-trial-entitlements-20261121` |
| `feat/5-nouveaux-modeles-facture` |
| `feat/abonnement-choix-moyen-paiement` |
| `feat/accounting-expense-payment-mode-20261121` |
| `feat/dashboard-reference-layout` |
| `feat/dashboard-reference-modules-20261119` |
| `feat/dashboard-reference-redesign-20261112` |
| `feat/enterprise-command-center-20261117` |
| `feat/enterprise-company-pagination-20261117` |
| `feat/enterprise-multi-company-foundation-20261116` |
| `feat/enterprise-page-structure-2026-11-13` |
| `feat/enterprise-page-structure-v2-2026-11-13` |
| `feat/enterprise-pages-v2-2026-11-13` |
| `feat/enterprise-workspace-ux-20261117` |
| `feat/invoice-stock-warehouse-20261119` |
| `feat/invoice-template-gallery-2026-11-15` |
| `feat/invoice-template-gallery-2026-11-15-v2` |
| `feat/invoice-templates-pro-enterprise-20261117` |
| `feat/invoice-warehouse-stock-20261119` |
| `feat/invoice-warehouse-stock-main-20261119` |
| `feat/mobile-config-preflight` |
| `feat/monthly-invoice-quota-v8-2026-11-15` |
| `feat/ohada-account-mappings-20261122` |
| `feat/phases-2-4-paiements-compta-achats-20261112` |
| `feat/phases-5-7-portal-international-automation-20261112` |
| `feat/professional-subscription-page-2026-11-15` |
| `feat/responsive-scaling-2026-11-15` |
| `feat/sidebar-icon-label-navigation-20261117` |
| `feat/sidebar-navigation-visual-refresh-20261117` |
| `feat/subscription-engine-local-simulation-20261117` |
| `feat/sunupilot-dashboard-reference` |
| `feat/templates-factures-devis-complets` |
| `feat/topbar-notifications-bell-20261112` |
| `feat/ui-motion-visual-recette-20261112` |
| `feat/workspace-settings-navigation-20261121` |
| `feature/ohada-expense-account-mappings-20261122` |
| `feature/video-presentation-spark-sunupilot` |
| `fix/a11y-settings-labels-20261116` |
| `fix/accessibility-contrast-focus-main-20261121` |
| `fix/accessibility-template-preview-contrast-20261122` |
| `fix/accounting-event-audit-retention-v22-20261122` |
| `fix/accounting-event-audit-retention-v22-run2-20261122` |
| `fix/accounting-invoice-cancellation-reversal-20261121` |
| `fix/accounting-refund-journal-reversal-20261121` |
| `fix/atomic-backup-publish-2026-11-15` |
| `fix/atomic-encrypted-backups-2026-11-15` |
| `fix/audit-devise-relances-escape` |
| `fix/backup-directory-permissions-20261122` |
| `fix/backup-retention-guard-2026-11-16` |
| `fix/ci-serial-tests-2026-11-15` |
| `fix/client-delete-history-protection-20261122` |
| `fix/dashboard-donut-count-20261118` |
| `fix/docker-context-secrets-and-lockfile-2026-11-15` |
| `fix/docker-local-startup-mysql-redis-swagger` |
| `fix/enterprise-badge-contrast-current-main-run19-20261123` |
| `fix/enterprise-badge-contrast-main-20261122` |
| `fix/enterprise-invitation-email-proof-20261116` |
| `fix/expense-ledger-protection-20261122` |
| `fix/invoice-delete-history-guard-20261122` |
| `fix/invoice-footer-stamp-mobile-20261121` |
| `fix/invoice-mobile-table-cards-20261121` |
| `fix/invoice-pdf-continuation-identity-20261121` |
| `fix/invoice-print-and-payment-stamp-2026-11-15` |
| `fix/invoice-print-banner-geometry-20261121` |
| `fix/invoice-print-banner-spacing-20261122` |
| `fix/invoice-print-typography-20261118` |
| `fix/invoice-settlement-integrity-2026-11-15` |
| `fix/invoice-stock-principal-warehouse` |
| `fix/light-dark-theme-consistency-20261118` |
| `fix/mobile-invoice-line-columns` |
| `fix/mobile-nonpublic-hostnames-20261123` |
| `fix/mobile-nonpublic-hostnames-current-main-20261123` |
| `fix/mobile-preflight-current-main-20261123` |
| `fix/mobile-preflight-main-20261123` |
| `fix/mobile-preflight-main-after-security-20261123` |
| `fix/monthly-invoice-quota-schema-v8-2026-11-15` |
| `fix/mysql-backup-limited-privileges-20261122` |
| `fix/navigation-compact-sidebar-2026-11-13` |
| `fix/pdf-headless-user-formatting-20261121` |
| `fix/pdf-pagination-extras-flow-20261117` |
| `fix/pdf-print-pagination-20261117` |
| `fix/pdf-stream-ack-payment-disclosures-20261116` |
| `fix/pdf-worker-db-readiness-2026-11-16` |
| `fix/pdf-worker-health-and-sidebar-icons-2026-11-15` |
| `fix/pdf-worker-wait-for-api-health-2026-11-15` |
| `fix/pro-orders-tenant-currency-20261123` |
| `fix/pro-orders-tenant-currency-main-20261123` |
| `fix/pro-workspace-status-contrast-20261122` |
| `fix/product-delete-stock-history-protection-20261122` |
| `fix/purchase-receipt-warehouse-deadlock-20261119` |
| `fix/quota-registry-initialization-robustness-2026-11-15` |
| `fix/quote-executive-a4-pagination-20261121` |
| `fix/quote-warehouse-resilience-20261120` |
| `fix/refund-payment-method-mapping-20261122` |
| `fix/refund-payment-method-mapping-rebased-20261122` |
| `fix/revoke-jwt-on-logout-2026-11-15` |
| `fix/session-revocation-and-payment-timeouts-2026-11-15` |
| `fix/sidebar-aria-current-2026-11-15` |
| `fix/subscription-disabled-state-tests-docs-20261117` |
| `fix/subscription-icons-main-2026-11-15` |
| `fix/sunupilot-pwa-lifecycle` |
| `fix/team-invitation-email-proof-20261117` |
| `fix/tenant-currency-atomic-current-main-20261123` |
| `fix/tenant-currency-atomic-latest-main-20261123` |
| `fix/tenant-currency-atomic-lock-20261123` |
| `fix/tenant-currency-atomic-lock-main-20261123` |
| `fix/tenant-currency-atomic-main-20261123` |
| `fix/tenant-currency-final-main-20261123` |
| `fix/ui-icons-legibility-2026-11-15` |
| `fix/ui-responsive-polish-20261117` |
| `fix/visual-qr-fixture-20261121` |
| `fix/webhook-local-timezone-dynamic-currency-20261123` |
| `fix/whatsapp-country-guard-2026-11-16` |
| `improve/pdf-page3-balance-20261121` |
| `improve/pdf-page3-balance-main-20261121` |
| `integration/main-company-invitation-email-proof-20261117` |
| `integration/reconcile-main-v21-20261122` |
| `integration/schema-v21-accounting-trial-20261122` |
| `integration/schema-v22-main-reconciled-20261122` |
| `integration/sunupilot-video-main-20261121` |
| `main` |
| `qa/test-pdf-24-modeles` |
| `rebase/pr106-main-20261121-run1` |
| `rebase/pr110-main-20261121-run1` |
| `rebrand/optigest` |
| `reconciliation/schema-v21-main-base-20261122` |
| `security/docker-ignore-local-secrets-2026-11-15` |
| `security/immediate-session-revocation-2026-11-16` |
| `security/invoice-client-tenant-current-main-after-181-20261123` |
| `security/invoice-client-tenant-scope-20261123` |
| `security/invoice-client-tenant-scope-current-main-20261123` |
| `security/invoice-list-verification-code-redaction-20261122` |
| `security/invoice-tenant-scope-final-main-20261123` |
| `security/invoice-verification-code-redaction-main-20261123-run7` |
| `security/redact-secret-urls-in-logs-2026-11-16` |
| `security/redact-verification-codes-current-main-run19-20261123` |
| `security/redact-verification-codes-main-current-20261123-run12` |
| `security/refund-statement-tenant-join-20261123-run14` |
| `security/reset-token-hash-redaction-main-current-20261123` |
| `security/tenant-relations-main-current-20261123-run12` |
| `test/accessibility-audit-business-pages-20261118` |
| `test/accessibility-dark-keyboard-20261118` |
| `test/accessibility-dark-keyboard-rebased-20261120` |
| `test/backup-atomic-visibility-2026-11-15` |
| `test/dark-theme-zoom-200-sweep-20261118` |
| `test/expense-accounting-mappings-regression-20261122` |
| `test/free-trial-expiry-session-guard-20261122` |
| `test/invoice-long-pdf-pagination-20261121` |
| `test/invoice-short-pdf-one-page-20261121` |
| `test/invoice-short-pdf-one-page-main-20261121` |
| `test/ohada-expense-ledger-integrity-20261121` |
| `test/pdf-font-embedding-and-visual-print-20261118` |
| `test/security-auth-reset-token-redaction-20261122` |
| `test/team-invitation-expiry-email-change-20261122` |
| `test/theme-dark-mobile-sweep-20261118` |
| `test/theme-dark-sweep-20261118` |
| `test/theme-light-desktop-sweep-20261118` |
| `test/theme-light-mobile-sweep-20261118` |
| `test/workspace-zoom-200-sweep-20261118` |
| `tooling/local-docker-test-bundle-20261112` |
| `ui/augmenter-logo-icones-sidebar` |
| `ui/modern-responsive-polish` |
| `ux/dashboard-mobile-module-rail-20261122` |
| `ux/pro-workspace-mobile-domain-rail-20261122` |
| `ux/settings-company-fields-grid-20261122` |

## 4. Inventaire PR

- 54 ouvertes; 146 fermées; 114 merged; 32 closed unmerged; total 200.
- Head/base SHA et nombre de commits sont consignés par ligne.

### PR ouvertes
| PR | Titre | Branche | Head SHA | Base SHA | État / mergeable | Commits |
|---|---|---|---|---|---|
| [#203](https://github.com/morn53426-ui/-samafacture-pro/pull/203) | security(invoices): redact verification codes from list responses | `security/redact-verification-codes-current-main-run19-20261123` | `2059e3744ce88eface5c00e52c459c7e6edc5235` | `f8a61187e8b8df7dc319d611dd58fb02dd0aa336` | Draft; mergeable | 6 |
| [#201](https://github.com/morn53426-ui/-samafacture-pro/pull/201) | docs(audit): rapport d'exécution runs 15–17 — 23 novembre | `audit/execution-report-20261123-run15` | `63493905494fc1e1a54d9e277c03aba34c1e2b31` | `f8a61187e8b8df7dc319d611dd58fb02dd0aa336` | Draft; mergeable | 11 |
| [#199](https://github.com/morn53426-ui/-samafacture-pro/pull/199) | fix(security): scope client statement refunds to tenant payment | `security/refund-statement-tenant-join-20261123-run14` | `b212dbc0bac111c77023c1ad42c58514786aeaca` | `b0b52e660af61fa781dc9a761165dd72977f969a` | Draft; mergeable | 3 |
| [#198](https://github.com/morn53426-ui/-samafacture-pro/pull/198) | docs(audit): execution report run 14 — 23 November | `audit/execution-report-20261123-run14` | `e6cc9a40ab92f0eaf9fa9f5c1aa02150d449fb62` | `b0b52e660af61fa781dc9a761165dd72977f969a` | Draft; mergeable | 5 |
| [#196](https://github.com/morn53426-ui/-samafacture-pro/pull/196) | docs(audit): execution report run 13 — 23 November | `audit/execution-report-20261123-run13` | `539a9430c78f83908ce7b404d98804309b19d578` | `b0b52e660af61fa781dc9a761165dd72977f969a` | Draft; mergeable | 2 |
| [#195](https://github.com/morn53426-ui/-samafacture-pro/pull/195) | docs(audit): execution report run 12 — 23 November | `audit/execution-report-20261123-run12` | `b54c4b9fa1334b00663beb2ee26762a7f58e2853` | `b0b52e660af61fa781dc9a761165dd72977f969a` | Draft; mergeable | 3 |
| [#194](https://github.com/morn53426-ui/-samafacture-pro/pull/194) | security(tenant): harden invoice, client and payment isolation | `security/tenant-relations-main-current-20261123-run12` | `900163220356db9c443e11e5f6208760d49a62f2` | `c0a3b569e3e685183376be8428c4696d8c767ccd` | Draft; mergeable | 20 |
| [#193](https://github.com/morn53426-ui/-samafacture-pro/pull/193) | security(invoices): redact verification codes from list responses | `security/redact-verification-codes-main-current-20261123-run12` | `fb6324d34b024072f98d7c1347a0da330922aba4` | `b0b52e660af61fa781dc9a761165dd72977f969a` | Draft; mergeable | 5 |
| [#192](https://github.com/morn53426-ui/-samafacture-pro/pull/192) | fix(currency): serialize tenant currency and first business writes | `fix/tenant-currency-final-main-20261123` | `8a11e00bb976979403e9d3fcfa8e767a074b5423` | `b0b52e660af61fa781dc9a761165dd72977f969a` | Draft; mergeable | 11 |
| [#190](https://github.com/morn53426-ui/-samafacture-pro/pull/190) | fix(currency): serialize tenant currency and first business writes | `fix/tenant-currency-atomic-current-main-20261123` | `0abc0440d11b67ad513bc1e2793d7bb558d37229` | `b276eba52b5179f351efe68d18cf540a170c70fd` | Draft; mergeable | 15 |
| [#188](https://github.com/morn53426-ui/-samafacture-pro/pull/188) | security(tenant): enforce ownership across invoice-related records | `security/invoice-client-tenant-current-main-after-181-20261123` | `39f27a324412cefae046181e22430ba79f24b5c5` | `b276eba52b5179f351efe68d18cf540a170c70fd` | Draft; blocked | 10 |
| [#185](https://github.com/morn53426-ui/-samafacture-pro/pull/185) | fix(currency): serialize tenant currency changes and first business writes | `fix/tenant-currency-atomic-main-20261123` | `50b9fcc21b6655347d4feac1eb319dad38982996` | `13111355a0d2bc71ee0f3a01b504179b2d136926` | Draft; mergeable | 13 |
| [#183](https://github.com/morn53426-ui/-samafacture-pro/pull/183) | fix(currency): serialize tenant currency changes and orders | `fix/tenant-currency-atomic-lock-main-20261123` | `4a73d68d91ff3d7360e868d034bc6a1d8816966f` | `1c51012381bc2142a3df22b16fd38d03e788cbbc` | Draft; blocked | 14 |
| [#182](https://github.com/morn53426-ui/-samafacture-pro/pull/182) | fix(pro): use tenant currency for orders and lock history | `fix/pro-orders-tenant-currency-main-20261123` | `a078a351d714fa05e4ecf5901040135e06dc6383` | `13111355a0d2bc71ee0f3a01b504179b2d136926` | Draft; mergeable | 10 |
| [#180](https://github.com/morn53426-ui/-samafacture-pro/pull/180) | docs(audit): execution report run 11 — 23 November | `audit/execution-report-20261123-run11` | `2f1b11e77d5120fc14f4124460c4dda632e1850e` | `b43a94fc2937b0108077501a0260358c8569e11f` | Draft; mergeable | 3 |
| [#179](https://github.com/morn53426-ui/-samafacture-pro/pull/179) | security(invoices): enforce client and payment tenant ownership | `security/invoice-client-tenant-scope-20261123` | `5f554950cba1c4f0ea5dc6383b4f4588f7b61c64` | `b43a94fc2937b0108077501a0260358c8569e11f` | Draft; blocked | 23 |
| [#178](https://github.com/morn53426-ui/-samafacture-pro/pull/178) | fix(currency): serialize tenant currency changes and orders | `fix/tenant-currency-atomic-lock-20261123` | `70b4c68858997f8fcfa61dd40fb415a31b9b3f22` | `953489e79a9a6779b03e9c436559b925904f5635` | Draft; mergeable | 27 |
| [#177](https://github.com/morn53426-ui/-samafacture-pro/pull/177) | security(invoices): redact verification code from list API | `security/invoice-verification-code-redaction-main-20261123-run7` | `f68ab94eb1d4c2c01d08331321cda293ab0a264f` | `b43a94fc2937b0108077501a0260358c8569e11f` | Draft; mergeable | 6 |
| [#176](https://github.com/morn53426-ui/-samafacture-pro/pull/176) | docs(audit): rapports d'exécution runs 6 à 10 — 23 novembre | `audit/execution-report-20261123-run6` | `8083f938c80ccba4ff499cdf3a6bddef95f29f3f` | `b43a94fc2937b0108077501a0260358c8569e11f` | Draft; mergeable | 8 |
| [#175](https://github.com/morn53426-ui/-samafacture-pro/pull/175) | docs(audit): rapport d'exécution run 5 — 23 novembre | `audit/execution-report-20261123-run5` | `f9f95b734deb3fe9ecacfbb257686085b3fa53a6` | `b43a94fc2937b0108077501a0260358c8569e11f` | Draft; mergeable | 1 |
| [#172](https://github.com/morn53426-ui/-samafacture-pro/pull/172) | docs(audit): rapport d'exécution run 4 — 23 novembre | `audit/execution-report-20261123-run4` | `14688f7a8fd8fe5d9b3cdde50bb546ac7485f30e` | `b43a94fc2937b0108077501a0260358c8569e11f` | Draft; mergeable | 2 |
| [#171](https://github.com/morn53426-ui/-samafacture-pro/pull/171) | fix(pro): use tenant currency for orders and lock history | `fix/pro-orders-tenant-currency-20261123` | `953489e79a9a6779b03e9c436559b925904f5635` | `13111355a0d2bc71ee0f3a01b504179b2d136926` | Draft; blocked | 63 |
| [#170](https://github.com/morn53426-ui/-samafacture-pro/pull/170) | docs(audit): rapport d'exécution run 3 — 23 novembre | `audit/execution-report-20261123-run3` | `6fa59a42ebb12bb9d6f8a266059125b81991ff95` | `b43a94fc2937b0108077501a0260358c8569e11f` | Draft; mergeable | 5 |
| [#169](https://github.com/morn53426-ui/-samafacture-pro/pull/169) | docs(audit): rapport d'exécution run 2 — 22 novembre | `audit/execution-report-20261122-run2` | `dff61fb42a429fce93ed1fc6f0a3c9f355ced6f4` | `b43a94fc2937b0108077501a0260358c8569e11f` | Draft; mergeable | 2 |
| [#166](https://github.com/morn53426-ui/-samafacture-pro/pull/166) | docs(audit): rapport d'exécution initial du 22 novembre | `audit/execution-report-20261122-run1` | `dc7e6f55c5f7d357400f78c26dcfa469b75c3cef` | `b43a94fc2937b0108077501a0260358c8569e11f` | Draft; mergeable | 1 |
| [#157](https://github.com/morn53426-ui/-samafacture-pro/pull/157) | a11y(navigation): fermer le menu mobile avec Échap | `a11y/mobile-sidebar-escape-focus-20261122` | `c37403034a25bad6d4ecd0867066ce8c258bdd9c` | `00d52ca8acdced3d81d39bf592a916d6729c4e98` | Ready; blocked | 16 |
| [#156](https://github.com/morn53426-ui/-samafacture-pro/pull/156) | a11y(dashboard): ajouter un accès clavier au contenu principal | `a11y/dashboard-skip-navigation-20261122` | `8f45795c3df521ffb021947d5376bfaa22a832ca` | `8d0f287f46a96cb0697d7a0be9f6fe055b6e5a51` | Ready; blocked | 9 |
| [#155](https://github.com/morn53426-ui/-samafacture-pro/pull/155) | ux(settings): grille responsive pour les coordonnées entreprise | `ux/settings-company-fields-grid-20261122` | `99670cdf29694c73e0a09038380af250704e89c3` | `00d52ca8acdced3d81d39bf592a916d6729c4e98` | Ready; blocked | 15 |
| [#154](https://github.com/morn53426-ui/-samafacture-pro/pull/154) | ux(workspace): navigation mobile compacte par domaine | `ux/pro-workspace-mobile-domain-rail-20261122` | `185e0487c95489b8748c1d33418317c5aaf77eb7` | `8d0f287f46a96cb0697d7a0be9f6fe055b6e5a51` | Ready; mergeable | 9 |
| [#153](https://github.com/morn53426-ui/-samafacture-pro/pull/153) | test(trial): vérifier l'expiration sur la première requête protégée | `test/free-trial-expiry-session-guard-20261122` | `29932fbbefe39bad5bb5c3a187a6ade99cafafd3` | `00d52ca8acdced3d81d39bf592a916d6729c4e98` | Ready; blocked | 16 |
| [#145](https://github.com/morn53426-ui/-samafacture-pro/pull/145) | fix(accounting): retain invoice reversal events (schema v22) | `fix/accounting-event-audit-retention-v22-run2-20261122` | `5b6ba8bf3b05e4155697159c60cf4b5051196bf8` | `decb8da2e48e8f7a93fc63202f00fe0b4170e6e2` | Draft; mergeable | 15 |
| [#142](https://github.com/morn53426-ui/-samafacture-pro/pull/142) | feat(accounting, trial): integrate invoice lifecycle and 15-day trial on schema v21 | `integration/schema-v21-accounting-trial-20261122` | `decb8da2e48e8f7a93fc63202f00fe0b4170e6e2` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft; blocked | 77 |
| [#141](https://github.com/morn53426-ui/-samafacture-pro/pull/141) | ci: add workspace UI structure regression checks | `ci/workspace-ui-structure-tests-20261122` | `2a09ccf8bfdb3b26b84482b7445902f266fb1dbf` | `868027e1edc8c0e7ad1d5f25e78d90d24b50c5f4` | Draft; mergeable | 3 |
| [#140](https://github.com/morn53426-ui/-samafacture-pro/pull/140) | ci(lint): couvrir les routes backend et tests de protection | `ci/lint-history-protection-backend-20261122` | `32d1c1f56cb9c2b46890aae5b0b72136b13660a8` | `00d52ca8acdced3d81d39bf592a916d6729c4e98` | Draft; blocked | 5 |
| [#139](https://github.com/morn53426-ui/-samafacture-pro/pull/139) | fix(a11y): improve professional workspace status contrast | `fix/pro-workspace-status-contrast-20261122` | `baa9ea6a688121c580b9f95c1933a2a15663f07f` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft; blocked | 1 |
| [#138](https://github.com/morn53426-ui/-samafacture-pro/pull/138) | fix(inventory): protect products with stock or history | `fix/product-delete-stock-history-protection-20261122` | `27d5a6c27d5d3066c1f6aaa04e03945caa165974` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft; blocked | 15 |
| [#137](https://github.com/morn53426-ui/-samafacture-pro/pull/137) | fix(accounting): protect clients with linked history | `fix/client-delete-history-protection-20261122` | `f2aada8d5c016998591fc0b31771de11c3b8ed50` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft; blocked | 10 |
| [#136](https://github.com/morn53426-ui/-samafacture-pro/pull/136) | fix(accounting): protect posted expenses from edits and deletion | `fix/expense-ledger-protection-20261122` | `4e0f2a893812df88a2dd4a9bed2c26224ea9f656` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft; blocked | 5 |
| [#135](https://github.com/morn53426-ui/-samafacture-pro/pull/135) | fix(accounting): preserve issued invoice history | `fix/invoice-delete-history-guard-20261122` | `2c7f3cbde915e19ea484236c7a76ad7008f485ae` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft; blocked | 11 |
| [#134](https://github.com/morn53426-ui/-samafacture-pro/pull/134) | fix(a11y): badge Entreprise lisible en thème sombre | `fix/enterprise-badge-contrast-main-20261122` | `52021018d7894b637d311af7d036cea220248195` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft; blocked | 3 |
| [#133](https://github.com/morn53426-ui/-samafacture-pro/pull/133) | fix(a11y): corriger le contraste des aperçus de modèles | `fix/accessibility-template-preview-contrast-20261122` | `6b3cd9ffd5446b13e71ca9108c61ade2fde4af5e` | `c607f397c4db35ff12e356ec15ed0919553b748e` | Draft; blocked | 1 |
| [#132](https://github.com/morn53426-ui/-samafacture-pro/pull/132) | docs(audit): état initial et plan priorisé 22 novembre | `audit/initial-review-20261122` | `6543b3a701753341dae348032f9d08f003e2d796` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft; mergeable | 84 |
| [#131](https://github.com/morn53426-ui/-samafacture-pro/pull/131) | docs: actualiser la feuille de route sur le main courant | `docs/improvement-plan-main-20261122` | `3d51f0afb669ebdddc18c2601cd123d89c206683` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft; mergeable | 4 |
| [#130](https://github.com/morn53426-ui/-samafacture-pro/pull/130) | fix(a11y): contraste WCAG AA et focus clavier sur les deux thèmes | `fix/accessibility-contrast-focus-main-20261121` | `0b819127cc8bdbf8410611642d51b257431e84a6` | `00d52ca8acdced3d81d39bf592a916d6729c4e98` | Draft; blocked | 21 |
| [#129](https://github.com/morn53426-ui/-samafacture-pro/pull/129) | feat(workspace): navigation par domaines et paramètres structurés | `feat/workspace-settings-navigation-20261121` | `868027e1edc8c0e7ad1d5f25e78d90d24b50c5f4` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft; blocked | 9 |
| [#128](https://github.com/morn53426-ui/-samafacture-pro/pull/128) | feat(trial,workspace): essai 15 jours et organisation professionnelle | `feat/15-day-trial-entitlements-20261121` | `e3b91dc4ae459fc4fdd65b63dd440f632ccd4217` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Ready; blocked | 39 |
| [#127](https://github.com/morn53426-ui/-samafacture-pro/pull/127) | fix(pdf): pagination A4 du devis Executive (28 lignes) | `fix/quote-executive-a4-pagination-20261121` | `400ce60ddb8f23e4f37fe836058f180682c2f0c7` | `00d52ca8acdced3d81d39bf592a916d6729c4e98` | Ready; mergeable | 6 |
| [#126](https://github.com/morn53426-ui/-samafacture-pro/pull/126) | feat(landing): présentation vidéo Sunupilot — portage sur main actuel | `integration/sunupilot-video-main-20261121` | `817b10da7b85ce9ca3eb0d4a8312f258349b5647` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft; blocked | 30 |
| [#118](https://github.com/morn53426-ui/-samafacture-pro/pull/118) | feat(landing): vidéo Sunupilot — capture locale automatisée des écrans | `feature/video-presentation-spark-sunupilot` | `29dd7ccc8084ce91f9c7eee975610fdd039a67f4` | `f49d352125352d009da9abebd2ceecbb122c6d6b` | Ready; blocked | 42 |
| [#115](https://github.com/morn53426-ui/-samafacture-pro/pull/115) | test(accounting): cover expense posting and tenant isolation | `test/ohada-expense-ledger-integrity-20261121` | `3873c1d1dbaa114af2aec991b1f49e48702f82a1` | `f49d352125352d009da9abebd2ceecbb122c6d6b` | Ready; blocked | 1 |
| [#114](https://github.com/morn53426-ui/-samafacture-pro/pull/114) | docs: centralize SamaFacture Pro improvement roadmap | `docs/improvement-plan-20261121` | `ff2cae7bd378680ec20a9998851665a166c539c8` | `5478809ee73e25f381503a20712893e6cc6c8a2b` | Ready; mergeable | 4 |
| [#110](https://github.com/morn53426-ui/-samafacture-pro/pull/110) | test(accessibility): cover light/dark keyboard navigation and contrast | `test/accessibility-dark-keyboard-rebased-20261120` | `722b5bfce06704a645dbe27b1516333e980dd920` | `f42f69e184f92bec26d76442a1249593b64f795f` | Ready; blocked | 15 |
| [#102](https://github.com/morn53426-ui/-samafacture-pro/pull/102) | test(accessibility): couvrir le thème sombre et le parcours clavier | `test/accessibility-dark-keyboard-20261118` | `86aeeb6f4be28ad4d76622e3a26ac0304326dc73` | `b5863a0d346d42c7cecb2618d7cb87028bd3e8b0` | Draft; blocked | 13 |
| [#99](https://github.com/morn53426-ui/-samafacture-pro/pull/99) | Adopt SunuPilot branding — indigo and baobab green | `rebrand/optigest` | `3f70466d0b6bc1ab41f082e31324d5702bd39966` | `b5863a0d346d42c7cecb2618d7cb87028bd3e8b0` | Ready; blocked | 21 |

### PR fermées
| PR | Titre | Branche | Head SHA | Base SHA | Résultat | Commits |
|---|---|---|---|---|---|---|
| [#204](https://github.com/morn53426-ui/-samafacture-pro/pull/204) | docs(audit): rapport d'exécution run 20 — 23 novembre | `audit/execution-report-20261123-run20` | `78dab3e621bc78b1e96e31c36ec73bde8ae5120b` | `047e7badf4fccd91644af74e0968089b23246c93` | Merged | 2 |
| [#202](https://github.com/morn53426-ui/-samafacture-pro/pull/202) | fix(a11y): badge Entreprise lisible en thème sombre | `fix/enterprise-badge-contrast-current-main-run19-20261123` | `268ccf303e4332f47e73910043f601e4083b97e0` | `f8a61187e8b8df7dc319d611dd58fb02dd0aa336` | Merged | 4 |
| [#200](https://github.com/morn53426-ui/-samafacture-pro/pull/200) | a11y(navigation): close mobile sidebar with Escape on current main | `a11y/sidebar-escape-main-current-run15` | `69180203cc2c694c3de029873b360d43d0b487ca` | `b0b52e660af61fa781dc9a761165dd72977f969a` | Merged | 5 |
| [#197](https://github.com/morn53426-ui/-samafacture-pro/pull/197) | a11y(dashboard): keyboard skip link on current main | `a11y/dashboard-skip-link-main-current-run13` | `c2ba2ffb156d1aac7a418cba9e6cce73b362a86a` | `c0a3b569e3e685183376be8428c4696d8c767ccd` | Merged | 6 |
| [#191](https://github.com/morn53426-ui/-samafacture-pro/pull/191) | fix(currency): serialize tenant currency and first business writes | `fix/tenant-currency-atomic-latest-main-20261123` | `198480fe89ddaf8bba3216d9a14fe6fec06bae21` | `b276eba52b5179f351efe68d18cf540a170c70fd` | Closed unmerged | 11 |
| [#189](https://github.com/morn53426-ui/-samafacture-pro/pull/189) | fix(mobile): validate Capacitor public HTTPS before native builds | `fix/mobile-preflight-current-main-20261123` | `f9bb3b9b63313663883a27bf35629ce0e6a2a7cd` | `b276eba52b5179f351efe68d18cf540a170c70fd` | Closed unmerged | 5 |
| [#187](https://github.com/morn53426-ui/-samafacture-pro/pull/187) | fix(mobile): guard Capacitor native builds on latest main | `fix/mobile-preflight-main-after-security-20261123` | `6fc60bdca4a311822a0333f83a02000c495f4d36` | `b276eba52b5179f351efe68d18cf540a170c70fd` | Merged | 5 |
| [#186](https://github.com/morn53426-ui/-samafacture-pro/pull/186) | fix(mobile): block native builds until public HTTPS config is valid | `fix/mobile-preflight-main-20261123` | `8971961468b831e25e1751d2619ec3b7ed8094e0` | `13111355a0d2bc71ee0f3a01b504179b2d136926` | Closed unmerged | 5 |
| [#184](https://github.com/morn53426-ui/-samafacture-pro/pull/184) | fix(mobile): validate Capacitor config before native build | `fix/mobile-nonpublic-hostnames-current-main-20261123` | `c0bc6a6531e5ad76804878d98059f1e64acc1df9` | `13111355a0d2bc71ee0f3a01b504179b2d136926` | Closed unmerged | 5 |
| [#181](https://github.com/morn53426-ui/-samafacture-pro/pull/181) | test(security): cover reset token redaction on current main | `security/reset-token-hash-redaction-main-current-20261123` | `262707e11d6f362820bf07018647df4312791444` | `13111355a0d2bc71ee0f3a01b504179b2d136926` | Merged | 2 |
| [#174](https://github.com/morn53426-ui/-samafacture-pro/pull/174) | fix(mobile): reject reserved non-public hostnames | `fix/mobile-nonpublic-hostnames-20261123` | `27fa8c2ec2e2e87b5f6b58a98b07052f5a5bce75` | `b43a94fc2937b0108077501a0260358c8569e11f` | Closed unmerged | 11 |
| [#173](https://github.com/morn53426-ui/-samafacture-pro/pull/173) | feat(mobile): block native builds until HTTPS domain is configured | `feat/mobile-config-preflight` | `23c1cf95bf459118324dfece3580ece4470b9b34` | `b43a94fc2937b0108077501a0260358c8569e11f` | Closed unmerged | 7 |
| [#168](https://github.com/morn53426-ui/-samafacture-pro/pull/168) | fix: fuseau local, devise du tenant et isolation des routes | `fix/webhook-local-timezone-dynamic-currency-20261123` | `b07000daa7663196de68a42bc0ba011f4f4cf7f9` | `b43a94fc2937b0108077501a0260358c8569e11f` | Merged | 53 |
| [#167](https://github.com/morn53426-ui/-samafacture-pro/pull/167) | fix: devise des emails, relances impayés et échappement HTML | `fix/audit-devise-relances-escape` | `4e848f3b98b1bc93635f0dab01a7d752fd2b18cd` | `b43a94fc2937b0108077501a0260358c8569e11f` | Merged | 26 |
| [#165](https://github.com/morn53426-ui/-samafacture-pro/pull/165) | docs(backup): sécuriser le transfert hors serveur rclone | `docs/backup-offsite-pinned-rclone-20261122` | `76aa447d8beefa49dc7da11d334144bd2c75427f` | `e6a2caf04f0648d30419042c97cb63b6a14a05f8` | Merged | 5 |
| [#164](https://github.com/morn53426-ui/-samafacture-pro/pull/164) | test(security): empêcher la divulgation des hashes de réinitialisation | `test/security-auth-reset-token-redaction-20261122` | `a10bc748a38b05a80caf21c9f2f16da5e729d2e1` | `8d0f287f46a96cb0697d7a0be9f6fe055b6e5a51` | Closed unmerged | 3 |
| [#163](https://github.com/morn53426-ui/-samafacture-pro/pull/163) | security(backup): restreindre les permissions du dossier de sauvegarde | `fix/backup-directory-permissions-20261122` | `1c3a12bacd9c6a761247756562ea77ebe50ef41d` | `00d52ca8acdced3d81d39bf592a916d6729c4e98` | Merged | 19 |
| [#162](https://github.com/morn53426-ui/-samafacture-pro/pull/162) | test(security): couvrir expiration et changement email des invitations equipe | `test/team-invitation-expiry-email-change-20261122` | `4fa9a6878a9804683581133e63ef8ef19dd28cd7` | `5f1c09d655b340eac687d983e322e740798b7817` | Merged | 9 |
| [#161](https://github.com/morn53426-ui/-samafacture-pro/pull/161) | ux(dashboard): réduire le défilement mobile des modules | `ux/dashboard-mobile-module-rail-20261122` | `53eadfe851b4ee3faf7122d485299025ea300808` | `5f1c09d655b340eac687d983e322e740798b7817` | Merged | 5 |
| [#160](https://github.com/morn53426-ui/-samafacture-pro/pull/160) | fix(backup): compatible avec le compte MySQL limité de Docker | `fix/mysql-backup-limited-privileges-20261122` | `bdca6bec1c5b98747571907dffa91195c15293b7` | `00d52ca8acdced3d81d39bf592a916d6729c4e98` | Merged | 7 |
| [#159](https://github.com/morn53426-ui/-samafacture-pro/pull/159) | security(invoices): retirer le code public de la liste paginée | `security/invoice-list-verification-code-redaction-20261122` | `1c6bf875b98273cac0c00ac5c306aa22dcafb8d3` | `00d52ca8acdced3d81d39bf592a916d6729c4e98` | Closed unmerged | 18 |
| [#158](https://github.com/morn53426-ui/-samafacture-pro/pull/158) | docs(security): corriger les conseils CORS et proxy | `docs/production-env-security-guidance-20261122` | `be0f2789ccebd103c9fbf8da28bd1586eddb1549` | `00d52ca8acdced3d81d39bf592a916d6729c4e98` | Merged | 7 |
| [#152](https://github.com/morn53426-ui/-samafacture-pro/pull/152) | test(accounting): couvrir les correspondances OHADA des dépenses | `test/expense-accounting-mappings-regression-20261122` | `46d95cfd1e0dba639c31661e48f2b27026f6b20f` | `00d52ca8acdced3d81d39bf592a916d6729c4e98` | Merged | 5 |
| [#151](https://github.com/morn53426-ui/-samafacture-pro/pull/151) | fix(print): preserve full-width invoice banners on A4 | `fix/invoice-print-banner-spacing-20261122` | `4eec7b226911cea55d47ecffba9473a5456fa51e` | `e8a030d5a4e2cfbf7015cf8feb147674eaee5768` | Merged | 7 |
| [#150](https://github.com/morn53426-ui/-samafacture-pro/pull/150) | feat(accounting): configure OHADA sales and expense mappings | `feat/ohada-account-mappings-20261122` | `ca3cb8fbf594f41c39cfe5958e3bb04520825864` | `41aea0f68401e4e2d93a23c1494aff5f1a532404` | Merged | 12 |
| [#149](https://github.com/morn53426-ui/-samafacture-pro/pull/149) | feat(accounting): configure expense category account mappings (schema v23) | `feature/ohada-expense-account-mappings-20261122` | `6f82b82dfab5c6d4a8b0fc0a466b331a2ebab3c7` | `41aea0f68401e4e2d93a23c1494aff5f1a532404` | Closed unmerged | 4 |
| [#148](https://github.com/morn53426-ui/-samafacture-pro/pull/148) | reconcile: port trial and accounting protections (schema v22) onto current main | `reconciliation/schema-v21-main-base-20261122` | `d9c428aaa916a54994d4d5064543facf4eead29c` | `f0ae8b08c4e7e35abc333c53a9380deee48fd88b` | Merged | 2 |
| [#147](https://github.com/morn53426-ui/-samafacture-pro/pull/147) | integration: réconcilier comptabilité OHADA et essai gratuit v21 avec main actuel | `integration/reconcile-main-v21-20261122` | `e8b2dc9c6f20ed40d0b49327f276366afe45a8b5` | `f0ae8b08c4e7e35abc333c53a9380deee48fd88b` | Closed unmerged | 78 |
| [#146](https://github.com/morn53426-ui/-samafacture-pro/pull/146) | fix(integration): reconcile OHADA, 15-day trial and audit retention on current main | `integration/schema-v22-main-reconciled-20261122` | `62ea473892b11439074b75ea58e674e2f60e5a81` | `f0ae8b08c4e7e35abc333c53a9380deee48fd88b` | Closed unmerged | 93 |
| [#144](https://github.com/morn53426-ui/-samafacture-pro/pull/144) | fix(accounting): retain invoice reversal events on invoice deletion (schema v22) | `fix/accounting-event-audit-retention-v22-20261122` | `90b718abcbef7cbd01ec39dcf368488d0eafdf65` | `9355eb37493a33ae08e64ef6ce742a12ab6f9dd4` | Closed unmerged | 6 |
| [#143](https://github.com/morn53426-ui/-samafacture-pro/pull/143) | fix(accounting): map cheque payments to bank and reject unknown methods | `fix/refund-payment-method-mapping-rebased-20261122` | `17d25a5e3686f0016e94da9fe354b2f6e23b7afe` | `83dbb6b9e50b9a0e794afb9ad097c2eca0ed113e` | Closed unmerged | 3 |
| [#125](https://github.com/morn53426-ui/-samafacture-pro/pull/125) | fix(pdf): pagination A4 cohérente des factures et devis longs | `improve/pdf-page3-balance-main-20261121` | `3bab7c770052a811b14273b380196c63940fa466` | `00d52ca8acdced3d81d39bf592a916d6729c4e98` | Merged | 44 |
| [#124](https://github.com/morn53426-ui/-samafacture-pro/pull/124) | fix(invoice): afficher les montants des lignes sans scroll mobile | `fix/invoice-mobile-table-cards-20261121` | `67f7721d512370db3b40413a12f212226324ca76` | `2860dc26f7a903511c1463381d32107b612a6280` | Merged | 3 |
| [#123](https://github.com/morn53426-ui/-samafacture-pro/pull/123) | test(pdf): garantir une facture courte sur une page A4 | `test/invoice-short-pdf-one-page-20261121` | `c592c7046f78ebfb127ce5490b4e08d31419d49f` | `95adbf61e05bc88ebc95e470160c898c2736717f` | Merged | 5 |
| [#122](https://github.com/morn53426-ui/-samafacture-pro/pull/122) | test(visual): fournir un QR code aux fixtures mobiles facture/devis | `fix/visual-qr-fixture-20261121` | `df6070e367ae720a789e1c190408819e56db86cd` | `3a75596e8f80f522046d482a4426ae19f653c13d` | Closed unmerged | 1 |
| [#121](https://github.com/morn53426-ui/-samafacture-pro/pull/121) | fix(pdf): préserver le cachet sur les écrans mobiles | `fix/invoice-footer-stamp-mobile-20261121` | `7c562612e897e2ed7af93e494a4cf79bbb8da5e1` | `adb7a71e3891ad8d763a4e8ac31d2e699bd745b6` | Merged | 8 |
| [#120](https://github.com/morn53426-ui/-samafacture-pro/pull/120) | fix(accounting): reverse refund entries in cash and bank journals | `fix/accounting-refund-journal-reversal-20261121` | `b45f479754341f8111e5233a09cec21f76a762da` | `509d0805437332474cb8907d58fff6c6d5407838` | Merged | 6 |
| [#119](https://github.com/morn53426-ui/-samafacture-pro/pull/119) | feat(accounting): distinguish cash and bank expense payments | `feat/accounting-expense-payment-mode-20261121` | `08a1c025744a7af2d795c7a761607ac1bf71b424` | `aaccaac2db6adb1ca22ee33c21ab79101bfcb0a5` | Merged | 24 |
| [#117](https://github.com/morn53426-ui/-samafacture-pro/pull/117) | fix(accounting): reverse invoice entries on cancellation and reactivation | `fix/accounting-invoice-cancellation-reversal-20261121` | `ba756d09888474477a19c182b42c1298ef092dd8` | `f49d352125352d009da9abebd2ceecbb122c6d6b` | Merged | 70 |
| [#116](https://github.com/morn53426-ui/-samafacture-pro/pull/116) | test(pdf): couvrir la pagination des factures longues | `test/invoice-long-pdf-pagination-20261121` | `41fb9896ab4b1393f35082a5fb988e5bc9bceb5d` | `f49d352125352d009da9abebd2ceecbb122c6d6b` | Merged | 7 |
| [#113](https://github.com/morn53426-ui/-samafacture-pro/pull/113) | fix(pdf): preserve company date and number formats in headless PDFs | `fix/pdf-headless-user-formatting-20261121` | `862d31a76342f47c4df9dbe2690dcaf914360921` | `2c44832f0f288a8268dff01b291fe5c41a72d68e` | Closed unmerged | 2 |
| [#112](https://github.com/morn53426-ui/-samafacture-pro/pull/112) | fix(pdf): repeat company and document identity on continuation pages | `fix/invoice-pdf-continuation-identity-20261121` | `885b7b42a7d4dc56ba2c3dc6a69b5b3bcf7a8b1d` | `5478809ee73e25f381503a20712893e6cc6c8a2b` | Merged | 26 |
| [#111](https://github.com/morn53426-ui/-samafacture-pro/pull/111) | fix(invoice): keep print banners inside the A4 printable area | `fix/invoice-print-banner-geometry-20261121` | `0ec7c3eeb59fa70465d4a0037e6c3c2d461bb2df` | `b07ceba600fa7a530d37cadc7eaeefd9b4bde628` | Merged | 8 |
| [#109](https://github.com/morn53426-ui/-samafacture-pro/pull/109) | fix(invoice): keep quotes available during warehouse API outages | `fix/quote-warehouse-resilience-20261120` | `8d0a4d2990174f950dcb334fbe1e6323a7d5e86f` | `370604b5e09f3494c328f04abefc9ddb67812314` | Merged | 5 |
| [#108](https://github.com/morn53426-ui/-samafacture-pro/pull/108) | fix(stock): éviter les deadlocks lors de l'initialisation du magasin principal | `fix/purchase-receipt-warehouse-deadlock-20261119` | `f0f43c3d1e7a920b470894275f5d9754f306dae1` | `e3d8162c9b21d3f9ffb3e2a4a3470f36dbb203d2` | Merged | 3 |
| [#107](https://github.com/morn53426-ui/-samafacture-pro/pull/107) | feat(stock): route invoice movements to the selected warehouse | `feat/invoice-stock-warehouse-20261119` | `30bcfaa58ebf4960c2308390b586cb13c5adb466` | `eef3fb31145ceacb7d4e79103a5658b352d86631` | Merged | 3 |
| [#106](https://github.com/morn53426-ui/-samafacture-pro/pull/106) | test(stock): validate invoice warehouse routing | `fix/invoice-stock-principal-warehouse` | `383c885a969bf3da2ce8e06acc8829a5f1d1e60b` | `f42f69e184f92bec26d76442a1249593b64f795f` | Merged | 2 |
| [#105](https://github.com/morn53426-ui/-samafacture-pro/pull/105) | feat(dashboard): rapprocher les raccourcis de la référence Sunupilot | `feat/dashboard-reference-modules-20261119` | `f3cbbc669629fa730783bdbfbe6baf72ab5d81c0` | `8eafada90573648e31e0f78da906ab4799f8cdf2` | Merged | 125 |
| [#104](https://github.com/morn53426-ui/-samafacture-pro/pull/104) | fix(pwa): fiabiliser le cycle de vie du service worker | `fix/sunupilot-pwa-lifecycle` | `86da24a1c6e8fc6d6b1dc57d648d1c2cbaa0722f` | `11d55850b64702302a922185af02440394131541` | Merged | 1 |
| [#103](https://github.com/morn53426-ui/-samafacture-pro/pull/103) | feat(brand): intégrer les fondations visuelles SUNUPILOT | `brand/sunupilot-identity-foundation` | `63f8eb27a5ff410c7f1c96e844f8114289531b40` | `b5863a0d346d42c7cecb2618d7cb87028bd3e8b0` | Merged | 26 |
| [#101](https://github.com/morn53426-ui/-samafacture-pro/pull/101) | fix(accessibility): corriger les contrastes et auditer les 17 pages | `test/accessibility-audit-business-pages-20261118` | `468caba29865f38eaa788f043f2ae164b4b965f9` | `0ceec8d7ef4d4f221b8f181f4d5c3bc2c1c82555` | Merged | 8 |
| [#100](https://github.com/morn53426-ui/-samafacture-pro/pull/100) | test(visual): couvrir le zoom 200 % en thème sombre | `test/dark-theme-zoom-200-sweep-20261118` | `6fe85dfd3076e8024a854405bed4f5051bd1af72` | `44f9f54987d63fde2fdd68e56a48fa23f1fce35f` | Merged | 2 |
| [#98](https://github.com/morn53426-ui/-samafacture-pro/pull/98) | fix(responsive): corriger les tableaux au zoom 200 % | `test/workspace-zoom-200-sweep-20261118` | `dd64ea0274ce4d01f30e5fe9a4097ba006d967b1` | `7793652d9d10bad7a0d0e7d6754c3a39b42ec9ee` | Merged | 4 |
| [#97](https://github.com/morn53426-ui/-samafacture-pro/pull/97) | fix(dashboard): améliorer la lisibilité du total des factures | `fix/dashboard-donut-count-20261118` | `2d4d7619350a6fe5ddc50868cb7e4d3ca5d4cb39` | `423bc170d7996c45bc26fcbfa7a541b097e80944` | Merged | 3 |
| [#96](https://github.com/morn53426-ui/-samafacture-pro/pull/96) | test(theme): vérifier le mode clair sur bureau | `test/theme-light-desktop-sweep-20261118` | `dfe8ce45fdb4bed07a6d88c679ff46c601208a69` | `a6ba833e3bcee5e73e353a7e7f3ca318c8ffa4db` | Merged | 2 |
| [#95](https://github.com/morn53426-ui/-samafacture-pro/pull/95) | test(theme): vérifier le mode clair sur mobile | `test/theme-light-mobile-sweep-20261118` | `b77108576d2ccaa14fbf618e6707cb903a99f73a` | `048881747abf4afd26f2ae0fe5cbaf7998745eb8` | Merged | 1 |
| [#94](https://github.com/morn53426-ui/-samafacture-pro/pull/94) | test(theme): vérifier le mode sombre sur mobile | `test/theme-dark-mobile-sweep-20261118` | `55c985deecd6b225030c2f6129afc446f97106ca` | `db94e600b30fab3a961b417862bc434a6d3bfc05` | Merged | 3 |
| [#93](https://github.com/morn53426-ui/-samafacture-pro/pull/93) | fix(theme): garantir le contraste de l’aperçu facture en mode sombre | `test/theme-dark-sweep-20261118` | `7bd4d2e94fe00a0de6413e4545bdc23895d49745` | `9d105c698731c062a67e3627b20d23e736147ad6` | Merged | 4 |
| [#92](https://github.com/morn53426-ui/-samafacture-pro/pull/92) | test(pdf): vérifier les polices incorporées et les marges A4 réelles | `test/pdf-font-embedding-and-visual-print-20261118` | `42b5a0bcf4393a6b4c513c2a621c9a3b7576efa6` | `d84b938e73da881f67e72c6d85cc10f5bc2b4dbf` | Merged | 8 |
| [#91](https://github.com/morn53426-ui/-samafacture-pro/pull/91) | fix(invoice): améliorer les polices et l’impression A4 des factures et devis | `fix/invoice-print-typography-20261118` | `d8805a202dd96748e83e3d3a43b48e2787b41b63` | `d4226d4e5b6e71d4d369df744c98c8299690ac79` | Merged | 10 |
| [#90](https://github.com/morn53426-ui/-samafacture-pro/pull/90) | fix(print): vérifier la typographie et l'impression A4 des 31 modèles | `audit/invoice-pdf-typography-print-20261118` | `7cb2d43cf3aadccb38e1a1a5d6c664a8db014c41` | `d4226d4e5b6e71d4d369df744c98c8299690ac79` | Closed unmerged | 9 |
| [#89](https://github.com/morn53426-ui/-samafacture-pro/pull/89) | fix(ui): corriger la cohérence des thèmes clair et sombre | `fix/light-dark-theme-consistency-20261118` | `bf497de04d01096648f201619c29b63b7321b7a4` | `a081f8adbb61d5689cbb185282157c19191506ae` | Merged | 37 |
| [#88](https://github.com/morn53426-ui/-samafacture-pro/pull/88) | docs(docker): clarifier le démarrage local avec Docker | `docs/local-docker-bootstrap-20261117` | `eeea9c4a71001f32889bf302a78cff65e360a353` | `d8d137cec31e66efd7cc799f4061d8c5d8afdc8a` | Merged | 1 |
| [#87](https://github.com/morn53426-ui/-samafacture-pro/pull/87) | feat(invoice): ajouter 3 modèles Pro et 4 modèles Entreprise | `feat/invoice-templates-pro-enterprise-20261117` | `4de3da4409263f2ff1deff7350c488d18a5f7fb2` | `68059bc6f8b358950fd910a4dde1590cb2799aff` | Merged | 9 |
| [#86](https://github.com/morn53426-ui/-samafacture-pro/pull/86) | fix(ui): améliorer les interactions sidebar et Entreprise sur mobile | `fix/ui-responsive-polish-20261117` | `5efe69b69853850e99e11626b3272cc2e57a9fb8` | `c959c9c1f1abe0a3b8f43d9f5b5421ef40d6422a` | Merged | 1 |
| [#85](https://github.com/morn53426-ui/-samafacture-pro/pull/85) | docs(ui): préparer les corrections responsive et animations | `docs/ui-polish-plans-20261117` | `137a9b01d3ea60ffeb7ec3a0338607638871acd2` | `a00f1721cb63990049659bc57e325e868e0352d9` | Closed unmerged | 1 |
| [#84](https://github.com/morn53426-ui/-samafacture-pro/pull/84) | feat(billing): préparer le moteur d'abonnement mensuel en simulation locale | `feat/subscription-engine-local-simulation-20261117` | `c077af1465c262e19f309c746ff3c84f332b7f5e` | `12716c760a0874b393b235587028ba78970bb0b8` | Merged | 9 |
| [#83](https://github.com/morn53426-ui/-samafacture-pro/pull/83) | docs(billing): cadrer l'architecture des abonnements mensuels | `docs/subscription-monthly-architecture-20261117` | `430e2010b1bee958b1b26435c1f8462a6e503ad2` | `e7d447fcd5034a16abb96f214ffb88cb59c6c1cf` | Merged | 2 |
| [#82](https://github.com/morn53426-ui/-samafacture-pro/pull/82) | chore(agents): intégrer les skills design engineering | `chore/emil-design-skills-20261117` | `70f8ea190bfd00316cfe8de2ccf5d9bcc83b193a` | `1ebe6d031ca34690291441d5f194b0191746cb32` | Merged | 1 |
| [#81](https://github.com/morn53426-ui/-samafacture-pro/pull/81) | feat(nav): moderniser le rail latéral avec libellés | `feat/sidebar-icon-label-navigation-20261117` | `f3ce7ed158e7cb83ddcad347983ed1ff17af9f3e` | `89ab5ed3e37af88413cb50e01e53aa6baa8b4d58` | Merged | 22 |
| [#80](https://github.com/morn53426-ui/-samafacture-pro/pull/80) | feat(entreprise): paginer la liste des sociétés du groupe | `feat/enterprise-company-pagination-20261117` | `3b8d8ebc171b7c5053d865c0a29b589793094a20` | `d607e671d5072f8ad428dd222f94e539dd9dc84c` | Merged | 34 |
| [#79](https://github.com/morn53426-ui/-samafacture-pro/pull/79) | feat(nav): moderniser la barre latérale et les icônes | `feat/sidebar-navigation-visual-refresh-20261117` | `314c06e7e9ec2fc39145b1216058fddf4043c418` | `d607e671d5072f8ad428dd222f94e539dd9dc84c` | Merged | 3 |
| [#78](https://github.com/morn53426-ui/-samafacture-pro/pull/78) | docs(billing): clarifier l’état réel des abonnements mensuels | `docs/subscriptions-current-state-20261117` | `e618e88c7be3178be3f9d8bd0c2229fba53b3767` | `d607e671d5072f8ad428dd222f94e539dd9dc84c` | Closed unmerged | 2 |
| [#77](https://github.com/morn53426-ui/-samafacture-pro/pull/77) | test(billing): verrouiller les abonnements récurrents non activés | `fix/subscription-disabled-state-tests-docs-20261117` | `60f57e272b273364a556781c18bc71fdee4806e3` | `d607e671d5072f8ad428dd222f94e539dd9dc84c` | Merged | 57 |
| [#76](https://github.com/morn53426-ui/-samafacture-pro/pull/76) | fix(pdf): améliorer la pagination des devis et factures | `fix/pdf-pagination-extras-flow-20261117` | `2e7dd32a3eec318051d5891e8c03f6447ae2afba` | `f6796b796fc41d6b32e098397ec2ed9ed66c38eb` | Closed unmerged | 7 |
| [#75](https://github.com/morn53426-ui/-samafacture-pro/pull/75) | fix(pdf): éviter les pages isolées dans les devis volumineux | `fix/pdf-print-pagination-20261117` | `b8e344915ceaf843a79fee82f0f9aba784cf2d9f` | `f6796b796fc41d6b32e098397ec2ed9ed66c38eb` | Merged | 2 |
| [#74](https://github.com/morn53426-ui/-samafacture-pro/pull/74) | ci: exécuter le test réel de restauration des sauvegardes chiffrées | `ci/real-restore-smoke-20261117` | `8864ab9478d019205f2c5a58fc206712c7129070` | `be8e5d98ecb664261645f16c10699d350345e90a` | Merged | 1 |
| [#73](https://github.com/morn53426-ui/-samafacture-pro/pull/73) | feat(ui): simplifier les espaces Entreprise et professionnel | `feat/enterprise-workspace-ux-20261117` | `14cdd3c48c0b089bc35493bf93d4b4349c88ff1a` | `be8e5d98ecb664261645f16c10699d350345e90a` | Merged | 38 |
| [#72](https://github.com/morn53426-ui/-samafacture-pro/pull/72) | fix(team): sécuriser les invitations classiques par preuve email | `fix/team-invitation-email-proof-20261117` | `8e1b84dffe598350c88ed2442e8df06339507c7e` | `f0429c599f721e693b69880aa58b525ec11f0f19` | Merged | 10 |
| [#71](https://github.com/morn53426-ui/-samafacture-pro/pull/71) | feat(entreprise): centre de pilotage consolidé du groupe | `feat/enterprise-command-center-20261117` | `ae7e0e8e59f0dfbe7ea8a7fee49b8ea375379e00` | `f0429c599f721e693b69880aa58b525ec11f0f19` | Merged | 8 |
| [#69](https://github.com/morn53426-ui/-samafacture-pro/pull/69) | fix(security): vérifier l’adresse email avant le rattachement multi-sociétés | `fix/enterprise-invitation-email-proof-20261116` | `4347d572f4e78fe057fc3595d677619abe74e745` | `66071353da9b7ecfe86b3f4f1fb1a896387b59ae` | Merged | 31 |
| [#68](https://github.com/morn53426-ui/-samafacture-pro/pull/68) | feat: laisser le client choisir son moyen de paiement | `feat/abonnement-choix-moyen-paiement` | `3f32787dd561d01e91b1f784fb238376b2220b50` | `70750be430c83c4bf3ff369ad453c7b1fd1af511` | Merged | 16 |
| [#67](https://github.com/morn53426-ui/-samafacture-pro/pull/67) | docs(email): corriger le comportement SMTP local et tester la redaction | `audit/fix-reset-email-docs-and-redaction-test-20261116` | `a53c96daa1c2052fa19ca270d574d948fab81f30` | `2e00606aa4b3da7d74bbf3a9622e3203a4447a6a` | Merged | 6 |
| [#65](https://github.com/morn53426-ui/-samafacture-pro/pull/65) | docs(billing): distinguer achat ponctuel et abonnement récurrent | `docs/correct-one-time-plan-billing-2026-11-16` | `43592f99b6f72cadc369b76c9489d4a831e21094` | `70750be430c83c4bf3ff369ad453c7b1fd1af511` | Closed unmerged | 2 |
| [#64](https://github.com/morn53426-ui/-samafacture-pro/pull/64) | docs(audit): documenter le risque de vérification des invitations multi-sociétés | `audit/security-multisocietes-review-20261116-run3` | `4acf4d365c89d3152892d49515e9570d0be98eed` | `71e0a06812f5cd63d20f3800768431371a89b1d6` | Merged | 2 |
| [#63](https://github.com/morn53426-ui/-samafacture-pro/pull/63) | fix(realtime): autoriser les groupes Entreprise dans les notifications | `audit/fix-realtime-company-groups-20261116-run1` | `e5c3d8020b40079021aa678db9dbcb4969831e92` | `7a0a508a48ba785293dbf73af28cff31aba3f157` | Merged | 3 |
| [#62](https://github.com/morn53426-ui/-samafacture-pro/pull/62) | fix(entreprise): corriger la migration v10 et les invitations | `audit/fix-enterprise-migration-invitation-20261116` | `0b93cf9e37feb94d2b317924f16f3045db45a9e4` | `88100b911089669fc679b48b7c6c3559dfe873c5` | Closed unmerged | 3 |
| [#60](https://github.com/morn53426-ui/-samafacture-pro/pull/60) | feat(entreprise): socle multi-sociétés et cadrage de l’abonnement mensuel | `feat/enterprise-multi-company-foundation-20261116` | `c19e12959de8895a8ecf59e4d0e3319c74e95bbe` | `32cde58d6f694905b20e3100489d53dd96fd1981` | Merged | 99 |
| [#59](https://github.com/morn53426-ui/-samafacture-pro/pull/59) | docs(staging): corriger la procédure Docker Compose et HTTPS | `docs/fix-staging-compose-runbook-20261116` | `22c0dae280e3e7ee7305bd8b761c5cfebe2969bf` | `d446f6613b9e4d4f7c47e5d2cff847f4f32111fe` | Merged | 6 |
| [#57](https://github.com/morn53426-ui/-samafacture-pro/pull/57) | fix(a11y): associer les libellés de la page Paramètres | `fix/a11y-settings-labels-20261116` | `4b275916eefa7253b2cc11b3c0a150d9050a918d` | `2a8fe25611b129f03417f26b3a364e77f0983b7e` | Merged | 3 |
| [#56](https://github.com/morn53426-ui/-samafacture-pro/pull/56) | fix(pdf): file durable avec acquittement et reprise, mentions paiement exactes | `fix/pdf-stream-ack-payment-disclosures-20261116` | `a576e5e1fec88c5a0e7eb8272e791cdb2a49bcab` | `6ded322a8951131f53f871fa4a907815b44a702a` | Merged | 144 |
| [#55](https://github.com/morn53426-ui/-samafacture-pro/pull/55) | audit: corriger la conservation des tâches PDF en attente | `audit/rapport-approfondi-2026-11-16-run2` | `1aee933103049ca9e0049ed76f00e4ff641c8aaa` | `abf4994f57e01dd2dedefb92299fa58e82b90361` | Merged | 4 |
| [#54](https://github.com/morn53426-ui/-samafacture-pro/pull/54) | fix: remove Nginx upstream balancing warning | `audit/fix-nginx-upstream-order-20261116` | `5e93abdc37d49cdb4c458c9963eeb7998aa018c8` | `066227e9fe75a84b7a401510957195dd76e4ee81` | Merged | 2 |
| [#53](https://github.com/morn53426-ui/-samafacture-pro/pull/53) | docs: ajouter le plan d’entreprise et la stratégie de lancement | `docs/business-plan-samafacture-pro` | `ac07f0788ee60f1db6fc3a8a68bf4d0784b9e2a7` | `c298062b75a9f475c79db3febd55a8523e2743ae` | Merged | 4 |
| [#52](https://github.com/morn53426-ui/-samafacture-pro/pull/52) | security: redact sensitive tokens from HTTP access logs | `security/redact-secret-urls-in-logs-2026-11-16` | `d27f55b581ba7db3da5decd411d26c399531bc94` | `4a3b55477b4689707295e8a6342cf826a342f8f1` | Merged | 10 |
| [#51](https://github.com/morn53426-ui/-samafacture-pro/pull/51) | CI: bloquer les dépendances présentant une vulnérabilité npm | `audit/npm-audit-gate-2026-11-16` | `63a344d9154b5f5879689fa632dc697148afe2e7` | `ffcc8e347bdb26fa0e7c8a74784e10054a738711` | Merged | 1 |
| [#50](https://github.com/morn53426-ui/-samafacture-pro/pull/50) | Fix: éviter la concurrence d'initialisation MySQL du worker PDF | `fix/pdf-worker-db-readiness-2026-11-16` | `59d341a154621ef4e15acb77a402a1a85534e969` | `70191f8d2edc49cd84239d0a02ab381079798703` | Merged | 4 |
| [#49](https://github.com/morn53426-ui/-samafacture-pro/pull/49) | test(ui): cover notification placement with visual viewport offsets | `audit/visual-viewport-offset-regression-20261116` | `f744b20396781fde17daa074380ca02c6a9e2d3c` | `a6d46c8fdec30e66fea5f31c2afb234422ec4ed0` | Merged | 1 |
| [#48](https://github.com/morn53426-ui/-samafacture-pro/pull/48) | fix(ui): keep notifications visible above the mobile keyboard | `automation/visual-viewport-notifications-20261116-0243` | `64f5b2c2ec8eb5e86f83a9661ff9596f329522d0` | `ab97e27464b8a9559bda214659e78a217a2d244a` | Merged | 2 |
| [#47](https://github.com/morn53426-ui/-samafacture-pro/pull/47) | Éviter les mauvais destinataires WhatsApp pour les numéros locaux | `fix/whatsapp-country-guard-2026-11-16` | `a49756cd21ec95f952044412b0538c1938564a90` | `0f85649d943052b08cbb3528c90b1c59b0329241` | Merged | 2 |
| [#46](https://github.com/morn53426-ui/-samafacture-pro/pull/46) | fix(ui): keep mobile notifications inside viewport | `automation/audit-fixes-20261116-0150` | `a423dca17e30edf84e6708cc470a6bf2ea995edb` | `5e4f1b31e498d946828320b5019df3c9e6531d6f` | Merged | 9 |
| [#45](https://github.com/morn53426-ui/-samafacture-pro/pull/45) | Sécuriser la sauvegarde, la rétention et la restauration de la base | `fix/backup-retention-guard-2026-11-16` | `e277ca8a841204b0cdfd98d497311ffe87a5c28e` | `fef41010c63197c687f5dc44443c00304b1754bc` | Merged | 19 |
| [#44](https://github.com/morn53426-ui/-samafacture-pro/pull/44) | Sécurité : rendre la révocation des sessions immédiate entre workers | `security/immediate-session-revocation-2026-11-16` | `d6887ce043b8c3871a03342943ee270375f7aff9` | `d474fde7cfa40faead028e36437e315ee8ce0cd0` | Merged | 2 |
| [#43](https://github.com/morn53426-ui/-samafacture-pro/pull/43) | Améliorer le mobile, les aperçus A4 et l’espace professionnel | `fix/mobile-invoice-line-columns` | `38a365581a31fdd996411ea44fff5db03b6c6c1d` | `d474fde7cfa40faead028e36437e315ee8ce0cd0` | Merged | 34 |
| [#42](https://github.com/morn53426-ui/-samafacture-pro/pull/42) | Fiabiliser les PDF et corriger le thème système à l'impression | `qa/test-pdf-24-modeles` | `d3b70a09c598195713cc7e9b49d03b7db52a1404` | `2b7d556ed454e6a9efa403b0a4742b47bcc0270d` | Merged | 9 |
| [#41](https://github.com/morn53426-ui/-samafacture-pro/pull/41) | Préparer l’archive du code fusionné sur main | `ci/package-main-after-pr39-pr40` | `8c725a00cd3b353684033e3c7219737af487d437` | `2b7d556ed454e6a9efa403b0a4742b47bcc0270d` | Closed unmerged | 1 |
| [#40](https://github.com/morn53426-ui/-samafacture-pro/pull/40) | Ajouter cinq modèles modernes de facture et de devis | `feat/5-nouveaux-modeles-facture` | `342a3e43c5b8801411892d72d04be6faa2ee7d5d` | `c7334201d701d16f4574ebd485c3db2011d504ea` | Merged | 9 |
| [#39](https://github.com/morn53426-ui/-samafacture-pro/pull/39) | Agrandir légèrement le logo et les icônes de navigation | `ui/augmenter-logo-icones-sidebar` | `63af3d94dc35cc3534a58f467201f3dda3803493` | `c7334201d701d16f4574ebd485c3db2011d504ea` | Merged | 2 |
| [#38](https://github.com/morn53426-ui/-samafacture-pro/pull/38) | Make monthly invoice quota initialization deterministic | `fix/quota-registry-initialization-robustness-2026-11-15` | `c8ea3204dcdc805619a5e3bb83f318ffa97638a3` | `829a5c9c6f0ce903db376fbb55bdbefd485bb7a5` | Merged | 9 |
| [#37](https://github.com/morn53426-ui/-samafacture-pro/pull/37) | Exclude local secrets from Docker and require npm lockfile | `fix/docker-context-secrets-and-lockfile-2026-11-15` | `52d4b81b3ff86b73e9b7956cb31e217d87a8160b` | `577c1858b76fab340b594338f5cdef802333539a` | Merged | 3 |
| [#36](https://github.com/morn53426-ui/-samafacture-pro/pull/36) | Harden invoice settlement, paid status and payment idempotency | `fix/invoice-settlement-integrity-2026-11-15` | `30318cf3cf48be4f0a6ccd9bda0cdac699211341` | `577c1858b76fab340b594338f5cdef802333539a` | Merged | 4 |
| [#35](https://github.com/morn53426-ui/-samafacture-pro/pull/35) | Test that backup archives stay temporary until dump completion | `test/backup-atomic-visibility-2026-11-15` | `f4c463e5ec768eee125a7d0f623f0ae4626ea38d` | `97d2f09a4dbdcf4dc265c5d1ae188f9c8236ee4d` | Merged | 1 |
| [#34](https://github.com/morn53426-ui/-samafacture-pro/pull/34) | Prevent local environment secrets from entering Docker images | `security/docker-ignore-local-secrets-2026-11-15` | `4d2c20e28ee29d9c18538d8775e64a73772ea8ce` | `27a94a02431f743667b8118811fde96629000a90` | Closed unmerged | 2 |
| [#33](https://github.com/morn53426-ui/-samafacture-pro/pull/33) | Publish database backups only after atomic validation | `fix/atomic-backup-publish-2026-11-15` | `081d931236086aca8f53eebb312540c73a9934b7` | `27a94a02431f743667b8118811fde96629000a90` | Closed unmerged | 1 |
| [#32](https://github.com/morn53426-ui/-samafacture-pro/pull/32) | Publish complete database backups atomically | `fix/atomic-encrypted-backups-2026-11-15` | `03a36a61b7c4e30321066c78babe95c67bda363e` | `27a94a02431f743667b8118811fde96629000a90` | Merged | 1 |
| [#31](https://github.com/morn53426-ui/-samafacture-pro/pull/31) | Harden session revocation and payment provider timeouts | `fix/session-revocation-and-payment-timeouts-2026-11-15` | `46f280761b6149260eeca0e1bbab3ab5304d3118` | `f77848ff5384ae6388c4f079431591c2fbf230bf` | Merged | 5 |
| [#30](https://github.com/morn53426-ui/-samafacture-pro/pull/30) | Add transactional monthly invoice quota with schema migration v8 | `feat/monthly-invoice-quota-v8-2026-11-15` | `f3b2690913b9897c8aa9b6a55dee08e5fc1d18aa` | `27a94a02431f743667b8118811fde96629000a90` | Closed unmerged | 1 |
| [#29](https://github.com/morn53426-ui/-samafacture-pro/pull/29) | Fix monthly invoice quota with schema migration v8 | `fix/monthly-invoice-quota-schema-v8-2026-11-15` | `69028f5946e93f259fdcd69cb7d3f9c913b99d31` | `d02acd32e62008ac8b9832e4eb369f7b880be217` | Merged | 1 |
| [#28](https://github.com/morn53426-ui/-samafacture-pro/pull/28) | Improve sidebar navigation accessibility | `fix/sidebar-aria-current-2026-11-15` | `1066c1c4d02ebeebd571fc45534c6539b374963c` | `9d77366260a7542cdbed7c4b84e489eddc7289e5` | Merged | 1 |
| [#27](https://github.com/morn53426-ui/-samafacture-pro/pull/27) | Improve sidebar icon semantics and enforce full icon coverage | `fix/pdf-worker-health-and-sidebar-icons-2026-11-15` | `04304461cafad9c2576015e10dc59abf7437f329` | `577c1858b76fab340b594338f5cdef802333539a` | Merged | 1 |
| [#26](https://github.com/morn53426-ui/-samafacture-pro/pull/26) | Fix PDF worker startup ordering after API readiness | `fix/pdf-worker-wait-for-api-health-2026-11-15` | `941f235f5f4b625af5038b1dc17710fe5db02acf` | `070ce902e5f6c9a50427faf57010606f6860731e` | Merged | 1 |
| [#25](https://github.com/morn53426-ui/-samafacture-pro/pull/25) | Fix subscription page icons and visual regression checks | `fix/subscription-icons-main-2026-11-15` | `3316731d6119e6b43a9cdef8c935083f0b4a6979` | `95f019d4cd4711b55752915f3cb58b1a24fd21f3` | Merged | 1 |
| [#24](https://github.com/morn53426-ui/-samafacture-pro/pull/24) | Sécurité : révocation des sessions, correctif liaison Google, filtrag… | `audit/securite-2026-11-15` | `9939413ad492d89af41fc28ce4d05c8130f45d03` | `f5c5b45b57589694080f55c46b2dfae010b09a49` | Merged | 1 |
| [#23](https://github.com/morn53426-ui/-samafacture-pro/pull/23) | Galerie de 19 modèles, impression fiable, WhatsApp et audit transversal | `feat/invoice-template-gallery-2026-11-15-v2` | `570bf60cad5f73bb7f1fe3e65646f29e65068b9f` | `caa9d729ac052bff671cb22bb906cf7c7108292d` | Merged | 27 |
| [#22](https://github.com/morn53426-ui/-samafacture-pro/pull/22) | Présenter les modèles de facture dans une galerie visuelle | `feat/invoice-template-gallery-2026-11-15` | `70d95aac18e38b1aac466f1f184f8fa536caa638` | `f5c5b45b57589694080f55c46b2dfae010b09a49` | Closed unmerged | 10 |
| [#21](https://github.com/morn53426-ui/-samafacture-pro/pull/21) | Finaliser les factures et devis imprimés en A4 | `fix/invoice-print-and-payment-stamp-2026-11-15` | `ed6c1467affe76a6e055af95b943a44cedc09891` | `217f888563648b546cb4025a309580fbf1789f1a` | Merged | 8 |
| [#20](https://github.com/morn53426-ui/-samafacture-pro/pull/20) | Professionnaliser la page Abonnement et ses icônes | `feat/professional-subscription-page-2026-11-15` | `cf58665a9083cb4e52dc24cce75cdb2291632d6e` | `217f888563648b546cb4025a309580fbf1789f1a` | Closed unmerged | 4 |
| [#19](https://github.com/morn53426-ui/-samafacture-pro/pull/19) | Stabiliser la CI avec des tests MySQL séquentiels | `fix/ci-serial-tests-2026-11-15` | `4a74afa8dceaebc1dcb7dbaf6e88b175e6438fde` | `a855795884ffa2392af122f896dc792298207bb0` | Merged | 1 |
| [#18](https://github.com/morn53426-ui/-samafacture-pro/pull/18) | Professionnaliser l’interface et les documents, renforcer la responsivité et la montée en charge | `feat/responsive-scaling-2026-11-15` | `f7d10afed88a1cf03baac276836dc6f0165e09d6` | `39919152d8e8f8290be719227bd40e2676628687` | Merged | 46 |
| [#17](https://github.com/morn53426-ui/-samafacture-pro/pull/17) | Améliorer la visibilité et la cohérence des icônes | `fix/ui-icons-legibility-2026-11-15` | `0d7c5390f47444a13eae765a083e7bc2cdafb5c0` | `cc5218a24fbc7fac81341ac9e8b778876bfff916` | Merged | 2 |
| [#16](https://github.com/morn53426-ui/-samafacture-pro/pull/16) | Fix Docker startup: single MySQL schema init and Redis readiness | `fix/docker-local-startup-mysql-redis-swagger` | `2f021548666e2575035ff4d45ca9936f4ceaf7b7` | `5f8a0dd9e574a883662597a1e3539ec81679a0ac` | Merged | 2 |
| [#15](https://github.com/morn53426-ui/-samafacture-pro/pull/15) | UI : harmoniser les pages métier pour un logiciel de gestion professionnel | `feat/enterprise-pages-v2-2026-11-13` | `e9992176d76f18f9e48f7d1d98378b1d9070cb78` | `95a75189e98bd0e939b763f8dff979167a621773` | Merged | 174 |
| [#14](https://github.com/morn53426-ui/-samafacture-pro/pull/14) | UI : finaliser la structure professionnelle des pages métier | `feat/enterprise-page-structure-v2-2026-11-13` | `745a98b586ef19f7747df9dfa1c19af97ee233d2` | `95a75189e98bd0e939b763f8dff979167a621773` | Closed unmerged | 8 |
| [#13](https://github.com/morn53426-ui/-samafacture-pro/pull/13) | UI : organiser les pages métier comme un logiciel professionnel | `feat/enterprise-page-structure-2026-11-13` | `e39910166ba43eaa1852844883c5ddc649b170cf` | `95a75189e98bd0e939b763f8dff979167a621773` | Closed unmerged | 35 |
| [#12](https://github.com/morn53426-ui/-samafacture-pro/pull/12) | UI : organisation professionnelle des pages métier | `feat/enterprise-page-structure-2026-11-13` | `abb2f78187944a4dab48c37efe2ff35500a9fd81` | `2b448ff685331d929c43f685f1cc20000dffa9c9` | Merged | 26 |
| [#11](https://github.com/morn53426-ui/-samafacture-pro/pull/11) | Audit UI — navigation compacte et amélioration de la visibilité | `audit/ui-runtime-pages-polish-20261113` | `094c34f33a457633e334b46538ff3bba606a4597` | `204f96d8b8a169383f5c3042fd26cbf1aa596896` | Closed unmerged | 8 |
| [#10](https://github.com/morn53426-ui/-samafacture-pro/pull/10) | UI : navigation compacte et espace de travail élargi | `fix/navigation-compact-sidebar-2026-11-13` | `508607c7cc69e560b539438c44cbc2330b035a6e` | `204f96d8b8a169383f5c3042fd26cbf1aa596896` | Merged | 10 |
| [#9](https://github.com/morn53426-ui/-samafacture-pro/pull/9) | Build a temporary local Docker test ZIP | `tooling/local-docker-test-bundle-20261112` | `b88eeebb659dc119848094f8ddc6d9894a3be569` | `204f96d8b8a169383f5c3042fd26cbf1aa596896` | Closed unmerged | 1 |
| [#8](https://github.com/morn53426-ui/-samafacture-pro/pull/8) | Phases 5 à 7 — Portail client, CRM, internationalisation et IA | `feat/phases-5-7-portal-international-automation-20261112` | `a3a43402f59d54be7f0c4cc1e5ac23d04f9f333b` | `b13a8a0ff03d10e84c73a1efeee8d357e0e2be4f` | Merged | 84 |
| [#7](https://github.com/morn53426-ui/-samafacture-pro/pull/7) | Phases 2 à 4 — Paiements réels, comptabilité OHADA et achats/stocks | `feat/phases-2-4-paiements-compta-achats-20261112` | `f028da5802241ccd8df687875a2ba4787a5145b6` | `96e7f1ed31e3f42ec45843ca7a7dd8f89bc6dc72` | Merged | 45 |
| [#6](https://github.com/morn53426-ui/-samafacture-pro/pull/6) | Ajouter une cloche de notifications à la barre supérieure | `feat/topbar-notifications-bell-20261112` | `a36472e66f180124a699c01d10b26012e4b8b079` | `6c75f32b6589a5c06481ff758ff2cce6e7d08a97` | Merged | 5 |
| [#5](https://github.com/morn53426-ui/-samafacture-pro/pull/5) | Refonte du tableau de bord SamaFacture Pro — palette et navigation | `feat/dashboard-reference-redesign-20261112` | `6cf80f4c547b62d41bd428b44bbf87be3b50f3c4` | `4bfce7f82af42537ba68c64f529eda67cf2eba96` | Merged | 55 |
| [#4](https://github.com/morn53426-ui/-samafacture-pro/pull/4) | UI polish: animations accessibles et recette visuelle responsive | `feat/ui-motion-visual-recette-20261112` | `1ae8c307b3cf394e8103f5e40237494723c4dae1` | `4bfce7f82af42537ba68c64f529eda67cf2eba96` | Merged | 21 |
| [#3](https://github.com/morn53426-ui/-samafacture-pro/pull/3) | Audit correctif : sauvegardes, sécurité des sessions, paiements et quotas | `audit/fix-backup-and-runtime-20261110` | `9ea9a9aa00d4c3d4ef6e0a9a46f771a1912bedb5` | `4bfce7f82af42537ba68c64f529eda67cf2eba96` | Closed unmerged | 126 |
| [#2](https://github.com/morn53426-ui/-samafacture-pro/pull/2) | Modèles de factures et devis — enrichissement des informations et du rendu | `feat/templates-factures-devis-complets` | `81aa9fa67012f19b69c2df4a0c72490b14dea285` | `9d39e3ac49c98bd4cd8c301e78c7f0a12c32b59d` | Merged | 25 |
| [#1](https://github.com/morn53426-ui/-samafacture-pro/pull/1) | SamaFacture Pro — modernisation UI et modules professionnels | `ui/modern-responsive-polish` | `a2faa30e320e1ad09b4537201a4627dc909f5514` | `813e327deade3cb6e0bca8abcc2a9e3b63240b8f` | Merged | 148 |

## 5. Candidats prioritaires — compare sur main exact

### P0 sécurité tenant #194
- Head `900163220356db9c443e11e5f6208760d49a62f2`; 20 ahead / 3 behind main, 12 fichiers.
- CI historique sur head exact: Tests #45188705205 success, ESLint #45188705209 success, ZIP #45188705073 success. Aucun succès réutilisable après resynchronisation.
- Draft; nouvelle CI après sync et validation humaine sécurité spécifique obligatoires.
- #203 verification_code (6 ahead / 2 behind) et #199 refund join (3 ahead / 4 behind) sont sous-ensembles; éviter merges doublons.

### P1 devise #192
- Head `8a11e00bb976979403e9d3fcfa8e767a074b5423`; 11 ahead / 4 behind, 11 fichiers.
- CI sur ce head exact: Tests #45138383987 success, ZIP #45138383828 success, ESLint #45138383956 success.
- Draft; synchroniser, rerun, validation métier OHADA/devise et rollback requises avant fusion.

## 6. Migrations et comptabilité
- Main schema v23 selon Run 20 et état migration précédent; #202/#204 n'ont aucun DDL.
- v21 : trial 15 jours/date UTC; v22 : événements de contrepassation; v23 : mappings comptables tenant-aware.
- #142 v21 et #145 v22 divergentes/historiques; déjà intégrées à main, ne pas fusionner en doublon.
- Aucune migration exécutée. Toute migration destructive ou écriture historique exige validation humaine.

## 7. Workflows et protection GitHub

### Workflows présents sur main
- `lint.yml` — `.github/workflows/lint.yml` (workflow id undefined)
- `package-source-zip.yml` — `.github/workflows/package-source-zip.yml` (workflow id undefined)
- `test.yml` — `.github/workflows/test.yml` (workflow id undefined)

### Ruleset
- #27410527 actif sur main; PR obligatoire, threads résolus, suppression et non-fast-forward interdits.
- Checks requis: `Tests Node.js et MySQL`, `Build complete source archive`.
- 0 approval requise configurée, aucun bypass actor; bypass courant never.
- Branch-protection classique inaccessible (403), ruleset lu. Auto-merge désactivé.

## 8. Planning P0–P3
| Priorité | Lot | Actions | Garde-fou |
|---|---|---|---|
| P0 | #194 tenant security | Sync non destructive, diff re-review, CI exacte | Validation humaine sécurité |
| P0 | #203/#199 | Fallbacks; ne pas merger en doublons | Si #194 non retenue, portage ciblé |
| P1 | #192 devise | Sync, tests concurrence, facture/devis/API/rollback | Validation humaine OHADA |
| P1 | migrations/comptabilité | Reconciliation v21–v23, reversibilité | Validation humaine |
| P1 | backups/Docker | Tests restore/smoke | CI main stable |
| P2 | PDF/print/mobile/accessibilité | Petits lots et recette visuelle | Main stable |
| P3 | documentation/branding/abonnements | Lots isolés, sans paiement réel | CI exacte |

## 9. Préservation
- Aucun push direct ou force push main; aucune branche supprimée; aucun volume, donnée, backup ou historique comptable touché.
- Aucun paiement réel, mandat, déploiement ou opération destructive.
- #202 applicative et #204 documentaire seulement; aucun DDL.
- CI post-merge #45206892048 encore in_progress au snapshot; main n'est pas certifié stable après #204.
- Rapport Run 20 : https://github.com/morn53426-ui/-samafacture-pro/blob/main/docs/audit/rapport-execution-run20-2026-11-23.md


## Addendum — revue complémentaire devise / commandes

- Revue statique du diff PR #192 sur le head `8a11e00bb976979403e9d3fcfa8e767a074b5423` : verrou de compte cohérent partagé entre profil/localisation et créations métier; tests de concurrence couvrent plusieurs courses et la préservation des champs optionnels; aucun DDL.
- **Point bloquant métier non tranché** : `POST /api/pro/orders` accepte une devise explicite valide différente de la devise de base, alors que factures et achats fournisseurs imposent la devise de base et qu'aucune conversion n'est activée. Le test vérifie seulement le rejet d'une devise inconnue, pas le cas d'une devise supportée différente. Décider explicitement du support multidevise et de son impact rapports/comptabilité, ou appliquer la contrainte devise de base avec test de régression.
- COMMENT statique #6024556793 sur #192 (pas une approbation). #192 reste Draft; synchronisation sur main `8df0651951884623d4f5d4cd7ebc48b9c26f79e0`, CI exacte fraîche et validation humaine OHADA/devise obligatoires.
- Snapshot inventaire initial du rapport (213 branches, 54 ouvertes, 146 fermées) est pris avant la création de la branche/PR Run21; ces éléments de rapport ne sont pas inclus dans les comptes du snapshot.
