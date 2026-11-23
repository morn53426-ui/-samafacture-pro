# Rapport d'exécution — Audit SamaFacture Pro, Run 14
**Date : 23 novembre 2026 (Dakar)**

## Résumé
- **Main** : `b0b52e660af61fa781dc9a761165dd72977f969a`, inchangé depuis le dernier run.
- Dernier commit main confirmé : `fix(mobile): validate Capacitor public HTTPS before native builds`.
- Inventaire paginé : **206 branches** (100 + 100 + 6), **51 PR ouvertes**.
- Aucun merge, aucun push main, aucun force-push, aucune branche supprimée, aucune migration exécutée, aucune donnée/volume/sauvegarde/historique comptable modifié, aucun paiement réel, aucun déploiement.
- Le status combiné main a retourné un tableau vide; le connecteur ne permet pas dans ce run de confirmer les checks main via cet endpoint. Le dernier run post-merge connu du SHA main reste #45138061597 (success), mais il n'est pas présenté comme une nouvelle exécution.

## Main, commits et CI
- SHA main : `b0b52e660af61fa781dc9a761165dd72977f969a`.
- Message du head : préflight Capacitor HTTPS public renforcé, merge après validation précédente.
- Run post-merge précédemment confirmé : [45138061597](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45138061597), success; SHA main n'a pas changé.
- Workflows identifiés : Tests automatisés (Node/MySQL), ESLint JavaScript modifié, Package complete source ZIP.
- Le fetch de workflow-runs via connecteur est limité aux événements PR; il ne retourne pas les runs push/main. Le status API combiné main était vide.

