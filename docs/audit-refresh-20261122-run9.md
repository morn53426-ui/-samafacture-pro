# Audit refresh — 22 novembre 2026, run 9 (12:26 UTC)

## Périmètre et preuve
- Dépôt : `morn53426-ui/-samafacture-pro`; branche de référence `main`.
- HEAD main confirmé : `8453ee6d8e633f151523236eecff1bc0e0cf877b` (merge PR #123).
- Main n'a pas été modifiée. Aucun merge/close, aucune branche supprimée, aucun volume, fichier de données ou backup supprimé; aucun paiement réel activé.
- Les recherches ont été relancées sur l'état courant, sans reprendre les comptes des anciens rapports.

## Inventaire GitHub
- **Branches : 148 noms** (100 + 48, pagination terminée; page suivante vide lors de la vérification précédente). Noms complets ci-dessous.
- **Pull Requests : 25 ouvertes, 113 fermées, 94 fermées-merged, 19 fermées non-merged; 138 PR au total.** Les fenêtres de création Novembre 1–10, 11–15, 16–18 et 19–22 donnent respectivement 3, 40, 54, 16 fermées (merged : 2, 30, 48, 14). Aucune PR ouverte ou fermée antérieure au 1er novembre n'a été retournée.
- Attention : « merged » peut signifier fusion dans une branche de PR, pas dans `main`. #119 et #120 ont été fusionnées dans la chaîne #117/#119; elles ne sont pas sur main.
- Head SHA de toutes les PR ouvertes consultées; comparaisons fraîches main↔PR réalisées. Les branches non-PR (122 branches hors main et PR ouvertes) n'ont pas reçu de comparaison de SHA/ahead-behind fraîche ce run.

## Main, commits et CI
- `main` HEAD `8453ee6d8e633f151523236eecff1bc0e0cf877b`, merge PR #123, 21 nov. 19:20 UTC.
- Les 10 commits récents retrouvés :
- `8453ee6d` — Merge PR #123 — short invoice PDF one page (2026-11-21 19:20Z)
- `c592c704` — Merge latest main into short invoice PDF test branch (2026-11-21 19:06Z)
- `95adbf61` — Merge PR #121 — preserve invoice stamp on mobile (2026-11-21 19:06Z)
- `18d103a7` — Merge main into short invoice PDF test branch (2026-11-21 19:00Z)
- `7c562612` — Merge main into mobile invoice fixes (2026-11-21 18:58Z)
- `c5d5bd2f` — Reject empty/truncated short PDF (2026-11-21 18:54Z)
- `adb7a71e` — Merge PR #116 — long PDF pagination tests (2026-11-21 18:52Z)
- `ab5ec792` — Merge PR #124 — mobile invoice table cards (2026-11-21 18:49Z)
- `67f7721d` — Test five columns without mobile scroll (2026-11-21 18:17Z)
- `f2c9cf2d` — Show invoice financial columns as mobile cards (2026-11-21 18:17Z)
- Les status contexts et runs associés directement au SHA main n'ont pas été retournés par le connecteur. CI du HEAD PR #123 `c592c704`: Tests, ESLint, ZIP **success**; cela ne remplace pas un statut main directement vérifié.

## PR ouvertes (head, base, comparaison et CI)
| PR | Sujet | Head branch | État | Ahead/behind main (ou base) | Head SHA (court) | CI observée |
|---|---|---|---|---|---|---|
| [#142](https://github.com/morn53426-ui/-samafacture-pro/pull/142) | Schema v21 accounting + 15-day trial integration | `integration/schema-v21-accounting-trial-20261122` | Draft | 52/0 | `2a382b69` | Lint + ZIP OK; Node/MySQL tests, restore, cluster smoke OK; visual pending |
| [#141](https://github.com/morn53426-ui/-samafacture-pro/pull/141) | Workspace UI structure regression tests | `ci/workspace-ui-structure-tests-20261122` | Draft | 12/0 main; 3/0 base #129 | `2a09ccf8` | Workspace structure workflow green |
| [#132](https://github.com/morn53426-ui/-samafacture-pro/pull/132) | Audit report + branch inventory | `audit/initial-review-20261122` | Draft | 73/0 | `73bb1843` | No fresh runs returned |
| [#130](https://github.com/morn53426-ui/-samafacture-pro/pull/130) | Accessibility contrast + keyboard | `fix/accessibility-contrast-focus-main-20261121` | Draft | 20/0 | `9722ca99` | Tests + ESLint + ZIP green |
| [#138](https://github.com/morn53426-ui/-samafacture-pro/pull/138) | Product delete protects stock/history | `fix/product-delete-stock-history-protection-20261122` | Draft | 15/0 | `27d5a6c2` | Tests + ESLint + ZIP green |
| [#140](https://github.com/morn53426-ui/-samafacture-pro/pull/140) | Backend history-protection lint coverage | `ci/lint-history-protection-backend-20261122` | Draft | 4/0 | `d16c4c54` | Tests + ESLint + ZIP green |
| [#137](https://github.com/morn53426-ui/-samafacture-pro/pull/137) | Client delete protects linked history | `fix/client-delete-history-protection-20261122` | Draft | 10/0 | `f2aada8d` | Tests + ESLint + ZIP green |
| [#139](https://github.com/morn53426-ui/-samafacture-pro/pull/139) | Professional workspace status contrast | `fix/pro-workspace-status-contrast-20261122` | Draft | 1/0 | `baa9ea6a` | Tests + ZIP green; ESLint run absent |
| [#135](https://github.com/morn53426-ui/-samafacture-pro/pull/135) | Invoice delete protects accounting history | `fix/invoice-delete-history-guard-20261122` | Draft | 11/0 | `2c7f3cb` | Tests + ESLint + ZIP green |
| [#136](https://github.com/morn53426-ui/-samafacture-pro/pull/136) | Posted expense edit/delete protection | `fix/expense-ledger-protection-20261122` | Draft | 5/0 | `4e0f2a89` | Tests + ESLint + ZIP green |
| [#134](https://github.com/morn53426-ui/-samafacture-pro/pull/134) | Enterprise badge dark-theme contrast | `fix/enterprise-badge-contrast-main-20261122` | Draft | 3/0 | `52021018` | Tests + ESLint + ZIP green |
| [#133](https://github.com/morn53426-ui/-samafacture-pro/pull/133) | Template preview contrast (stacked on #130) | `fix/accessibility-template-preview-contrast-20261122` | Draft | 13/0 main; 1/8 base #130 | `6b3cd9ff` | No workflow runs; base stale |
| [#125](https://github.com/morn53426-ui/-samafacture-pro/pull/125) | PDF long-document page-3 balance | `improve/pdf-page3-balance-main-20261121` | Ready | 43/0 | `7d9617d0` | Tests + ESLint + ZIP green |
| [#126](https://github.com/morn53426-ui/-samafacture-pro/pull/126) | Sunupilot landing video port to current main | `integration/sunupilot-video-main-20261121` | Draft | 30/0 | `817b10da` | Tests + ZIP green |
| [#131](https://github.com/morn53426-ui/-samafacture-pro/pull/131) | Current improvement roadmap | `docs/improvement-plan-main-20261122` | Draft | 4/0 | `3d51f0af` | Tests + ZIP green |
| [#118](https://github.com/morn53426-ui/-samafacture-pro/pull/118) | Older Sunupilot video presentation branch | `feature/video-presentation-spark-sunupilot` | Ready | 42/23 | `29dd7ccc` | Tests + ZIP green; diverged |
| [#99](https://github.com/morn53426-ui/-samafacture-pro/pull/99) | SunuPilot rebrand (stale) | `rebrand/optigest` | Ready | 21/228 | `3f70466d` | Tests fail: dark availability contrast 3.97:1; ESLint + ZIP green |
| [#114](https://github.com/morn53426-ui/-samafacture-pro/pull/114) | Older improvement roadmap | `docs/improvement-plan-20261121` | Ready | 4/50 | `ff2cae7b` | Tests + ZIP green; stale |
| [#102](https://github.com/morn53426-ui/-samafacture-pro/pull/102) | Accessibility dark theme + keyboard (stale) | `test/accessibility-dark-keyboard-20261118` | Draft | 13/228 | `86aeeb6f` | Tests fail: Reports date inputs focus indicator; ESLint + ZIP green |
| [#110](https://github.com/morn53426-ui/-samafacture-pro/pull/110) | Rebased accessibility keyboard sweep | `test/accessibility-dark-keyboard-rebased-20261120` | Ready | 15/53 | `722b5bfce` | Tests fail: Reports date inputs focus indicator; ESLint + ZIP green |
| [#129](https://github.com/morn53426-ui/-samafacture-pro/pull/129) | Professional workspace/settings navigation | `feat/workspace-settings-navigation-20261121` | Draft | 9/0 | `868027e1` | Tests + ESLint + ZIP green |
| [#127](https://github.com/morn53426-ui/-samafacture-pro/pull/127) | Executive quote A4 pagination | `fix/quote-executive-a4-pagination-20261121` | Draft | 5/0 | `9bfc8aeab` | Tests + ESLint + ZIP green |
| [#128](https://github.com/morn53426-ui/-samafacture-pro/pull/128) | 15-day trial + professional workspace + OHADA | `feat/15-day-trial-entitlements-20261121` | Draft | 39/0 | `e3b91dc4` | Tests + ESLint + ZIP green |
| [#117](https://github.com/morn53426-ui/-samafacture-pro/pull/117) | Invoice cancellation/re-activation accounting reversal | `fix/accounting-invoice-cancellation-reversal-20261121` | Ready | 47/0 | `ba756d09` | Tests + ESLint + ZIP green |
| [#115](https://github.com/morn53426-ui/-samafacture-pro/pull/115) | OHADA expense-ledger integrity tests | `test/ohada-expense-ledger-integrity-20261121` | Ready | 1/23 | `3873c1d1` | Tests + ZIP green; branch behind |

## Constats techniques et risques
1. **PR #142 intégration v21** (52 commits, 42 fichiers, Draft) porte les branches #117/#128 et protections #135/#136/#137, avec l'intégration expense mode/refund. Elle ne porte pas le guard produit/stock de #138. CI sur HEAD `2a382b69`: ESLint et ZIP verts; Tests Node/MySQL étape 11 verte, restauration sauvegarde étape 12 verte, smoke cluster MySQL/Redis étape 14 verte; recette visuelle étape 15 **encore en cours**. Pas de résultat final.
2. **Comptabilité — annulation de facture payée/partiellement payée non testée.** Le test de contrepassation vérifie une facture sans paiement; le remboursement est testé séparément. Le code conserve l'encaissement lors de l'annulation et contre-passe l'écriture facture, ce qui peut laisser un solde client créditeur jusqu'au remboursement. Valider explicitement le workflow et la balance pour annulation avec paiement partiel/total, remboursement, puis réactivation.
3. **Risque de mapping trésorerie des remboursements.** Si l'écriture paiement manque, le helper déduit 521/571 par regex sur le champ méthode (ex. Wave/PayDunya/Orange/carte/virement→banque; sinon caisse). Les méthodes étant saisies librement, « chèque », « mobile money » ou variantes inconnues peuvent être classées caisse. Tests couvrent « virement » et « Espèces » seulement. Préférer mapping normalisé, ou bloquer le remboursement si compte d'origine non déterminable.
4. **PR #138** protection suppression produit/stock/history reste indépendante, CI verte; portage contrôlé requis dans l'intégration. **PR #140** élargit ESLint et recouvre les mêmes fichiers workflow/config que #142; résolution de conflit à planifier.
5. **Workspace** : #129 navigation/paramètres et #128 intégration trial se recouvrent; #141 tests structurels sont empilés sur #129. Choisir une branche d'intégration et reporter le test, sans merger deux implémentations UX en parallèle.
6. **Accessibilité** : #130, #134, #139 ont CI verte. #133 est 1 commit ahead mais 8 behind de sa base #130, sans runs; rebase avant validation. #99 échoue contraste sombre 3.97:1; #102/#110 échouent focus visible des champs date `from/to` dans Rapports.
7. **PDF** : #125 prêt, CI verte; #127 corrige la pagination Executive, CI verte, mais reste Draft. Vérifier ordre/rebase et recette A4 avant merge.
8. **Video** : #126 portage main courant (30 ahead, CI tests+ZIP verts) préférable à #118 (23 behind, mergeability false). L'asset MP4 final reste signalé absent; la page utilise un fallback animé.
9. **Docs** : #131 roadmap main-current (4 ahead, tests+ZIP verts) préférable à #114 (50 behind). #132 audit PR est Draft, 73 commits ahead, sans run récent retourné.

## Planning priorisé
### P0 — avant toute intégration de #142
- Attendre le résultat final de la recette visuelle; relancer CI sur le dernier SHA si celui-ci change.
- Revue indépendante des migrations v19/v20/v21 (idempotence, données existantes, dates UTC, aucun essai rétroactif) et du code auth/session/tenant.
- Ajouter tests cancellation paid/partial + refund/re-activation; vérifier balance et piste d'audit. Revoir le mapping méthode→521/571.
- Revue comptable OHADA par personne compétente; aucune certification SYSCOHADA revendiquée.

### P1 — protections de données et UI
- Portage/revue #138 product-history protection; coordonner #140 lint avec le lint de #142.
- Consolider #129/#128 workspace, puis intégrer #141 tests de structure sur la base retenue.
- Revoir #135/#136/#137 protections dans #142 (CI verte), sans supprimer données.

### P1 — PDF/print
- Revoir #125 et #127 en séquence, vérifier facture/devis 1, 2 et 3+ pages, bandeau, cachet, logos, QR, polices, thème clair/sombre, données longues, zoom mobile.
- Conserver tests visuels et PDF A4 comme critères bloquants.

### P2 — accessibilité, vidéo et OHADA
- Rebaser #133 sur le HEAD #130, CI complète; traiter #99/#102/#110 comme branches obsolètes/échouées, ne pas merger.
- Garder #126, vérifier le MP4 final avant de remplacer le fallback; comparer #118 sans fusion.
- Rebaser #115 (23 commits behind) et garder le test d'isolation tenant.
- Maintenir #131; ne pas merger la roadmap #114 avant comparaison.

### P3 — inventaire branches restantes et sécurité
- Refaire head SHA, ahead/behind et CI des 122 branches non-PR; inventorier leurs commits et rechercher branches abandonnées/duplications avant toute suppression (aucune suppression autorisée).
- Audit sécurité ciblé : auth/JWT/session, secrets Docker, migrations, backup/restore, tenant isolation, dépendances; test réel local impossible ici.

## Limites de cette exécution
- Connecteur GitHub : inventaire des noms de branches et PR heads disponible; SHA/ahead-behind des 122 branches non-PR non rafraîchis.
- Aucun clone local/runtime de tests fourni : tests locaux, Docker local, inspection visuelle réelle et certification OHADA **non exécutés**.
- Les runs GitHub rapportés sont des résultats de CI observés sur les SHAs indiqués; les tests visuels #142 ne sont pas finalisés.
- Les changements effectués dans ce run sont **documentation uniquement** sur la branche d'audit #132; aucune modification de code ni de main.

## Inventaire complet des noms de branches (148)
### (sans préfixe)

- `main`

### audit

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

### automation

- `automation/audit-fixes-20261116-0150`
- `automation/visual-viewport-notifications-20261116-0243`

### brand

- `brand/sunupilot-identity-foundation`

### chore

- `chore/emil-design-skills-20261117`

### ci

- `ci/lint-history-protection-backend-20261122`
- `ci/package-main-after-pr39-pr40`
- `ci/real-restore-smoke-20261117`
- `ci/workspace-ui-structure-tests-20261122`

### docs

- `docs/business-plan-samafacture-pro`
- `docs/correct-one-time-plan-billing-2026-11-16`
- `docs/fix-staging-compose-runbook-20261116`
- `docs/improvement-plan-20261121`
- `docs/improvement-plan-main-20261122`
- `docs/local-docker-bootstrap-20261117`
- `docs/subscription-monthly-architecture-20261117`
- `docs/subscriptions-current-state-20261117`
- `docs/ui-polish-plans-20261117`

### feat

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
- `feat/monthly-invoice-quota-v8-2026-11-15`
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

### feature

- `feature/video-presentation-spark-sunupilot`

### fix

- `fix/a11y-settings-labels-20261116`
- `fix/accessibility-contrast-focus-main-20261121`
- `fix/accessibility-template-preview-contrast-20261122`
- `fix/accounting-invoice-cancellation-reversal-20261121`
- `fix/accounting-refund-journal-reversal-20261121`
- `fix/atomic-backup-publish-2026-11-15`
- `fix/atomic-encrypted-backups-2026-11-15`
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
- `fix/invoice-print-typography-20261118`
- `fix/invoice-settlement-integrity-2026-11-15`
- `fix/invoice-stock-principal-warehouse`
- `fix/light-dark-theme-consistency-20261118`
- `fix/mobile-invoice-line-columns`
- `fix/monthly-invoice-quota-schema-v8-2026-11-15`
- `fix/navigation-compact-sidebar-2026-11-13`
- `fix/pdf-headless-user-formatting-20261121`
- `fix/pdf-pagination-extras-flow-20261117`
- `fix/pdf-print-pagination-20261117`
- `fix/pdf-stream-ack-payment-disclosures-20261116`
- `fix/pdf-worker-db-readiness-2026-11-16`
- `fix/pdf-worker-health-and-sidebar-icons-2026-11-15`
- `fix/pdf-worker-wait-for-api-health-2026-11-15`
- `fix/pro-workspace-status-contrast-20261122`
- `fix/product-delete-stock-history-protection-20261122`
- `fix/purchase-receipt-warehouse-deadlock-20261119`
- `fix/quota-registry-initialization-robustness-2026-11-15`
- `fix/quote-executive-a4-pagination-20261121`
- `fix/quote-warehouse-resilience-20261120`
- `fix/revoke-jwt-on-logout-2026-11-15`
- `fix/session-revocation-and-payment-timeouts-2026-11-15`
- `fix/sidebar-aria-current-2026-11-15`
- `fix/subscription-disabled-state-tests-docs-20261117`
- `fix/subscription-icons-main-2026-11-15`
- `fix/sunupilot-pwa-lifecycle`
- `fix/team-invitation-email-proof-20261117`
- `fix/ui-icons-legibility-2026-11-15`
- `fix/ui-responsive-polish-20261117`
- `fix/visual-qr-fixture-20261121`
- `fix/whatsapp-country-guard-2026-11-16`

### improve

- `improve/pdf-page3-balance-20261121`
- `improve/pdf-page3-balance-main-20261121`

### integration

- `integration/main-company-invitation-email-proof-20261117`
- `integration/schema-v21-accounting-trial-20261122`
- `integration/sunupilot-video-main-20261121`

### qa

- `qa/test-pdf-24-modeles`

### rebase

- `rebase/pr106-main-20261121-run1`
- `rebase/pr110-main-20261121-run1`

### rebrand

- `rebrand/optigest`

### security

- `security/docker-ignore-local-secrets-2026-11-15`
- `security/immediate-session-revocation-2026-11-16`
- `security/redact-secret-urls-in-logs-2026-11-16`

### test

- `test/accessibility-audit-business-pages-20261118`
- `test/accessibility-dark-keyboard-20261118`
- `test/accessibility-dark-keyboard-rebased-20261120`
- `test/backup-atomic-visibility-2026-11-15`
- `test/dark-theme-zoom-200-sweep-20261118`
- `test/invoice-long-pdf-pagination-20261121`
- `test/invoice-short-pdf-one-page-20261121`
- `test/invoice-short-pdf-one-page-main-20261121`
- `test/ohada-expense-ledger-integrity-20261121`
- `test/pdf-font-embedding-and-visual-print-20261118`
- `test/theme-dark-mobile-sweep-20261118`
- `test/theme-dark-sweep-20261118`
- `test/theme-light-desktop-sweep-20261118`
- `test/theme-light-mobile-sweep-20261118`
- `test/workspace-zoom-200-sweep-20261118`

### tooling

- `tooling/local-docker-test-bundle-20261112`

### ui

- `ui/augmenter-logo-icones-sidebar`
- `ui/modern-responsive-polish`


## Follow-up du run 9 — correction comptable (12:42 UTC)
- Deux branches de correction dédiées ont été créées : `fix/refund-payment-method-mapping-20261122` (base obsolète, conservée) et `fix/refund-payment-method-mapping-rebased-20261122` (PR #143, Draft). L'intégration #142 avançait pendant le travail; le head #142 est désormais `d2a687ab`.
- Cause prouvée : le formulaire `public/factures.html` propose « Chèque »; les deux regex comptables (post-payment et fallback refund) ne l'incluaient pas. La méthode libre inconnue était classée caisse par défaut.
- Correctif/test portés sur #142 : mapping normalisé explicite; chèque→521, espèces→571; inconnues bloquées 409; tests d'écriture chèque, remboursement chèque, méthode inconnue et balance. Commits #142 : `cbcd674b` (test), `d2a687ab` (route).
- PR #143 reste Draft et ne reçoit pas de runs CI sur sa base de branche; sa comparaison montre 2 commits ahead/10 behind et mergeability false. La correction est aussi portée sur #142 pour obtenir CI main.
- HEAD #142 `d2a687ab`: ESLint et ZIP success; Tests automatisés run #1516 en cours (initialisation containers, tests/recette visuelle pas encore démarrés).
- Inventaire après création des branches : **150 branches** (100+50); **26 PR ouvertes**, 113 fermées (94 merged/19 non-merged), **139 PR total**. Les 2 branches ajoutées à l'inventaire précédent : `fix/refund-payment-method-mapping-20261122`, `fix/refund-payment-method-mapping-rebased-20261122`.
- Aucun merge/close/main touché; aucune donnée/volume/backup supprimé; aucun paiement réel.


### CI/HEAD refresh — 12:43 UTC
- #142 current head `b4e23b2a` (test query assertion scoped by source_type+source_id); run #1518 Tests automated **in progress**, container initialization. ESLint #525 and ZIP #1220 **success**.
- The previous run #1516 on head `d2a687ab` was superseded by the test assertion refinement. Do not treat it as final.
- #143 remains Draft, head `17d25a5e`, no CI returned and mergeability false against its stale base; same correction is included on #142 for CI.

### CI step progress — 12:44 UTC
- #142 run #1518 : Docker build + secrets check success; npm install en cours; audit dépendances/tests/restore/cluster/visual non encore démarrés. ESLint #525 et ZIP #1220 restent success.

## Run 2 — vérification fraîche et CI complète (22 novembre 2026, 13:24 UTC)

### Inventaire revérifié
- 150 branches distantes : 100 sur page 1, 50 sur page 2 (pagination terminée).
- 139 PR : 26 ouvertes (19 Draft, 7 prêtes), 113 fermées; parmi les fermées, 94 merged et 19 non merged.
- `main` HEAD `8453ee6d8e633f151523236eecff1bc0e0cf877b`, inchangée. 12 derniers commits revus; derniers changements PDF/print/mobile.
- PR #142 : HEAD `9355eb37493a33ae08e64ef6ce742a12ab6f9dd4`, 74 commits ahead, 0 behind, 48 fichiers, clean/mergeable. Aucun review, aucun thread.

### CI finale #142 — preuves
- Tests run `45024413918` : success. Job complet; 576 tests, 575 pass, 0 fail, 1 skipped. Tests MySQL, Docker image/secret-sentinel, restauration réelle backup chiffré (1 test pass), cluster MySQL/Redis smoke, recette responsive.
- ESLint run `45024413890` : success.
- ZIP run `45024413895` : success.
- npm audit dans le job tests : 0 vulnérabilité (info/low/moderate/high/critical = 0).
- Recette visuelle : 147 captures, 7 largeurs; artefact `samafacture-recette-visuelle-1521`, 87,112,943 octets, expiration indiquée 14 jours.
- Un test est skipped; aucune raison n'a été déterminée dans ce rapport. CI verte ne remplace pas revue humaine.

### Correctif chèques — revue indépendante
Le mapping `paymentTreasuryAccount` et le test d'encaissement « Chèque » sur journal BQ/compte 521 sont identiques entre la branche #143 et le HEAD #142. #142 contient aussi les tests de remboursement par chèque et rejet méthode inconnue portés pour exécution CI. #143 reste Draft, sans checks, divergé de la base d'intégration (3 commits ahead, 13 behind); ne pas fusionner sa copie redondante.

### Main CI et limite API
Sur main, le check-run Tests Node.js et MySQL associé à HEAD a conclu success. Le combined status endpoint renvoie néanmoins `pending` avec 0 status contexts; cette incohérence de statut API est notée, sans prétendre que la main a une CI récente complète. Lecture branch-protection/ruleset non confirmée dans cette session.

### Risques et décisions
- #142 reste Draft : aucun merge ni approbation; main reste inchangée.
- La PR #143 est redondante pour les modifications de mapping déjà intégrées à #142. Conserver ouverte, ne pas merger/fermer sans autorisation.
- Revue comptable indépendante requise : annulation d'une facture déjà payée, articulation écriture facture/encaissement/contrepassation, permanence de l'événement d'audit (la migration définit une FK facture ON DELETE CASCADE; la route protège la suppression, mais un bypass DB pourrait supprimer les événements).
- Aucun test local n'a été exécuté; les preuves proviennent de GitHub Actions.
- Les branches non-PR n'ont pas toutes été comparées individuellement à main : inventaire de noms complet, audit SHA/ahead-behind incomplet pour ce sous-ensemble.

### Planning ajusté
1. P0 : revue comptable indépendante de #142 (annulation facture avec paiements, événements d'audit, tenant isolation) avant sortir Draft/merge.
2. P1 : résoudre la PR #143 redondante après décision autorisée; #138 protection produit/stock, #140 lint routes historique.
3. P1 : recette PDF/devis (#125/#127) puis rebase et CI; conserver les échecs #99/#102/#110 bloquants.
4. P2 : workspace (#128/#129/#141) sans duplication; accessibilité #133 rebase.
5. P3 : audit SHA/ancestry des 122 branches non-PR restantes, sécurité Docker/backup/session et OHADA.

## Run 3 — protection des événements comptables et CI empilée (22 novembre 2026)

- Cause audit : la migration 011 avait une FK invoice-event `ON DELETE CASCADE`, pouvant effacer l'historique de contrepassation si une facture était supprimée hors de la route protégée.
- Correctif v22 en PR Draft #145 : nouvelle FK RESTRICT, migration idempotente v21→22, tests pour suppression facture bloquée, conservation événement, re-run et effacement cascade tenant.
- PR #144 reste ouverte Draft comme tentative précédente sans CI; #145 est reprise sur le head intégration actuel pour déclencher les workflows.
- PR #142 head `decb8da` : ZIP #45027909640 success, ESLint #45027909637 success, Tests #45027909669 en cours (Docker build/secret verification). Head 77 commits ahead main, 0 behind, 48 fichiers.
- PR #145 head `c59e3f0`, base intégration `decb8da` : ZIP et ESLint verts, Tests #45027993526 en cours (démarrage). Aucun test local.
- PR #132 audit head `13d6bce` : ZIP #45027535450 success; Tests #45027535457 en cours à la recette visuelle responsive.
- Les filtres CI de test, lint et ZIP ont été ajoutés sur la branche intégration pour permettre les PR empilées; ces modifications sont elles-mêmes sous CI #142.
- Aucune fusion/fermeture, main préservée.
