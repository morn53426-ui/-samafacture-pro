# SamaFacture Pro — Rapport d'exécution Run 3 (23 novembre 2026)

## Résumé exécutif


> **Note de snapshot :** l'inventaire (176 branches / 40 PR ouvertes) a été collecté avant la création de la branche de rapport et de la PR #170, puis du correctif et de la PR #171. Ces deux branches/PR sont exclues de l'inventaire initial; l'état vivant après création est donc 178 branches et 42 PR ouvertes (si aucune autre modification concurrente).

- Dépôt public : `morn53426-ui/-samafacture-pro`.
- Main inchangé : `b43a94fc2937b0108077501a0260358c8569e11f`.
- Inventaire actualisé : **176 branches**, **40 PR ouvertes**, **125 PR fermées** (dont 106 merged et 19 fermées sans merge). Les numéros #58, #61, #66 et #70 sont absents de la collection PR.
- Deux PR ouvertes ajoutées/actualisées depuis run 2 : #168 (fuseau/devise tenant et isolation) et #167 (devise emails/relances et échappement HTML; head réactualisé).
- **Main stable :** run push-main #1676 sur SHA exact `b43a94fc2937b0108077501a0260358c8569e11f` a terminé `success` le 22 novembre. Le run précédent après #163 (#1674, SHA `e6a2caf04f0648d30419042c97cb63b6a14a05f8`) est également `success`.
- Aucun merge, aucun push sur main, aucun force-push, aucune branche supprimée, aucune migration exécutée, aucun paiement réel ni déploiement.
- Commentaires de revue ciblée publiés : #167 (ID 7088759860), #168 (ID 7088760213). Aucun APPROVE.

## Main, commits et CI post-fusion

| Ref | SHA | CI/run | Résultat observé |
|---|---|---|---|
| main post #165 | `b43a94fc2937b0108077501a0260358c8569e11f` | Tests automatisés run #1676, [Actions](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45080802243) | Tests Node/MySQL success; 584 tests, 583 pass, 0 fail, 1 skip; restauration chiffrée réelle 1/1; recette visuelle 147 captures / 7 largeurs. |
| main post #163 | `e6a2caf04f0648d30419042c97cb63b6a14a05f8` | Tests run #1674, [Actions](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45079271982) | success. |
| main check-runs | `b43a94fc2937b0108077501a0260358c8569e11f` | API check-runs | 1 check: `Tests Node.js et MySQL` success. Check-suites 1/1 success. Le combined-status endpoint ne renvoie aucun status, mais le check-run exact est confirmé. |

Le workflow source ZIP et ESLint sont PR-only; ils ne s'exécutent pas sur push-main. La CI post-fusion main observée est donc le workflow tests.

## Ruleset et protections actuelles

Lecture autorisée du ruleset `27410527` **protect main**, enforcement active, condition `refs/heads/main` :

- Pull Request obligatoire; méthodes merge/rebase/squash autorisées.
- Suppression et non-fast-forward interdits.
- Résolution de conversations requise.
- Checks requis : `Tests Node.js et MySQL` et `Build complete source archive`.
- **Approvals requis : 0**; aucun acteur de bypass.
- `current_user_can_bypass = never`.
- Endpoint branch-protection classique : 403 `Resource not accessible by integration`; sa configuration n'est pas vérifiable par cette connexion.

Le ruleset n'impose pas une approbation humaine indépendante. Je maintiens toutefois votre gate opérationnel : aucune fusion de sécurité, devise ou comptabilité sans revue/validation humaine indépendante.

## CI exacte des PR prioritaires

| PR | Head SHA | Diff main | Checks sur SHA exact | Décision |
|---|---|---|---|---|
| #167 | `4e848f3b98b1bc93635f0dab01a7d752fd2b18cd` | 26 commits ahead, 0 behind; 22 fichiers | Tests, ESLint, ZIP : 3/3 success. Tests 589, 588 pass, 0 fail, 1 skip; restore réel 1/1; visuel 147/7 widths. | **Ne pas fusionner** : XSS + relances multi-devise sans tests dédiés; revue humaine indépendante requise. |
| #168 | `b07000daa7663196de68a42bc0ba011f4f4cf7f9` | 53 commits ahead, 0 behind; 30 fichiers; inclut #167 | Tests, ESLint, ZIP : 3/3 success. Tests 595, 594 pass, 0 fail, 1 skip; restore réel 1/1; visuel 147/7 widths. | **Ne pas fusionner** : défaut devise commandes commerciales + race de verrouillage de devise; dépend de #167. |
| #149 | `6f82b82dfab5c6d4a8b0fc0a466b331a2ebab3c7` | 4 ahead, 42 behind; diverged; 14 fichiers | Tests, ESLint, ZIP : 3/3 success sur head exact. | **Bloquée** : migration 012 en doublon et version v23 inchangée; nécessite migration 013/version24, tests upgrade/replay, FK tenant composée, rebase et validation OHADA humaine. |
| #159 | `1c6bf875b98273cac0c00ac5c306aa22dcafb8d3` | 12 ahead, 15 behind; diverged; mergeable=false | 3/3 success sur head exact. | Rebase + CI exact + revue humaine sécurité. |
| #164 | `a10bc748a38b05a80caf21c9f2f16da5e729d2e1` | 3 ahead, 16 behind; diverged | 3/3 success sur head exact. | Rebase + CI exact + revue humaine sécurité. |
| #169 | `dff61fb42a429fce93ed1fc6f0a3c9f355ced6f4` | Rapport run 2, draft | Tests + ZIP 2/2 success. | Historique conservé; run 3 ajouté séparément. |

Les autres PR ouvertes conservent la snapshot CI de run 2; leur CI/diff n'a pas été réactualisée individuellement dans ce run. Les checks verts sur heads stale ne valident pas un rebase.

## Revue #167 — devise / relances / échappement HTML

- Head exact : `4e848f3b98b1bc93635f0dab01a7d752fd2b18cd`.
- CI 3/3 success, tests 588 pass + 1 skip, restauration réelle 1/1, recette 147 captures.
- Commentaire actualisé ID **7088759860** : demande test XSS sur messages API hostiles et tests scheduler multi-devises (totaux séparés, clés run_key historiques, pas de doublons).
- La revue précédente était basée sur un SHA antérieur `96e1641`; elle ne valide pas le head actuel.
- Pas d'approbation.

## Revue #168 — findings bloquants

