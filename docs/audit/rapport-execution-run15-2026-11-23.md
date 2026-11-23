# Audit et développement SamaFacture Pro — Run 15
**Date : 23 novembre 2026**  
**Dépôt :** https://github.com/morn53426-ui/-samafacture-pro

## Résumé
- Main observé : `b0b52e660af61fa781dc9a761165dd72977f969a`, inchangé pendant ce run.
- Snapshot avant publication du présent rapport : 209 branches, 54 PR ouvertes, 142 PR fermées vérifiées par 4 plages de création : 1–10 nov (3), 11–15 nov (40), 16–20 nov (60), 21–23 nov (39); chaque plage est sous la limite de 100.
- Après création de la branche/PR du rapport : 210 branches et 55 PR ouvertes (ajout de la branche `audit/execution-report-20261123-run15` et PR #201).
- Aucun merge. Aucun push direct ou force-push sur main. Aucune branche supprimée. Aucun DDL/migration exécuté. Aucun volume, backup, donnée ou historique comptable modifié. Aucun paiement réel ni déploiement.
- Main status API combiné a retourné `statuses=[]`. Le run post-fusion connu #45138061597 a un job Tests Node/MySQL terminé success, mais le connecteur ne permet pas de vérifier à nouveau la relation run→SHA dans cette exécution; ne pas le présenter comme un nouveau run.

## Main, commits et workflows
- SHA main : `b0b52e660af61fa781dc9a761165dd72977f969a`.
- Head : `fix(mobile): validate Capacitor public HTTPS before native builds`.
- Run post-fusion connu : [45138061597](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45138061597), job Node/MySQL success (toutes étapes listées terminées success).
- Workflow Tests automatisés : Node/MySQL, audit npm bloquant, sauvegarde/restauration chiffrée, smoke MySQL/Redis, recette visuelle responsive.
- Workflow ESLint — JavaScript modifié : ciblage par paths.
- Workflow Package complete source ZIP.
- Status API main actuel vide; CI post-merge n'a pas été relancée ici.

## Inventaire des 20 commits récents (snapshot)
- `b0b52e660af61fa781dc9a761165dd72977f969a` — fix(mobile): validate Capacitor public HTTPS before native builds (2026-11-23T08:22:09Z)
- `b276eba52b5179f351efe68d18cf540a170c70fd` — test(security): cover reset token hash redaction (2026-11-23T08:09:51Z)
- `262707e11d6f362820bf07018647df4312791444` — ci(lint): include auth reset token redaction tests (2026-11-23T08:00:09Z)
- `aa4bf4f64c4be58c4ad69064f4ef58f8411450a2` — test(security): cover reset token hash redaction on current main (2026-11-23T08:00:07Z)
- `13111355a0d2bc71ee0f3a01b504179b2d136926` — fix: fuseau local, devise du tenant et isolation (2026-11-23T07:58:23Z)
- `19fcafb0be02c261ea799236fed046bdce80a291` — fix: devises, relances et échappement HTML (2026-11-23T07:57:52Z)
- `b43a94fc2937b0108077501a0260358c8569e11f` — docs(backup): sécuriser le transfert hors serveur rclone (2026-11-22T23:00:10Z)
- `e6a2caf04f0648d30419042c97cb63b6a14a05f8` — Merge pull request #163 from morn53426-ui/fix/backup-directory-permissions-20261122 (2026-11-22T22:43:06Z)
- `1c3a12bacd9c6a761247756562ea77ebe50ef41d` — Merge latest main invitation-security test into backup directory hardening (2026-11-22T22:36:47Z)
- `596b3311f12c41946906b236274d9c8a615393d6` — test(security): couvrir expiration et changement email des invitations equipe (#162) (2026-11-22T22:33:54Z)
- `b8df6bfac18e4eb2776a35887e178af6d8d42bfd` — Merge dashboard update and keep backup permission lint target (2026-11-22T22:27:19Z)
- `cc728a65336a5ad154136c668f3be06256e66ede` — Merge dashboard module rail and main into backup directory permissions fix (2026-11-22T22:26:11Z)
- `8d0f287f46a96cb0697d7a0be9f6fe055b6e5a51` — ux(dashboard): réduire le défilement mobile des modules (#161) (2026-11-22T22:24:22Z)
- `f3844b627efcdf6472ef57bffe3d69283a36bb37` — fix(sync): conserver server/.env.example de main (2026-11-22T22:17:53Z)
- `1d42ba738607a1f648e3391c051a618061654f69` — fix(sync): conserver le modèle .env courant de main (2026-11-22T22:17:22Z)
- `d6a054483a11a3ebd7020fa8850d59f07dafdc22` — Merge latest main into backup directory permissions hardening (2026-11-22T22:16:41Z)
- `06c3589daf5f49405e9a7ead70ee5cc9aece2a12` — Merge latest main while preserving private backup directory permissions (2026-11-22T22:16:08Z)
- `5f1c09d655b340eac687d983e322e740798b7817` — docs(security): corriger les conseils CORS et proxy (#158) (2026-11-22T22:15:02Z)
- `db790c1d25cdedabf19d33cffd5bf489bc77d1ef` — refactor(backup): supprimer le mkdir redondant (2026-11-22T22:08:02Z)
- `620b919b8f317d2fd5116728ff5aa292aa3357b0` — Merge main and MySQL backup permissions into backup-directory-permissions (2026-11-22T22:07:00Z)

## PR candidates et statuts CI exacts
| PR | Head SHA | Tests Node/MySQL | ESLint | ZIP | Décision |
|---|---|---|---|---|---|
| [#193](https://github.com/morn53426-ui/-samafacture-pro/pull/193) | `fb6324d34b024072f98d7c1347a0da330922aba4` | [1776 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45140914890) | [723 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45140914986) | [1462 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45140914942) | Draft, validation sécurité humaine |
| [#194](https://github.com/morn53426-ui/-samafacture-pro/pull/194) | `5cd2604b395e7d994c051f4b7d19f7800bccaaf6` | [1777 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45141155965) | [724 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45141155971) | [1463 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45141155951) | Draft, validation sécurité humaine |
| [#199](https://github.com/morn53426-ui/-samafacture-pro/pull/199) | `b212dbc0bac111c77023c1ad42c58514786aeaca` | [1786 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45156601143) | [726 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45156601267) | [1472 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45156601096) | Draft, validation sécurité humaine |
| [#197](https://github.com/morn53426-ui/-samafacture-pro/pull/197) | `d23afbe04e35db9cfbaaf70a7ee2d0f6de187b61` | [1782 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45150892896) | [725 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45150893054) | [1468 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45150893223) | Draft, revue COMMENT; approbation requise |
| [#192](https://github.com/morn53426-ui/-samafacture-pro/pull/192) | `8a11e00bb976979403e9d3fcfa8e767a074b5423` | [1775 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45138383987) | [722 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45138383956) | [1461 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45138383828) | Draft; décision métier devise |
| [#200](https://github.com/morn53426-ui/-samafacture-pro/pull/200) | `e010e563e568e89dcc86f8d735a60f6236986258` | [1790 in_progress](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45160520684) | [727 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45160520663) | [1476 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45160520733) | Draft; mergeability signal initial false à re-vérifier |
| [#198](https://github.com/morn53426-ui/-samafacture-pro/pull/198) | `e6cc9a40ab92f0eaf9fa9f5c1aa02150d449fb62` | Status API vide | — | — | Draft, report Run 14 stale |
| [#196](https://github.com/morn53426-ui/-samafacture-pro/pull/196) | `539a9430c78f83908ce7b404d98804309b19d578` | [1783 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45151179027) | Non déclenché (doc) | [1469 success](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45151178940) | Report Run 13 stale |

## Revue statique P0
### #193 — Redaction code de vérification
- Codes retirés des listes factures et historique client; détail authentifié conserve le code pour QR; endpoint public ne le renvoie pas.
- Tests de liste, historique, détail et consultation publique.
- CI 3/3 green sur SHA exact. Review COMMENT, pas APPROVE. Validation humaine sécurité obligatoire.

### #194 — Isolation tenant relationnelle
- Jointures tenant-aware sur factures, clients, paiements, dashboard/rapports, documents professionnels et checkout.
- Génération récurrente verrouille et valide le client avant effets; mismatch 409/rollback.
- Fixtures cross-tenant/API-key contextualisées.
- CI 3/3 green sur SHA exact. Draft, approbation sécurité humaine obligatoire.
- Risque restant : poursuivre l'audit de toutes les routes/relation non couvertes; la couverture ciblée n'est pas une preuve d'exhaustivité.

### #199 — Remboursements dans relevé client
- Cause : relation remboursement→paiement et paiement→facture insuffisamment tenant-scoped.
- Fix : `p.user_id = r.user_id`, `f.user_id = p.user_id`.
- Fixture : crée refund, corrompt temporairement payment tenant dans la DB test, vérifie l'exclusion, restaure dans `finally`.
- CI 3/3 green exact; review COMMENT; validation humaine sécurité requise.

## P2 — Accessibilité clavier
### #200 — Escape ferme sidebar mobile
- Portage isolé depuis #157, 3 commits, compare exact main : 3 ahead / 0 behind, 3 fichiers.
- Diff : `public/js/sidebar.js`, test structural `server/tests/sidebar-mobile-keyboard.test.js`, workflow lint.
- Échap priorise dialogues visibles, ferme sidebar et remet le focus sur le déclencheur visible (toggle Groupe prioritaire), sinon bouton mobile; notifications restent fermables.
- Revue statique COMMENT. Tests #1790 encore in progress; ESLint #727 et ZIP #1476 success sur head exact.
- GitHub renvoyait mergeable=false à la création; re-vérifier après calcul CI. Draft, pas d'approbation.
- Test est structurel (regex/source), pas une simulation DOM réelle; une recette clavier manuelle/automatisée browser reste souhaitable.

## PR empilées et candidates stale
- #157 et #155 ont 15–16 commits, 16 fichiers, base `00d52ca8...` ancienne, mergeable=false, et changements annexes importants. Ne pas fusionner; porter les petits lots isolément sur main (ex. #200).
- #179/#188 sont candidates sécurité historiques; #194 est la reconstruction actuelle.
- #177 est candidate redaction historique; #193 est reconstruction actuelle.
- #171/#178/#182/#183/#185/#190 sont candidates devise empilées; #192 est la reconstruction actuelle.
- #127 pagination Executive : candidate historique à vérifier contre main avant merge; #127 a été signalée déjà portée en partie dans Run14, ne pas fusionner sans compare exact.

## Migrations / schema
- Runtime schema : **v23** (constante dans `server/config/db.js`).
- v8 quota mensuel; v9 jour d'ancrage récurrences; v10 index échéances; v11 groupes multi-sociétés; v12 email outbox durable; v13 preuve email multi-sociétés; v14 preuve email invitations équipe; v15 socle abonnement SaaS (aucun paiement créé); v16 type catalogue; v17 entrepôt mémorisé factures; v18 marqueur ventilation stocks historiques; v19 contrepassations/réactivations factures; v20 mode règlement dépenses; v21 trial 15 jours; v22 conservation événements comptables; v23 correspondances OHADA par entreprise.
- Migration 012 SQL fetchée : table `pro_compta_correspondances`, FK composite account/user, cascade scoped; commentaire indique que les écritures validées ne sont pas modifiées.
- Migration destructive/DDL historique #145 (v22) : validation comptable humaine spécifique. #142/v21 : validation humaine de l'essai et cycle facture. Aucun migration exécutée.
- Connecteur n'a pas exposé l'index de dossier migrations; les noms de tous les fichiers SQL n'ont pas été exhaustivement énumérés dans ce run.

## Protections et critères merge
- Main status API retourné vide dans ce run; règles de protection restent référencées dans Run14, non re-vérifiées via endpoint ruleset cette fois.
- Merge interdit sans: CI sur SHA exact, review humaine requise (notamment P0 sécurité et compta), compare/synchronisation, check migrations, threads résolus, protection main respectée.
- Si main CI échoue après merge, stopper les merges, stabiliser main par PR corrective, sans force-push/rollback destructif.

## Planning P0–P3
| Priorité | Lot | Action |
|---|---|---|
| P0 | #193 redaction | Validation sécurité humaine puis synchroniser main, re-run CI exacte avant décision |
| P0 | #194 isolation | Revue humaine complète, audit routes relationnelles restantes, validation spécifique |
| P0 | #199 refund statement | CI green; revue humaine sécurité |
| P0 | Audit tenant | Continuer route-by-route, joindre tests cross-tenant |
| P1 | #192 devise | Décision politique multi-devise commandes |
| P1 | #142 v21 trial/cycle | Reconstruction clean, validation comptable/métier |
| P1 | #145 v22 conservation | Validation comptable/DDL spécifique |
| P2 | #200 Escape sidebar | Tests Node/MySQL exacts, revue/approbation, mergeability re-check |
| P2 | PDF/print | Bandeaux, pagination, cachet/QR, polices A4, recette sur modèles courts/longs |
| P2 | Workspace | Responsive, navigation compacte, focus/contraste |
| P3 | Sunupilot | Branding, vidéo et documentation après stabilisation |

## Inventaire branches — snapshot pré-rapport (209)
- `a11y/dashboard-skip-link-main-current-run13`
- `a11y/dashboard-skip-navigation-20261122`
- `a11y/mobile-sidebar-escape-focus-20261122`
- `a11y/sidebar-escape-main-current-run15`
- `audit/execution-report-20261122-run1`
- `audit/execution-report-20261122-run2`
- `audit/execution-report-20261123-run3`
- `audit/execution-report-20261123-run4`
- `audit/execution-report-20261123-run5`
- `audit/execution-report-20261123-run6`
- `audit/execution-report-20261123-run11`
- `audit/execution-report-20261123-run12`
- `audit/execution-report-20261123-run13`
- `audit/execution-report-20261123-run14`
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

## Inventaire PR ouvertes — snapshot pré-rapport (54)
- #200: a11y(navigation): close mobile sidebar with Escape on current main
- #199: fix(security): scope client statement refunds to tenant payment
- #198: docs(audit): execution report run 14 — 23 November
- #197: a11y(dashboard): keyboard skip link on current main
- #196: docs(audit): execution report run 13 — 23 November
- #195: docs(audit): execution report run 12 — 23 November
- #194: security(tenant): enforce invoice-related ownership on current main
- #193: security(invoices): redact verification codes from list responses
- #192: fix(currency): serialize tenant currency and first business writes
- #190: fix(currency): serialize tenant currency and first business writes
- #188: security(tenant): enforce ownership across invoice-related records
- #185: fix(currency): serialize tenant currency changes and first business writes
- #183: fix(currency): serialize tenant currency changes and orders
- #182: fix(pro): use tenant currency for orders and lock history
- #180: docs(audit): execution report run 11 — 23 November
- #179: security(invoices): enforce client and payment tenant ownership
- #178: fix(currency): serialize tenant currency changes and orders
- #177: security(invoices): redact verification code from list API
- #176: docs(audit): rapports d'exécution runs 6 à 10 — 23 novembre
- #175: docs(audit): rapport d'exécution run 5 — 23 novembre
- #172: docs(audit): rapport d'exécution run 4 — 23 novembre
- #171: fix(pro): use tenant currency for orders and lock history
- #170: docs(audit): rapport d'exécution run 3 — 23 novembre
- #169: docs(audit): rapport d'exécution run 2 — 22 novembre
- #166: docs(audit): rapport d'exécution initial du 22 novembre
- #157: a11y(navigation): fermer le menu mobile avec Échap
- #156: a11y(dashboard): ajouter un accès clavier au contenu principal
- #155: ux(settings): grille responsive pour les coordonnées entreprise
- #154: ux(workspace): navigation mobile compacte par domaine
- #153: test(trial): vérifier l'expiration sur la première requête protégée
- #145: fix(accounting): retain invoice reversal events (schema v22)
- #142: feat(accounting, trial): integrate invoice lifecycle and 15-day trial on schema v21
- #141: ci: add workspace UI structure regression checks
- #140: ci(lint): couvrir les routes backend et tests de protection
- #139: fix(a11y): improve professional workspace status contrast
- #138: fix(inventory): protect products with stock or history
- #137: fix(accounting): protect clients with linked history
- #136: fix(accounting): protect posted expenses from edits and deletion
- #135: fix(accounting): preserve issued invoice history
- #134: fix(a11y): badge Entreprise lisible en thème sombre
- #133: fix(a11y): corriger le contraste des aperçus de modèles
- #132: docs(audit): état initial et plan priorisé 22 novembre
- #131: docs: actualiser la feuille de route sur le main courant
- #130: fix(a11y): contraste WCAG AA et focus clavier sur les deux thèmes
- #129: feat(workspace): navigation par domaines et paramètres structurés
- #128: feat(trial,workspace): essai 15 jours et organisation professionnelle
- #127: fix(pdf): pagination A4 du devis Executive (28 lignes)
- #126: feat(landing): présentation vidéo Sunupilot — portage sur main actuel
- #118: feat(landing): vidéo Sunupilot — capture locale automatisée des écrans
- #115: test(accounting): cover expense posting and tenant isolation
- #114: docs: centralize SamaFacture Pro improvement roadmap
- #110: test(accessibility): cover light/dark keyboard navigation and contrast
- #102: test(accessibility): couvrir le thème sombre et le parcours clavier
- #99: Adopt SunuPilot branding — indigo and baobab green

## Inventaire PR fermées — 142 (4 plages de création, vérifiées sans dépassement de la limite 100)
- #3: Audit correctif : sauvegardes, sécurité des sessions, paiements et quotas
- #2: Modèles de factures et devis — enrichissement des informations et du rendu
- #1: SamaFacture Pro — modernisation UI et modules professionnels
- #109: fix(invoice): keep quotes available during warehouse API outages
- #108: fix(stock): éviter les deadlocks lors de l'initialisation du magasin principal
- #107: feat(stock): route invoice movements to the selected warehouse
- #106: test(stock): validate invoice warehouse routing
- #105: feat(dashboard): rapprocher les raccourcis de la référence Sunupilot
- #104: fix(pwa): fiabiliser le cycle de vie du service worker
- #103: feat(brand): intégrer les fondations visuelles SUNUPILOT
- #101: fix(accessibility): corriger les contrastes et auditer les 17 pages
- #100: test(visual): couvrir le zoom 200 % en thème sombre
- #98: fix(responsive): corriger les tableaux au zoom 200 %
- #97: fix(dashboard): améliorer la lisibilité du total des factures
- #96: test(theme): vérifier le mode clair sur bureau
- #95: test(theme): vérifier le mode clair sur mobile
- #94: test(theme): vérifier le mode sombre sur mobile
- #93: fix(theme): garantir le contraste de l’aperçu facture en mode sombre
- #92: test(pdf): vérifier les polices incorporées et les marges A4 réelles
- #91: fix(invoice): améliorer les polices et l’impression A4 des factures et devis
- #90: fix(print): vérifier la typographie et l'impression A4 des 31 modèles
- #89: fix(ui): corriger la cohérence des thèmes clair et sombre
- #88: docs(docker): clarifier le démarrage local avec Docker
- #87: feat(invoice): ajouter 3 modèles Pro et 4 modèles Entreprise
- #86: fix(ui): améliorer les interactions sidebar et Entreprise sur mobile
- #85: docs(ui): préparer les corrections responsive et animations
- #84: feat(billing): préparer le moteur d'abonnement mensuel en simulation locale
- #83: docs(billing): cadrer l'architecture des abonnements mensuels
- #82: chore(agents): intégrer les skills design engineering
- #81: feat(nav): moderniser le rail latéral avec libellés
- #80: feat(entreprise): paginer la liste des sociétés du groupe
- #79: feat(nav): moderniser la barre latérale et les icônes
- #78: docs(billing): clarifier l’état réel des abonnements mensuels
- #77: test(billing): verrouiller les abonnements récurrents non activés
- #76: fix(pdf): améliorer la pagination des devis et factures
- #75: fix(pdf): éviter les pages isolées dans les devis volumineux
- #74: ci: exécuter le test réel de restauration des sauvegardes chiffrées
- #73: feat(ui): simplifier les espaces Entreprise et professionnel
- #72: fix(team): sécuriser les invitations classiques par preuve email
- #71: feat(entreprise): centre de pilotage consolidé du groupe
- #69: fix(security): vérifier l’adresse email avant le rattachement multi-sociétés
- #68: feat: laisser le client choisir son moyen de paiement
- #67: docs(email): corriger le comportement SMTP local et tester la redaction
- #65: docs(billing): distinguer achat ponctuel et abonnement récurrent
- #64: docs(audit): documenter le risque de vérification des invitations multi-sociétés
- #63: fix(realtime): autoriser les groupes Entreprise dans les notifications
- #62: fix(entreprise): corriger la migration v10 et les invitations
- #60: feat(entreprise): socle multi-sociétés et cadrage de l’abonnement mensuel
- #59: docs(staging): corriger la procédure Docker Compose et HTTPS
- #57: fix(a11y): associer les libellés de la page Paramètres
- #56: fix(pdf): file durable avec acquittement et reprise, mentions paiement exactes
- #55: audit: corriger la conservation des tâches PDF en attente
- #54: fix: remove Nginx upstream balancing warning
- #53: docs: ajouter le plan d’entreprise et la stratégie de lancement
- #52: security: redact sensitive tokens from HTTP access logs
- #51: CI: bloquer les dépendances présentant une vulnérabilité npm
- #50: Fix: éviter la concurrence d'initialisation MySQL du worker PDF
- #49: test(ui): cover notification placement with visual viewport offsets
- #48: fix(ui): keep notifications visible above the mobile keyboard
- #47: Éviter les mauvais destinataires WhatsApp pour les numéros locaux
- #46: fix(ui): keep mobile notifications inside viewport
- #45: Sécuriser la sauvegarde, la rétention et la restauration de la base
- #44: Sécurité : rendre la révocation des sessions immédiate entre workers
- #43: Améliorer le mobile, les aperçus A4 et l’espace professionnel
- #42: Fiabiliser les PDF et corriger le thème système à l'impression
- #41: Préparer l’archive du code fusionné sur main
- #40: Ajouter cinq modèles modernes de facture et de devis
- #39: Agrandir légèrement le logo et les icônes de navigation
- #38: Make monthly invoice quota initialization deterministic
- #37: Exclude local secrets from Docker and require npm lockfile
- #36: Harden invoice settlement, paid status and payment idempotency
- #35: Test that backup archives stay temporary until dump completion
- #34: Prevent local environment secrets from entering Docker images
- #33: Publish database backups only after atomic validation
- #32: Publish complete database backups atomically
- #31: Harden session revocation and payment provider timeouts
- #30: Add transactional monthly invoice quota with schema migration v8
- #29: Fix monthly invoice quota with schema migration v8
- #28: Improve sidebar navigation accessibility
- #27: Improve sidebar icon semantics and enforce full icon coverage
- #26: Fix PDF worker startup ordering after API readiness
- #25: Fix subscription page icons and visual regression checks
- #24: Sécurité : révocation des sessions, correctif liaison Google, filtrag…
- #23: Galerie de 19 modèles, impression fiable, WhatsApp et audit transversal
- #22: Présenter les modèles de facture dans une galerie visuelle
- #21: Finaliser les factures et devis imprimés en A4
- #20: Professionnaliser la page Abonnement et ses icônes
- #19: Stabiliser la CI avec des tests MySQL séquentiels
- #18: Professionnaliser l’interface et les documents, renforcer la responsivité et la montée en charge
- #17: Améliorer la visibilité et la cohérence des icônes
- #16: Fix Docker startup: single MySQL schema init and Redis readiness
- #15: UI : harmoniser les pages métier pour un logiciel de gestion professionnel
- #14: UI : finaliser la structure professionnelle des pages métier
- #13: UI : organiser les pages métier comme un logiciel professionnel
- #12: UI : organisation professionnelle des pages métier
- #11: Audit UI — navigation compacte et amélioration de la visibilité
- #10: UI : navigation compacte et espace de travail élargi
- #9: Build a temporary local Docker test ZIP
- #8: Phases 5 à 7 — Portail client, CRM, internationalisation et IA
- #7: Phases 2 à 4 — Paiements réels, comptabilité OHADA et achats/stocks
- #6: Ajouter une cloche de notifications à la barre supérieure
- #5: Refonte du tableau de bord SamaFacture Pro — palette et navigation
- #4: UI polish: animations accessibles et recette visuelle responsive
- #191: fix(currency): serialize tenant currency and first business writes
- #189: fix(mobile): validate Capacitor public HTTPS before native builds
- #187: fix(mobile): guard Capacitor native builds on latest main
- #186: fix(mobile): block native builds until public HTTPS config is valid
- #184: fix(mobile): validate Capacitor config before native build
- #181: test(security): cover reset token redaction on current main
- #174: fix(mobile): reject reserved non-public hostnames
- #173: feat(mobile): block native builds until HTTPS domain is configured
- #168: fix: fuseau local, devise du tenant et isolation des routes
- #167: fix: devise des emails, relances impayés et échappement HTML
- #165: docs(backup): sécuriser le transfert hors serveur rclone
- #164: test(security): empêcher la divulgation des hashes de réinitialisation
- #163: security(backup): restreindre les permissions du dossier de sauvegarde
- #162: test(security): couvrir expiration et changement email des invitations equipe
- #161: ux(dashboard): réduire le défilement mobile des modules
- #160: fix(backup): compatible avec le compte MySQL limité de Docker
- #159: security(invoices): retirer le code public de la liste paginée
- #158: docs(security): corriger les conseils CORS et proxy
- #152: test(accounting): couvrir les correspondances OHADA des dépenses
- #151: fix(print): preserve full-width invoice banners on A4
- #150: feat(accounting): configure OHADA sales and expense mappings
- #149: feat(accounting): configure expense category account mappings (schema v23)
- #148: reconcile: port trial and accounting protections (schema v22) onto current main
- #147: integration: réconcilier comptabilité OHADA et essai gratuit v21 avec main actuel
- #146: fix(integration): reconcile OHADA, 15-day trial and audit retention on current main
- #144: fix(accounting): retain invoice reversal events on invoice deletion (schema v22)
- #143: fix(accounting): map cheque payments to bank and reject unknown methods
- #125: fix(pdf): pagination A4 cohérente des factures et devis longs
- #124: fix(invoice): afficher les montants des lignes sans scroll mobile
- #123: test(pdf): garantir une facture courte sur une page A4
- #122: test(visual): fournir un QR code aux fixtures mobiles facture/devis
- #121: fix(pdf): préserver le cachet sur les écrans mobiles
- #120: fix(accounting): reverse refund entries in cash and bank journals
- #119: feat(accounting): distinguish cash and bank expense payments
- #117: fix(accounting): reverse invoice entries on cancellation and reactivation
- #116: test(pdf): couvrir la pagination des factures longues
- #113: fix(pdf): preserve company date and number formats in headless PDFs
- #112: fix(pdf): repeat company and document identity on continuation pages
- #111: fix(invoice): keep print banners inside the A4 printable area

## Préservation
- Merge 0; push main 0; force push 0; branche supprimée 0.
- Migration 0; données/volumes/sauvegardes/historique comptable modifiés 0.
- Paiement réel 0; déploiement production 0.


---

## Addendum Run 16 — suivi CI et correction clavier (23 novembre 2026)

### État réel du dépôt au snapshot
- `main` : `b0b52e660af61fa781dc9a761165dd72977f969a`.
- Branches : **210** (pagination API : 100 + 100 + 10).
- PR ouvertes : **55**.
- PR fermées : **142** (pagination 100 + 42), dont **110 fusionnées** et **32 fermées sans fusion**.
- Workflows présents sur main : `.github/workflows/test.yml`, `.github/workflows/lint.yml`, `.github/workflows/package-source-zip.yml`.
- Le dernier run post-fusion connu sur main est #45138061597, success sur le SHA `b0b52e660af61fa781dc9a761165dd72977f969a`. Le wrapper par SHA utilisé pour les PR ne retourne que les runs pull_request et n'a pas renvoyé ce run main; il n'est donc pas présenté comme un nouveau run.
- Ruleset #27410527 reconsulté : enforcement active; checks requis `Tests Node.js et MySQL` et `Build complete source archive`; résolution des conversations requise; approbations requises = **0**; bypass actors = **0**. L'endpoint de protection classique `branches/main/protection` retourne 403.

### PR de sécurité — vérification des runs exacts et reviews
- **#193** head `fb6324d34b024072f98d7c1347a0da330922aba4`: Tests #45140914890 success; ESLint #45140914986 success; ZIP #45140914942 success.
- **#194** head `5cd2604b395e7d994c051f4b7d19f7800bccaaf6`: Tests #45141155965 success; ESLint #45141155971 success; ZIP #45141155951 success.
- **#199** head `b212dbc0bac111c77023c1ad42c58514786aeaca`: Tests #45156601143 success; ESLint #45156601267 success; ZIP #45156601096 success.
- Les revues enregistrées sur #193/#194/#199/#200 proviennent uniquement du compte auteur `morn53426-ui` et sont de type COMMENTED; aucune approbation indépendante n'est enregistrée. CI verte ne vaut donc pas autorisation de fusion pour ces changements sécurité.
- #193 masque `verification_code` dans les réponses de liste facture et historique client, tout en le conservant dans le détail authentifié/QR.
- #194 ajoute les clauses tenant concordantes aux relations factures/clients/paiements, dashboard/rapports, checkout et récurrences.
- #199 ajoute `p.user_id = r.user_id` et `f.user_id = p.user_id` à la chaîne remboursement→paiement→facture du relevé client.

### PR #200 — correctif de focus découvert pendant la revue
- Base : `main` SHA `b0b52e660af61fa781dc9a761165dd72977f969a`.
- Head initial : `e010e563e568e89dcc86f8d735a60f6236986258`; les trois checks initiaux étaient green sur ce SHA.
- Finding : le sélecteur `querySelector('.enterprise-console-menu-toggle') || getElementById('mobile-toggle-btn')` choisissait un bouton Groupe même lorsqu'il était présent mais masqué, ce qui pouvait empêcher la restauration du focus vers le bouton mobile visible.
- Correctif commit `cd6793fd256f57d9a2159f673f97fb8e1e3f1500`: collecte des deux déclencheurs puis sélection du premier élément connecté et réellement visible via `getClientRects().length`.
- Test commit `69180203cc2c694c3de029873b360d43d0b487ca`: test structural étendu pour vérifier la recherche du premier déclencheur visible.
- Head actuel au snapshot : `69180203cc2c694c3de029873b360d43d0b487ca`; PR draft, base main.
- CI sur ce head exact : ZIP #45166873404 **success**; ESLint #45166873510 **success**; Tests #45166873559 **in_progress**. Ne pas réutiliser les succès du head initial `e010e5` comme preuve pour le head actuel.
- Revue statique du diff faite par l'auteur; pas d'approbation/revue indépendante externe. Aucun changement métier ou DDL.

### PR #201 — rapport Run 15
- Head avant cet addendum : `05df11e280dcf1f17a4986721a909e6330893dc7`; Tests #45160980773 success et ZIP #45160980866 success sur ce head.
- Le présent addendum Run 16 est ajouté en append-only au fichier `docs/audit/rapport-execution-run15-2026-11-23.md`; les sections Runs antérieurs sont conservées. Les contrôles du nouveau head après cet ajout doivent être vérifiés séparément.

### Migrations et schéma
- `server/config/db.js`: `CURRENT_SCHEMA_VERSION = 23`.
- Migrations versionnées `003` à `012` dans `server/database/migrations/`; migration 012 existante : `012_comptabilite_correspondances.sql`.
- Cinq scripts SQL supplémentaires à la racine : stabilite 2026-08-30, token_version 2026-11-15, facture_personnalisation, index_reset_token, scalabilite_30_41. Leur ordre exact d'application doit être confirmé par les procédures d'installation/upgrade avant un changement de schéma.
- Aucun DDL/migration exécuté pendant Run 16.

### Planning P0–P3
- **P0** : terminer Tests Node/MySQL sur le head exact #200 `69180203...`; si échec, examiner le log de ce run uniquement. Garder #200 draft jusqu'à revue indépendante.
- **P0** : obtenir une approbation sécurité humaine indépendante pour #193/#194/#199; les reviews actuelles sont des COMMENT de l'auteur seulement.
- **P0** : compléter le scan des relations tenant-aware restantes; aucune fusion #194/#199 avant revue du périmètre combiné et résolution des chevauchements.
- **P1** : #192 devise : confirmer métier multi-devise avant changer ou fusionner; CI historique green sur son head, pas de décision métier enregistrée.
- **P1** : #142 schema v21 / essai 15 jours et #145 schema v22 / conservation événements : rebase/reconstruction, CI exacte, validation humaine comptable/DDL.
- **P2** : autres correctifs accessibilité et impressions A4/PDF en lots indépendants.
- **P3** : branding, vidéo et documentation après stabilisation P0/P1.

### Bilan sécurité Run 16
- 0 fusion; main inchangé au SHA relevé.
- 0 push direct/force push sur main; 0 branche supprimée.
- 0 migration; 0 écriture comptable historique modifiée.
- 0 modification de données, volumes ou sauvegardes; 0 paiement réel; 0 déploiement production.


---

## Addendum Run 17 — fusion contrôlée #200 et arrêt après-merge (23 novembre 2026)

### Snapshot
- Main avant fusion : `b0b52e660af61fa781dc9a761165dd72977f969a`.
- Inventaire revalidé : **210 branches** (100 + 100 + 10), **54 PR ouvertes**, **143 PR fermées**. Les PR fermées sont comptées par plages de création (1–10 nov: 3; 11–15: 40; 16–20: 60; 21–23: 40). Le champ « merged » n'est pas exposé dans les résultats de recherche fermées lors de ce run; le total fusionné/non-fusionné historique n'est donc pas recalculé.
- PR #200 a été fusionnée en squash le 23 novembre à 11:59:09 UTC : commit main **`c0a3b569e3e685183376be8428c4696d8c767ccd`**. La branche source est conservée (aucune suppression).
- Diff fusionné : `.github/workflows/lint.yml`, `public/js/sidebar.js`, `server/tests/sidebar-mobile-keyboard.test.js`. Aucun DDL/migration, modification métier, données, historique comptable, volume, backup, paiement réel ou déploiement.

### #200 — revue indépendante et checks exacts pré-merge
- Head exact : `69180203cc2c694c3de029873b360d43d0b487ca`; base exacte : `b0b52e660af61fa781dc9a761165dd72977f969a`.
- Revue statique indépendante : le garde-dialogues reste prioritaire; Échap ferme la sidebar ouverte; focus restauré vers le premier déclencheur connecté et visible (toggle Groupe prioritaire, bouton mobile en fallback); fermeture des notifications conservée. Test structurel couvre les branches et états ARIA. Limite : pas de test DOM/browser interactif.
- Avant fusion, mergeable=true, threads de revue non résolus=0, Draft converti en Ready, checks exacts 3/3 success :
  - Tests Node/MySQL [45166873559](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45166873559) — success; steps incl. npm audit, suite, restore chiffrée, smoke MySQL/Redis, recette responsive.
  - ESLint [45166873510](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45166873510) — success.
  - ZIP [45166873404](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45166873404) — success.
- Le ruleset actif précédemment observé (#27410527) exige Tests Node.js/MySQL + archive ZIP et résolution des conversations; approbations requises=0, bypass=0. Aucun contournement utilisé.

### Vérification post-merge et blocage
- Commit main confirmé par GitHub : `c0a3b569e3e685183376be8428c4696d8c767ccd`; fichiers du commit correspondent au diff #200.
- Status API combiné sur le commit post-merge : `statuses=[]`; wrapper de workflow limité aux runs pull_request : `workflow_runs=[]`.
- La page Actions/checks GitHub n'est pas accessible dans cette session (fetch désactivé); le run main post-merge exact n'a donc pas pu être confirmé. **Arrêt de toutes les fusions et du lot suivant** jusqu'à vérification manuelle/outil d'accès des checks de `c0a3b569...`. Aucun résultat CI post-merge n'est inventé.
- Un run main antérieur #45138061597 avait ses étapes terminées success, mais il est antérieur à la fusion #200 et ne valide pas ce nouveau commit.

### P0/P1 restant
- #193, #194, #199 : CI complète success sur leurs heads exacts (voir Addendum Run 16), mais revue humaine sécurité distincte/approbation absente. #194 est le lot consolidé; les PR #193 et #199 ont des chevauchements. Ne pas fusionner avant revue sécurité humaine et comparaison des scopes.
- #192 : CI complète success sur head exact; décision métier sur invariant de devise encore requise.
- #142/#145 : integration/schema v21/v22, bases empilées; #142 mergeable=false et #145 cible la branche #142. Validation humaine spécifique trial/comptabilité/DDL requise. Aucune migration exécutée.
- Schema runtime main reste v23. Les migrations 012 OHADA et v22 audit retention sont intactes.

### Bilan Run 17
- Fusion #200 : 1 (squash, checks pré-merge exacts green).
- Main CI post-merge : non vérifiable via outils disponibles; **main stabilité non confirmée**.
- Merges suivants : 0; main push direct 0; force push 0; branches supprimées 0.
- DDL/migrations : 0; données/volumes/backups/historique comptable touchés : 0; paiement réel : 0; production : 0.


---

## Addendum Run 18 — vérification CI post-fusion et synchronisation (23 novembre 2026, 12:54 UTC)

### État confirmé
- `main` reste au SHA **`c0a3b569e3e685183376be8428c4696d8c767ccd`**, fusion #200.
- La CI post-fusion qui n'était pas accessible au Run 17 est désormais retrouvée via l'API Actions/check-runs : run **#45170046061**, événement `push`, head SHA exact `c0a3b569e3e685183376be8428c4696d8c767ccd`, conclusion **success**. Check « Tests Node.js et MySQL » completed success (11:59:14–12:05:08 UTC). Lien : https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45170046061
- Le wrapper status classique reste vide; cela n'invalide pas le check-run exact. Aucun autre lot n'a été fusionné.
- Inventaire branches paginé terminé : **210 branches** (100 + 100 + 10). **54 PR ouvertes**; les 20 PR fermées les plus récentes sont récupérées, mais l'API de recherche ne donne pas ici une pagination complète/total fermé fiable. Le total historique de 143 fermées est conservé du snapshot précédent, non recalculé.
- Schéma runtime : **v23**; migrations versionnées 003–012 et scripts SQL racine préexistants. Aucun script/migration exécuté.

### PR #197 — lien d'évitement clavier resynchronisé sans force push
- Head avant resynchronisation : `d23afbe04e35db9cfbaaf70a7ee2d0f6de187b61`, base b0b52e6.
- Compare avec le main actuel : 3 commits ahead, 1 behind; modifications limitées à CSS, dashboard HTML et test structurel. Le main n'a pas modifié ces fichiers dans #200.
- Rebasage conservateur via commit de fusion sur la branche PR (pas de force) : **`77788aeba50b3626f6349f886bc18df0c2102be7`**, parents: ancien head et main `c0a3b569e3e685183376be8428c4696d8c767ccd`. Ref update fast-forward accepté.
- Revue statique : lien focus-visible, cible main tabindex=-1, outline, test structurel. Pas de navigateur/DOM interactif exécuté ici.
- CI du nouveau head exact déclenchée : Tests #45179061694 **in_progress**; ESLint #45179061588 **in_progress**; ZIP #45179061592 **success**. Ne pas confondre avec la CI green du head précédent.

### Lots prioritaires
- **P0 sécurité** : #193 (redaction codes), #194 (isolation tenant consolidée), #199 (remboursements tenant). Les trois heads exacts ont CI 3/3 success. Aucune revue indépendante/approbation sécurité humaine enregistrée; bases PR anciennes (b0b52e6). Validation humaine spécifique et revue de chevauchement exigées avant fusion.
- **P1 devise** : #192, CI 3/3 success sur head `8a11e00...`; PR encore basée sur b0b52e6. Décision métier sur devise et synchronisation requises.
- **P1 comptabilité/essai** : #142 (schema v21, trial 15 jours) et #145 (schema v22, conservation événements). CI 3/3 success sur heads `decb8da...` et `5b6ba8b...`, mais #145 est empilée sur #142; bases/divergence doivent être réconciliées. Validation humaine spécifique comptable et migration requise avant merge.
- **P2 accessibilité** : #197 resynchronisée avec main, CI exacte en cours.
- **P2 PDF/print** : #127 pagination A4 Executive (mergeability true au dernier relevé) et autres branches d'impression; vérifier exact base, CI et diff avant reprise.
- **P3** : vidéo/branding/documentation non urgents.

### Préservation et décision
- Fusion Run 18 : 0; push direct main : 0; force push : 0; branche supprimée : 0.
- Migration/DDL : 0; données, volumes, sauvegardes et historique comptable touchés : 0; paiement réel : 0; production : 0.
- **Décision :** main post-merge #200 est confirmé green sur son run push exact. Les fusions restent séquentielles; #197 attend ses checks exacts, les lots P0/P1 attendent les validations humaines spécifiques.


---

## Addendum Run 19 — revue indépendante et correction du skip-link (23 novembre 2026, 13:56 UTC)

### État du dépôt
- `main` confirmé au SHA `c0a3b569e3e685183376be8428c4696d8c767ccd`; aucun nouveau commit ni fusion depuis le Run 18.
- CI post-fusion #200 toujours établie par run push exact #45170046061 sur `c0a3b569e3e685183376be8428c4696d8c767ccd`: job Tests Node.js/MySQL terminé success.
- Règles de merge : dernière observation documentée au Run 16, ruleset #27410527 actif, checks requis Tests Node.js/MySQL + Build complete source archive, conversations résolues, approbations requises=0, bypass actors=0. Endpoint de ruleset non exposé dans les outils de ce run; règles non re-vérifiées à 13:56 UTC.
- Branches, PR ouvertes/fermées et migrations n'ont pas été ré-inventoriées exhaustivement dans ce run; conserver les derniers totaux du Run 18 comme snapshot, pas comme nouveau comptage.

### PR #197 — finding et correction
- PR #197 reste ouverte et Draft; base SHA `c0a3b569e3e685183376be8428c4696d8c767ccd`.
- Head exact après corrections : `c2ba2ffb156d1aac7a418cba9e6cce73b362a86a`; branche `a11y/dashboard-skip-link-main-current-run13`.
- Compare main...branche : 6 commits ahead, 0 behind; 3 fichiers modifiés; aucune divergence avec main.
- Commits du Run 19 : `a19372203fb1041534aa885ce5d63c045dec2f61` (skip-link HTML vers la section de contenu) et `c2ba2ffb156d1aac7a418cba9e6cce73b362a86a` (assertions structurelles renforcées).
- Finding de revue : la cible antérieure `#main-content` se trouvait avant `#topbar-root` dans le landmark main; la barre supérieure (notifications, actions rapides, déconnexion) restait donc dans le parcours après activation du lien. Correction : le lien cible désormais `#dashboard-content`, section d'accueil focalisable située après `#topbar-root`; `main#main-content` conserve son landmark sémantique.
- Tokens `--emerald`, `--paper`, `--ink`, `--shadow-md` vérifiés présents dans `:root`; les variantes du thème sombre redéfinissent `--paper`, `--ink` et `--shadow-md`.
- Test structurel vérifie le lien, le landmark main, et l'ordre topbar → section cible. Limite : aucune simulation DOM/navigateur, parcours clavier réel ou lecteur d'écran exécuté.
- Diff indépendant relu : changement ciblé et limité aux CSS, dashboard HTML et test; pas de changement métier, financier, comptable, sécurité sensible ou DDL. Review GitHub COMMENT attachée au head exact (review id 6022891410); elle n'est pas une approbation humaine.
- CI sur le head exact `c2ba2ffb...` : Tests Node/MySQL #45188654715 in_progress au snapshot; ESLint #45188654724 in_progress; Source ZIP #45188654730 success. Le status API combiné retourne statuses=[]; seuls les workflow runs donnent les résultats en cours. Aucun succès des anciens heads n'est réutilisé.

### Décision
- Garder #197 en Draft jusqu'à fin des tests et de ESLint sur le head exact, résolution de tout finding et relecture de l'état mergeable/protections.
- Aucune fusion effectuée dans ce run. Ne pas convertir en Ready ni appeler l'API merge tant que les checks exacts ne sont pas success et les protections applicables revalidées.
- P0 sécurité #193/#194/#199, P1 devise #192 et P1 migrations/comptabilité #142/#145 restent bloqués selon les validations de leurs addenda précédents; ne pas les mélanger avec le lot accessibilité.

### Préservation
- Fusion 0; push direct main 0; force push 0; branche supprimée 0.
- DDL/migration exécuté 0; données, volumes, sauvegardes et historique comptable modifiés 0.
- Paiement réel 0; déploiement production 0.


---

## Addendum Run 19 — fusion #197 et nouveaux lots P0/P2 (23 novembre 2026, 14:04 UTC)

### PR #197 — fusion contrôlée
- Head revu et testé : `c2ba2ffb156d1aac7a418cba9e6cce73b362a86a`; base exacte `c0a3b569e3e685183376be8428c4696d8c767ccd`; compare 6 ahead / 0 behind; 3 fichiers.
- Finding initial corrigé : le lien d'évitement pointait sur `#main-content`, positionné avant `#topbar-root`; la barre utilitaire demeurait donc dans le parcours. Le lien cible maintenant `#dashboard-content`, après topbar, avec `tabindex=-1`; landmark `main#main-content` conservé.
- CI sur le head exact : Tests Node/MySQL #45188654715 success (tous les steps, y compris tests, restauration chiffrée, MySQL/Redis et recette responsive); ESLint #45188654724 success; ZIP #45188654730 success.
- Revue statique du diff final documentée (review COMMENT id 6022891410; pas une approbation). Aucun test lecteur d'écran/AT manuel exécuté.
- PR #197 marquée Ready puis fusion squash via l'API standard, avec expected head SHA, sans bypass : commit de merge `f8a61187e8b8df7dc319d611dd58fb02dd0aa336`, 23 novembre 2026 14:03:47 UTC.
- `compare(main, f8a61187...)` retournait `identical`: ce commit est bien le HEAD de main.
- **CI post-fusion en attente** au snapshot 14:04 UTC : `fetch_commit_workflow_runs(f8a61187...)` retourne `[]`; combined status retourne `statuses=[]`. Ne pas confondre avec les checks PR pré-fusion. Aucune autre fusion tant qu'un run push exact et vert n'est pas confirmé.

### PR #202 — contraste badge Entreprise
- Cause confirmée sur main avant fusion #197 : palette héritée `--emerald` / `--emerald-light` utilisée pour un badge petit; aucune assertion de contraste Enterprise dans la recette de thème.
- PR #134 historique était fortement divergente : 3 ahead / 100 behind, merge-base `8453ee6d...`; conservée ouverte en Draft, body annoté comme remplacée par un portage propre. Aucune branche supprimée.
- Nouvelle branche `fix/enterprise-badge-contrast-current-main-run19-20261123` créée depuis main `c0a3b569...`; PR #202 Draft, base `c0a3b569...`, head `1b546cbf92e5c9953b4bf3cfff5a32986ea59ecb`, compare 3 ahead / 0 behind, 2 fichiers.
- Commits : `4a3be5c05c5deded23ce3262aeea1af15ee9a45e` (palette claire/sombre/sombre système) et `65a4d8aca640d0d50389702006b84880fe5ea59f` (test contraste et reporting); dernier commit `1b546cbf...` corrige l'assertion browser-context pour lancer une erreur native dans `page.evaluate` plutôt que d'utiliser Node `assert`.
- Ratios mathématiques des valeurs proposées : clair `#066144` sur `#D1FAE5` = 6,61:1; sombre `#9DE7BC` sur `#173D2B` = 8,39:1. Le rendu réel dépend encore de la recette CI.
- CI exacte : Tests #45189484145 in_progress; ESLint #45189484248 success; ZIP #45189484153 success. Revue statique COMMENT id 6022966681; non approbation. Aucun changement de données/DDL/comptabilité.

### PR #203 — redaction du verification_code (P0 sécurité)
- Cause racine confirmée sur main `c0a3b569...` : `GET /api/factures` renvoie `f.*`; `GET /api/clients/:id` renvoie `SELECT * FROM factures`. Dans les deux réponses, le champ `verification_code` peut être exposé alors qu'il n'est pas requis par les listes.
- L'ancienne PR #193 était 5 ahead / 1 behind main; head ancien gardé ouvert Draft et annoté comme historique. Reprise fraîche sur `security/redact-verification-codes-current-main-run19-20261123`.
- PR #203 Draft, base `c0a3b569...`, head `7c3e5144a9a5f3cff69e4033a399fe93becfa420`, compare 5 ahead / 0 behind, 5 fichiers.
- Modifications : retire le code des listes factures et historique client; garde le code dans le détail authentifié pour le QR; tests list/detail/public consult; étend les triggers/cibles ESLint aux deux routes et deux tests. Aucun changement financier, fiscal, DDL ou écriture comptable.
- CI sur head exact : Tests #45189953127 in_progress; ESLint #45189952933 in_progress; ZIP #45189953049 success. Revue statique COMMENT id 6022995746; non approbation. **Validation humaine spécifique sécurité obligatoire avant fusion** (vérifier tous consommateurs de listes, accès public et nécessité du code dans le détail authentifié).

### Autres décisions
- Impression : #151 (bandeaux A4) et #125 (pagination PDF consolidée) déjà fusionnées; #127 contient le correctif Executive également porté dans #125 et reste doublon, ne pas fusionner.
- P0 #194/#199 isolation multi-tenant/remboursements et P1 #192 devise restent en attente de revue de sécurité/métier humaine; P1 #142/#145 (v21/v22) en attente de validation spécifique DDL/comptable.
- #197 est la seule fusion de ce run. Aucun push direct main, force push, branche supprimée, migration exécutée, donnée/volume/sauvegarde/historique comptable modifié, paiement réel ou déploiement production.
