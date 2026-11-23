# SamaFacture Pro — Rapport d'exécution Run 5 (23 novembre 2026)

## Snapshot
- Dépôt : morn53426-ui/-samafacture-pro, public, branche par défaut main.
- Snapshot après création de la branche de rapport mais avant ouverture de sa PR : **182 branches**, **45 PR ouvertes**, **125 PR fermées**.
- Main HEAD vérifié : b43a94fc2937b0108077501a0260358c8569e11f.
- À l'ouverture de la PR Run 5, le nombre de PR ouvertes augmentera de 1; ce snapshot ne sera pas écrasé.
- **0 merge, 0 push direct/force push sur main, 0 migration exécutée, 0 opération destructive, 0 paiement réel, 0 déploiement.**

## Main et CI post-fusion
- GitHub Actions run ID 45080802243, job 137388318607, Tests Node.js et MySQL : **success** sur le SHA exact.
- Logs exacts : 584 tests, 583 pass, 0 fail, 1 skipped; restauration réelle/chiffrée 1 pass; recette visuelle responsive 147 captures sur 7 largeurs; smoke cluster MySQL/Redis success.
- L'API combined commit status retourne zéro status context; la réussite est vérifiée via le job Actions et ses logs.
- Les protections de main documentées au Run 4 (ruleset actif, bypass never, PR/conversations/checks requis, 0 approvals) n'ont pas pu être relues directement par endpoint de protection pendant ce run.

