# Rapport d'exécution Audit SamaFacture Pro — Run 27
**Date/heure de vérification :** 23 novembre 2026, 19:56 UTC (Dakar)  
**Dépôt :** https://github.com/morn53426-ui/-samafacture-pro  
**Branche de rapport :** `audit/execution-report-20261123-run27`  
**Base de ce rapport :** `main` SHA `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c`  
**Historique :** nouveau rapport append-only; aucun rapport antérieur écrasé.

## 1. État Git constaté

- `main` est à `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c`, merge commit PR #194, 23 nov. 2026 à 16:53 UTC.
- La PR #194 (#security tenant) est fusionnée; PR #192 est également dans l’historique de main.
- **CI post-fusion de main non vérifiable avec les outils disponibles pendant ce run :** l’API workflow-runs utilisée retourne uniquement les runs liés aux PR; l’API de statuts combinés sur ce SHA a retourné une liste vide. La page GitHub Actions directe n’a pas pu être chargée. Cela ne prouve pas qu’aucun workflow ne s’est exécuté.
- Les protections/rulesets de branche et les approbations requises ne sont pas lisibles par les actions GitHub disponibles. Aucun contournement ni merge tenté.

## 2. Inventaire exhaustif

- **Branches : 225** (pages : 100 + 100 + 25; page suivante vide). Toutes sont conservées.
- **PR : 210** — 117 merged, 61 open, 32 closed sans merge. Le comptage merged a été partitionné par dates de création afin de dépasser la limite de 100 résultats.
- Open : #99, #102, #110, #114, #115, #118, #126, #127, #128, #129, #130, #131, #132, #133, #134, #135, #136, #137, #138, #139, #140, #141, #142, #145, #153, #154, #155, #156, #157, #166, #169, #170, #171, #172, #175, #176, #177, #178, #179, #180, #182, #183, #185, #188, #190, #193, #195, #196, #198, #199, #201, #203, #206, #207, #208, #209, #210, #211, #212, #213, #214
- Closed sans merge : #3, #9, #11, #13, #14, #20, #22, #30, #33, #34, #41, #62, #65, #76, #78, #85, #90, #113, #122, #143, #144, #146, #147, #149, #159, #164, #173, #174, #184, #186, #189, #191
- Merged (inventaire par numéros, partitions de dates) : #1, #2, #4, #5, #6, #7, #8, #10, #12, #15, #16, #17, #18, #19, #21, #23, #24, #25, #26, #27, #28, #29, #31, #32, #35, #36, #37, #38, #39, #40, #42, #43, #44, #45, #46, #47, #48, #49, #50, #51, #52, #53, #54, #55, #56, #57, #59, #60, #63, #64, #67, #68, #69, #71, #72, #73, #74, #75, #77, #79, #80, #81, #82, #83, #84, #86, #87, #88, #89, #91, #92, #93, #94, #95, #96, #97, #98, #100, #101, #103, #104, #105, #106, #107, #108, #109, #111, #112, #116, #117, #119, #120, #121, #123, #124, #125, #148, #150, #151, #152, #158, #160, #161, #162, #163, #165, #167, #168, #181, #187, #192, #194, #197, #200, #202, #204, #205

### Inventaire complet des branches (225)