- Head exact : `b07000daa7663196de68a42bc0ba011f4f4cf7f9`; 3/3 checks success, 594 pass + 1 skip, restauration réelle 1/1, recette visuelle 147 captures.
- **P1 — commandes commerciales en FCFA :** `public/professionnel.html` envoie le formulaire commandes sans champ `devise`; `POST /pro/orders` prend `req.body.devise || 'FCFA'`. Une entreprise EUR/USD peut créer une commande enregistrée FCFA. Le verrou currency de `/auth/entreprise` et `/pro/localization` omet aussi `pro_commandes`. Commentaire ID **7088760213** : défaut backend au currency tenant, validation devise, test de commande EUR et verrou après commande.
- **P1 — race sur le verrou devise :** les deux endpoints comptent l'historique puis modifient `users.devise` en requêtes séparées sans transaction/locking commun aux créations. Une création concurrente peut se produire entre COUNT et UPDATE. Commentaire ID **7088760213** : sérialisation/locking et test concurrent.
- #168 est empilée sur #167 : ne pas fusionner indépendamment; après #167, synchroniser/rebase, rerun CI et revue.

## OHADA / migrations

- Main schema version : **23**.
- Migrations SQL main : 10 fichiers, 003 à 012; migration 012 actuelle `comptabilite_correspondances`.
- #149 ajoute aussi un fichier migration 012 mais laisse la version 23; les installations déjà en v23 ne l'exécuteront pas. La correction requise reste 013/v24. Aucun SQL appliqué à des bases réelles.
- #142/#143/#144/#145/#146/#147 : branches d'intégration comptables stales/divergentes; aucune fusion. Préserver les événements, factures, écritures et contrepassations; validation humaine spécifique obligatoire.

## Workflows main

- `lint.yml` — `1c924553556d`
- `package-source-zip.yml` — `f6f28a9aafc3`
- `test.yml` — `a748864b071a`

- `test.yml` : pull_request + push main; tests Node/MySQL, audit npm bloquant, Docker, restauration chiffrée, cluster smoke, visuel.
- `lint.yml` : PR ciblée par chemins.
- `package-source-zip.yml` : PR seulement; archive ZIP source requise au ruleset.
- CI exactes des #167 et #168 sont 3/3 success.

## Inventaire complet des branches (176)

SHA courts du head de chaque branche, état `protected` retourné par l'API :