## Vérification exacte des PR candidates
| PR | Head SHA | Tests | ESLint | ZIP | Décision |
|---|---|---|---|---|---|
| [#193](https://github.com/morn53426-ui/-samafacture-pro/pull/193) | `fb6324d34b024072f98d7c1347a0da330922aba4` | [1776 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45140914890) | [723 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45140914986) | [1462 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45140914942) | Draft, validation sécurité humaine |
| [#194](https://github.com/morn53426-ui/-samafacture-pro/pull/194) | `5cd2604b395e7d994c051f4b7d19f7800bccaaf6` | [1777 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45141155965) | [724 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45141155971) | [1463 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45141155951) | Draft, validation sécurité humaine |
| [#192](https://github.com/morn53426-ui/-samafacture-pro/pull/192) | `8a11e00bb976979403e9d3fcfa8e767a074b5423` | [1775 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45138383987) | [722 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45138383956) | [1461 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45138383828) | Draft, décision devise métier |
| [#197](https://github.com/morn53426-ui/-samafacture-pro/pull/197) | `d23afbe04e35db9cfbaaf70a7ee2d0f6de187b61` | [1782 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45150892896) | [725 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45150893054) | [1468 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45150893223) | Draft; review COMMENT déposée, approbation absente |
| [#196](https://github.com/morn53426-ui/-samafacture-pro/pull/196) | `539a9430c78f83908ce7b404d98804309b19d578` | [1783 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45151179027) | Non déclenché sur documentation | [1469 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45151178940) | Draft rapport Run 13 |

Les statuts sont vérifiés via runs PR rattachés à chaque SHA exact. Les revues déposées #193/#194/#197 sont **COMMENT** (non APPROVE), avec les identifiants 6019916661, 6019917386 et 6019917815.

## Revue statique indépendante
### #193 — secret de consultation facture
- `verification_code` retiré des réponses liste facture et historique client.
- Le détail authentifié conserve le code pour QR/verify; la réponse publique ne le réexpose pas.
- Tests régression liste, historique, détail, consultation publique.
- Aucun changement de schema ou calcul financier.
- Risque restant : confirmer que les composants frontend qui créent les liens QR utilisent le détail (diff statique et tests actuels ne remplacent pas la validation humaine).

### #194 — isolation tenant relationnelle
- Clauses tenant ajoutées aux jointures factures/clients/paiements, dashboard, rapports, récurrences et checkout.
- Paiements du détail facture filtrés par user_id; mises à jour du code de vérification ciblées tenant.
- Client de facture récurrente validé sous verrou avant effets métier; 409 si mismatch.
- Fixtures cross-tenant et permissions API-key évaluées dans le bon contexte.
- Aucun changement schema, migration ou montant comptable.
- Risque restant : revue sécurité humaine du périmètre complet des relations/routes et des références historiques anormales avant fusion.

### #197 — skip-link dashboard
- Lien clavier avant shell, cible main focusable, style visible au focus et test structurel.
- Diff limité à dashboard HTML, CSS et test.
- Tests Node/MySQL, lint, ZIP success sur head exact.
- Pas de changement métier ou migration. Draft, aucun avis d'approbation.

## Migrations / comptabilité
- Runtime schema : **v23**, confirmé dans `server/config/db.js`.
- v21 : trial 15 jours UTC, pas d'attribution rétroactive.
- v22 : conservation événements de contrepassation invoice; DDL retire FK invoice-event cascade, changement critique.
- v23 : mappings OHADA entreprise.
- Migration catalogue `012_comptabilite_correspondances.sql` et migrations antérieures `003` à `012` sont recensées dans l'audit précédent; aucune migration lancée ce run.
- #142 (v21) et #145 (v22) restent empilées, Draft et nécessitent validation comptable/humaine. #145 nécessite particulièrement l'approbation du changement de FK/DDL et plan de reprise.
- #149 est closed sans merge, #150/#152 restent les références historiques de mappings OHADA intégrés.

## Tableau de suivi P0-P3
| Priorité | Lot | Statut / action |
|---|---|---|
| P0 | #193 redaction verification codes | 3/3 CI green exact; draft; approbation sécurité humaine requise |
| P0 | #194 isolation cross-tenant | 3/3 CI green exact; draft; revue sécurité humaine requise |
| P0 | Audit des relations/routes restantes | À poursuivre après review des deux P0; rechercher join sans tenant et chemins historiques |
| P1 | #192 devise + verrou transactionnel | 3/3 CI green; décision explicite sur devises de commandes |
| P1 | #142 schema v21/trial 15 jours | CI précédente verte mais branch empilée; synchronisation/reconstruction et validation comptable |
| P1 | #145 schema v22 conservation audit | CI précédente verte sur head rapporté; revue DDL, backup/recovery et validation comptable |
| P2 | #197 accessibilité clavier | 3/3 CI green exact; Draft; approbation/protection requise |
| P2 | PDF/print A4, QR/cachet, responsive | Continuer par petits lots après P0/P1 |
| P2 | Workspace, pagination et accessibilité | Réconcilier PR stale avec main courant |
| P3 | Branding Sunupilot, vidéo et documentation | Après stabilisation P0/P1 |

## Fusions
**0 fusion.** Conditions non toutes remplies : PR de sécurité nécessitent approbation humaine; PR #197 reste Draft et review approbatrice/protection GitHub non confirmée. Pas de fusion par contournement.

## Risques restants
1. P0 sécurité — redaction codes et isolation tenant nécessitent approbation humaine.
2. DDL v22 — changement de FK et comportement purge tenant, validation comptable/DBA.
3. Trial v21 — règles d'expiration/entitlements doivent être validées métier; migration non rétroactive.
4. Devise — politique des commandes multi-devises non confirmée.
5. Main CI status endpoint vide dans ce run; run post-merge connu vert, mais pas de nouvel run main déclenché.
6. PR historiques empilées/stale; ne pas fusionner doublons #177/#179/#188 ni anciennes PR devise sans comparaison/synchronisation.

## Préservation
- 0 merge; 0 push direct main; 0 force push.
- 0 branche supprimée.
- 0 migration exécutée; 0 data/volume/backups/historique comptable modifiés.
- 0 paiement réel; 0 production deployment.

## Inventaire complet des branches (snapshot 206)
- `a11y/dashboard-skip-link-main-current-run13`
- `a11y/dashboard-skip-navigation-20261122`
- `a11y/mobile-sidebar-escape-focus-20261122`
- `audit/execution-report-20261122-run1`
- `audit/execution-report-20261122-run2`
- `audit/execution-report-20261123-run3`
- `audit/execution-report-20261123-run4`
- `audit/execution-report-20261123-run5`
- `audit/execution-report-20261123-run6`
- `audit/execution-report-20261123-run11`
- `audit/execution-report-20261123-run12`
- `audit/execution-report-20261123-run13`
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
- `fix/mobile-nonpublic-hostnames-current-main-20261123`
- `fix/mobile-preflight-current-main-20261123`
- `fix/mobile-preflight-main-20261123`
- `fix/mobile-preflight-main-after-security-20261123`
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
- `security/redact-verification-codes-main-current-20261123-run12`
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

## Inventaire PR ouvertes (51)
- [#197 — a11y(dashboard): keyboard skip link on current main](https://github.com/morn53426-ui/-samafacture-pro/pull/197)
- [#194 — security(tenant): enforce invoice-related ownership on current main](https://github.com/morn53426-ui/-samafacture-pro/pull/194)
- [#193 — security(invoices): redact verification codes from list responses](https://github.com/morn53426-ui/-samafacture-pro/pull/193)
- [#196 — docs(audit): execution report run 13 — 23 November](https://github.com/morn53426-ui/-samafacture-pro/pull/196)
- [#145 — fix(accounting): retain invoice reversal events (schema v22)](https://github.com/morn53426-ui/-samafacture-pro/pull/145)
- [#142 — feat(accounting, trial): integrate invoice lifecycle and 15-day trial on schema v21](https://github.com/morn53426-ui/-samafacture-pro/pull/142)
- [#195 — docs(audit): execution report run 12 — 23 November](https://github.com/morn53426-ui/-samafacture-pro/pull/195)
- [#177 — security(invoices): redact verification code from list API](https://github.com/morn53426-ui/-samafacture-pro/pull/177)
- [#192 — fix(currency): serialize tenant currency and first business writes](https://github.com/morn53426-ui/-samafacture-pro/pull/192)
- [#179 — security(invoices): enforce client and payment tenant ownership](https://github.com/morn53426-ui/-samafacture-pro/pull/179)
- [#188 — security(tenant): enforce ownership across invoice-related records](https://github.com/morn53426-ui/-samafacture-pro/pull/188)
- [#190 — fix(currency): serialize tenant currency and first business writes](https://github.com/morn53426-ui/-samafacture-pro/pull/190)
- [#185 — fix(currency): serialize tenant currency changes and first business writes](https://github.com/morn53426-ui/-samafacture-pro/pull/185)
- [#183 — fix(currency): serialize tenant currency changes and orders](https://github.com/morn53426-ui/-samafacture-pro/pull/183)
- [#182 — fix(pro): use tenant currency for orders and lock history](https://github.com/morn53426-ui/-samafacture-pro/pull/182)
- [#171 — fix(pro): use tenant currency for orders and lock history](https://github.com/morn53426-ui/-samafacture-pro/pull/171)
- [#180 — docs(audit): execution report run 11 — 23 November](https://github.com/morn53426-ui/-samafacture-pro/pull/180)
- [#178 — fix(currency): serialize tenant currency changes and orders](https://github.com/morn53426-ui/-samafacture-pro/pull/178)
- [#176 — docs(audit): rapports d'exécution runs 6 à 10 — 23 novembre](https://github.com/morn53426-ui/-samafacture-pro/pull/176)
- [#175 — docs(audit): rapport d'exécution run 5 — 23 novembre](https://github.com/morn53426-ui/-samafacture-pro/pull/175)
- [#172 — docs(audit): rapport d'exécution run 4 — 23 novembre](https://github.com/morn53426-ui/-samafacture-pro/pull/172)
- [#170 — docs(audit): rapport d'exécution run 3 — 23 novembre](https://github.com/morn53426-ui/-samafacture-pro/pull/170)
- [#169 — docs(audit): rapport d'exécution run 2 — 22 novembre](https://github.com/morn53426-ui/-samafacture-pro/pull/169)
- [#166 — docs(audit): rapport d'exécution initial du 22 novembre](https://github.com/morn53426-ui/-samafacture-pro/pull/166)
- [#156 — a11y(dashboard): ajouter un accès clavier au contenu principal](https://github.com/morn53426-ui/-samafacture-pro/pull/156)
- [#155 — ux(settings): grille responsive pour les coordonnées entreprise](https://github.com/morn53426-ui/-samafacture-pro/pull/155)
- [#154 — ux(workspace): navigation mobile compacte par domaine](https://github.com/morn53426-ui/-samafacture-pro/pull/154)
- [#153 — test(trial): vérifier l'expiration sur la première requête protégée](https://github.com/morn53426-ui/-samafacture-pro/pull/153)
- [#157 — a11y(navigation): fermer le menu mobile avec Échap](https://github.com/morn53426-ui/-samafacture-pro/pull/157)
- [#127 — fix(pdf): pagination A4 du devis Executive (28 lignes)](https://github.com/morn53426-ui/-samafacture-pro/pull/127)
- [#140 — ci(lint): couvrir les routes backend et tests de protection](https://github.com/morn53426-ui/-samafacture-pro/pull/140)
- [#130 — fix(a11y): contraste WCAG AA et focus clavier sur les deux thèmes](https://github.com/morn53426-ui/-samafacture-pro/pull/130)
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

## PR fermées visibles par le connecteur (100 résultats)
Le connecteur de recherche renvoie au maximum 100 PR fermées dans cette requête et n'offre pas ici de pagination; le total historique précédemment relevé était 142, mais le total fermé complet n'est pas recalculé à ce run.
- [#187 — fix(mobile): guard Capacitor native builds on latest main](https://github.com/morn53426-ui/-samafacture-pro/pull/187)
- [#189 — fix(mobile): validate Capacitor public HTTPS before native builds](https://github.com/morn53426-ui/-samafacture-pro/pull/189)
- [#191 — fix(currency): serialize tenant currency and first business writes](https://github.com/morn53426-ui/-samafacture-pro/pull/191)
- [#184 — fix(mobile): validate Capacitor config before native build](https://github.com/morn53426-ui/-samafacture-pro/pull/184)
- [#164 — test(security): empêcher la divulgation des hashes de réinitialisation](https://github.com/morn53426-ui/-samafacture-pro/pull/164)
- [#174 — fix(mobile): reject reserved non-public hostnames](https://github.com/morn53426-ui/-samafacture-pro/pull/174)
- [#181 — test(security): cover reset token redaction on current main](https://github.com/morn53426-ui/-samafacture-pro/pull/181)
- [#186 — fix(mobile): block native builds until public HTTPS config is valid](https://github.com/morn53426-ui/-samafacture-pro/pull/186)
- [#168 — fix: fuseau local, devise du tenant et isolation des routes](https://github.com/morn53426-ui/-samafacture-pro/pull/168)
- [#167 — fix: devise des emails, relances impayés et échappement HTML](https://github.com/morn53426-ui/-samafacture-pro/pull/167)
- [#143 — fix(accounting): map cheque payments to bank and reject unknown methods](https://github.com/morn53426-ui/-samafacture-pro/pull/143)
- [#173 — feat(mobile): block native builds until HTTPS domain is configured](https://github.com/morn53426-ui/-samafacture-pro/pull/173)
- [#159 — security(invoices): retirer le code public de la liste paginée](https://github.com/morn53426-ui/-samafacture-pro/pull/159)
- [#149 — feat(accounting): configure expense category account mappings (schema v23)](https://github.com/morn53426-ui/-samafacture-pro/pull/149)
- [#165 — docs(backup): sécuriser le transfert hors serveur rclone](https://github.com/morn53426-ui/-samafacture-pro/pull/165)
- [#163 — security(backup): restreindre les permissions du dossier de sauvegarde](https://github.com/morn53426-ui/-samafacture-pro/pull/163)
- [#162 — test(security): couvrir expiration et changement email des invitations equipe](https://github.com/morn53426-ui/-samafacture-pro/pull/162)
- [#161 — ux(dashboard): réduire le défilement mobile des modules](https://github.com/morn53426-ui/-samafacture-pro/pull/161)
- [#158 — docs(security): corriger les conseils CORS et proxy](https://github.com/morn53426-ui/-samafacture-pro/pull/158)
- [#160 — fix(backup): compatible avec le compte MySQL limité de Docker](https://github.com/morn53426-ui/-samafacture-pro/pull/160)
- [#152 — test(accounting): couvrir les correspondances OHADA des dépenses](https://github.com/morn53426-ui/-samafacture-pro/pull/152)
- [#125 — fix(pdf): pagination A4 cohérente des factures et devis longs](https://github.com/morn53426-ui/-samafacture-pro/pull/125)
- [#151 — fix(print): preserve full-width invoice banners on A4](https://github.com/morn53426-ui/-samafacture-pro/pull/151)
- [#150 — feat(accounting): configure OHADA sales and expense mappings](https://github.com/morn53426-ui/-samafacture-pro/pull/150)
- [#148 — reconcile: port trial and accounting protections (schema v22) onto current main](https://github.com/morn53426-ui/-samafacture-pro/pull/148)
- [#147 — integration: réconcilier comptabilité OHADA et essai gratuit v21 avec main actuel](https://github.com/morn53426-ui/-samafacture-pro/pull/147)
- [#146 — fix(integration): reconcile OHADA, 15-day trial and audit retention on current main](https://github.com/morn53426-ui/-samafacture-pro/pull/146)
- [#117 — fix(accounting): reverse invoice entries on cancellation and reactivation](https://github.com/morn53426-ui/-samafacture-pro/pull/117)
- [#144 — fix(accounting): retain invoice reversal events on invoice deletion (schema v22)](https://github.com/morn53426-ui/-samafacture-pro/pull/144)
- [#119 — feat(accounting): distinguish cash and bank expense payments](https://github.com/morn53426-ui/-samafacture-pro/pull/119)
- [#120 — fix(accounting): reverse refund entries in cash and bank journals](https://github.com/morn53426-ui/-samafacture-pro/pull/120)
- [#123 — test(pdf): garantir une facture courte sur une page A4](https://github.com/morn53426-ui/-samafacture-pro/pull/123)
- [#121 — fix(pdf): préserver le cachet sur les écrans mobiles](https://github.com/morn53426-ui/-samafacture-pro/pull/121)
- [#116 — test(pdf): couvrir la pagination des factures longues](https://github.com/morn53426-ui/-samafacture-pro/pull/116)
- [#124 — fix(invoice): afficher les montants des lignes sans scroll mobile](https://github.com/morn53426-ui/-samafacture-pro/pull/124)
- [#122 — test(visual): fournir un QR code aux fixtures mobiles facture/devis](https://github.com/morn53426-ui/-samafacture-pro/pull/122)
- [#113 — fix(pdf): preserve company date and number formats in headless PDFs](https://github.com/morn53426-ui/-samafacture-pro/pull/113)
- [#112 — fix(pdf): repeat company and document identity on continuation pages](https://github.com/morn53426-ui/-samafacture-pro/pull/112)
- [#106 — test(stock): validate invoice warehouse routing](https://github.com/morn53426-ui/-samafacture-pro/pull/106)
- [#111 — fix(invoice): keep print banners inside the A4 printable area](https://github.com/morn53426-ui/-samafacture-pro/pull/111)
- [#109 — fix(invoice): keep quotes available during warehouse API outages](https://github.com/morn53426-ui/-samafacture-pro/pull/109)
- [#107 — feat(stock): route invoice movements to the selected warehouse](https://github.com/morn53426-ui/-samafacture-pro/pull/107)
- [#108 — fix(stock): éviter les deadlocks lors de l'initialisation du magasin principal](https://github.com/morn53426-ui/-samafacture-pro/pull/108)
- [#105 — feat(dashboard): rapprocher les raccourcis de la référence Sunupilot](https://github.com/morn53426-ui/-samafacture-pro/pull/105)
- [#104 — fix(pwa): fiabiliser le cycle de vie du service worker](https://github.com/morn53426-ui/-samafacture-pro/pull/104)
- [#103 — feat(brand): intégrer les fondations visuelles SUNUPILOT](https://github.com/morn53426-ui/-samafacture-pro/pull/103)
- [#101 — fix(accessibility): corriger les contrastes et auditer les 17 pages](https://github.com/morn53426-ui/-samafacture-pro/pull/101)
- [#100 — test(visual): couvrir le zoom 200 % en thème sombre](https://github.com/morn53426-ui/-samafacture-pro/pull/100)
- [#98 — fix(responsive): corriger les tableaux au zoom 200 %](https://github.com/morn53426-ui/-samafacture-pro/pull/98)
- [#97 — fix(dashboard): améliorer la lisibilité du total des factures](https://github.com/morn53426-ui/-samafacture-pro/pull/97)
- [#96 — test(theme): vérifier le mode clair sur bureau](https://github.com/morn53426-ui/-samafacture-pro/pull/96)
- [#95 — test(theme): vérifier le mode clair sur mobile](https://github.com/morn53426-ui/-samafacture-pro/pull/95)
- [#94 — test(theme): vérifier le mode sombre sur mobile](https://github.com/morn53426-ui/-samafacture-pro/pull/94)
- [#93 — fix(theme): garantir le contraste de l’aperçu facture en mode sombre](https://github.com/morn53426-ui/-samafacture-pro/pull/93)
- [#82 — chore(agents): intégrer les skills design engineering](https://github.com/morn53426-ui/-samafacture-pro/pull/82)
- [#83 — docs(billing): cadrer l'architecture des abonnements mensuels](https://github.com/morn53426-ui/-samafacture-pro/pull/83)
- [#92 — test(pdf): vérifier les polices incorporées et les marges A4 réelles](https://github.com/morn53426-ui/-samafacture-pro/pull/92)
- [#85 — docs(ui): préparer les corrections responsive et animations](https://github.com/morn53426-ui/-samafacture-pro/pull/85)
- [#90 — fix(print): vérifier la typographie et l'impression A4 des 31 modèles](https://github.com/morn53426-ui/-samafacture-pro/pull/90)
- [#91 — fix(invoice): améliorer les polices et l’impression A4 des factures et devis](https://github.com/morn53426-ui/-samafacture-pro/pull/91)
- [#89 — fix(ui): corriger la cohérence des thèmes clair et sombre](https://github.com/morn53426-ui/-samafacture-pro/pull/89)
- [#88 — docs(docker): clarifier le démarrage local avec Docker](https://github.com/morn53426-ui/-samafacture-pro/pull/88)
- [#87 — feat(invoice): ajouter 3 modèles Pro et 4 modèles Entreprise](https://github.com/morn53426-ui/-samafacture-pro/pull/87)
- [#86 — fix(ui): améliorer les interactions sidebar et Entreprise sur mobile](https://github.com/morn53426-ui/-samafacture-pro/pull/86)
- [#84 — feat(billing): préparer le moteur d'abonnement mensuel en simulation locale](https://github.com/morn53426-ui/-samafacture-pro/pull/84)
- [#81 — feat(nav): moderniser le rail latéral avec libellés](https://github.com/morn53426-ui/-samafacture-pro/pull/81)
- [#77 — test(billing): verrouiller les abonnements récurrents non activés](https://github.com/morn53426-ui/-samafacture-pro/pull/77)
- [#78 — docs(billing): clarifier l’état réel des abonnements mensuels](https://github.com/morn53426-ui/-samafacture-pro/pull/78)
- [#80 — feat(entreprise): paginer la liste des sociétés du groupe](https://github.com/morn53426-ui/-samafacture-pro/pull/80)
- [#79 — feat(nav): moderniser la barre latérale et les icônes](https://github.com/morn53426-ui/-samafacture-pro/pull/79)
- [#76 — fix(pdf): améliorer la pagination des devis et factures](https://github.com/morn53426-ui/-samafacture-pro/pull/76)
- [#75 — fix(pdf): éviter les pages isolées dans les devis volumineux](https://github.com/morn53426-ui/-samafacture-pro/pull/75)
- [#72 — fix(team): sécuriser les invitations classiques par preuve email](https://github.com/morn53426-ui/-samafacture-pro/pull/72)
- [#73 — feat(ui): simplifier les espaces Entreprise et professionnel](https://github.com/morn53426-ui/-samafacture-pro/pull/73)
- [#74 — ci: exécuter le test réel de restauration des sauvegardes chiffrées](https://github.com/morn53426-ui/-samafacture-pro/pull/74)
- [#71 — feat(entreprise): centre de pilotage consolidé du groupe](https://github.com/morn53426-ui/-samafacture-pro/pull/71)
- [#60 — feat(entreprise): socle multi-sociétés et cadrage de l’abonnement mensuel](https://github.com/morn53426-ui/-samafacture-pro/pull/60)
- [#63 — fix(realtime): autoriser les groupes Entreprise dans les notifications](https://github.com/morn53426-ui/-samafacture-pro/pull/63)
- [#69 — fix(security): vérifier l’adresse email avant le rattachement multi-sociétés](https://github.com/morn53426-ui/-samafacture-pro/pull/69)
- [#64 — docs(audit): documenter le risque de vérification des invitations multi-sociétés](https://github.com/morn53426-ui/-samafacture-pro/pull/64)
- [#67 — docs(email): corriger le comportement SMTP local et tester la redaction](https://github.com/morn53426-ui/-samafacture-pro/pull/67)
- [#59 — docs(staging): corriger la procédure Docker Compose et HTTPS](https://github.com/morn53426-ui/-samafacture-pro/pull/59)
- [#57 — fix(a11y): associer les libellés de la page Paramètres](https://github.com/morn53426-ui/-samafacture-pro/pull/57)
- [#65 — docs(billing): distinguer achat ponctuel et abonnement récurrent](https://github.com/morn53426-ui/-samafacture-pro/pull/65)
- [#56 — fix(pdf): file durable avec acquittement et reprise, mentions paiement exactes](https://github.com/morn53426-ui/-samafacture-pro/pull/56)
- [#68 — feat: laisser le client choisir son moyen de paiement](https://github.com/morn53426-ui/-samafacture-pro/pull/68)
- [#53 — docs: ajouter le plan d’entreprise et la stratégie de lancement](https://github.com/morn53426-ui/-samafacture-pro/pull/53)
- [#62 — fix(entreprise): corriger la migration v10 et les invitations](https://github.com/morn53426-ui/-samafacture-pro/pull/62)
- [#55 — audit: corriger la conservation des tâches PDF en attente](https://github.com/morn53426-ui/-samafacture-pro/pull/55)
- [#54 — fix: remove Nginx upstream balancing warning](https://github.com/morn53426-ui/-samafacture-pro/pull/54)
- [#52 — security: redact sensitive tokens from HTTP access logs](https://github.com/morn53426-ui/-samafacture-pro/pull/52)
- [#51 — CI: bloquer les dépendances présentant une vulnérabilité npm](https://github.com/morn53426-ui/-samafacture-pro/pull/51)
- [#50 — Fix: éviter la concurrence d'initialisation MySQL du worker PDF](https://github.com/morn53426-ui/-samafacture-pro/pull/50)
- [#49 — test(ui): cover notification placement with visual viewport offsets](https://github.com/morn53426-ui/-samafacture-pro/pull/49)
- [#48 — fix(ui): keep notifications visible above the mobile keyboard](https://github.com/morn53426-ui/-samafacture-pro/pull/48)
- [#46 — fix(ui): keep mobile notifications inside viewport](https://github.com/morn53426-ui/-samafacture-pro/pull/46)
- [#47 — Éviter les mauvais destinataires WhatsApp pour les numéros locaux](https://github.com/morn53426-ui/-samafacture-pro/pull/47)
- [#45 — Sécuriser la sauvegarde, la rétention et la restauration de la base](https://github.com/morn53426-ui/-samafacture-pro/pull/45)
- [#43 — Améliorer le mobile, les aperçus A4 et l’espace professionnel](https://github.com/morn53426-ui/-samafacture-pro/pull/43)
- [#44 — Sécurité : rendre la révocation des sessions immédiate entre workers](https://github.com/morn53426-ui/-samafacture-pro/pull/44)


## Addendum — commits récents de main (20 résultats, 23 novembre)
Requête récente paginée/triée par date commit. Liste observée :
- `b0b52e660af61fa781dc9a761165dd72977f969a` — fix(mobile): validate Capacitor public HTTPS before native builds
- `b276eba52b5179f351efe68d18cf540a170c70fd` — test(security): cover reset token hash redaction
- `262707e11d6f362820bf07018647df4312791444` — ci(lint): include auth reset token redaction tests
- `aa4bf4f64c4be58c4ad69064f4ef58f8411450a2` — test(security): cover reset token hash redaction on current main
- `13111355a0d2bc71ee0f3a01b504179b2d136926` — fix: fuseau local, devise du tenant et isolation
- `19fcafb0be02c261ea799236fed046bdce80a291` — fix: devises, relances et échappement HTML
- `b43a94fc2937b0108077501a0260358c8569e11f` — docs(backup): sécuriser le transfert hors serveur rclone
- `e6a2caf04f0648d30419042c97cb63b6a14a05f8` — merge PR #163 backup-directory permissions
- `1c3a12bacd9c6a761247756562ea77ebe50ef41d` — merge latest main invitation-security test into backup hardening
- `596b3311f12c41946906b236274d9c8a615393d6` — test invitations expiration/change-email (#162)
- `b8df6bfac18e4eb2776a35887e178af6d8d42bfd` — merge dashboard update and backup lint target
- `cc728a65336a5ad154136c668f3be06256e66ede` — merge dashboard module rail into backup permissions fix
- `8d0f287f46a96cb0697d7a0be9f6fe055b6e5a51` — UX dashboard module rail mobile (#161)
- `f3844b627efcdf6472ef57bffe3d69283a36bb37` — keep server/.env.example current
- `1d42ba738607a1f648e3391c051a618061654f69` — keep .env template current
- `d6a054483a11a3ebd7020fa8850d59f07dafdc22` — merge main into backup permissions hardening
- `06c3589daf5f49405e9a7ead70ee5cc9aece2a12` — merge latest main preserving backup directory permissions
- `5f1c09d655b340eac687d983e322e740798b7817` — security proxy/CORS documentation (#158)
- `db790c1d25cdedabf19d33cffd5bf489bc77d1ef` — refactor backup redundant mkdir
- `620b919b8f317d2fd5116728ff5aa292aa3357b0` — merge main and MySQL backup permissions