`- a11y/dashboard-skip-link-main-current-run13`
`- a11y/dashboard-skip-navigation-20261122`
`- a11y/mobile-sidebar-escape-focus-20261122`
`- a11y/sidebar-escape-main-current-run15`
`- audit/execution-report-20261122-run1`
`- audit/execution-report-20261122-run2`
`- audit/execution-report-20261123-run11`
`- audit/execution-report-20261123-run12`
`- audit/execution-report-20261123-run13`
`- audit/execution-report-20261123-run14`
`- audit/execution-report-20261123-run15`
`- audit/execution-report-20261123-run20`
`- audit/execution-report-20261123-run21`
`- audit/execution-report-20261123-run22`
`- audit/execution-report-20261123-run23`
`- audit/execution-report-20261123-run25`
`- audit/execution-report-20261123-run26`
`- audit/execution-report-20261123-run27`
`- audit/execution-report-20261123-run3`
`- audit/execution-report-20261123-run4`
`- audit/execution-report-20261123-run5`
`- audit/execution-report-20261123-run6`
`- audit/fix-backup-and-runtime-20261110`
`- audit/fix-enterprise-migration-invitation-20261116`
`- audit/fix-nginx-upstream-order-20261116`
`- audit/fix-realtime-company-groups-20261116-run1`
`- audit/fix-reset-email-docs-and-redaction-test-20261116`
`- audit/initial-review-20261122`
`- audit/invoice-pdf-typography-print-20261118`
`- audit/npm-audit-gate-2026-11-16`
`- audit/rapport-approfondi-2026-11-16-run2`
`- audit/securite-2026-11-15`
`- audit/security-multisocietes-review-20261116-run3`
`- audit/ui-runtime-pages-polish-20261113`
`- audit/visual-viewport-offset-regression-20261116`
`- automation/audit-fixes-20261116-0150`
`- automation/visual-viewport-notifications-20261116-0243`
`- brand/sunupilot-identity-foundation`
`- chore/emil-design-skills-20261117`
`- ci/lint-history-protection-backend-20261122`
`- ci/package-main-after-pr39-pr40`
`- ci/real-restore-smoke-20261117`
`- ci/workspace-ui-structure-tests-20261122`
`- docs/backup-offsite-pinned-rclone-20261122`
`- docs/business-plan-samafacture-pro`
`- docs/correct-one-time-plan-billing-2026-11-16`
`- docs/fix-staging-compose-runbook-20261116`
`- docs/improvement-plan-20261121`
`- docs/improvement-plan-main-20261122`
`- docs/local-docker-bootstrap-20261117`
`- docs/production-env-security-guidance-20261122`
`- docs/subscription-monthly-architecture-20261117`
`- docs/subscriptions-current-state-20261117`
`- docs/ui-polish-plans-20261117`
`- feat/15-day-trial-entitlements-20261121`
`- feat/5-nouveaux-modeles-facture`
`- feat/abonnement-choix-moyen-paiement`
`- feat/accounting-expense-payment-mode-20261121`
`- feat/dashboard-reference-layout`
`- feat/dashboard-reference-modules-20261119`
`- feat/dashboard-reference-redesign-20261112`
`- feat/enterprise-command-center-20261117`
`- feat/enterprise-company-pagination-20261117`
`- feat/enterprise-multi-company-foundation-20261116`
`- feat/enterprise-page-structure-2026-11-13`
`- feat/enterprise-page-structure-v2-2026-11-13`
`- feat/enterprise-pages-v2-2026-11-13`
`- feat/enterprise-workspace-ux-20261117`
`- feat/invoice-stock-warehouse-20261119`
`- feat/invoice-template-gallery-2026-11-15`
`- feat/invoice-template-gallery-2026-11-15-v2`
`- feat/invoice-templates-pro-enterprise-20261117`
`- feat/invoice-warehouse-stock-20261119`
`- feat/invoice-warehouse-stock-main-20261119`
`- feat/mobile-config-preflight`
`- feat/monthly-invoice-quota-v8-2026-11-15`
`- feat/ohada-account-mappings-20261122`
`- feat/phases-2-4-paiements-compta-achats-20261112`
`- feat/phases-5-7-portal-international-automation-20261112`
`- feat/professional-subscription-page-2026-11-15`
`- feat/responsive-scaling-2026-11-15`
`- feat/sidebar-icon-label-navigation-20261117`
`- feat/sidebar-navigation-visual-refresh-20261117`
`- feat/subscription-engine-local-simulation-20261117`
`- feat/sunupilot-dashboard-reference`
`- feat/templates-factures-devis-complets`
`- feat/topbar-notifications-bell-20261112`
`- feat/ui-motion-visual-recette-20261112`
`- feat/workspace-settings-navigation-20261121`
`- feature/ohada-expense-account-mappings-20261122`
`- feature/video-presentation-spark-sunupilot`
`- fix/a11y-settings-labels-20261116`
`- fix/accessibility-contrast-focus-main-20261121`
`- fix/accessibility-template-preview-contrast-20261122`
`- fix/accounting-event-audit-retention-v22-20261122`
`- fix/accounting-event-audit-retention-v22-run2-20261122`
`- fix/accounting-invoice-cancellation-reversal-20261121`
`- fix/accounting-refund-journal-reversal-20261121`
`- fix/atomic-backup-publish-2026-11-15`
`- fix/atomic-encrypted-backups-2026-11-15`
`- fix/audit-devise-relances-escape`
`- fix/backup-directory-permissions-20261122`
`- fix/backup-retention-guard-2026-11-16`
`- fix/cash-register-default-base-currency-20261123`
`- fix/ci-serial-tests-2026-11-15`
`- fix/client-delete-history-protection-20261122`
`- fix/company-settings-responsive-grid-main-20261123`
`- fix/dashboard-donut-count-20261118`
`- fix/docker-context-secrets-and-lockfile-2026-11-15`
`- fix/docker-local-startup-mysql-redis-swagger`
`- fix/enterprise-badge-contrast-current-main-run19-20261123`
`- fix/enterprise-badge-contrast-main-20261122`
`- fix/enterprise-invitation-email-proof-20261116`
`- fix/expense-ledger-protection-20261122`
`- fix/invoice-delete-history-guard-20261122`
`- fix/invoice-footer-stamp-mobile-20261121`
`- fix/invoice-mobile-table-cards-20261121`
`- fix/invoice-pdf-continuation-identity-20261121`
`- fix/invoice-print-and-payment-stamp-2026-11-15`
`- fix/invoice-print-banner-geometry-20261121`
`- fix/invoice-print-banner-spacing-20261122`
`- fix/invoice-print-typography-20261118`
`- fix/invoice-settlement-integrity-2026-11-15`
`- fix/invoice-stock-principal-warehouse`
`- fix/light-dark-theme-consistency-20261118`
`- fix/mobile-invoice-line-columns`
`- fix/mobile-nonpublic-hostnames-20261123`
`- fix/mobile-nonpublic-hostnames-current-main-20261123`
`- fix/mobile-preflight-current-main-20261123`
`- fix/mobile-preflight-main-20261123`
`- fix/mobile-preflight-main-after-security-20261123`
`- fix/mobile-workspace-domain-rail-main-20261123`
`- fix/monthly-invoice-quota-schema-v8-2026-11-15`
`- fix/mysql-backup-limited-privileges-20261122`
`- fix/navigation-compact-sidebar-2026-11-13`
`- fix/pdf-headless-user-formatting-20261121`
`- fix/pdf-pagination-extras-flow-20261117`
`- fix/pdf-print-pagination-20261117`
`- fix/pdf-stream-ack-payment-disclosures-20261116`
`- fix/pdf-worker-db-readiness-2026-11-16`
`- fix/pdf-worker-health-and-sidebar-icons-2026-11-15`
`- fix/pdf-worker-wait-for-api-health-2026-11-15`
`- fix/pro-orders-base-currency-main-20261123-run23`
`- fix/pro-orders-tenant-currency-20261123`
`- fix/pro-orders-tenant-currency-main-20261123`
`- fix/pro-workspace-status-contrast-20261122`
`- fix/product-delete-stock-history-protection-20261122`
`- fix/purchase-receipt-warehouse-deadlock-20261119`
`- fix/quota-registry-initialization-robustness-2026-11-15`
`- fix/quote-executive-a4-pagination-20261121`
`- fix/quote-warehouse-resilience-20261120`
`- fix/refund-payment-method-mapping-20261122`
`- fix/refund-payment-method-mapping-rebased-20261122`
`- fix/revoke-jwt-on-logout-2026-11-15`
`- fix/session-revocation-and-payment-timeouts-2026-11-15`
`- fix/sidebar-aria-current-2026-11-15`
`- fix/subscription-disabled-state-tests-docs-20261117`
`- fix/subscription-icons-main-2026-11-15`
`- fix/sunupilot-pwa-lifecycle`
`- fix/team-invitation-email-proof-20261117`
`- fix/tenant-currency-atomic-current-main-20261123`
`- fix/tenant-currency-atomic-latest-main-20261123`
`- fix/tenant-currency-atomic-lock-20261123`
`- fix/tenant-currency-atomic-lock-main-20261123`
`- fix/tenant-currency-atomic-main-20261123`
`- fix/tenant-currency-final-main-20261123`
`- fix/ui-icons-legibility-2026-11-15`
`- fix/ui-responsive-polish-20261117`
`- fix/visual-qr-fixture-20261121`
`- fix/webhook-local-timezone-dynamic-currency-20261123`
`- fix/whatsapp-country-guard-2026-11-16`
`- improve/pdf-page3-balance-20261121`
`- improve/pdf-page3-balance-main-20261121`
`- integration/main-company-invitation-email-proof-20261117`
`- integration/pr210-schema-v23-main-current-20261123`
`- integration/reconcile-main-v21-20261122`
`- integration/schema-v21-accounting-trial-20261122`
`- integration/schema-v22-main-reconciled-20261122`
`- integration/sunupilot-video-main-20261121`
`- main`
`- qa/test-pdf-24-modeles`
`- rebase/pr106-main-20261121-run1`
`- rebase/pr110-main-20261121-run1`
`- rebrand/optigest`
`- reconciliation/schema-v21-main-base-20261122`
`- security/docker-ignore-local-secrets-2026-11-15`
`- security/immediate-session-revocation-2026-11-16`
`- security/invoice-client-tenant-current-main-after-181-20261123`
`- security/invoice-client-tenant-scope-20261123`
`- security/invoice-client-tenant-scope-current-main-20261123`
`- security/invoice-list-verification-code-redaction-20261122`
`- security/invoice-tenant-scope-final-main-20261123`
`- security/invoice-verification-code-redaction-main-20261123-run7`
`- security/redact-secret-urls-in-logs-2026-11-16`
`- security/redact-verification-codes-current-main-run19-20261123`
`- security/redact-verification-codes-main-current-20261123-run12`
`- security/refund-statement-tenant-join-20261123-run14`
`- security/reset-token-hash-redaction-main-current-20261123`
`- security/tenant-relations-main-current-20261123-run12`
`- test/accessibility-audit-business-pages-20261118`
`- test/accessibility-dark-keyboard-20261118`
`- test/accessibility-dark-keyboard-rebased-20261120`
`- test/backup-atomic-visibility-2026-11-15`
`- test/dark-theme-zoom-200-sweep-20261118`
`- test/expense-accounting-mappings-regression-20261122`
`- test/free-trial-expiry-session-guard-20261122`
`- test/invoice-long-pdf-pagination-20261121`
`- test/invoice-short-pdf-one-page-20261121`
`- test/invoice-short-pdf-one-page-main-20261121`
`- test/ohada-expense-ledger-integrity-20261121`
`- test/pdf-font-embedding-and-visual-print-20261118`
`- test/security-auth-reset-token-redaction-20261122`
`- test/team-invitation-expiry-email-change-20261122`
`- test/theme-dark-mobile-sweep-20261118`
`- test/theme-dark-sweep-20261118`
`- test/theme-light-desktop-sweep-20261118`
`- test/theme-light-mobile-sweep-20261118`
`- test/workspace-zoom-200-sweep-20261118`
`- tooling/local-docker-test-bundle-20261112`
`- ui/augmenter-logo-icones-sidebar`
`- ui/modern-responsive-polish`
`- ux/dashboard-mobile-module-rail-20261122`
`- ux/pro-workspace-mobile-domain-rail-20261122`
`- ux/settings-company-fields-grid-20261122`
`- ux/settings-company-fields-grid-main-20261123-run23`