- `a11y/dashboard-skip-navigation-20261122` — `8f45795c3df5` (protected=false)
- `a11y/mobile-sidebar-escape-focus-20261122` — `c37403034a25` (protected=false)
- `audit/execution-report-20261122-run1` — `dc7e6f55c5f7` (protected=false)
- `audit/execution-report-20261122-run2` — `dff61fb42a42` (protected=false)
- `audit/fix-backup-and-runtime-20261110` — `9ea9a9aa00d4` (protected=false)
- `audit/fix-enterprise-migration-invitation-20261116` — `0b93cf9e37fe` (protected=false)
- `audit/fix-nginx-upstream-order-20261116` — `5e93abdc37d4` (protected=false)
- `audit/fix-realtime-company-groups-20261116-run1` — `e5c3d8020b40` (protected=false)
- `audit/fix-reset-email-docs-and-redaction-test-20261116` — `a53c96daa1c2` (protected=false)
- `audit/initial-review-20261122` — `6543b3a70175` (protected=false)
- `audit/invoice-pdf-typography-print-20261118` — `7cb2d43cf3aa` (protected=false)
- `audit/npm-audit-gate-2026-11-16` — `63a344d9154b` (protected=false)
- `audit/rapport-approfondi-2026-11-16-run2` — `1aee93310304` (protected=false)
- `audit/securite-2026-11-15` — `9939413ad492` (protected=false)
- `audit/security-multisocietes-review-20261116-run3` — `4acf4d365c89` (protected=false)
- `audit/ui-runtime-pages-polish-20261113` — `094c34f33a45` (protected=false)
- `audit/visual-viewport-offset-regression-20261116` — `f744b2039678` (protected=false)
- `automation/audit-fixes-20261116-0150` — `a423dca17e30` (protected=false)
- `automation/visual-viewport-notifications-20261116-0243` — `64f5b2c2ec8e` (protected=false)
- `brand/sunupilot-identity-foundation` — `63f8eb27a5ff` (protected=false)
- `chore/emil-design-skills-20261117` — `70f8ea190bfd` (protected=false)
- `ci/lint-history-protection-backend-20261122` — `32d1c1f56cb9` (protected=false)
- `ci/package-main-after-pr39-pr40` — `8c725a00cd3b` (protected=false)
- `ci/real-restore-smoke-20261117` — `8864ab9478d0` (protected=false)
- `ci/workspace-ui-structure-tests-20261122` — `2a09ccf8bfdb` (protected=false)
- `docs/backup-offsite-pinned-rclone-20261122` — `76aa447d8bee` (protected=false)
- `docs/business-plan-samafacture-pro` — `ac07f0788ee6` (protected=false)
- `docs/correct-one-time-plan-billing-2026-11-16` — `43592f99b6f7` (protected=false)
- `docs/fix-staging-compose-runbook-20261116` — `22c0dae280e3` (protected=false)
- `docs/improvement-plan-20261121` — `ff2cae7bd378` (protected=false)
- `docs/improvement-plan-main-20261122` — `3d51f0afb669` (protected=false)
- `docs/local-docker-bootstrap-20261117` — `eeea9c4a7100` (protected=false)
- `docs/production-env-security-guidance-20261122` — `be0f2789cceb` (protected=false)
- `docs/subscription-monthly-architecture-20261117` — `430e2010b1be` (protected=false)
- `docs/subscriptions-current-state-20261117` — `e618e88c7be3` (protected=false)
- `docs/ui-polish-plans-20261117` — `137a9b01d3ea` (protected=false)
- `feat/abonnement-choix-moyen-paiement` — `3f32787dd561` (protected=false)
- `feat/accounting-expense-payment-mode-20261121` — `08a1c025744a` (protected=false)
- `feat/dashboard-reference-layout` — `11d55850b647` (protected=false)
- `feat/dashboard-reference-modules-20261119` — `f3cbbc669629` (protected=false)
- `feat/dashboard-reference-redesign-20261112` — `6cf80f4c547b` (protected=false)
- `feat/enterprise-command-center-20261117` — `ae7e0e8e59f0` (protected=false)
- `feat/enterprise-company-pagination-20261117` — `3b8d8ebc171b` (protected=false)
- `feat/enterprise-multi-company-foundation-20261116` — `c19e12959de8` (protected=false)
- `feat/enterprise-page-structure-2026-11-13` — `e39910166ba4` (protected=false)
- `feat/enterprise-page-structure-v2-2026-11-13` — `745a98b586ef` (protected=false)
- `feat/enterprise-pages-v2-2026-11-13` — `e9992176d76f` (protected=false)
- `feat/enterprise-workspace-ux-20261117` — `14cdd3c48c0b` (protected=false)
- `feat/invoice-stock-warehouse-20261119` — `30bcfaa58ebf` (protected=false)
- `feat/invoice-template-gallery-2026-11-15-v2` — `570bf60cad5f` (protected=false)
- `feat/invoice-template-gallery-2026-11-15` — `70d95aac18e3` (protected=false)
- `feat/invoice-templates-pro-enterprise-20261117` — `4de3da440926` (protected=false)
- `feat/invoice-warehouse-stock-20261119` — `e9ac3c69d928` (protected=false)
- `feat/invoice-warehouse-stock-main-20261119` — `158a9e0663d1` (protected=false)
- `feat/monthly-invoice-quota-v8-2026-11-15` — `f3b2690913b9` (protected=false)
- `feat/ohada-account-mappings-20261122` — `ca3cb8fbf594` (protected=false)
- `feat/phases-2-4-paiements-compta-achats-20261112` — `f028da580224` (protected=false)
- `feat/phases-5-7-portal-international-automation-20261112` — `a3a43402f59d` (protected=false)
- `feat/professional-subscription-page-2026-11-15` — `cf58665a9083` (protected=false)
- `feat/responsive-scaling-2026-11-15` — `f7d10afed88a` (protected=false)
- `feat/sidebar-icon-label-navigation-20261117` — `c8bc6af9181b` (protected=false)
- `feat/sidebar-navigation-visual-refresh-20261117` — `314c06e7e9ec` (protected=false)
- `feat/subscription-engine-local-simulation-20261117` — `c077af1465c2` (protected=false)
- `feat/sunupilot-dashboard-reference` — `11d55850b647` (protected=false)
- `feat/templates-factures-devis-complets` — `81aa9fa67012` (protected=false)
- `feat/topbar-notifications-bell-20261112` — `a36472e66f18` (protected=false)
- `feat/ui-motion-visual-recette-20261112` — `1ae8c307b3cf` (protected=false)
- `feat/workspace-settings-navigation-20261121` — `868027e1edc8` (protected=false)
- `feat/5-nouveaux-modeles-facture` — `342a3e43c5b8` (protected=false)
- `feat/15-day-trial-entitlements-20261121` — `e3b91dc4ae45` (protected=false)
- `feature/ohada-expense-account-mappings-20261122` — `6f82b82dfab5` (protected=false)
- `feature/video-presentation-spark-sunupilot` — `29dd7ccc8084` (protected=false)
- `fix/a11y-settings-labels-20261116` — `4b275916eefa` (protected=false)
- `fix/accessibility-contrast-focus-main-20261121` — `0b819127cc8b` (protected=false)
- `fix/accessibility-template-preview-contrast-20261122` — `6b3cd9ffd544` (protected=false)
- `fix/accounting-event-audit-retention-v22-20261122` — `90b718abcbef` (protected=false)
- `fix/accounting-event-audit-retention-v22-run2-20261122` — `5b6ba8bf3b05` (protected=false)
- `fix/accounting-invoice-cancellation-reversal-20261121` — `ba756d098884` (protected=false)
- `fix/accounting-refund-journal-reversal-20261121` — `b45f47975434` (protected=false)
- `fix/atomic-backup-publish-2026-11-15` — `081d93123608` (protected=false)
- `fix/atomic-encrypted-backups-2026-11-15` — `03a36a61b7c4` (protected=false)
- `fix/audit-devise-relances-escape` — `4e848f3b98b1` (protected=false)
- `fix/backup-directory-permissions-20261122` — `1c3a12bacd9c` (protected=false)
- `fix/backup-retention-guard-2026-11-16` — `e277ca8a8412` (protected=false)
- `fix/ci-serial-tests-2026-11-15` — `4a74afa8dcea` (protected=false)
- `fix/client-delete-history-protection-20261122` — `f2aada8d5c01` (protected=false)
- `fix/dashboard-donut-count-20261118` — `2d4d7619350a` (protected=false)
- `fix/docker-context-secrets-and-lockfile-2026-11-15` — `52d4b81b3ff8` (protected=false)
- `fix/docker-local-startup-mysql-redis-swagger` — `2f021548666e` (protected=false)
- `fix/enterprise-badge-contrast-main-20261122` — `52021018d789` (protected=false)
- `fix/enterprise-invitation-email-proof-20261116` — `4347d572f4e7` (protected=false)
- `fix/expense-ledger-protection-20261122` — `4e0f2a893812` (protected=false)
- `fix/invoice-delete-history-guard-20261122` — `2c7f3cbde915` (protected=false)
- `fix/invoice-footer-stamp-mobile-20261121` — `7c562612e897` (protected=false)
- `fix/invoice-mobile-table-cards-20261121` — `67f7721d5123` (protected=false)
- `fix/invoice-pdf-continuation-identity-20261121` — `885b7b42a7d4` (protected=false)
- `fix/invoice-print-and-payment-stamp-2026-11-15` — `ed6c1467affe` (protected=false)
- `fix/invoice-print-banner-geometry-20261121` — `0ec7c3eeb59f` (protected=false)
- `fix/invoice-print-banner-spacing-20261122` — `4eec7b226911` (protected=false)
- `fix/invoice-print-typography-20261118` — `d8805a202dd9` (protected=false)
- `fix/invoice-settlement-integrity-2026-11-15` — `30318cf3cf48` (protected=false)
- `fix/invoice-stock-principal-warehouse` — `383c885a969b` (protected=false)
- `fix/light-dark-theme-consistency-20261118` — `bf497de04d01` (protected=false)
- `fix/mobile-invoice-line-columns` — `9019ec2dfca2` (protected=false)
- `fix/monthly-invoice-quota-schema-v8-2026-11-15` — `69028f5946e9` (protected=false)
- `fix/mysql-backup-limited-privileges-20261122` — `bdca6bec1c5b` (protected=false)
- `fix/navigation-compact-sidebar-2026-11-13` — `508607c7cc69` (protected=false)
- `fix/pdf-headless-user-formatting-20261121` — `862d31a76342` (protected=false)
- `fix/pdf-pagination-extras-flow-20261117` — `2e7dd32a3eec` (protected=false)
- `fix/pdf-print-pagination-20261117` — `b8e344915cea` (protected=false)
- `fix/pdf-stream-ack-payment-disclosures-20261116` — `a576e5e1fec8` (protected=false)
- `fix/pdf-worker-db-readiness-2026-11-16` — `59d341a15462` (protected=false)
- `fix/pdf-worker-health-and-sidebar-icons-2026-11-15` — `04304461cafa` (protected=false)
- `fix/pdf-worker-wait-for-api-health-2026-11-15` — `941f235f5f4b` (protected=false)
- `fix/pro-workspace-status-contrast-20261122` — `baa9ea6a6881` (protected=false)
- `fix/product-delete-stock-history-protection-20261122` — `27d5a6c27d5d` (protected=false)
- `fix/purchase-receipt-warehouse-deadlock-20261119` — `f0f43c3d1e7a` (protected=false)
- `fix/quota-registry-initialization-robustness-2026-11-15` — `c8ea3204dcdc` (protected=false)
- `fix/quote-executive-a4-pagination-20261121` — `400ce60ddb8f` (protected=false)
- `fix/quote-warehouse-resilience-20261120` — `8d0a4d299017` (protected=false)
- `fix/refund-payment-method-mapping-20261122` — `3265810b25f3` (protected=false)
- `fix/refund-payment-method-mapping-rebased-20261122` — `17d25a5e3686` (protected=false)
- `fix/revoke-jwt-on-logout-2026-11-15` — `a20939278417` (protected=false)
- `fix/session-revocation-and-payment-timeouts-2026-11-15` — `46f280761b61` (protected=false)
- `fix/sidebar-aria-current-2026-11-15` — `1066c1c4d02e` (protected=false)
- `fix/subscription-disabled-state-tests-docs-20261117` — `60f57e272b27` (protected=false)
- `fix/subscription-icons-main-2026-11-15` — `3316731d6119` (protected=false)
- `fix/sunupilot-pwa-lifecycle` — `86da24a1c6e8` (protected=false)
- `fix/team-invitation-email-proof-20261117` — `8e1b84dffe59` (protected=false)
- `fix/ui-icons-legibility-2026-11-15` — `0d7c5390f474` (protected=false)
- `fix/ui-responsive-polish-20261117` — `5efe69b69853` (protected=false)
- `fix/visual-qr-fixture-20261121` — `df6070e367ae` (protected=false)
- `fix/webhook-local-timezone-dynamic-currency-20261123` — `b07000daa766` (protected=false)
- `fix/whatsapp-country-guard-2026-11-16` — `a49756cd21ec` (protected=false)
- `improve/pdf-page3-balance-20261121` — `115ab9f0e2f1` (protected=false)
- `improve/pdf-page3-balance-main-20261121` — `3bab7c770052` (protected=false)
- `integration/main-company-invitation-email-proof-20261117` — `70750be430c8` (protected=false)
- `integration/reconcile-main-v21-20261122` — `e8b2dc9c6f20` (protected=false)
- `integration/schema-v21-accounting-trial-20261122` — `decb8da2e48e` (protected=false)
- `integration/schema-v22-main-reconciled-20261122` — `62ea473892b1` (protected=false)
- `integration/sunupilot-video-main-20261121` — `817b10da7b85` (protected=false)
- `main` — `b43a94fc2937` (protected=true)
- `qa/test-pdf-24-modeles` — `d3b70a09c598` (protected=false)
- `rebase/pr106-main-20261121-run1` — `383c885a969b` (protected=false)
- `rebase/pr110-main-20261121-run1` — `ca1d1abdc9c6` (protected=false)
- `rebrand/optigest` — `3f70466d0b6b` (protected=false)
- `reconciliation/schema-v21-main-base-20261122` — `d9c428aaa916` (protected=false)
- `security/docker-ignore-local-secrets-2026-11-15` — `4d2c20e28ee2` (protected=false)
- `security/immediate-session-revocation-2026-11-16` — `d6887ce043b8` (protected=false)
- `security/invoice-list-verification-code-redaction-20261122` — `1c6bf875b982` (protected=false)
- `security/redact-secret-urls-in-logs-2026-11-16` — `d27f55b581ba` (protected=false)
- `test/accessibility-audit-business-pages-20261118` — `468caba29865` (protected=false)
- `test/accessibility-dark-keyboard-20261118` — `86aeeb6f4be2` (protected=false)
- `test/accessibility-dark-keyboard-rebased-20261120` — `722b5bfce067` (protected=false)
- `test/backup-atomic-visibility-2026-11-15` — `f4c463e5ec76` (protected=false)
- `test/dark-theme-zoom-200-sweep-20261118` — `6fe85dfd3076` (protected=false)
- `test/expense-accounting-mappings-regression-20261122` — `46d95cfd1e0d` (protected=false)
- `test/free-trial-expiry-session-guard-20261122` — `29932fbbefe3` (protected=false)
- `test/invoice-long-pdf-pagination-20261121` — `41fb9896ab4b` (protected=false)
- `test/invoice-short-pdf-one-page-20261121` — `c592c7046f78` (protected=false)
- `test/invoice-short-pdf-one-page-main-20261121` — `f49d35212535` (protected=false)
- `test/ohada-expense-ledger-integrity-20261121` — `3873c1d1dbaa` (protected=false)
- `test/pdf-font-embedding-and-visual-print-20261118` — `42b5a0bcf439` (protected=false)
- `test/security-auth-reset-token-redaction-20261122` — `a10bc748a38b` (protected=false)
- `test/team-invitation-expiry-email-change-20261122` — `4fa9a6878a98` (protected=false)
- `test/theme-dark-mobile-sweep-20261118` — `55c985deecd6` (protected=false)
- `test/theme-dark-sweep-20261118` — `7bd4d2e94fe0` (protected=false)
- `test/theme-light-desktop-sweep-20261118` — `dfe8ce45fdb4` (protected=false)
- `test/theme-light-mobile-sweep-20261118` — `b77108576d2c` (protected=false)
- `test/workspace-zoom-200-sweep-20261118` — `dd64ea0274ce` (protected=false)
- `tooling/local-docker-test-bundle-20261112` — `b88eeebb659d` (protected=false)
- `ui/augmenter-logo-icones-sidebar` — `63af3d94dc35` (protected=false)
- `ui/modern-responsive-polish` — `a2faa30e320e` (protected=false)
- `ux/dashboard-mobile-module-rail-20261122` — `53eadfe851b4` (protected=false)
- `ux/pro-workspace-mobile-domain-rail-20261122` — `185e0487c954` (protected=false)
- `ux/settings-company-fields-grid-20261122` — `99670cdf2969` (protected=false)

