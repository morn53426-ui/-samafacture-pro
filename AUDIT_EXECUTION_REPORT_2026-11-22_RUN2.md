# Rapport d'exécution SamaFacture Pro — Run 2 (22 novembre 2026)

## Résumé

- Repository : morn53426-ui/-samafacture-pro (public), branche par défaut main.
- SHA main observé : b43a94fc2937b0108077501a0260358c8569e11f.
- 175 branches recensées en deux pages; aucune branche supprimée.
- 38 PR ouvertes, 125 fermées (PR numéros manquants : 58, 61, 66, 70; total 163 PR existantes).
- 2 merges vérifiés dans ce run : #163 puis #165. Aucun merge effectué par ce run.
- Aucune CI post-merge de main confirmée : status API vide et outil workflow-runs ne retourne que les runs déclenchés par PR.
- Aucun push sur main, force-push, contournement de protection, migration, opération destructive, paiement réel ou déploiement.

## SHA / merges

| Référence | SHA / résultat | Vérification |
|---|---|---|
| main | b43a94fc2937b0108077501a0260358c8569e11f | head observé; status combiné vide (0 checks), aucun run push-main accessible |
| #165 (runbook rclone) | head 76aa447d8beefa49dc7da11d334144bd2c75427f; merge b43a94fc2937b0108077501a0260358c8569e11f | Tests automatisés success + ZIP success sur head; post-merge main non vérifié |
| #163 (permissions backup) | head 1c3a12bacd9c6a761247756562ea77ebe50ef41; merge e6a2caf04f0648d30419042c97cb63b6a14a05f8 | La description PR rapporte une CI sur f3844b6; run exact du head actuel non retrouvé; post-merge main non vérifié |
| #167 (currency/XSS) | 96e1641fd9fb28ff890578ff13c9612c5c3ac52b | Tests automatisés success, ESLint success, ZIP success sur ce SHA exact |
| #166 (rapport run1) | dc7e6f55c5f7d357400f78c26dcfa469b75c3cef | Tests success + ZIP success; rapport historique conservé |
| #149 (mapping charges) | 6f82b82dfab5c6d4a8b0fc0a466b331a2ebab3c7 | Tests, ESLint et ZIP success sur head, mais base stale et migration bloquante |

## CI / workflows

- .github/workflows/test.yml : PR vers main et push main; Node 26, MySQL 8, Redis 7, Docker/Compose + nginx, npm audit bloquant, tests Node/MySQL séquentiels, restauration réelle chiffrée, smoke cluster et recette visuelle responsive.
- .github/workflows/lint.yml : ESLint ciblé par fichiers et paths; les listes de fichiers test/lint doivent être maintenues lors de nouveaux tests.
- .github/workflows/package-source-zip.yml : archive source.
- Le runbook de protection main indique (vérification datée 16 novembre) PR obligatoire, approbation indépendante, conversations résolues, tests et archive requis, branche à jour et aucun bypass. L'état actuel des rulesets/protections n'a pas pu être relu via l'accès disponible; cette documentation est une preuve historique, pas une vérification actuelle.
- Main SHA b43a94fc… : status combiné 0 checks; aucune CI post-merge exacte confirmée. Ne pas déclarer main green.

## Migrations / comptabilité

- CURRENT_SCHEMA_VERSION sur main : 23.
- SQL migrations référencées : 003_professional_modules.sql, 004_paiements_comptabilite_achats.sql, 005_portail_crm_international_ia.sql, 006_company_groups.sql, 007_email_outbox.sql, 008_company_group_email_proof.sql, 009_team_invitation_email_proof.sql, 010_saas_subscriptions_simulation.sql, 011_comptabilite_contrepas_factures.sql, 012_comptabilite_correspondances.sql (10 fichiers, 003–012).
- Migration 012 actuelle : correspondances OHADA par entreprise, ventes et catégories de dépenses; la table utilise la relation compte/user composée.
- Migration 011 actuelle : événements de comptabilisation/contrepassation facture; FK invoice event conserve encore ON DELETE CASCADE. Les routes main protègent les factures émises contre suppression; la protection application est vérifiée, mais la rétention FK reste une défense en profondeur à examiner.
- PR #149 ajoute une seconde migration 012 et conserve version 23. **Blocage** : les installations déjà en v23 ne rejouent pas runMigrations; la table nouvelle manquerait. Il faut migration 013/version 24, tests v23→24/replay, et FK composée (compte_id,user_id) pour l'isolation tenant. Commentaire ajouté à PR #149 (commentaire 7087962190); demande formelle de changes impossible car ce PR appartient au compte qui exécute l'audit.
- PRs #142/#145/#144/#143/#147/#146 sont des intégrations comptables/trial/audit basées sur des branches différentes, très divergées/stales; pas de fusion. Toute migration destructive ou écriture historique exige validation humaine spécifique.