## 3. SHA, PR et CI exactes

| PR | Branche / head SHA | Diff | CI sur head exact | Mergeability / revue | Décision |
|---|---|---|---|---|---|
| #214 | `fix/cash-register-default-base-currency-20261123` / `2349f3abc9f8fa8304616143dfff9e93299b4fa2` | 3 commits, 2 fichiers, +122/−9 environ; 0 behind main | Tests Node/MySQL #45250410943 SUCCESS; ESLint #45250411138 SUCCESS; ZIP #45250410915 SUCCESS. Les étapes restore chiffrée, diagnostics, smoke MySQL/Redis, recette responsive et captures sont SUCCESS. | Draft, mergeable=true, 0 review/threads | Garder draft; CI verte mais revue indépendante et validation main post-fusion manquent. |
| #210 | `fix/pro-orders-base-currency-main-20261123-run23` / `fa92faeccf886fa3d67f4c8003fbc7b2f0ccf5ad` | 2 commits, 2 fichiers; 0 behind main | Tests #45224583486 SUCCESS; ESLint #45224583453 SUCCESS; ZIP #45224583450 SUCCESS; restore/smoke/visual SUCCESS | Draft, mergeable=true; revue non enregistrée | Revue produit/comptabilité nécessaire pour la règle « commande = devise de base ». |
| #203 | `security/redact-verification-codes-current-main-run19-20261123` / `2059e3744ce88eface5c00e52c459c7e6edc5235` | 6 commits, 5 fichiers | Tests #45191717740 SUCCESS; ESLint #45191717706 SUCCESS; ZIP #45191717720 SUCCESS | Draft, mergeable=false, base SHA ancien | Fix de sécurité utile, mais synchroniser la base et revalider avant revue/merge. |
| #188 | `security/invoice-client-tenant-current-main-after-181-20261123` / `39f27a324412cefae046181e22430ba79f24b5c5` | 10 commits, 7 fichiers | Aucun run PR trouvé sur ce head exact | Draft, mergeable=false | P0 sécurité tenant; synchronisation/conflits et CI à résoudre. |
| #199 | `security/refund-statement-tenant-join-20261123-run14` / `b212dbc0bac111c77023c1ad42c58514786aeaca` | 3 commits, 3 fichiers | Tests #45156601143 SUCCESS; ESLint #45156601267 SUCCESS; ZIP #45156601096 SUCCESS | Draft, mergeable=false | Fix utile; synchroniser puis revue et CI. |
| #211 | `ux/settings-company-fields-grid-main-20261123-run23` / `4518451df4e887ed584219d282530e3acf4734df` | 3 commits, 3 fichiers | Tests #45225973762 SUCCESS; ESLint #45225973707 SUCCESS; ZIP #45225973680 SUCCESS | Draft, mergeable=true | Lot UX indépendant; CI verte, revue avant merge. |
| #142 | `integration/schema-v21-accounting-trial-20261122` / `decb8da2e48e8f7a93fc63202f00fe0b4170e6e2` | 77 commits, 48 fichiers | Tests #45027909669 SUCCESS; ESLint #45027909637 SUCCESS; ZIP #45027909640 SUCCESS | Draft, mergeable=false; branch d’intégration ancienne | Ne pas fusionner; schéma v21 à réconcilier avec main v23 et validation comptable humaine. |
| #145 | `fix/accounting-event-audit-retention-v22-run2-20261122` / `5b6ba8bf3b05e4155697159c60cf4b5051196bf8` | 15 commits, 7 fichiers; base = head #142 | Tests #45029642007 SUCCESS; ESLint #45029642012 SUCCESS; ZIP #45029642014 SUCCESS | Draft, mergeable=true mais PR empilée sur #142; aucune approbation visible | Ne pas fusionner isolément; consolider sur main v23, revue et validation comptable. |