## 15 commits récents observés
| SHA court | Date UTC | Sujet |
|---|---|---|
| b43a94fc2937 | 2026-11-22T23:00:10Z | docs(backup): sécuriser le transfert hors serveur rclone |
| e6a2caf04f06 | 2026-11-22T22:43:06Z | Merge pull request #163 from morn53426-ui/fix/backup-directory-permissions-20261122 |
| 1c3a12bacd9c | 2026-11-22T22:36:47Z | Merge latest main invitation-security test into backup directory hardening |
| 596b3311f12c | 2026-11-22T22:33:54Z | test(security): couvrir expiration et changement email des invitations equipe (#162) |
| b8df6bfac18e | 2026-11-22T22:27:19Z | Merge dashboard update and keep backup permission lint target |
| cc728a65336a | 2026-11-22T22:26:11Z | Merge dashboard module rail and main into backup directory permissions fix |
| 8d0f287f46a9 | 2026-11-22T22:24:22Z | ux(dashboard): réduire le défilement mobile des modules (#161) |
| f3844b627efc | 2026-11-22T22:17:53Z | fix(sync): conserver server/.env.example de main |
| 1d42ba738607 | 2026-11-22T22:17:22Z | fix(sync): conserver le modèle .env courant de main |
| d6a054483a11 | 2026-11-22T22:16:41Z | Merge latest main into backup directory permissions hardening |
| 06c3589daf5f | 2026-11-22T22:16:08Z | Merge latest main while preserving private backup directory permissions |
| 5f1c09d655b3 | 2026-11-22T22:15:02Z | docs(security): corriger les conseils CORS et proxy (#158) |
| db790c1d25cd | 2026-11-22T22:08:02Z | refactor(backup): supprimer le mkdir redondant |
| 620b919b8f31 | 2026-11-22T22:07:00Z | Merge main and MySQL backup permissions into backup-directory-permissions |
| d736f90ee003 | 2026-11-22T22:06:18Z | fix(backup): compatible avec le compte MySQL limité de Docker (#160) |

## CI sur les SHA exacts des PR prioritaires
| PR | Head SHA | Tests Node/MySQL | ESLint | ZIP | Gate |
|---|---|---|---|---|---|
| #173 | 23c1cf95bf459118324dfece3580ece4470b9b34 | success (589; 588 pass, 0 fail, 1 skip) | success | success | 147 captures/7 widths, restoration 1/1; revue humaine requise |
| #174 | e7cf79a28767f05aee89075d1b6351f227d29c6b | **aucun run** | **aucun run** | **aucun run** | Base branch #173 absente des filtres CI; draft, gate bloqué |
| #171 | 953489e79a9a6779b03e9c436559b925904f5635 | success (595; 594 pass, 0 fail, 1 skip) | success | success | stack #168; review humaine requise |
| #172 | 14688f7a8fd8fe5d9b3cdde50bb546ac7485f30e | success (584; 583 pass, 0 fail, 1 skip) | non déclenché (Markdown) | success | rapport documentaire |
| #167 | 4e848f3b98b1bc93635f0dab01a7d752fd2b18cd | success | success | success | tests XSS/scheduler + review indépendante |
| #168 | b07000daa7663196de68a42bc0ba011f4f4cf7f9 | success | success | success | race du verrou de devise non résolue |
| #149 | 6f82b82dfab5c6d4a8b0fc0a466b331a2ebab3c7 | success | success | success | migration 012/version23 conflictuelle |
| #159 | 1c6bf875b98273cac0c00ac5c306aa22dcafb8d3 | success | success | success | stale, rebase/diff requis |
| #164 | a10bc748a38b05a80caf21c9f2f16da5e729d2e1 | success | success | success | review indépendante requise |

## PR prioritaires — branches, commits, diffs
| PR | Head SHA | Branch head | Base | Commits | Fichiers | État |
|---|---|---|---|---:|---|
| #173 | 23c1cf95bf459118324dfece3580ece4470b9b34 | feat/mobile-config-preflight | main | 7 | 5 | ready |
| #174 | e7cf79a28767f05aee89075d1b6351f227d29c6b | fix/mobile-nonpublic-hostnames-20261123 | feat/mobile-config-preflight | 3 | 3 | draft |
| #171 | 953489e79a9a6779b03e9c436559b925904f5635 | fix/pro-orders-tenant-currency-20261123 | fix/webhook-localtimezone-dynamic-currency-20261123 | 10 | 7 | draft |
| #172 | 14688f7a8fd8fe5d9b3cdde50bb546ac7485f30e | audit/execution-report-20261123-run4 | main | 2 | 1 | draft |
| #167 | 4e848f3b98b1bc93635f0dab01a7d752fd2b18cd | fix/audit-devise-relances-escape | main | 26 | 22 | open |
| #168 | b07000daa7663196de68a42bc0ba011f4f4cf7f9 | fix/webhook-localtimezone-dynamic-currency-20261123 | main | — | — | open |
| #149 | 6f82b82dfab5c6d4a8b0fc0a466b331a2ebab3c7 | feat/ohada-account-mappings-20261122 | main | 4 | 14 | draft |
| #159 | 1c6bf875b98273cac0c00ac5c306aa22dcafb8d3 | security/invoice-list-verification-code-redaction-20261122 | main | 18 | 16 | open |
| #164 | a10bc748a38b05a80caf21c9f2f16da5e729d2e1 | test/security-auth-reset-token-redaction-20261122 | main | 3 | 2 | open |

## Findings et corrections
- #173 mobile preflight : refuse placeholders, HTTP, IP littérales et local domains. Head CI green; la configuration utilise toujours le placeholder, donc preflight doit échouer jusqu'au domaine HTTPS réel.
- Revue run5 : suffixes DNS réservés/non publics .example, .home.arpa, .lan, .corp, .private, .alt, .onion n'étaient pas rejetés. Correction #174 ajoute guard, tests et README. Diff 3 fichiers relu.
- #174 CI absent : base feat/mobile-config-preflight n'est pas dans les filtres PR de test.yml, lint.yml, package-source-zip.yml; draft empilée, gate bloqué. Aucun approval.
- Limite : validation statique, pas de résolution DNS; un domaine public peut malgré tout pointer vers IP privée. DNS/TLS/connexion à vérifier sur device/simulator.
- #171 devise pro : CI exacte green, mais la race entre changement de devise et création de documents reste à corriger par transaction/verrou cohérent + test concurrent.
- #167 devise/relances/HTML : CI exact green; tests XSS et scheduler multi-devise et review humaine restent gates.
- #159 code verification list : CI exact green sur head stale, rebase.
- #164 reset hashes : CI exact green, review indépendante.
- #149 OHADA : main version23, migrations 003–012. Migration 012 déjà présente (012_comptabilite_correspondances.sql); #149 propose autre 012/version23. Requis 013/version24, upgrade v23→v24, replay/idempotence, FK composée tenant, validation OHADA humaine.
- #142–#147 intégrations v21/v22 : réconciliation migration/écritures, idempotence, audit historique et validation humaine avant merge.

## Workflows CI
- .github/workflows/test.yml: tests Node/MySQL séquentiels, npm audit, restauration chiffrée, smoke cluster MySQL/Redis, recette responsive.
- .github/workflows/lint.yml: ESLint ciblé par paths et base branch.
- .github/workflows/package-source-zip.yml: archive complète source sur PR, bases de branches filtrées.
- Finding CI stack: #174 base feat/mobile-config-preflight non incluse dans les filtres, donc pas de run exact.

## Branches (inventaire complet snapshot)
- a11y/dashboard-skip-navigation-20261122
- a11y/mobile-sidebar-escape-focus-20261122
- audit/execution-report-20261122-run1
- audit/execution-report-20261122-run2
- audit/execution-report-20261123-run3
- audit/execution-report-20261123-run4
- audit/execution-report-20261123-run5
- audit/fix-backup-and-runtime-20261110
- audit/fix-enterprise-migration-invitation-20261116
- audit/fix-nginx-upstream-order-20261116
- audit/fix-realtime-company-groups-20261116-run1
- audit/fix-reset-email-docs-and-redaction-test-20261116
- audit/initial-review-20261122
- audit/invoice-pdf-typography-print-20261118
- audit/npm-audit-gate-2026-11-16
- audit/rapport-approfondi-2026-11-16-run2
- audit/securite-2026-11-15
- audit/security-multisocietes-review-20261116-run3
- audit/ui-runtime-pages-polish-20261113
- audit/visual-viewport-offset-regression-20261116
- automation/audit-fixes-20261116-0150
- automation/visual-viewport-notifications-20261116-0243
- brand/sunupilot-identity-foundation
- chore/emil-design-skills-20261117
- ci/lint-history-protection-backend-20261122
- ci/package-main-after-pr39-pr40
- ci/real-restore-smoke-20261117
- ci/workspace-ui-structure-tests-20261122
- docs/backup-offsite-pinned-rclone-20261122
- docs/business-plan-samafacture-pro
- docs/correct-one-time-plan-billing-2026-11-16
- docs/fix-staging-compose-runbook-20261116
- docs/improvement-plan-20261121
- docs/improvement-plan-main-20261122
- docs/local-docker-bootstrap-20261117
- docs/production-env-security-guidance-20261122
- docs/subscription-monthly-architecture-20261117
- docs/subscriptions-current-state-20261117
- docs/ui-polish-plans-20261117
- feat/abonnement-choix-moyen-paiement
- feat/accounting-expense-payment-mode-20261121
- feat/dashboard-reference-layout
- feat/dashboard-reference-modules-20261119
- feat/dashboard-reference-redesign-20261112
- feat/enterprise-command-center-20261117
- feat/enterprise-company-pagination-20261117
- feat/enterprise-multi-company-foundation-20261116
- feat/enterprise-page-structure-2026-11-13
- feat/enterprise-page-structure-v2-2026-11-13
- feat/enterprise-pages-v2-2026-11-13
- feat/enterprise-workspace-ux-20261117
- feat/invoice-stock-warehouse-20261119
- feat/invoice-template-gallery-2026-11-15-v2
- feat/invoice-template-gallery-2026-11-15
- feat/invoice-templates-pro-enterprise-20261117
- feat/invoice-warehouse-stock-20261119
- feat/invoice-warehouse-stock-main-20261119
- feat/mobile-config-preflight
- feat/monthly-invoice-quota-v8-2026-11-15
- feat/ohada-account-mappings-20261122
- feat/phases-2-4-paiements-compta-achats-20261112
- feat/phases-5-7-portal-international-automation-20261112
- feat/professional-subscription-page-2026-11-15
- feat/responsive-scaling-2026-11-15
- feat/sidebar-icon-label-navigation-20261117
- feat/sidebar-navigation-visual-refresh-20261117
- feat/subscription-engine-local-simulation-20261117
- feat/sunupilot-dashboard-reference
- feat/templates-factures-devis-complets
- feat/topbar-notifications-bell-20261112
- feat/ui-motion-visual-recette-20261112
- feat/workspace-settings-navigation-20261121
- feat/5-nouveaux-modeles-facture
- feat/15-day-trial-entitlements-20261121
- feature/ohada-expense-account-mappings-20261122
- feature/video-presentation-spark-sunupilot
- fix/a11y-settings-labels-20261116
- fix/accessibility-contrast-focus-main-20261121
- fix/accessibility-template-preview-contrast-20261122
- fix/accounting-event-audit-retention-v22-20261122
- fix/accounting-event-audit-retention-v22-run2-20261122
- fix/accounting-invoice-cancellation-reversal-20261121
- fix/accounting-refund-journal-reversal-20261121
- fix/atomic-backup-publish-2026-11-15
- fix/atomic-encrypted-backups-2026-11-15
- fix/audit-devise-relances-escape
- fix/backup-directory-permissions-20261122
- fix/backup-retention-guard-2026-11-16
- fix/ci-serial-tests-2026-11-15
- fix/client-delete-history-protection-20261122
- fix/dashboard-donut-count-20261118
- fix/docker-context-secrets-and-lockfile-2026-11-15
- fix/docker-local-startup-mysql-redis-swagger
- fix/enterprise-badge-contrast-main-20261122
- fix/enterprise-invitation-email-proof-20261116
- fix/expense-ledger-protection-20261122
- fix/invoice-delete-history-guard-20261122
- fix/invoice-footer-stamp-mobile-20261121
- fix/invoice-mobile-table-cards-20261121
- fix/invoice-pdf-continuation-identity-20261121
- fix/invoice-print-and-payment-stamp-2026-11-15
- fix/invoice-print-banner-geometry-20261121
- fix/invoice-print-banner-spacing-20261122
- fix/invoice-print-typography-20261118
- fix/invoice-settlement-integrity-2026-11-15
- fix/invoice-stock-principal-warehouse
- fix/light-dark-theme-consistency-20261118
- fix/mobile-invoice-line-columns
- fix/mobile-nonpublic-hostnames-20261123
- fix/monthly-invoice-quota-schema-v8-2026-11-15
- fix/mysql-backup-limited-privileges-20261122
- fix/navigation-compact-sidebar-2026-11-13
- fix/pdf-headless-user-formatting-20261121
- fix/pdf-pagination-extras-flow-20261117
- fix/pdf-print-pagination-20261117
- fix/pdf-stream-ack-payment-disclosures-20261116
- fix/pdf-worker-db-readiness-2026-11-16
- fix/pdf-worker-health-and-sidebar-icons-2026-11-15
- fix/pdf-worker-wait-for-api-health-2026-11-15
- fix/pro-orders-tenant-currency-20261123
- fix/pro-workspace-status-contrast-20261122
- fix/product-delete-stock-history-protection-20261122
- fix/purchase-receipt-warehouse-deadlock-20261119
- fix/quota-registry-initialization-robustness-2026-11-15
- fix/quote-executive-a4-pagination-20261121
- fix/quote-warehouse-resilience-20261120
- fix/refund-payment-method-mapping-20261122
- fix/refund-payment-method-mapping-rebased-20261122
- fix/revoke-jwt-on-logout-2026-11-15
- fix/session-revocation-and-payment-timeouts-2026-11-15
- fix/sidebar-aria-current-2026-11-15
- fix/subscription-disabled-state-tests-docs-20261117
- fix/subscription-icons-main-2026-11-15
- fix/sunupilot-pwa-lifecycle
- fix/team-invitation-email-proof-20261117
- fix/ui-icons-legibility-2026-11-15
- fix/ui-responsive-polish-20261117
- fix/visual-qr-fixture-20261121
- fix/webhook-local-timezone-dynamic-currency-20261123
- fix/whatsapp-country-guard-2026-11-16
- improve/pdf-page3-balance-20261121
- improve/pdf-page3-balance-main-20261121
- integration/main-company-invitation-email-proof-20261117
- integration/reconcile-main-v21-20261122
- integration/schema-v21-accounting-trial-20261122
- integration/schema-v22-main-reconciled-20261122
- integration/sunupilot-video-main-20261121
- main
- qa/test-pdf-24-modeles
- rebase/pr106-main-20261121-run1
- rebase/pr110-main-20261121-run1
- rebrand/optigest
- reconciliation/schema-v21-main-base-20261122
- security/docker-ignore-local-secrets-2026-11-15
- security/immediate-session-revocation-2026-11-16
- security/invoice-list-verification-code-redaction-20261122
- security/redact-secret-urls-in-logs-2026-11-16
- test/accessibility-audit-business-pages-20261118
- test/accessibility-dark-keyboard-20261118
- test/accessibility-dark-keyboard-rebased-20261120
- test/backup-atomic-visibility-2026-11-15
- test/dark-theme-zoom-200-sweep-20261118
- test/expense-accounting-mappings-regression-20261122
- test/free-trial-expiry-session-guard-20261122
- test/invoice-long-pdf-pagination-20261121
- test/invoice-short-pdf-one-page-20261121
- test/invoice-short-pdf-one-page-main-20261121
- test/ohada-expense-ledger-integrity-20261121
- test/pdf-font-embedding-and-visual-print-20261118
- test/security-auth-reset-token-redaction-20261122
- test/team-invitation-expiry-email-change-20261122
- test/theme-dark-mobile-sweep-20261118
- test/theme-dark-sweep-20261118
- test/theme-light-desktop-sweep-20261118
- test/theme-light-mobile-sweep-20261118
- test/workspace-zoom-200-sweep-20261118
- tooling/local-docker-test-bundle-20261112
- ui/augmenter-logo-icones-sidebar
- ui/modern-responsive-polish
- ux/dashboard-mobile-module-rail-20261122
- ux/pro-workspace-mobile-domain-rail-20261122
- ux/settings-company-fields-grid-20261122

## PR ouvertes (inventaire complet snapshot)
- [#174](https://github.com/morn53426-ui/-samafacture-pro/pull/174) — fix(mobile): reject reserved non-public hostnames
- [#173](https://github.com/morn53426-ui/-samafacture-pro/pull/173) — feat(mobile): block native builds until HTTPS domain is configured
- [#168](https://github.com/morn53426-ui/-samafacture-pro/pull/168) — fix: fuseau local, devise du tenant et isolation des routes
- [#172](https://github.com/morn53426-ui/-samafacture-pro/pull/172) — docs(audit): rapport d'exécution run 4 — 23 novembre
- [#171](https://github.com/morn53426-ui/-samafacture-pro/pull/171) — fix(pro): use tenant currency for orders and lock history
- [#170](https://github.com/morn53426-ui/-samafacture-pro/pull/170) — docs(audit): rapport d'exécution run 3 — 23 novembre
- [#167](https://github.com/morn53426-ui/-samafacture-pro/pull/167) — fix: devise des emails, relances impayés et échappement HTML
- [#169](https://github.com/morn53426-ui/-samafacture-pro/pull/169) — docs(audit): rapport d'exécution run 2 — 22 novembre
- [#149](https://github.com/morn53426-ui/-samafacture-pro/pull/149) — feat(accounting): configure expense category account mappings (schema v23)
- [#166](https://github.com/morn53426-ui/-samafacture-pro/pull/166) — docs(audit): rapport d'exécution initial du 22 novembre
- [#156](https://github.com/morn53426-ui/-samafacture-pro/pull/156) — a11y(dashboard): ajouter un accès clavier au contenu principal
- [#159](https://github.com/morn53426-ui/-samafacture-pro/pull/159) — security(invoices): retirer le code public de la liste paginée
- [#155](https://github.com/morn53426-ui/-samafacture-pro/pull/155) — ux(settings): grille responsive pour les coordonnées entreprise
- [#154](https://github.com/morn53426-ui/-samafacture-pro/pull/154) — ux(workspace): navigation mobile compacte par domaine
- [#153](https://github.com/morn53426-ui/-samafacture-pro/pull/153) — test(trial): vérifier l'expiration sur la première requête protégée
- [#157](https://github.com/morn53426-ui/-samafacture-pro/pull/157) — a11y(navigation): fermer le menu mobile avec Échap
- [#164](https://github.com/morn53426-ui/-samafacture-pro/pull/164) — test(security): empêcher la divulgation des hashes de réinitialisation
- [#127](https://github.com/morn53426-ui/-samafacture-pro/pull/127) — fix(pdf): pagination A4 du devis Executive (28 lignes)
- [#140](https://github.com/morn53426-ui/-samafacture-pro/pull/140) — ci(lint): couvrir les routes backend et tests de protection
- [#130](https://github.com/morn53426-ui/-samafacture-pro/pull/130) — fix(a11y): contraste WCAG AA et focus clavier sur les deux thèmes
- [#147](https://github.com/morn53426-ui/-samafacture-pro/pull/147) — integration: réconcilier comptabilité OHADA et essai gratuit v21 avec main actuel
- [#145](https://github.com/morn53426-ui/-samafacture-pro/pull/145) — fix(accounting): retain invoice reversal events (schema v22)
- [#142](https://github.com/morn53426-ui/-samafacture-pro/pull/142) — feat(accounting, trial): integrate invoice lifecycle and 15-day trial on schema v21
- [#146](https://github.com/morn53426-ui/-samafacture-pro/pull/146) — fix(integration): reconcile OHADA, 15-day trial and audit retention on current main
- [#132](https://github.com/morn53426-ui/-samafacture-pro/pull/132) — docs(audit): état initial et plan priorisé 22 novembre
- [#128](https://github.com/morn53426-ui/-samafacture-pro/pull/128) — feat(trial,workspace): essai 15 jours et organisation professionnelle
- [#144](https://github.com/morn53426-ui/-samafacture-pro/pull/144) — fix(accounting): retain invoice reversal events on invoice deletion (schema v22)
- [#143](https://github.com/morn53426-ui/-samafacture-pro/pull/143) — fix(accounting): map cheque payments to bank and reject unknown methods
- [#141](https://github.com/morn53426-ui/-samafacture-pro/pull/141) — ci: add workspace UI structure regression checks
- [#138](https://github.com/morn53426-ui/-samafacture-pro/pull/138) — fix(inventory): protect products with stock or history
- [#137](https://github.com/morn53426-ui/-samafacture-pro/pull/137) — fix(accounting): protect clients with linked history
- [#139](https://github.com/morn53426-ui/-samafacture-pro/pull/139) — fix(a11y): improve professional workspace status contrast
- [#135](https://github.com/morn53426-ui/-samafacture-pro/pull/135) — fix(accounting): preserve issued invoice history
- [#136](https://github.com/morn53426-ui/-samafacture-pro/pull/136) — fix(accounting): protect posted expenses from edits and deletion
- [#134](https://github.com/morn53426-ui/-samafacture-pro/pull/134) — fix(a11y): badge Entreprise lisible en thème sombre
- [#115](https://github.com/morn53426-ui/-samafacture-pro/pull/115) — test(accounting): cover expense posting and tenant isolation
- [#133](https://github.com/morn53426-ui/-samafacture-pro/pull/133) — fix(a11y): corriger le contraste des aperçus de modèles
- [#126](https://github.com/morn53426-ui/-samafacture-pro/pull/126) — feat(landing): présentation vidéo Sunupilot — portage sur main actuel
- [#131](https://github.com/morn53426-ui/-samafacture-pro/pull/131) — docs: actualiser la feuille de route sur le main courant
- [#118](https://github.com/morn53426-ui/-samafacture-pro/pull/118) — feat(landing): vidéo Sunupilot — capture locale automatisée des écrans
- [#99](https://github.com/morn53426-ui/-samafacture-pro/pull/99) — Adopt SunuPilot branding — indigo and baobab green
- [#114](https://github.com/morn53426-ui/-samafacture-pro/pull/114) — docs: centralize SamaFacture Pro improvement roadmap
- [#102](https://github.com/morn53426-ui/-samafacture-pro/pull/102) — test(accessibility): couvrir le thème sombre et le parcours clavier
- [#110](https://github.com/morn53426-ui/-samafacture-pro/pull/110) — test(accessibility): cover light/dark keyboard navigation and contrast
- [#129](https://github.com/morn53426-ui/-samafacture-pro/pull/129) — feat(workspace): navigation par domaines et paramètres structurés

## PR fermées (numéros, triés)
1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 59, 60, 62, 63, 64, 65, 67, 68, 69, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 100, 101, 103, 104, 105, 106, 107, 108, 109, 111, 112, 113, 116, 117, 119, 120, 121, 122, 123, 124, 125, 148, 150, 151, 152, 158, 160, 161, 162, 163, 165

PR records #58, #61, #66 et #70 restent gaps à vérifier. Le snapshot fermé est réparti par date de création pour éviter le plafond 100 : 10 (22–23 nov), 99 (15–21 nov), 16 (1–14 nov), 0 avant 1 nov = 125.

## Planning P0–P3
| Priority | Lot | Gate |
|---|---|---|
| P0 | #171/#168 race devise | transaction + test concurrent, CI exact, review humaine |
| P0 | #167 sécurité/XSS scheduler | tests hostiles, multi-devise/idempotence, review indépendante |
| P0 | #159/#164 | rebase, diff, CI exacte, approbation humaine |
| P0 | #173 mobile preflight | review humaine; domaine public réel non défini |
| P0 | #174 hostname guard | CI stack filter à corriger/synchroniser, CI exacte, review |
| P1 | #149 OHADA | 013/v24, upgrade/replay/FK tenant, validation humaine |
| P1 | #142–#147 accounting/trial v21/v22 | reconciliation, tests de migration/écritures, validation humaine |
| P2 | PDF/print, UX, responsive, a11y | PR petites, recette visuelle/print |
| P3 | branding, vidéo, documentation | après stabilisation |

## Risques et historique
- Reviewer indépendant indisponible; aucune APPROVE n'a été donnée.
- #174 sans CI exacte; #168 race; #149 migration; #159/#164 stale.
- Main 1 test ignoré; le skip ne compte pas comme réussite.
- Protections GitHub non re-vérifiées directement dans ce run; Run4 reste l'évidence.
- Aucun merge, migration, suppression, modification historique comptable, paiement réel, déploiement ou opération destructive.
- Rapports historiques conservés : #166 Run1, #169 Run2, #170 Run3, #172 Run4; ce fichier est nouveau Run5.
