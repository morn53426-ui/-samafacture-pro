# Audit & développement SamaFacture Pro — Run 12
**Snapshot GitHub : 23 novembre 2026, ~08:45 UTC**  
Repository: https://github.com/morn53426-ui/-samafacture-pro

## Résumé exécutif
- `main` observé : **`b0b52e660af61fa781dc9a761165dd72977f969a`**; CI main run **45138061597** `Tests automatisés` = **success** sur SHA exact.
- Snapshot avant création du présent rapport : **203 branches** et **48 PR ouvertes**. Ce rapport et sa PR sont additifs; aucune branche/PR antérieure n'est supprimée.
- `main` est stable dans les vérifications disponibles. Aucun merge durant Run 12.
- Trois lots de sécurité préparés/reconstruits sur des branches dédiées : #193 (codes de vérification), #194 (isolation tenant), et #188 fixture correction commit `39f27a3` portée sur #194. Tous restent en draft; validation humaine sécurité avant fusion.
- Aucun push sur `main`, force push, branche supprimée, migration exécutée, volume/donnée/backup/historique comptable modifié, paiement réel ou déploiement.

## 1. Main — SHA et 10 commits récents
- [`b0b52e660af61fa781dc9a761165dd72977f969a`](https://github.com/morn53426-ui/-samafacture-pro/commit/b0b52e660af61fa781dc9a761165dd72977f969a) — fix(mobile): validate Capacitor public HTTPS before native builds

Fusion après validation complète des tests Node/MySQL, restauration chiffrée, smoke Docker, recette responsive, ESLint et ZIP. (2026-11-23T08:22:09Z)
- [`b276eba52b5179f351efe68d18cf540a170c70fd`](https://github.com/morn53426-ui/-samafacture-pro/commit/b276eba52b5179f351efe68d18cf540a170c70fd) — test(security): cover reset token hash redaction

test(security): cover reset token redaction on current main (2026-11-23T08:09:51Z)
- [`262707e11d6f362820bf07018647df4312791444`](https://github.com/morn53426-ui/-samafacture-pro/commit/262707e11d6f362820bf07018647df4312791444) — ci(lint): include auth reset token redaction tests (2026-11-23T08:00:09Z)
- [`aa4bf4f64c4be58c4ad69064f4ef58f8411450a2`](https://github.com/morn53426-ui/-samafacture-pro/commit/aa4bf4f64c4be58c4ad69064f4ef58f8411450a2) — test(security): cover reset token hash redaction on current main (2026-11-23T08:00:07Z)
- [`13111355a0d2bc71ee0f3a01b504179b2d136926`](https://github.com/morn53426-ui/-samafacture-pro/commit/13111355a0d2bc71ee0f3a01b504179b2d136926) — fix: fuseau local, devise du tenant et isolation

Fusion après validation des tests automatisés, ESLint et package source ZIP; PR #167 déjà intégrée. (2026-11-23T07:58:23Z)
- [`19fcafb0be02c261ea799236fed046bdce80a291`](https://github.com/morn53426-ui/-samafacture-pro/commit/19fcafb0be02c261ea799236fed046bdce80a291) — fix: devises, relances et échappement HTML

Fusion après validation des tests automatisés, ESLint et package source ZIP. (2026-11-23T07:57:52Z)
- [`b43a94fc2937b0108077501a0260358c8569e11f`](https://github.com/morn53426-ui/-samafacture-pro/commit/b43a94fc2937b0108077501a0260358c8569e11f) — docs(backup): sécuriser le transfert hors serveur rclone

* docs(backup): verrouiller l'image rclone du transfert hors site

* docs(backup): expliciter la config et le home rclone

* docs(backup): vérifier le propriétaire du volume Docker (2026-11-22T23:00:10Z)
- [`e6a2caf04f0648d30419042c97cb63b6a14a05f8`](https://github.com/morn53426-ui/-samafacture-pro/commit/e6a2caf04f0648d30419042c97cb63b6a14a05f8) — Merge pull request #163 from morn53426-ui/fix/backup-directory-permissions-20261122 (2026-11-22T22:43:06Z)
- [`1c3a12bacd9c6a761247756562ea77ebe50ef41d`](https://github.com/morn53426-ui/-samafacture-pro/commit/1c3a12bacd9c6a761247756562ea77ebe50ef41d) — Merge latest main invitation-security test into backup directory hardening (2026-11-22T22:36:47Z)
- [`596b3311f12c41946906b236274d9c8a615393d6`](https://github.com/morn53426-ui/-samafacture-pro/commit/596b3311f12c41946906b236274d9c8a615393d6) — test(security): couvrir expiration et changement email des invitations equipe (#162)

* test(security): couvrir expiration et changement email des invitations equipe

* test(security): isoler l’outbox des scénarios invitation

* ux(dashboard): réduire le défilement mobile des modules (#161)

* ux(dashboard): rail horizontal des modules sur mobile

* test(dashboard): accepter et vérifier le focus du rail modules

* ci(lint): inclure le test clavier du dashboard (2026-11-22T22:33:54Z)

## 2. CI de main et PRs — SHA exacts
- Main `b0b52e660af61fa781dc9a761165dd72977f969a`: run [45138061597](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45138061597) `Tests automatisés` **success**.
- Main précédent `b276eba52b5179f351efe68d18cf540a170c70fd`: run [45136394570](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45136394570) **success**.
- #192 head `8a11e00bb976979403e9d3fcfa8e767a074b5423`: Tests [45138383987] success; ESLint [45138383956] success; ZIP [45138383828] success — 3/3 sur head exact.
- #193 head `fb6324d34b024072f98d7c1347a0da330922aba4`: Tests [45140914890] **in_progress** au snapshot; ESLint [45140914986] success; ZIP [45140914942] success. Pas encore complet.
- #194 head `5cd2604b395e7d994c051f4b7d19f7800bccaaf6`: Tests [45141155965] **in_progress** et ZIP [45141155951] **in_progress** au snapshot; aucun ESLint run visible encore. Pas encore complet.
- #188 head `39f27a324412cefae046181e22430ba79f24b5c5`: aucun run CI visible à l'instant du snapshot; statut commit pending.
- #177 head `f68ab94eb1d4c2c01d08331321cda293ab0a264f`: Tests [45118980192], ESLint [45118980187] et ZIP [45118980228] success, mais branche/base obsolète.

## 3. Findings P0
### P0-A — codes publics divulgués par les listes
Main actuel renvoie `verification_code` via `SELECT *` dans la liste factures et l'historique client. Ce secret protège la consultation publique; il ne doit pas être distribué par les listes.
- Candidate actuelle : [PR #193](https://github.com/morn53426-ui/-samafacture-pro/pull/193), branche `security/redact-verification-codes-main-current-20261123-run12` (head `fb6324d`).
- Correctif : retirer le code des deux réponses liste; conserver le détail authentifié pour le QR; test de la consultation publique; lint ciblé.
- CI : tests en cours, lint et ZIP green sur head exact. **Aucune approbation humaine ni fusion.**

### P0-B — relations inter-tenant
Cause racine : requêtes tenant-aware sur la ligne principale, mais certaines jointures sur ID seulement; référence historique anormale pouvait faire apparaître client/facture/paiement d'un autre tenant.
- Candidate actuelle : [PR #194](https://github.com/morn53426-ui/-samafacture-pro/pull/194), branche `security/tenant-relations-main-current-20261123-run12`, base `b0b52e660af61fa781dc9a761165dd72977f969a`, head `5cd2604`.
- Correctifs : facture/client/paiement/dashboard/rapports/commandes/bons/avoirs/acomptes/refunds/checkout; validation verrouillée du client dans la génération récurrente; test cross-tenant et lint.
- Fixture API-key : l'échec #45137909256 sur #188 (`1e82c9b`) attendait 403 mais recevait 201, car le membre n'envoyait pas `X-SF-Company-Owner`; `resolveTenant` testait son espace personnel (owner) et non la société lecture seule. Commit `39f27a3` ajoute le contexte; #194 porte cette correction.
- CI #194 en cours au snapshot. **Revue humaine sécurité obligatoire avant fusion.**

### Duplicates conservés
- #179 base `b43a94fc`, head `5f554950`, `dirty`, CI sur head non confirmée.
- #188 base `b276eba5`, head `39f27a3`, un commit main derrière et workflow conflictuant; aucun run exact visible.
- #194 est la reconstruction candidate sur main actuel. #179/#188/branches restent ouvertes et intactes; ne pas fusionner deux lots chevauchants.

## 4. P1 — devise / concurrence
- [PR #192](https://github.com/morn53426-ui/-samafacture-pro/pull/192) : verrou transactionnel tenant sur réglages et premières écritures; 12 tests de concurrence décrits; 3/3 CI green sur SHA exact `8a11e00`; 11 commits ahead / 0 behind main.
- Maintenir draft : décision métier en suspens sur commandes commerciales qui acceptent une devise différente du tenant. Ne pas changer le comportement financier sans confirmation. Aucun merge.

## 5. P1 comptabilité / migrations — validation humaine
- Schema version actuelle dans `server/config/db.js`: **23**.
- Migrations versionnées présentes : `003_professional_modules.sql` à `012_comptabilite_correspondances.sql` (incluant 011 événements comptables facture, 012 correspondances OHADA).
- Scripts SQL legacy à la racine : `migration_2026_08_30_stabilite.sql`, `migration_2026_11_15_token_version.sql`, `migration_facture_personnalisation.sql`, `migration_index_reset_token.sql`, `migration_scalabilite_30_41.sql`.
- #142 schema v21 essai 15 jours/cycle facture et #145 schema v22 conservation/contrepassation comptable : changes comptables critiques; validation comptable/humaine et revue migration/rollback avant toute fusion.
- Aucune migration lancée dans Run 12.

## 6. Ruleset / protection main
Ruleset `27410527` `protect main` **active** :
- Bloque suppression et non-fast-forward.
- PR obligatoire, résolution threads obligatoire, status checks stricts.
- Required checks : `Tests Node.js et MySQL`, `Build complete source archive`.
- Approvals configurés : 0; malgré cela, les exigences utilisateur demandent une revue/validation humaine spécifique pour sécurité et comptabilité. Aucun acteur de bypass; `current_user_can_bypass=never`.
- Méthodes autorisées : merge, squash, rebase.

## 7. Planning P0–P3
| Priorité | Lot | État / prochaine étape |
|---|---|---|
| P0 | #193 redaction `verification_code` | tests en cours; attendre suite complète, revue humaine, sync si main avance |
| P0 | #194 isolation cross-tenant | tests/ZIP en cours; ESLint à confirmer; revue sécurité humaine; ne pas merger #179/#188 |
| P1 | #192 verrou devise | 3/3 CI green; décision métier multi-devise commandes requise |
| P1 | #142/#145 cycle facture/essai et conservation comptable | revue migration + validation comptable/humaine |
| P1 | #128 essai gratuit 15 jours / espace professionnel | vérifier CI sur base main courante, revue business |
| P2 | impression/PDF, pagination, QR/cachet, responsive, accessibilité | tests visuels A4, factures 1/plusieurs pages, mobile et zoom |
| P3 | Sunupilot vidéo/branding et documentation | après stabilisation P0/P1 |

## 8. Inventaire complet des branches (203)
- `a11y/dashboard-skip-navigation-20261122`
- `a11y/mobile-sidebar-escape-focus-20261122`
- `audit/execution-report-20261122-run1`
- `audit/execution-report-20261122-run2`
- `audit/execution-report-20261123-run3`
- `audit/execution-report-20261123-run4`
- `audit/execution-report-20261123-run5`
- `audit/execution-report-20261123-run6`
- `audit/execution-report-20261123-run11`
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

## 9. Inventaire complet des PR ouvertes (48)
- [#194 security(tenant): enforce invoice-related ownership on current main](https://github.com/morn53426-ui/-samafacture-pro/pull/194) — `security/tenant-relations-main-current-20261123-run12` @ `5cd2604b39`; base `b0b52e660a`; draft
- [#193 security(invoices): redact verification codes from list responses](https://github.com/morn53426-ui/-samafacture-pro/pull/193) — `security/redact-verification-codes-main-current-20261123-run12` @ `fb6324d34b`; base `b0b52e660a`; draft
- [#192 fix(currency): serialize tenant currency and first business writes](https://github.com/morn53426-ui/-samafacture-pro/pull/192) — `fix/tenant-currency-final-main-20261123` @ `8a11e00bb9`; base `b0b52e660a`; draft
- [#190 fix(currency): serialize tenant currency and first business writes](https://github.com/morn53426-ui/-samafacture-pro/pull/190) — `fix/tenant-currency-atomic-current-main-20261123` @ `0abc0440d1`; base `b276eba52b`; draft
- [#188 security(tenant): enforce ownership across invoice-related records](https://github.com/morn53426-ui/-samafacture-pro/pull/188) — `security/invoice-client-tenant-current-main-after-181-20261123` @ `39f27a3244`; base `b276eba52b`; draft
- [#185 fix(currency): serialize tenant currency changes and first business writes](https://github.com/morn53426-ui/-samafacture-pro/pull/185) — `fix/tenant-currency-atomic-main-20261123` @ `50b9fcc21b`; base `13111355a0`; draft
- [#183 fix(currency): serialize tenant currency changes and orders](https://github.com/morn53426-ui/-samafacture-pro/pull/183) — `fix/tenant-currency-atomic-lock-main-20261123` @ `4a73d68d91`; base `1c51012381`; draft
- [#182 fix(pro): use tenant currency for orders and lock history](https://github.com/morn53426-ui/-samafacture-pro/pull/182) — `fix/pro-orders-tenant-currency-main-20261123` @ `a078a351d7`; base `13111355a0`; draft
- [#180 docs(audit): execution report run 11 — 23 November](https://github.com/morn53426-ui/-samafacture-pro/pull/180) — `audit/execution-report-20261123-run11` @ `2f1b11e77d`; base `b43a94fc29`; draft
- [#179 security(invoices): enforce client and payment tenant ownership](https://github.com/morn53426-ui/-samafacture-pro/pull/179) — `security/invoice-client-tenant-scope-20261123` @ `5f554950cb`; base `b43a94fc29`; draft
- [#178 fix(currency): serialize tenant currency changes and orders](https://github.com/morn53426-ui/-samafacture-pro/pull/178) — `fix/tenant-currency-atomic-lock-20261123` @ `70b4c68858`; base `953489e79a`; draft
- [#177 security(invoices): redact verification code from list API](https://github.com/morn53426-ui/-samafacture-pro/pull/177) — `security/invoice-verification-code-redaction-main-20261123-run7` @ `f68ab94eb1`; base `b43a94fc29`; draft
- [#176 docs(audit): rapports d'exécution runs 6 à 10 — 23 novembre](https://github.com/morn53426-ui/-samafacture-pro/pull/176) — `audit/execution-report-20261123-run6` @ `8083f938c8`; base `b43a94fc29`; draft
- [#175 docs(audit): rapport d'exécution run 5 — 23 novembre](https://github.com/morn53426-ui/-samafacture-pro/pull/175) — `audit/execution-report-20261123-run5` @ `f9f95b734d`; base `b43a94fc29`; draft
- [#172 docs(audit): rapport d'exécution run 4 — 23 novembre](https://github.com/morn53426-ui/-samafacture-pro/pull/172) — `audit/execution-report-20261123-run4` @ `14688f7a8f`; base `b43a94fc29`; draft
- [#171 fix(pro): use tenant currency for orders and lock history](https://github.com/morn53426-ui/-samafacture-pro/pull/171) — `fix/pro-orders-tenant-currency-20261123` @ `953489e79a`; base `13111355a0`; draft
- [#170 docs(audit): rapport d'exécution run 3 — 23 novembre](https://github.com/morn53426-ui/-samafacture-pro/pull/170) — `audit/execution-report-20261123-run3` @ `6fa59a42eb`; base `b43a94fc29`; draft
- [#169 docs(audit): rapport d'exécution run 2 — 22 novembre](https://github.com/morn53426-ui/-samafacture-pro/pull/169) — `audit/execution-report-20261122-run2` @ `dff61fb42a`; base `b43a94fc29`; draft
- [#166 docs(audit): rapport d'exécution initial du 22 novembre](https://github.com/morn53426-ui/-samafacture-pro/pull/166) — `audit/execution-report-20261122-run1` @ `dc7e6f55c5`; base `b43a94fc29`; draft
- [#157 a11y(navigation): fermer le menu mobile avec Échap](https://github.com/morn53426-ui/-samafacture-pro/pull/157) — `a11y/mobile-sidebar-escape-focus-20261122` @ `c37403034a`; base `00d52ca8ac`; ready
- [#156 a11y(dashboard): ajouter un accès clavier au contenu principal](https://github.com/morn53426-ui/-samafacture-pro/pull/156) — `a11y/dashboard-skip-navigation-20261122` @ `8f45795c3d`; base `8d0f287f46`; ready
- [#155 ux(settings): grille responsive pour les coordonnées entreprise](https://github.com/morn53426-ui/-samafacture-pro/pull/155) — `ux/settings-company-fields-grid-20261122` @ `99670cdf29`; base `00d52ca8ac`; ready
- [#154 ux(workspace): navigation mobile compacte par domaine](https://github.com/morn53426-ui/-samafacture-pro/pull/154) — `ux/pro-workspace-mobile-domain-rail-20261122` @ `185e0487c9`; base `8d0f287f46`; ready
- [#153 test(trial): vérifier l'expiration sur la première requête protégée](https://github.com/morn53426-ui/-samafacture-pro/pull/153) — `test/free-trial-expiry-session-guard-20261122` @ `29932fbbef`; base `00d52ca8ac`; ready
- [#145 fix(accounting): retain invoice reversal events (schema v22)](https://github.com/morn53426-ui/-samafacture-pro/pull/145) — `fix/accounting-event-audit-retention-v22-run2-20261122` @ `5b6ba8bf3b`; base `decb8da2e4`; draft
- [#142 feat(accounting, trial): integrate invoice lifecycle and 15-day trial on schema v21](https://github.com/morn53426-ui/-samafacture-pro/pull/142) — `integration/schema-v21-accounting-trial-20261122` @ `decb8da2e4`; base `8453ee6d8e`; draft
- [#141 ci: add workspace UI structure regression checks](https://github.com/morn53426-ui/-samafacture-pro/pull/141) — `ci/workspace-ui-structure-tests-20261122` @ `2a09ccf8bf`; base `868027e1ed`; draft
- [#140 ci(lint): couvrir les routes backend et tests de protection](https://github.com/morn53426-ui/-samafacture-pro/pull/140) — `ci/lint-history-protection-backend-20261122` @ `32d1c1f56c`; base `00d52ca8ac`; draft
- [#139 fix(a11y): improve professional workspace status contrast](https://github.com/morn53426-ui/-samafacture-pro/pull/139) — `fix/pro-workspace-status-contrast-20261122` @ `baa9ea6a68`; base `8453ee6d8e`; draft
- [#138 fix(inventory): protect products with stock or history](https://github.com/morn53426-ui/-samafacture-pro/pull/138) — `fix/product-delete-stock-history-protection-20261122` @ `27d5a6c27d`; base `8453ee6d8e`; draft
- [#137 fix(accounting): protect clients with linked history](https://github.com/morn53426-ui/-samafacture-pro/pull/137) — `fix/client-delete-history-protection-20261122` @ `f2aada8d5c`; base `8453ee6d8e`; draft
- [#136 fix(accounting): protect posted expenses from edits and deletion](https://github.com/morn53426-ui/-samafacture-pro/pull/136) — `fix/expense-ledger-protection-20261122` @ `4e0f2a8938`; base `8453ee6d8e`; draft
- [#135 fix(accounting): preserve issued invoice history](https://github.com/morn53426-ui/-samafacture-pro/pull/135) — `fix/invoice-delete-history-guard-20261122` @ `2c7f3cbde9`; base `8453ee6d8e`; draft
- [#134 fix(a11y): badge Entreprise lisible en thème sombre](https://github.com/morn53426-ui/-samafacture-pro/pull/134) — `fix/enterprise-badge-contrast-main-20261122` @ `52021018d7`; base `8453ee6d8e`; draft
- [#133 fix(a11y): corriger le contraste des aperçus de modèles](https://github.com/morn53426-ui/-samafacture-pro/pull/133) — `fix/accessibility-template-preview-contrast-20261122` @ `6b3cd9ffd5`; base `c607f397c4`; draft
- [#132 docs(audit): état initial et plan priorisé 22 novembre](https://github.com/morn53426-ui/-samafacture-pro/pull/132) — `audit/initial-review-20261122` @ `6543b3a701`; base `8453ee6d8e`; draft
- [#131 docs: actualiser la feuille de route sur le main courant](https://github.com/morn53426-ui/-samafacture-pro/pull/131) — `docs/improvement-plan-main-20261122` @ `3d51f0afb6`; base `8453ee6d8e`; draft
- [#130 fix(a11y): contraste WCAG AA et focus clavier sur les deux thèmes](https://github.com/morn53426-ui/-samafacture-pro/pull/130) — `fix/accessibility-contrast-focus-main-20261121` @ `0b819127cc`; base `00d52ca8ac`; draft
- [#129 feat(workspace): navigation par domaines et paramètres structurés](https://github.com/morn53426-ui/-samafacture-pro/pull/129) — `feat/workspace-settings-navigation-20261121` @ `868027e1ed`; base `8453ee6d8e`; draft
- [#128 feat(trial,workspace): essai 15 jours et organisation professionnelle](https://github.com/morn53426-ui/-samafacture-pro/pull/128) — `feat/15-day-trial-entitlements-20261121` @ `e3b91dc4ae`; base `8453ee6d8e`; ready
- [#127 fix(pdf): pagination A4 du devis Executive (28 lignes)](https://github.com/morn53426-ui/-samafacture-pro/pull/127) — `fix/quote-executive-a4-pagination-20261121` @ `400ce60ddb`; base `00d52ca8ac`; ready
- [#126 feat(landing): présentation vidéo Sunupilot — portage sur main actuel](https://github.com/morn53426-ui/-samafacture-pro/pull/126) — `integration/sunupilot-video-main-20261121` @ `817b10da7b`; base `8453ee6d8e`; draft
- [#118 feat(landing): vidéo Sunupilot — capture locale automatisée des écrans](https://github.com/morn53426-ui/-samafacture-pro/pull/118) — `feature/video-presentation-spark-sunupilot` @ `29dd7ccc80`; base `f49d352125`; ready
- [#115 test(accounting): cover expense posting and tenant isolation](https://github.com/morn53426-ui/-samafacture-pro/pull/115) — `test/ohada-expense-ledger-integrity-20261121` @ `3873c1d1db`; base `f49d352125`; ready
- [#114 docs: centralize SamaFacture Pro improvement roadmap](https://github.com/morn53426-ui/-samafacture-pro/pull/114) — `docs/improvement-plan-20261121` @ `ff2cae7bd3`; base `5478809ee7`; ready
- [#110 test(accessibility): cover light/dark keyboard navigation and contrast](https://github.com/morn53426-ui/-samafacture-pro/pull/110) — `test/accessibility-dark-keyboard-rebased-20261120` @ `722b5bfce0`; base `f42f69e184`; ready
- [#102 test(accessibility): couvrir le thème sombre et le parcours clavier](https://github.com/morn53426-ui/-samafacture-pro/pull/102) — `test/accessibility-dark-keyboard-20261118` @ `86aeeb6f4b`; base `b5863a0d34`; draft
- [#99 Adopt SunuPilot branding — indigo and baobab green](https://github.com/morn53426-ui/-samafacture-pro/pull/99) — `rebrand/optigest` @ `3f70466d0b`; base `b5863a0d34`; ready

## 10. Bilan Run 12
- Merges : **0**.
- Push direct main : **0**; force push : **0**.
- Branche/PR supprimée : **0**.
- Migration exécutée : **0**.
- Données, volumes, sauvegardes, historique comptable modifiés : **0**.
- Paiement réel/déploiement : **0**.
- Risques restants : tests #193/#194 en cours; #188/#179 duplicates non synchronisées; validations humaines sécurité #193/#194 et comptabilité #142/#145; décision devises #192.


## Addendum — après publication du rapport (23 novembre, ~08:47 UTC)
- La branche du rapport `audit/execution-report-20261123-run12` et la PR [#195](https://github.com/morn53426-ui/-samafacture-pro/pull/195) ont été ajoutées sans écraser l'historique. Le snapshot inventaire ci-dessus est antérieur à ce rapport : après création, le total observé est 204 branches et 49 PR ouvertes (si aucune activité concurrente).
- #193 : Tests #45140914890 encore `in_progress`; ESLint #45140914986 success; ZIP #45140914942 success.
- #194 : Tests #45141155965 encore `in_progress`; ESLint #45141155971 success; ZIP #45141155951 success.
- Revue statique COMMENT, sans approbation, publiée sur les heads exacts #193 et #194. Les deux PR restent draft et exigent validation humaine sécurité.
- Main n'a pas bougé du SHA `b0b52e660af61fa781dc9a761165dd72977f969a` au dernier snapshot; run main #45138061597 reste success.