Les conclusions CI ci-dessus sont associées aux SHA listés, pas à un head ultérieur.

## 4. Revue indépendante du lot #214

### Cause
La route `POST /api/pro/cash/registers` prenait FCFA en valeur par défaut lorsque le formulaire n’envoyait pas de devise. Une entreprise configurée en EUR pouvait donc créer involontairement une caisse FCFA.

### Diff observé
- Transaction DB; lecture `users.devise` sous `FOR UPDATE`, partageant le verrou avec la modification de devise.
- Devise par défaut du compte lorsque l’entrée est absente/vide.
- Validation des devises explicites; rejet `ZZZ`.
- Vérification tenant de l’établissement dans la transaction.
- Insert et commit; audit après commit; release/rollback en cas d’erreur.
- Tests EUR, USD explicitement autorisé, devise inconnue et course concurrente changement de devise/création caisse.

### Risque résiduel / décision
- La caisse USD explicite reste autorisée (multi-devises) — cela semble intentionnel et les rapports doivent garder les soldes par devise. Confirmer la règle produit si l’entreprise souhaite interdire toute caisse non-base.
- Le test concurrence attend les tentatives SQL de verrou plutôt qu’une temporisation; il vérifie l’ordre et la devise stockée.
- Diff court, sans migration ni modification d’historique. Aucun paiement ni déploiement.
- Revue statique indépendante favorable, mais **pas d’approbation humaine enregistrée**; PR reste draft.

