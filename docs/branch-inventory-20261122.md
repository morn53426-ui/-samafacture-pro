# Inventaire des branches distantes — 22 novembre 2026, run 7

Dépôt : `morn53426-ui/-samafacture-pro`  
Référence : `main`  
Branches : **147** (noms confirmés run 8 follow-up) ; **146 SHA enregistrés / 144 uniques**, HEADs des PR ouvertes rafraîchis; les 122 branches non-PR conservent leurs SHA run 7 (la branche d’audit est auto-référente et n’a pas de SHA dans le tableau).  
PR ouvertes : **24** (têtes et comparaisons run 8). Main : `8453ee6d8e633f151523236eecff1bc0e0cf877b`.  
CI main : aucune status/run fraîche retournée run 8; ruleset `protect main` attesté run 6 mais non revalidé run 8.


> Run 7 (09:23 UTC): noms de branches vérifiés (100+46, aucun changement). HEADs mis à jour pour les 22 branches des PR ouvertes (hors branche auto-référente #132) et les 122 branches sans PR ouverte. Ahead/behind frais pour les 23 PR et les 122 branches non-PR. Les dates de dernier commit ne sont pas disponibles via la collecte; CI non-PR non vérifiée. Couverture des noms et SHA: 146 branches, aucun nom manquant.

> Branches API paginées 100+46. La ligne de cette branche d’audit est auto-référente : son HEAD est le commit de mise à jour du présent inventaire, consultable dans PR #132. Les dates de dernier commit ne sont pas retournées par cette collecte. Ahead/behind a été recalculé pour les 23 PR ouvertes; les branches sans PR n'ont pas toutes été comparées à main. Aucune branche supprimée.

## Têtes partagées
- `11d55850`: `feat/dashboard-reference-layout`, `feat/sunupilot-dashboard-reference`
- `383c885a`: `fix/invoice-stock-principal-warehouse`, `rebase/pr106-main-20261121-run1`

## Branches par préfixe

### (sans préfixe) (1)

| Branche | HEAD |
|---|---|
| `main` | `8453ee6d` |

### audit (13)

| Branche | HEAD |
|---|---|
| `audit/fix-backup-and-runtime-20261110` | `9ea9a9aa` |
| `audit/fix-enterprise-migration-invitation-20261116` | `0b93cf9e` |
| `audit/fix-nginx-upstream-order-20261116` | `5e93abdc` |
| `audit/fix-realtime-company-groups-20261116-run1` | `e5c3d802` |
| `audit/fix-reset-email-docs-and-redaction-test-20261116` | `a53c96da` |
| `audit/initial-review-20261122` | (self; see PR #132 head) |
| `audit/invoice-pdf-typography-print-20261118` | `7cb2d43c` |
| `audit/npm-audit-gate-2026-11-16` | `63a344d9` |
| `audit/rapport-approfondi-2026-11-16-run2` | `1aee9331` |
| `audit/securite-2026-11-15` | `9939413a` |
| `audit/security-multisocietes-review-20261116-run3` | `4acf4d36` |
| `audit/ui-runtime-pages-polish-20261113` | `094c34f3` |
| `audit/visual-viewport-offset-regression-20261116` | `f744b203` |

### automation (2)

| Branche | HEAD |
|---|---|
| `automation/audit-fixes-20261116-0150` | `a423dca1` |
| `automation/visual-viewport-notifications-20261116-0243` | `64f5b2c2` |

### brand (1)

| Branche | HEAD |
|---|---|
| `brand/sunupilot-identity-foundation` | `63f8eb27` |

### chore (1)

| Branche | HEAD |
|---|---|
| `chore/emil-design-skills-20261117` | `70f8ea19` |

### ci (4)

| Branche | HEAD |
|---|---|
| `ci/lint-history-protection-backend-20261122` | `d16c4c54` |
| `ci/workspace-ui-structure-tests-20261122` | `f16f127b` |
| `ci/package-main-after-pr39-pr40` | `8c725a00` |
| `ci/real-restore-smoke-20261117` | `8864ab94` |

### docs (9)

| Branche | HEAD |
|---|---|
| `docs/business-plan-samafacture-pro` | `ac07f078` |
| `docs/correct-one-time-plan-billing-2026-11-16` | `43592f99` |
| `docs/fix-staging-compose-runbook-20261116` | `22c0dae2` |
| `docs/improvement-plan-20261121` | `ff2cae7b` |
| `docs/improvement-plan-main-20261122` | `3d51f0af` |
| `docs/local-docker-bootstrap-20261117` | `eeea9c4a` |
| `docs/subscription-monthly-architecture-20261117` | `430e2010` |
| `docs/subscriptions-current-state-20261117` | `e618e88c` |
| `docs/ui-polish-plans-20261117` | `137a9b01` |

### feat (33)

| Branche | HEAD |
|---|---|
| `feat/15-day-trial-entitlements-20261121` | `e3b91dc4` |
| `feat/5-nouveaux-modeles-facture` | `342a3e43` |
| `feat/abonnement-choix-moyen-paiement` | `3f32787d` |
| `feat/accounting-expense-payment-mode-20261121` | `08a1c025` |
| `feat/dashboard-reference-layout` | `11d55850` |
| `feat/dashboard-reference-modules-20261119` | `f3cbbc66` |
| `feat/dashboard-reference-redesign-20261112` | `6cf80f4c` |
| `feat/enterprise-command-center-20261117` | `ae7e0e8e` |
| `feat/enterprise-company-pagination-20261117` | `3b8d8ebc` |
| `feat/enterprise-multi-company-foundation-20261116` | `c19e1295` |
| `feat/enterprise-page-structure-2026-11-13` | `e3991016` |
| `feat/enterprise-page-structure-v2-2026-11-13` | `745a98b5` |
| `feat/enterprise-pages-v2-2026-11-13` | `e9992176` |
| `feat/enterprise-workspace-ux-20261117` | `14cdd3c4` |
| `feat/invoice-stock-warehouse-20261119` | `30bcfaa5` |
| `feat/invoice-template-gallery-2026-11-15` | `70d95aac` |
| `feat/invoice-template-gallery-2026-11-15-v2` | `570bf60c` |
| `feat/invoice-templates-pro-enterprise-20261117` | `4de3da44` |
| `feat/invoice-warehouse-stock-20261119` | `e9ac3c69` |
| `feat/invoice-warehouse-stock-main-20261119` | `158a9e06` |
| `feat/monthly-invoice-quota-v8-2026-11-15` | `f3b26909` |
| `feat/phases-2-4-paiements-compta-achats-20261112` | `f028da58` |
| `feat/phases-5-7-portal-international-automation-20261112` | `a3a43402` |
| `feat/professional-subscription-page-2026-11-15` | `cf58665a` |
| `feat/responsive-scaling-2026-11-15` | `f7d10afe` |
| `feat/sidebar-icon-label-navigation-20261117` | `c8bc6af9` |
| `feat/sidebar-navigation-visual-refresh-20261117` | `314c06e7` |
| `feat/subscription-engine-local-simulation-20261117` | `c077af14` |
| `feat/sunupilot-dashboard-reference` | `11d55850` |
| `feat/templates-factures-devis-complets` | `81aa9fa6` |
| `feat/topbar-notifications-bell-20261112` | `a36472e6` |
| `feat/ui-motion-visual-recette-20261112` | `1ae8c307` |
| `feat/workspace-settings-navigation-20261121` | `868027e1` |

### feature (1)

| Branche | HEAD |
|---|---|
| `feature/video-presentation-spark-sunupilot` | `29dd7ccc` |

### fix (53)

| Branche | HEAD |
|---|---|
| `fix/a11y-settings-labels-20261116` | `4b275916` |
| `fix/accessibility-contrast-focus-main-20261121` | `9722ca99` |
| `fix/accessibility-template-preview-contrast-20261122` | `6b3cd9ff` |
| `fix/accounting-invoice-cancellation-reversal-20261121` | `ba756d09` |
| `fix/accounting-refund-journal-reversal-20261121` | `b45f4797` |
| `fix/atomic-backup-publish-2026-11-15` | `081d9312` |
| `fix/atomic-encrypted-backups-2026-11-15` | `03a36a61` |
| `fix/backup-retention-guard-2026-11-16` | `e277ca8a` |
| `fix/ci-serial-tests-2026-11-15` | `4a74afa8` |
| `fix/client-delete-history-protection-20261122` | `f2aada8d` |
| `fix/dashboard-donut-count-20261118` | `2d4d7619` |
| `fix/docker-context-secrets-and-lockfile-2026-11-15` | `52d4b81b` |
| `fix/docker-local-startup-mysql-redis-swagger` | `2f021548` |
| `fix/enterprise-badge-contrast-main-20261122` | `52021018` |
| `fix/enterprise-invitation-email-proof-20261116` | `4347d572` |
| `fix/expense-ledger-protection-20261122` | `4e0f2a89` |
| `fix/invoice-delete-history-guard-20261122` | `2c7f3cbd` |
| `fix/invoice-footer-stamp-mobile-20261121` | `7c562612` |
| `fix/invoice-mobile-table-cards-20261121` | `67f7721d` |
| `fix/invoice-pdf-continuation-identity-20261121` | `885b7b42` |
| `fix/invoice-print-and-payment-stamp-2026-11-15` | `ed6c1467` |
| `fix/invoice-print-banner-geometry-20261121` | `0ec7c3ee` |
| `fix/invoice-print-typography-20261118` | `d8805a20` |
| `fix/invoice-settlement-integrity-2026-11-15` | `30318cf3` |
| `fix/invoice-stock-principal-warehouse` | `383c885a` |
| `fix/light-dark-theme-consistency-20261118` | `bf497de0` |
| `fix/mobile-invoice-line-columns` | `9019ec2d` |
| `fix/monthly-invoice-quota-schema-v8-2026-11-15` | `69028f59` |
| `fix/navigation-compact-sidebar-2026-11-13` | `508607c7` |
| `fix/pdf-headless-user-formatting-20261121` | `862d31a7` |
| `fix/pdf-pagination-extras-flow-20261117` | `2e7dd32a` |
| `fix/pdf-print-pagination-20261117` | `b8e34491` |
| `fix/pdf-stream-ack-payment-disclosures-20261116` | `a576e5e1` |
| `fix/pdf-worker-db-readiness-2026-11-16` | `59d341a1` |
| `fix/pdf-worker-health-and-sidebar-icons-2026-11-15` | `04304461` |
| `fix/pdf-worker-wait-for-api-health-2026-11-15` | `941f235f` |
| `fix/pro-workspace-status-contrast-20261122` | `baa9ea6a` |
| `fix/product-delete-stock-history-protection-20261122` | `27d5a6c2` |
| `fix/purchase-receipt-warehouse-deadlock-20261119` | `f0f43c3d` |
| `fix/quota-registry-initialization-robustness-2026-11-15` | `c8ea3204` |
| `fix/quote-executive-a4-pagination-20261121` | `9bfc8aea` |
| `fix/quote-warehouse-resilience-20261120` | `8d0a4d29` |
| `fix/revoke-jwt-on-logout-2026-11-15` | `a2093927` |
| `fix/session-revocation-and-payment-timeouts-2026-11-15` | `46f28076` |
| `fix/sidebar-aria-current-2026-11-15` | `1066c1c4` |
| `fix/subscription-disabled-state-tests-docs-20261117` | `60f57e27` |
| `fix/subscription-icons-main-2026-11-15` | `3316731d` |
| `fix/sunupilot-pwa-lifecycle` | `86da24a1` |
| `fix/team-invitation-email-proof-20261117` | `8e1b84df` |
| `fix/ui-icons-legibility-2026-11-15` | `0d7c5390` |
| `fix/ui-responsive-polish-20261117` | `5efe69b6` |
| `fix/visual-qr-fixture-20261121` | `df6070e3` |
| `fix/whatsapp-country-guard-2026-11-16` | `a49756cd` |

### improve (2)

| Branche | HEAD |
|---|---|
| `improve/pdf-page3-balance-20261121` | `115ab9f0` |
| `improve/pdf-page3-balance-main-20261121` | `7d9617d0` |

### integration (2)

| Branche | HEAD |
|---|---|
| `integration/main-company-invitation-email-proof-20261117` | `70750be4` |
| `integration/sunupilot-video-main-20261121` | `817b10da` |

### qa (1)

| Branche | HEAD |
|---|---|
| `qa/test-pdf-24-modeles` | `d3b70a09` |

### rebase (2)

| Branche | HEAD |
|---|---|
| `rebase/pr106-main-20261121-run1` | `383c885a` |
| `rebase/pr110-main-20261121-run1` | `ca1d1abd` |

### rebrand (1)

| Branche | HEAD |
|---|---|
| `rebrand/optigest` | `3f70466d` |

### security (3)

| Branche | HEAD |
|---|---|
| `security/docker-ignore-local-secrets-2026-11-15` | `4d2c20e2` |
| `security/immediate-session-revocation-2026-11-16` | `d6887ce0` |
| `security/redact-secret-urls-in-logs-2026-11-16` | `d27f55b5` |

### test (15)

| Branche | HEAD |
|---|---|
| `test/accessibility-audit-business-pages-20261118` | `468caba2` |
| `test/accessibility-dark-keyboard-20261118` | `86aeeb6f` |
| `test/accessibility-dark-keyboard-rebased-20261120` | `722b5bfc` |
| `test/backup-atomic-visibility-2026-11-15` | `f4c463e5` |
| `test/dark-theme-zoom-200-sweep-20261118` | `6fe85dfd` |
| `test/invoice-long-pdf-pagination-20261121` | `41fb9896` |
| `test/invoice-short-pdf-one-page-20261121` | `c592c704` |
| `test/invoice-short-pdf-one-page-main-20261121` | `f49d3521` |
| `test/ohada-expense-ledger-integrity-20261121` | `3873c1d1` |
| `test/pdf-font-embedding-and-visual-print-20261118` | `42b5a0bc` |
| `test/theme-dark-mobile-sweep-20261118` | `55c985de` |
| `test/theme-dark-sweep-20261118` | `7bd4d2e9` |
| `test/theme-light-desktop-sweep-20261118` | `dfe8ce45` |
| `test/theme-light-mobile-sweep-20261118` | `b7710857` |
| `test/workspace-zoom-200-sweep-20261118` | `dd64ea02` |

### tooling (1)

| Branche | HEAD |
|---|---|
| `tooling/local-docker-test-bundle-20261112` | `b88eeebb` |

### ui (2)

| Branche | HEAD |
|---|---|
| `ui/augmenter-logo-icones-sidebar` | `63af3d94` |
| `ui/modern-responsive-polish` | `a2faa30e` |


## Run 8 — PR heads et comparaisons fraîches (22 novembre 2026, 10:26 UTC)

Les 146 noms sont identiques au run 7 (pagination 100 + 46 + page terminale vide). Les têtes des PR ouvertes ont été rafraîchies; les SHA des 122 branches sans PR ne sont pas rafraîchis dans ce run et restent ceux du run 7. Les comparaisons ahead/behind ci-dessous sont recalculées contre main actuel, sauf #133 qui est empilée sur #130.

| PR | Head SHA | Ahead/behind | CI observée |
|---|---|---:|---|
| #140 | d16c4c54 | 4/0 | tests, lint, ZIP success |
| #139 | baa9ea6a | 1/0 | tests + ZIP success, lint absent |
| #138 | 27d5a6c2 | 15/0 | tests, lint, ZIP success |
| #137 | f2aada8d | 10/0 | tests, lint, ZIP success |
| #136 | 4e0f2a89 | 5/0 | tests, lint, ZIP success |
| #135 | 2c7f3cbd | 11/0 | tests, lint, ZIP success |
| #134 | 52021018 | 3/0 | tests, lint, ZIP success |
| #133 | 6b3cd9ff | 13/0 vs main; 1/8 vs #130 | aucun run; base #130 |
| #132 | 97fc9486* | 67/0 | tests + ZIP success sur ce head précédent |
| #131 | 3d51f0af | 4/0 | tests + ZIP success |
| #130 | 9722ca99 | 20/0 | tests, lint, ZIP success |
| #129 | 868027e1 | 9/0 | aucun run retourné |
| #128 | e3b91dc4 | 39/0 | tests, lint, ZIP success |
| #127 | 9bfc8aea | 5/0 | tests, lint, ZIP success |
| #126 | 817b10da | 30/0 | tests + ZIP success, lint absent |
| #125 | 7d9617d0 | 43/0 | tests, lint, ZIP success |
| #118 | 29dd7ccc | 42/23 | tests + ZIP success, diverged |
| #117 | ba756d09 | 47/0 | tests, lint, ZIP success |
| #115 | 3873c1d1 | 1/23 | tests + ZIP success, diverged |
| #114 | ff2cae7b | 4/50 | tests + ZIP success, diverged |
| #110 | 722b5bfc | 15/53 | visual tests failure; lint + ZIP success |
| #102 | 86aeeb6f | 13/228 | visual tests failure; lint + ZIP success |
| #99 | 3f70466d | 21/228 | visual tests failure; lint + ZIP success |

* #132 auto-reference: the head changes after these audit documents are committed; use the PR's live head SHA.

### Failures confirmed from current workflow logs
- #99: dark status badge contrast 3.97:1 (below WCAG AA 4.5:1).
- #102: native date inputs from/to on Rapports had no visible focus during reverse keyboard traversal.
- #110: expense red amounts contrast 4.23:1, below 4.5:1.
### Main CI
Current main SHA remains 8453ee6d8e633f151523236eecff1bc0e0cf877b. Combined statuses and PR-triggered workflow-run query returned no entries this run; no main CI result is claimed.


### Run 8 follow-up — branche/PR #141
- Branches: **147** (page 1=100, page 2=47, page 3=0); aucun nom extra/manquant par rapport à la liste API. L'inventaire contient 146 refs hors branche audit auto-référente, dont la nouvelle ci/workspace-ui-structure-tests-20261122.
- PR ouvertes: **24**.
- #141: head f16f127b, base feat/workspace-settings-navigation-20261121 (PR #129), 1 ahead/0 behind, 1 fichier (.github/workflows/workspace-ui-structure.yml), Draft. Workflow-run/status query vide au contrôle; CI non confirmée.
- #129: head 868027e1, 9 ahead/0 behind main, Draft; workflow-runs/status query vide.
- #132: les checks précédemment vus (Tests in_progress, ZIP success) concernaient le head c77da4b8 avant les commits documentaires de follow-up. Ces commits avancent encore le head auto-référentiel; le statut de CI du head live doit être revérifié, aucune CI complète verte n'est revendiquée.
- Les HEAD des 122 branches sans PR ne sont pas rafraîchis dans ce follow-up; leurs SHA restent run7. Le head de la branche audit #132 est auto-référentiel.
- main reste 8453ee6d; CI main non visible par les endpoints interrogés.