## Inventaire des PR ouvertes (40)

Head/base SHAs courts et état draft. CI revalidée pour #167/#168/#149/#159/#164/#169; pour les autres, la dernière snapshot reste run 2 :

| PR | Titre | Head branch | Head SHA | Base SHA | État | CI |
|---|---|---|---|---|---|
| #169 | docs(audit): rapport d'exécution run 2 — 22 novembre | `audit/execution-report-20261122-run2` | `dff61fb42a42` | `b43a94fc2937` | draft | rechecked |
| #168 | fix: fuseau local, devise du tenant et isolation des routes | `fix/webhook-local-timezone-dynamic-currency-20261123` | `b07000daa766` | `b43a94fc2937` | ready | rechecked |
| #167 | fix: devise des emails, relances impayés et échappement HTML | `fix/audit-devise-relances-escape` | `4e848f3b98b1` | `b43a94fc2937` | ready | rechecked |
| #166 | docs(audit): rapport d'exécution initial du 22 novembre | `audit/execution-report-20261122-run1` | `dc7e6f55c5f7` | `b43a94fc2937` | draft | run 2 snapshot; not refreshed this run |
| #164 | test(security): empêcher la divulgation des hashes de réinitialisation | `test/security-auth-reset-token-redaction-20261122` | `a10bc748a38b` | `8d0f287f46a9` | ready | rechecked |
| #159 | security(invoices): retirer le code public de la liste paginée | `security/invoice-list-verification-code-redaction-20261122` | `1c6bf875b982` | `00d52ca8acdc` | ready | rechecked |
| #157 | a11y(navigation): fermer le menu mobile avec Échap | `a11y/mobile-sidebar-escape-focus-20261122` | `c37403034a25` | `00d52ca8acdc` | ready | run 2 snapshot; not refreshed this run |
| #156 | a11y(dashboard): ajouter un accès clavier au contenu principal | `a11y/dashboard-skip-navigation-20261122` | `8f45795c3df5` | `8d0f287f46a9` | ready | run 2 snapshot; not refreshed this run |
| #155 | ux(settings): grille responsive pour les coordonnées entreprise | `ux/settings-company-fields-grid-20261122` | `99670cdf2969` | `00d52ca8acdc` | ready | run 2 snapshot; not refreshed this run |
| #154 | ux(workspace): navigation mobile compacte par domaine | `ux/pro-workspace-mobile-domain-rail-20261122` | `185e0487c954` | `8d0f287f46a9` | ready | run 2 snapshot; not refreshed this run |
| #153 | test(trial): vérifier l'expiration sur la première requête protégée | `test/free-trial-expiry-session-guard-20261122` | `29932fbbefe3` | `00d52ca8acdc` | ready | run 2 snapshot; not refreshed this run |
| #149 | feat(accounting): configure expense category account mappings (schema v23) | `feature/ohada-expense-account-mappings-20261122` | `6f82b82dfab5` | `41aea0f68401` | draft | rechecked |
| #147 | integration: réconcilier comptabilité OHADA et essai gratuit v21 avec main actuel | `integration/reconcile-main-v21-20261122` | `e8b2dc9c6f20` | `f0ae8b08c4e7` | draft | run 2 snapshot; not refreshed this run |
| #146 | fix(integration): reconcile OHADA, 15-day trial and audit retention on current main | `integration/schema-v22-main-reconciled-20261122` | `62ea473892b1` | `f0ae8b08c4e7` | draft | run 2 snapshot; not refreshed this run |
| #145 | fix(accounting): retain invoice reversal events (schema v22) | `fix/accounting-event-audit-retention-v22-run2-20261122` | `5b6ba8bf3b05` | `decb8da2e48e` | draft | run 2 snapshot; not refreshed this run |
| #144 | fix(accounting): retain invoice reversal events on invoice deletion (schema v22) | `fix/accounting-event-audit-retention-v22-20261122` | `90b718abcbef` | `9355eb37493a` | draft | run 2 snapshot; not refreshed this run |
| #143 | fix(accounting): map cheque payments to bank and reject unknown methods | `fix/refund-payment-method-mapping-rebased-20261122` | `17d25a5e3686` | `83dbb6b9e50b` | draft | run 2 snapshot; not refreshed this run |
| #142 | feat(accounting, trial): integrate invoice lifecycle and 15-day trial on schema v21 | `integration/schema-v21-accounting-trial-20261122` | `decb8da2e48e` | `8453ee6d8e63` | draft | run 2 snapshot; not refreshed this run |
| #141 | ci: add workspace UI structure regression checks | `ci/workspace-ui-structure-tests-20261122` | `2a09ccf8bfdb` | `868027e1edc8` | draft | run 2 snapshot; not refreshed this run |
| #140 | ci(lint): couvrir les routes backend et tests de protection | `ci/lint-history-protection-backend-20261122` | `32d1c1f56cb9` | `00d52ca8acdc` | draft | run 2 snapshot; not refreshed this run |
| #139 | fix(a11y): improve professional workspace status contrast | `fix/pro-workspace-status-contrast-20261122` | `baa9ea6a6881` | `8453ee6d8e63` | draft | run 2 snapshot; not refreshed this run |
| #138 | fix(inventory): protect products with stock or history | `fix/product-delete-stock-history-protection-20261122` | `27d5a6c27d5d` | `8453ee6d8e63` | draft | run 2 snapshot; not refreshed this run |
| #137 | fix(accounting): protect clients with linked history | `fix/client-delete-history-protection-20261122` | `f2aada8d5c01` | `8453ee6d8e63` | draft | run 2 snapshot; not refreshed this run |
| #136 | fix(accounting): protect posted expenses from edits and deletion | `fix/expense-ledger-protection-20261122` | `4e0f2a893812` | `8453ee6d8e63` | draft | run 2 snapshot; not refreshed this run |
| #135 | fix(accounting): preserve issued invoice history | `fix/invoice-delete-history-guard-20261122` | `2c7f3cbde915` | `8453ee6d8e63` | draft | run 2 snapshot; not refreshed this run |
| #134 | fix(a11y): badge Entreprise lisible en thème sombre | `fix/enterprise-badge-contrast-main-20261122` | `52021018d789` | `8453ee6d8e63` | draft | run 2 snapshot; not refreshed this run |
| #133 | fix(a11y): corriger le contraste des aperçus de modèles | `fix/accessibility-template-preview-contrast-20261122` | `6b3cd9ffd544` | `c607f397c4db` | draft | run 2 snapshot; not refreshed this run |
| #132 | docs(audit): état initial et plan priorisé 22 novembre | `audit/initial-review-20261122` | `6543b3a70175` | `8453ee6d8e63` | draft | run 2 snapshot; not refreshed this run |
| #131 | docs: actualiser la feuille de route sur le main courant | `docs/improvement-plan-main-20261122` | `3d51f0afb669` | `8453ee6d8e63` | draft | run 2 snapshot; not refreshed this run |
| #130 | fix(a11y): contraste WCAG AA et focus clavier sur les deux thèmes | `fix/accessibility-contrast-focus-main-20261121` | `0b819127cc8b` | `00d52ca8acdc` | draft | run 2 snapshot; not refreshed this run |
| #129 | feat(workspace): navigation par domaines et paramètres structurés | `feat/workspace-settings-navigation-20261121` | `868027e1edc8` | `8453ee6d8e63` | draft | run 2 snapshot; not refreshed this run |
| #128 | feat(trial,workspace): essai 15 jours et organisation professionnelle | `feat/15-day-trial-entitlements-20261121` | `e3b91dc4ae45` | `8453ee6d8e63` | ready | run 2 snapshot; not refreshed this run |
| #127 | fix(pdf): pagination A4 du devis Executive (28 lignes) | `fix/quote-executive-a4-pagination-20261121` | `400ce60ddb8f` | `00d52ca8acdc` | ready | run 2 snapshot; not refreshed this run |
| #126 | feat(landing): présentation vidéo Sunupilot — portage sur main actuel | `integration/sunupilot-video-main-20261121` | `817b10da7b85` | `8453ee6d8e63` | draft | run 2 snapshot; not refreshed this run |
| #118 | feat(landing): vidéo Sunupilot — capture locale automatisée des écrans | `feature/video-presentation-spark-sunupilot` | `29dd7ccc8084` | `f49d35212535` | ready | run 2 snapshot; not refreshed this run |
| #115 | test(accounting): cover expense posting and tenant isolation | `test/ohada-expense-ledger-integrity-20261121` | `3873c1d1dbaa` | `f49d35212535` | ready | run 2 snapshot; not refreshed this run |
| #114 | docs: centralize SamaFacture Pro improvement roadmap | `docs/improvement-plan-20261121` | `ff2cae7bd378` | `5478809ee73e` | ready | run 2 snapshot; not refreshed this run |
| #110 | test(accessibility): cover light/dark keyboard navigation and contrast | `test/accessibility-dark-keyboard-rebased-20261120` | `722b5bfce067` | `f42f69e184f9` | ready | run 2 snapshot; not refreshed this run |
| #102 | test(accessibility): couvrir le thème sombre et le parcours clavier | `test/accessibility-dark-keyboard-20261118` | `86aeeb6f4be2` | `b5863a0d346d` | draft | run 2 snapshot; not refreshed this run |
| #99 | Adopt SunuPilot branding — indigo and baobab green | `rebrand/optigest` | `3f70466d0b6b` | `b5863a0d346d` | ready | run 2 snapshot; not refreshed this run |