## 5. Devise commandes (#210)
La route accepte maintenant la devise de base; une devise supportée mais différente retourne 409 avant insertion. Tests couvrent FCFA accepté, EUR rejeté pour FCFA, FCFA rejeté pour compte EUR et absence de lignes incohérentes. La règle « une seule devise de base tant que conversion n’existe pas » est une décision produit/comptable à confirmer avant merge.

## 6. Migrations et schéma — main v23

`server/config/db.js` indique `CURRENT_SCHEMA_VERSION = 23`; les migrations sont exécutées sous verrou MySQL `GET_LOCK('samafacture_schema_init', 60)`. Les installations nouvelles exécutent le schéma et les migrations; les anciennes sont migrées sous verrou. Les colonnes/index sont majoritairement ajoutés avec garde `information_schema` et `IF NOT EXISTS`, mais une revue de migration réelle reste nécessaire.

| Version | Contenu référencé dans `server/config/db.js` |
|---|---|
| 8 | Quota mensuel de factures |
| 9 | Ancrage de date pour factures récurrentes |
| 10 | Index des échéances |
| 11–14 | Groupes multi-sociétés, outbox email chiffrée, preuves email groupe/équipe (migrations 006–009) |
| 15 | Fondation abonnements SaaS (migration 010, simulation, pas de paiement) |
| 16 | Type structuré catalogue |
| 17–18 | Entrepôts et marqueur/backfill stock |
| 19 | Événements de contrepassation facture (migration 011) |
| 20 | Mode de règlement dépenses |
| 21 | Trial 15 jours UTC |
| 22 | Retrait de la FK facture sur événements comptables pour préserver l’audit |
| 23 | Correspondances comptables par tenant (migration 012) |