## Revue de corrections déjà présentes sur main

Les protections suivantes sont déjà dans les fichiers main observés (ne pas re-portar aveuglément les PRs anciennes #135–#138) :
- Factures émises non supprimables; utiliser annulation/contrepassation : server/routes/factures.js SHA 9787bf8ad464bc0582bede0aad6639f599306b91.
- Dépenses comptabilisées non supprimables/modifiables : server/routes/depenses.js SHA 4b957bf7dec502234c78619de8469cf307cbab72.
- Clients avec historique protégé : server/routes/clients.js SHA 9267461cf54f3f8950c768b858d1f30ee01cf632.
- Produits avec stock/historique protégés : server/routes/produits.js SHA b2054c78956dd45a009524f84cf7c978190cea1a.
Les PR #135/#136/#137/#138 sont donc des branches de travail stale/duplicatives à réconcilier, pas des candidats à merge sans relecture du main actuel.

## Revue #167 — currency/reminders/HTML escaping

- Head 96e1641fd9fb28ff890578ff13c9612c5c3ac52b, base main b43a94fc2937b0108077501a0260358c8569e11f; 23 commits, 19 fichiers, ahead 23/behind 0, mergeable selon GitHub au moment de l'audit.
- Les erreurs interpolées dans innerHTML et le succès du reset password sont échappés via escapeHtml; les pages modifiées chargent js/api.js.
- CI 3/3 success sur head exact, y compris recette visuelle.
- Revue/commentaire de l'audit déposée sur le head; elle n'est pas une approbation indépendante (même compte). Tests supplémentaires demandés : XSS avec message API hostile et tests scheduler multi-devise/compatibilité des anciennes run_key.
- Aucun merge; attendre approbation indépendante et contrôles branch protection actuels.

## PR ouvertes — état exact au moment du run

CI abbreviations : 3/3 = Tests + ESLint + ZIP success; 2/2 = Tests + ZIP success; no runs = aucun run PR trouvé; failed = Tests en échec. Les comparaisons sont main...head; behind signifie commits manquants de main.

| PR | Head branch / SHA court | Commits / fichiers PR | Ahead / behind main | CI | Mergeable / état |
|---|---|---:|---:|---|---|
| #167 | fix/audit-devise-relances-escape / 96e1641 | 23 / 19 | 23 / 0 | 3/3 pass | yes, ready |
| #166 | audit/execution-report-20261122-run1 / dc7e6f5 | 1 / 1 | 1 / 0 | 2/2 pass | yes, draft; historique |
| #164 | test/security-auth-reset-token-redaction-20261122 / a10bc74 | 3 / 2 | 3 / 16 | 3/3 pass | yes, stale |
| #159 | security/invoice-list-verification-code-redaction-20261122 / 1c6bf87 | 18 / 16 | 12 / 15 | 3/3 pass | no, stale |
| #156 | a11y/dashboard-skip-navigation-20261122 / 8f45795 | 9 / 5 | 8 / 15 | 3/3 pass | yes, stale |
| #155 | ux/settings-company-fields-grid-20261122 / 99670cd | 15 / 16 | 9 / 15 | 3/3 pass | no, stale |
| #154 | ux/pro-workspace-mobile-domain-rail-20261122 / 185e048 | 9 / 5 | 8 / 15 | 3/3 pass | yes, stale |
| #153 | test/free-trial-expiry-session-guard-20261122 / 29932fb | 16 / 15 | 10 / 15 | 3/3 pass | no, stale |
| #157 | a11y/mobile-sidebar-escape-focus-20261122 / c374030 | 16 / 16 | 10 / 15 | 3/3 pass | no, stale |
| #127 | fix/quote-executive-a4-pagination-20261121 / 400ce60 | 6 / 3 | 6 / 21 | 3/3 pass | yes, stale |
| #140 | ci/lint-history-protection-backend-20261122 / 32d1c1f | 5 / 1 | 5 / 21 | 3/3 pass | no, stale |
| #130 | fix/accessibility-contrast-focus-main-20261121 / 0b81912 | 21 / 7 | 21 / 21 | 3/3 pass | no, stale |
| #149 | feature/ohada-expense-account-mappings-20261122 / 6f82b82 | 4 / 14 | 4 / 42 | 3/3 pass | no, draft, migration blocker |
| #147 | integration/reconcile-main-v21-20261122 / e8b2dc9 | 78 / 44 | 78 / 45 | 3/3 pass | no, draft integration |
| #145 | fix/accounting-event-audit-retention-v22-run2-20261122 / 5b6ba8b | 15 / 7 | 92 / 93 | 3/3 pass | yes, draft; base integration |
| #142 | integration/schema-v21-accounting-trial-20261122 / decb8da | 77 / 48 | 77 / 93 | 3/3 pass | no, draft integration |
| #146 | integration/schema-v22-main-reconciled-20261122 / 62ea473 | 93 / 44 | 93 / 45 | 3/3 pass | no, draft integration |
| #132 | audit/initial-review-20261122 / 6543b3a | 84 / 3 | 84 / 93 | 2/2 pass | yes, draft/stale |
| #128 | feat/15-day-trial-entitlements-20261121 / e3b91dc | 39 / 26 | 39 / 93 | 3/3 pass | no, stale |
| #144 | fix/accounting-event-audit-retention-v22-20261122 / 90b718a | 6 / 5 | 80 / 93 | no runs | yes, draft; base integration |
| #143 | fix/refund-payment-method-mapping-rebased-20261122 / 17d25a5 | 3 / 2 | 64 / 93 | no runs | no, draft; base integration |
| #141 | ci/workspace-ui-structure-tests-20261122 / 2a09ccf | 3 / 2 | 12 / 93 | 1 custom pass | yes, draft; base PR #129 |
| #138 | fix/product-delete-stock-history-protection-20261122 / 27d5a6c | 15 / 4 | 15 / 93 | 3/3 pass | no, draft/stale |
| #137 | fix/client-delete-history-protection-20261122 / f2aada8 | 10 / 5 | 10 / 93 | 3/3 pass | no, draft/stale |
| #139 | fix/pro-workspace-status-contrast-20261122 / baa9ea6 | 1 / 1 | 1 / 93 | 2/2 pass | no, draft/stale |
| #135 | fix/invoice-delete-history-guard-20261122 / 2c7f3cb | 11 / 6 | 11 / 93 | 3/3 pass | no, draft/stale |
| #136 | fix/expense-ledger-protection-20261122 / 4e0f2a8 | 5 / 3 | 5 / 93 | 3/3 pass | no, draft/stale |
| #134 | fix/enterprise-badge-contrast-main-20261122 / 5202101 | 3 / 2 | 3 / 93 | 3/3 pass | yes, draft/stale |
| #115 | test/ohada-expense-ledger-integrity-20261121 / 3873c1d | 1 / 1 | 1 / 116 | 2/2 pass | no, stale |
| #133 | fix/accessibility-template-preview-contrast-20261122 / 6b3cd9f | 1 / 1 | 13 / 93 | no runs | no, draft; base PR #130 |
| #126 | integration/sunupilot-video-main-20261121 / 817b10d | 30 / 20 | 30 / 93 | 2/2 pass | no, draft/stale |
| #131 | docs/improvement-plan-main-20261122 / 3d51f0a | 4 / 1 | 4 / 93 | 2/2 pass | yes, draft/stale |
| #118 | feature/video-presentation-spark-sunupilot / 29dd7cc | 42 / 15 | 42 / 116 | 2/2 pass | no, stale |
| #99 | rebrand/optigest / 3f70466 | 21 / 84 | 21 / 321 | Tests fail; lint+ZIP pass | no, stale |
| #114 | docs/improvement-plan-20261121 / ff2cae7 | 4 / 1 | 4 / 143 | 2/2 pass | yes, stale |
| #102 | test/accessibility-dark-keyboard-20261118 / 86aeeb6 | 13 / 3 | 13 / 321 | Tests fail; lint+ZIP pass | no, stale |
| #110 | test/accessibility-dark-keyboard-rebased-20261120 / 722b5bf | 15 / 5 | 15 / 146 | Tests fail; lint+ZIP pass | no, stale |
| #129 | feat/workspace-settings-navigation-20261121 / 868027e | 9 / 6 | 9 / 93 | 3/3 pass | no, draft/stale |

## Causes des 3 CI en échec (logs Actions)

- #99 et #102 : recette visuelle, ratio contraste dark « Disponibilité » 3.97 (seuil 4.5).
- #110 : recette visuelle sur page Rapports; focus visible absent pour deux contrôles date natifs lors du parcours clavier/Shift+Tab.
- #144, #143, #133 : aucun run PR trouvé sur le head observé.
- #167 : tous les jobs PR sont terminés success avec tests, lint, ZIP sur head exact.
- Les checks success de branches stale ne valident pas leur rebase sur main.

## Priorités / planning

| Priorité | Lot | Action | Gate |
|---|---|---|---|
| P0 | CI et protection main | Obtenir les check-runs push-main et confirmer ruleset actuel via admin/API autorisé | Aucun merge tant que main n'est pas stable et contrôles requis vérifiés |
| P0 | #159/#164 sécurité | Rebase sur main, vérifier diff exact, re-run CI, review humaine indépendante | Tests + lint + ZIP + approbation indépendante |
| P0 | #167 HTML/XSS et devise | Head actuel CI 3/3 pass; ajouter tests XSS et scheduler multi-devises, review indépendante | CI exacte, review, conversations résolues |
| P1 | #149 mapping OHADA | Migration 013/version24; FK composée tenant; rebase; tests upgrade/replay | Validation humaine OHADA spécifique + CI exacte |
| P1 | #144/#145/#142/#146/#147/#143 | Dédupliquer/reconcilier sur main; auditer migration, ordre, idempotence, retention, rollback et données | Validation humaine pour historique/contrepassations; aucune fusion sur bases intégration |
| P1 | protections factures/dépenses/clients/produits | Vérifier main actuel; branches #135–138 sont redondantes/stale | Tests main exact et audit invariants |
| P2 | UX/a11y/PDF (#127/#130/#134/#139/#154–157/#155/#156) | Rebase petites PR indépendantes; rerun recette visuelle et focus | CI exact, review, base à jour |
| P3 | branding/video/roadmaps (#99/#114/#118/#126/#131) | Dédupliquer, reprendre après stabilité | CI + revue; échecs visuels corrigés |

## Décisions du run

- #167 : revue/commentaire d'audit sur le head exact; aucun merge. Le commentaire est une revue du compte auteur, pas une approbation indépendante.
- #149 : commentaire 7087962190 documente le conflit migration 012/version23 et FK tenant. REQUEST_CHANGES formel refusé par GitHub car PR du compte auteur; aucune approbation indépendante.
- #166 : rapport run1 conservé sans modification.
- #163 et #165 : merges antérieurs observés; main post-merge CI non vérifiable.
- Aucun lot fusionné pendant ce run. Aucune opération destructive/financière/production.

## Risques / blocages restants

1. CI post-merge main non vérifiée; status b43a94fc… vide.
2. Ruleset/protection main actuel non relu; runbook est daté du 16 novembre.
3. PRs stale en grand nombre (93–321 commits behind pour beaucoup); success CI sur ancien head/base ne suffit pas.
4. PR #149 migration 012/version23 invalide pour les installations v23 existantes; nécessite version24 et migration013.
5. Revue indépendante humaine absente sur les PR prioritaires.
6. PR #144/#145 audit-retention branches integration sans rebase sur main et sans validation humaine.
7. #99/#102/#110 ont des échecs visuels non résolus.
8. Closed PR list was searched in date slices (15 before Nov14, 70 Nov14–17, 40 Nov18–22); open list exhaustive 38; 175 branches exhaustive. No historical branch or report deleted.

## Inventaire complet des 175 branches (préservées)

a11y/dashboard-skip-navigation-20261122
a11y/mobile-sidebar-escape-focus-20261122
audit/execution-report-20261122-run1
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
fix/monthly-invoice-quota-schema-v8-2026-11-15
fix/mysql-backup-limited-privileges-20261122
fix/navigation-compact-sidebar-2026-11-13
fix/pdf-headless-user-formatting-20261121
fix/pdf-pagination-extras-flow-20261117
fix/pdf-print-pagination-20261117
fix/pdf-stream-ack-payment-disclosures-20261116
fix/pdf-worker-db-readiness-2026-11-16
fix/pdf-worker-health-and-sidebar-icons-20261115
fix/pdf-worker-wait-for-api-health-20261115
fix/pro-workspace-status-contrast-20261122
fix/product-delete-stock-history-protection-20261122
fix/purchase-receipt-warehouse-deadlock-20261119
fix/quota-registry-initialization-robustness-20261115
fix/quote-executive-a4-pagination-20261121
fix/quote-warehouse-resilience-20261120
fix/refund-payment-method-mapping-20261122
fix/refund-payment-method-mapping-rebased-20261122
fix/revoke-jwt-on-logout-20261115
fix/session-revocation-and-payment-timeouts-20261115
fix/sidebar-aria-current-20261115
fix/subscription-disabled-state-tests-docs-20261117
fix/subscription-icons-main-20261115
fix/sunupilot-pwa-lifecycle
fix/team-invitation-email-proof-20261117
fix/ui-icons-legibility-20261115
fix/ui-responsive-polish-20261117
fix/visual-qr-fixture-20261121
fix/webhook-local-timezone-dynamic-currency-20261123
fix/whatsapp-country-guard-20261116
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
security/docker-ignore-local-secrets-20261115
security/immediate-session-revocation-20261116
security/invoice-list-verification-code-redaction-20261122
security/redact-secret-urls-in-logs-20261116
test/accessibility-audit-business-pages-20261118
test/accessibility-dark-keyboard-20261118
test/accessibility-dark-keyboard-rebased-20261120
test/backup-atomic-visibility-20261115
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