## Inventaire des PR fermées (125)

| PR | Titre | État | Fermée le |
|---|---|---|---|
| #165 | docs(backup): sécuriser le transfert hors serveur rclone | merged | 2026-11-22 |
| #163 | security(backup): restreindre les permissions du dossier de sauvegarde | merged | 2026-11-22 |
| #162 | test(security): couvrir expiration et changement email des invitations equipe | merged | 2026-11-22 |
| #161 | ux(dashboard): réduire le défilement mobile des modules | merged | 2026-11-22 |
| #160 | fix(backup): compatible avec le compte MySQL limité de Docker | merged | 2026-11-22 |
| #158 | docs(security): corriger les conseils CORS et proxy | merged | 2026-11-22 |
| #152 | test(accounting): couvrir les correspondances OHADA des dépenses | merged | 2026-11-22 |
| #151 | fix(print): preserve full-width invoice banners on A4 | merged | 2026-11-22 |
| #150 | feat(accounting): configure OHADA sales and expense mappings | merged | 2026-11-22 |
| #148 | reconcile: port trial and accounting protections (schema v22) onto current main | merged | 2026-11-22 |
| #125 | fix(pdf): pagination A4 cohérente des factures et devis longs | merged | 2026-11-22 |
| #124 | fix(invoice): afficher les montants des lignes sans scroll mobile | merged | 2026-11-21 |
| #123 | test(pdf): garantir une facture courte sur une page A4 | merged | 2026-11-21 |
| #122 | test(visual): fournir un QR code aux fixtures mobiles facture/devis | closed without merge | 2026-11-21 |
| #121 | fix(pdf): préserver le cachet sur les écrans mobiles | merged | 2026-11-21 |
| #120 | fix(accounting): reverse refund entries in cash and bank journals | merged | 2026-11-21 |
| #119 | feat(accounting): distinguish cash and bank expense payments | merged | 2026-11-21 |
| #117 | fix(accounting): reverse invoice entries on cancellation and reactivation | merged | 2026-11-22 |
| #116 | test(pdf): couvrir la pagination des factures longues | merged | 2026-11-21 |
| #113 | fix(pdf): preserve company date and number formats in headless PDFs | closed without merge | 2026-11-21 |
| #112 | fix(pdf): repeat company and document identity on continuation pages | merged | 2026-11-21 |
| #111 | fix(invoice): keep print banners inside the A4 printable area | merged | 2026-11-21 |
| #109 | fix(invoice): keep quotes available during warehouse API outages | merged | 2026-11-20 |
| #108 | fix(stock): éviter les deadlocks lors de l'initialisation du magasin principal | merged | 2026-11-19 |
| #107 | feat(stock): route invoice movements to the selected warehouse | merged | 2026-11-20 |
| #106 | test(stock): validate invoice warehouse routing | merged | 2026-11-21 |
| #105 | feat(dashboard): rapprocher les raccourcis de la référence Sunupilot | merged | 2026-11-19 |
| #104 | fix(pwa): fiabiliser le cycle de vie du service worker | merged | 2026-11-19 |
| #103 | feat(brand): intégrer les fondations visuelles SUNUPILOT | merged | 2026-11-19 |
| #101 | fix(accessibility): corriger les contrastes et auditer les 17 pages | merged | 2026-11-18 |
| #100 | test(visual): couvrir le zoom 200 % en thème sombre | merged | 2026-11-18 |
| #98 | fix(responsive): corriger les tableaux au zoom 200 % | merged | 2026-11-18 |
| #97 | fix(dashboard): améliorer la lisibilité du total des factures | merged | 2026-11-18 |
| #96 | test(theme): vérifier le mode clair sur bureau | merged | 2026-11-18 |
| #95 | test(theme): vérifier le mode clair sur mobile | merged | 2026-11-18 |
| #94 | test(theme): vérifier le mode sombre sur mobile | merged | 2026-11-18 |
| #93 | fix(theme): garantir le contraste de l’aperçu facture en mode sombre | merged | 2026-11-18 |
| #92 | test(pdf): vérifier les polices incorporées et les marges A4 réelles | merged | 2026-11-18 |
| #91 | fix(invoice): améliorer les polices et l’impression A4 des factures et devis | merged | 2026-11-18 |
| #90 | fix(print): vérifier la typographie et l'impression A4 des 31 modèles | closed without merge | 2026-11-18 |
| #89 | fix(ui): corriger la cohérence des thèmes clair et sombre | merged | 2026-11-18 |
| #88 | docs(docker): clarifier le démarrage local avec Docker | merged | 2026-11-17 |
| #87 | feat(invoice): ajouter 3 modèles Pro et 4 modèles Entreprise | merged | 2026-11-17 |
| #86 | fix(ui): améliorer les interactions sidebar et Entreprise sur mobile | merged | 2026-11-17 |
| #85 | docs(ui): préparer les corrections responsive et animations | closed without merge | 2026-11-18 |
| #84 | feat(billing): préparer le moteur d'abonnement mensuel en simulation locale | merged | 2026-11-17 |
| #83 | docs(billing): cadrer l'architecture des abonnements mensuels | merged | 2026-11-18 |
| #82 | chore(agents): intégrer les skills design engineering | merged | 2026-11-18 |
| #81 | feat(nav): moderniser le rail latéral avec libellés | merged | 2026-11-17 |
| #80 | feat(entreprise): paginer la liste des sociétés du groupe | merged | 2026-11-17 |
| #79 | feat(nav): moderniser la barre latérale et les icônes | merged | 2026-11-17 |
| #78 | docs(billing): clarifier l’état réel des abonnements mensuels | closed without merge | 2026-11-17 |
| #77 | test(billing): verrouiller les abonnements récurrents non activés | merged | 2026-11-17 |
| #76 | fix(pdf): améliorer la pagination des devis et factures | closed without merge | 2026-11-17 |
| #75 | fix(pdf): éviter les pages isolées dans les devis volumineux | merged | 2026-11-17 |
| #74 | ci: exécuter le test réel de restauration des sauvegardes chiffrées | merged | 2026-11-17 |
| #73 | feat(ui): simplifier les espaces Entreprise et professionnel | merged | 2026-11-17 |
| #72 | fix(team): sécuriser les invitations classiques par preuve email | merged | 2026-11-17 |
| #71 | feat(entreprise): centre de pilotage consolidé du groupe | merged | 2026-11-17 |
| #69 | fix(security): vérifier l’adresse email avant le rattachement multi-sociétés | merged | 2026-11-17 |
| #68 | feat: laisser le client choisir son moyen de paiement | merged | 2026-11-17 |
| #67 | docs(email): corriger le comportement SMTP local et tester la redaction | merged | 2026-11-17 |
| #65 | docs(billing): distinguer achat ponctuel et abonnement récurrent | closed without merge | 2026-11-17 |
| #64 | docs(audit): documenter le risque de vérification des invitations multi-sociétés | merged | 2026-11-17 |
| #63 | fix(realtime): autoriser les groupes Entreprise dans les notifications | merged | 2026-11-17 |
| #62 | fix(entreprise): corriger la migration v10 et les invitations | closed without merge | 2026-11-16 |
| #60 | feat(entreprise): socle multi-sociétés et cadrage de l’abonnement mensuel | merged | 2026-11-17 |
| #59 | docs(staging): corriger la procédure Docker Compose et HTTPS | merged | 2026-11-17 |
| #57 | fix(a11y): associer les libellés de la page Paramètres | merged | 2026-11-17 |
| #56 | fix(pdf): file durable avec acquittement et reprise, mentions paiement exactes | merged | 2026-11-17 |
| #55 | audit: corriger la conservation des tâches PDF en attente | merged | 2026-11-16 |
| #54 | fix: remove Nginx upstream balancing warning | merged | 2026-11-16 |
| #53 | docs: ajouter le plan d’entreprise et la stratégie de lancement | merged | 2026-11-16 |
| #52 | security: redact sensitive tokens from HTTP access logs | merged | 2026-11-16 |
| #51 | CI: bloquer les dépendances présentant une vulnérabilité npm | merged | 2026-11-16 |
| #50 | Fix: éviter la concurrence d'initialisation MySQL du worker PDF | merged | 2026-11-16 |
| #49 | test(ui): cover notification placement with visual viewport offsets | merged | 2026-11-16 |
| #48 | fix(ui): keep notifications visible above the mobile keyboard | merged | 2026-11-16 |
| #47 | Éviter les mauvais destinataires WhatsApp pour les numéros locaux | merged | 2026-11-16 |
| #46 | fix(ui): keep mobile notifications inside viewport | merged | 2026-11-16 |
| #45 | Sécuriser la sauvegarde, la rétention et la restauration de la base | merged | 2026-11-16 |
| #44 | Sécurité : rendre la révocation des sessions immédiate entre workers | merged | 2026-11-16 |
| #43 | Améliorer le mobile, les aperçus A4 et l’espace professionnel | merged | 2026-11-16 |
| #42 | Fiabiliser les PDF et corriger le thème système à l'impression | merged | 2026-11-15 |
| #41 | Préparer l’archive du code fusionné sur main | closed without merge | 2026-11-15 |
| #40 | Ajouter cinq modèles modernes de facture et de devis | merged | 2026-11-15 |
| #39 | Agrandir légèrement le logo et les icônes de navigation | merged | 2026-11-15 |
| #38 | Make monthly invoice quota initialization deterministic | merged | 2026-11-15 |
| #37 | Exclude local secrets from Docker and require npm lockfile | merged | 2026-11-15 |
| #36 | Harden invoice settlement, paid status and payment idempotency | merged | 2026-11-15 |
| #35 | Test that backup archives stay temporary until dump completion | merged | 2026-11-15 |
| #34 | Prevent local environment secrets from entering Docker images | closed without merge | 2026-11-15 |
| #33 | Publish database backups only after atomic validation | closed without merge | 2026-11-15 |
| #32 | Publish complete database backups atomically | merged | 2026-11-15 |
| #31 | Harden session revocation and payment provider timeouts | merged | 2026-11-15 |
| #30 | Add transactional monthly invoice quota with schema migration v8 | closed without merge | 2026-11-15 |
| #29 | Fix monthly invoice quota with schema migration v8 | merged | 2026-11-15 |
| #28 | Improve sidebar navigation accessibility | merged | 2026-11-15 |
| #27 | Improve sidebar icon semantics and enforce full icon coverage | merged | 2026-11-15 |
| #26 | Fix PDF worker startup ordering after API readiness | merged | 2026-11-15 |
| #25 | Fix subscription page icons and visual regression checks | merged | 2026-11-15 |
| #24 | Sécurité : révocation des sessions, correctif liaison Google, filtrag… | merged | 2026-11-15 |
| #23 | Galerie de 19 modèles, impression fiable, WhatsApp et audit transversal | merged | 2026-11-15 |
| #22 | Présenter les modèles de facture dans une galerie visuelle | closed without merge | 2026-11-15 |
| #21 | Finaliser les factures et devis imprimés en A4 | merged | 2026-11-15 |
| #20 | Professionnaliser la page Abonnement et ses icônes | closed without merge | 2026-11-15 |
| #19 | Stabiliser la CI avec des tests MySQL séquentiels | merged | 2026-11-15 |
| #18 | Professionnaliser l’interface et les documents, renforcer la responsivité et la montée en charge | merged | 2026-11-15 |
| #17 | Améliorer la visibilité et la cohérence des icônes | merged | 2026-11-15 |
| #16 | Fix Docker startup: single MySQL schema init and Redis readiness | merged | 2026-11-15 |
| #15 | UI : harmoniser les pages métier pour un logiciel de gestion professionnel | merged | 2026-11-14 |
| #14 | UI : finaliser la structure professionnelle des pages métier | closed without merge | 2026-11-15 |
| #13 | UI : organiser les pages métier comme un logiciel professionnel | closed without merge | 2026-11-13 |
| #12 | UI : organisation professionnelle des pages métier | merged | 2026-11-13 |
| #11 | Audit UI — navigation compacte et amélioration de la visibilité | closed without merge | 2026-11-15 |
| #10 | UI : navigation compacte et espace de travail élargi | merged | 2026-11-13 |
| #9 | Build a temporary local Docker test ZIP | closed without merge | 2026-11-12 |
| #8 | Phases 5 à 7 — Portail client, CRM, internationalisation et IA | merged | 2026-11-12 |
| #7 | Phases 2 à 4 — Paiements réels, comptabilité OHADA et achats/stocks | merged | 2026-11-12 |
| #6 | Ajouter une cloche de notifications à la barre supérieure | merged | 2026-11-12 |
| #5 | Refonte du tableau de bord SamaFacture Pro — palette et navigation | merged | 2026-11-12 |
| #4 | UI polish: animations accessibles et recette visuelle responsive | merged | 2026-11-12 |
| #3 | Audit correctif : sauvegardes, sécurité des sessions, paiements et quotas | closed without merge | 2026-11-15 |
| #2 | Modèles de factures et devis — enrichissement des informations et du rendu | merged | 2026-11-10 |
| #1 | SamaFacture Pro — modernisation UI et modules professionnels | merged | 2026-11-10 |