Fichiers SQL référencés dans le code main :
- `003_professional_modules.sql`
- `004_paiements_comptabilite_achats.sql`
- `005_portail_crm_international_ia.sql`
- `006_company_groups.sql`
- `007_email_outbox.sql`
- `008_company_group_email_proof.sql`
- `009_team_invitation_email_proof.sql`
- `010_saas_subscriptions_simulation.sql`
- `011_comptabilite_contrepas_factures.sql`
- `012_comptabilite_correspondances.sql`

Migration 011 crée des événements de contrepassation et possède initialement une FK facture en cascade; la version 22 la retire pour préserver les événements. Migration 012 crée les correspondances par tenant avec FK composite vers comptes du même tenant. Aucune migration destructive n’est proposée dans ce run. Le listing de fichiers de migration n’a pas pu être obtenu via une API de directory listing; inventaire ci-dessus basé sur les références de `db.js` et les fichiers 011/012 lus directement.

**Risque P1 :** #142/#145 portent les versions v21/v22 sur une base historique; main est déjà v23. Rebase/reconciliation et tests upgrade/downgrade (sans exécution destructive) sont nécessaires. Validation humaine obligatoire avant fusion de tout lot touchant les écritures ou migrations.

## 7. Planning P0–P3

| Priorité | Lot | Action | Condition d’avancement |
|---|---|---|---|
| **P0** | Vérifier stabilité main | Obtenir les checks post-fusion du SHA c32ed40; confirmer ruleset/protection et approbations obligatoires | CI main vérifiée et protections confirmées |
| **P0** | #188 isolation factures/clients/relations | Synchroniser main, résoudre conflicts, revue diff, exécuter CI exacte | Revue sécurité approuvée, tests tenant green, aucune fuite |
| **P0** | #199 remboursement/relevé client | Synchroniser, revue jointure tenant, tests régression | CI exacte + approbation sécurité |
| **P0** | #203 codes de vérification | Garder le secret hors listes/historique client; base stale à synchroniser | CI exacte + revue sécurité |
| **P1** | #214 devise caisse | Diff/test validés; revue humaine et confirmation règles multi-devise | CI exacte, review approval, main CI post-merge |
| **P1** | #210 devise commandes | Confirmer règle business; synchroniser/review si besoin | Approval produit/comptabilité + CI |
| **P1** | #142/#145 comptabilité + trial | Reconcile schema v21/v22 with main v23; migrations compatibility and audit event retention | Revue comptable humaine + CI migration exhaustive |
| **P2** | #211 coordonnées entreprise | Grille responsive paramètres | CI exacte et revue UX |
| **P2** | #208 workspace mobile / #209 settings | Consolider duplications UX, vérifier responsive | Tests visuels et revue |
| **P2** | Impression/PDF, accessibilité | Reprendre les bugs d’impression (bandeau, titre, pagination) et contrastes/keyboard | Recette visuelle A4 + responsive |
| **P3** | Docs, runbooks, automatisation | Rapports append-only, instructions Docker/backup, plan amélioration | PR docs relue et CI |

## 8. Préservation / actions de ce run

- Aucun merge, push direct sur main, force-push, branche supprimée ou changement de protection.
- Aucun fichier de données, volume, backup ou historique comptable modifié.
- Aucun paiement réel, activation paiement, déploiement production ou migration exécutée.
- PR #214/#210/#203/#199/#211/#142/#145 restent draft/open.
- CI main post-fusion non confirmée : **toutes les fusions restent suspendues**.
- Rapport Run27 ajouté sur branche dédiée; rapport historique Run26 et autres rapports non modifiés.

## 9. Branches — inventaire complet
225 branches récupérées en pages API; liste triée ci-dessus. Aucune branche supprimée.