## 12 derniers commits main

| SHA | Message | Date |
|---|---|---|
| `b43a94fc2937` | docs(backup): sécuriser le transfert hors serveur rclone | 2026-11-22T23:00:10Z |
| `e6a2caf04f06` | Merge pull request #163 from morn53426-ui/fix/backup-directory-permissions-20261122 | 2026-11-22T22:43:06Z |
| `1c3a12bacd9c` | Merge latest main invitation-security test into backup directory hardening | 2026-11-22T22:36:47Z |
| `596b3311f12c` | test(security): couvrir expiration et changement email des invitations equipe (#162) | 2026-11-22T22:33:54Z |
| `b8df6bfac18e` | Merge dashboard update and keep backup permission lint target | 2026-11-22T22:27:19Z |
| `cc728a65336a` | Merge dashboard module rail and main into backup directory permissions fix | 2026-11-22T22:26:11Z |
| `8d0f287f46a9` | ux(dashboard): réduire le défilement mobile des modules (#161) | 2026-11-22T22:24:22Z |
| `f3844b627efc` | fix(sync): conserver server/.env.example de main | 2026-11-22T22:17:53Z |
| `1d42ba738607` | fix(sync): conserver le modèle .env courant de main | 2026-11-22T22:17:22Z |
| `d6a054483a11` | Merge latest main into backup directory permissions hardening | 2026-11-22T22:16:41Z |
| `06c3589daf5f` | Merge latest main while preserving private backup directory permissions | 2026-11-22T22:16:08Z |
| `5f1c09d655b3` | docs(security): corriger les conseils CORS et proxy (#158) | 2026-11-22T22:15:02Z |

## Migrations main

- `003_professional_modules.sql` — `d24f37b6f2c2`
- `004_paiements_comptabilite_achats.sql` — `9fde46a1c10b`
- `005_portail_crm_international_ia.sql` — `438204a27c56`
- `006_company_groups.sql` — `2a83a46966b3`
- `007_email_outbox.sql` — `b703b47fcc70`
- `008_company_group_email_proof.sql` — `2537d728712e`
- `009_team_invitation_email_proof.sql` — `a401605a7f1e`
- `010_saas_subscriptions_simulation.sql` — `bff294f2d631`
- `011_comptabilite_contrepas_factures.sql` — `164bc968d635`
- `012_comptabilite_correspondances.sql` — `bb3ec6e6b35d`

## Priorités et gates

| Priorité | Lot | Gate |
|---|---|---|
| P0 | CI post-merge main | Main stable; run #1676 success sur SHA exact confirmé. |
| P0 | #167 XSS/relances | Tests dédiés ajoutés, CI exacte 3/3, revue humaine indépendante; aucun merge avant. |
| P0 | #168 devise tenant/isolation | Corriger devise commandes, verrou concurrent, tests, synchroniser après #167, CI exacte, validation humaine. |
| P0 | #159/#164 sécurité | Rebase main, diff revu, CI exacte, approbation humaine indépendante. |
| P1 | #149 mapping charges OHADA | Migration 013/version24, FK tenant composée, tests upgrade/replay; validation OHADA humaine. |
| P1 | Intégrations comptables v21/v22 | Réconcilier/dédupliquer; préserver écritures et événements; validation humaine avant fusion. |
| P2 | UX/accessibilité/PDF | PR petites, rebase, tests responsive/print exacts. |
| P3 | Branding/video/docs | Après stabilisation. |

## Décisions du run 3

- Main CI post-merge confirmée green; pas d'arrêt pour instabilité.
- Deux commentaires de revue non-approbateurs publiés (#167 et #168).
- Aucun code applicatif modifié dans ce run, aucun merge; aucune migration, donnée, volume, backup ou historique comptable touché.
- Run 1 (#166) et run 2 (#169) conservés; ce run 3 est un nouveau rapport.

## Risques restant

1. Aucun approbateur indépendant confirmé sur #167/#168/#149/#159/#164; règles GitHub n'imposent actuellement 0 approbation (ruleset).
2. #167 : XSS tests et scheduler multi-currency tests manquants.
3. #168 : devise commande défaut FCFA et race de currency-lock.
4. #149 : migration 012 duplicate/version23, 42 commits behind.
5. #159/#164 : stale/divergent, nécessitent rebase.
6. Les PRs non prioritaires ne sont pas CI/diff revalidées individuellement run 3.
7. Branch protection endpoint classique 403; seules les règles du ruleset sont confirmées.



## Suivi complémentaire après snapshot — PR #171

- Nouvelle branche : `fix/pro-orders-tenant-currency-20261123`, head `9b70c35fef2e12726274ae4b726ca50c5e54b8e3`, base PR #168 head `b07000daa7663196de68a42bc0ba011f4f4cf7f9`.
- PR [#171](https://github.com/morn53426-ui/-samafacture-pro/pull/171) draft, 8 commits ahead/0 behind de la base, 6 fichiers modifiés; mergeable clean au dernier compare.
- Correctifs : commandes pro par défaut sur devise tenant, validation devise; verrou de changement de devise compte aussi `pro_commandes` et `pro_bons_livraison`; test EUR, devise invalide et refus de changement après commande.
- CI head exact `9b70c35fef2e12726274ae4b726ca50c5e54b8e3` : ZIP success (run 1387), ESLint success (run 663), Tests Node/MySQL en cours (run 1697, started 01:01:58Z). Aucun test local exécuté.
- Revue COMMENT publiée (review ID 6015507944), sans approbation. PR dépend de #168 et ne doit pas être fusionnée indépendamment.
- Finding #168 supplémentaire : les nouveaux tests devise/tenant ne sont pas couverts par le workflow ESLint path-list/commande. Commentaire #168 ID 7088811240; #171 ajoute les cinq fichiers tests aux deux listes et aux filtres de chemins.
- Race du verrou de devise (COUNT/UPDATE séparés et créations concurrentes) toujours non corrigée; lot distinct nécessaire.
