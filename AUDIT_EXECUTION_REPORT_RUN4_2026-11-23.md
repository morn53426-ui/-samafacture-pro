# SamaFacture Pro — Rapport d'exécution Run 4 (23 novembre 2026)

## Résumé

- Dépôt : `morn53426-ui/-samafacture-pro`, public, branche par défaut `main`.
- Snapshot inventaire : **178 branches**, **42 PR ouvertes**, **125 PR fermées** (2 pages REST, 100 + 25).
- Main : `b43a94fc2937b0108077501a0260358c8569e11f`.
- Dernière CI post-fusion sur ce SHA : Tests Node.js et MySQL **success**, run #45080802243, check-run #137388318607 terminé 2026-11-22 23:07:20Z.
- **0 fusion dans ce run; aucune migration, opération destructive, écriture comptable, paiement réel ou déploiement.**
- Inventaire exhaustif des branches et PR ci-dessous; les contrôles de CI des PR non prioritaires ne sont pas réputés exécutés.

## Main, protection et CI

- Branche `main` protégée (flag API `protected=true`).
- Ruleset actif `protect main`, ID 27410527, sans bypass (`current_user_can_bypass=never`).
- PR obligatoire, résolution des conversations obligatoire, non-fast-forward et suppression interdits.
- Status checks requis : `Tests Node.js et MySQL`, `Build complete source archive`.
- Le ruleset exige **0 approbation**. Pour cette exécution, une approbation humaine indépendante reste un gate volontaire supplémentaire.
- Lecture endpoint classique `/branches/main/protection` refusée (403); configuration classique non vérifiée.
- Check-run main : `Tests Node.js et MySQL` success (https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45080802243/job/137388318607).

## CI exactes des PR prioritaires

| PR | Head SHA | Tests Node/MySQL | ESLint | ZIP | État / décision |
|---|---|---|---|---|---|
| #167 | `4e848f3b98b1bc93635f0dab01a7d752fd2b18cd` | success | success | success | Revue sécurité complémentaire et humaine requise |
| #168 | `b07000daa7663196de68a42bc0ba011f4f4cf7f9` | success | success | success | Race du verrou devise non corrigée; ne pas fusionner |
| #149 | `6f82b82dfab5c6d4a8b0fc0a466b331a2ebab3c7` | success | success | success | Migration 012/version23 conflicte avec main; stale |
| #159 | `1c6bf875b98273cac0c00ac5c306aa22dcafb8d3` | success | success | success | Branch base stale; rebase/diff/CI à refaire |
| #164 | `a10bc748a38b05a80caf21c9f2f16da5e729d2e1` | success | success | success | Revue indépendante requise |
| #169 | `dff61fb42a429fce93ed1fc6f0a3c9f355ced6f4` | success | — | success | Rapport run2 historique |
| #170 | `6fa59a42ebb12bb9d6f8a266059125b81991ff95` | success | — | success | Rapport run3, conservé |
| #171 (head initial) | `9b70c35fef2e12726274ae4b726ca50c5e54b8e3` | **failure (timeout 12 min, exit 124)** | success | success | Cause teardown test; correctif ajouté |
| #171 (head actuel) | `e7a2bcd3818da6cf015c06855b62da7a2697d132` | **in_progress** | success | success | Attendre test exact avant décision |

### #171 — cause racine et correctif

Run initial #45092205798 (job #137424061202) sur SHA `9b70c35fef2e12726274ae4b726ca50c5e54b8e3` :
- Le test fonctionnel de création de commande EUR est affiché réussi, puis le fichier `auth-currency.test.js` est marqué en échec.
- Process Node atteint le timeout de 12 minutes, exit 124; le rapport diagnostique signale un child process actif et un event loop idle. La restauration chiffrée, le smoke cluster et la recette visuelle ont été skipped après l'échec.
- Artifact diagnostic #14782526619 (`samafacture-diagnostics-1697`, 3432 octets, expiration 30 novembre 2026).

Cause probable, étayée par le schéma et l'ordre cleanup (stack d'erreur de cleanup non présente dans les logs) : `pro_commandes.client_id` référence `clients` avec `ON DELETE RESTRICT`; `nettoyerUtilisateur` supprimait refunds puis `users`, ce qui peut faire échouer la cascade user->client lorsqu'une commande existe, et interrompre le teardown avant la fermeture du pool.

Correctif test-only commit `e7a2bcd3818da6cf015c06855b62da7a2697d132` dans `server/tests/setup.js` : suppression explicite des `pro_commandes` du user test avant `DELETE users`. Commentaire de revue non-approbateur #6015785817. CI exact sur ce head : Tests Node/MySQL in progress; ESLint et ZIP success. Aucun test local exécuté.

### #171 et #168 — devise tenant

- #171 est une PR draft empilée sur #168 (base `fix/webhook-local-timezone-dynamic-currency-20261123`, SHA `b07000daa7663196de68a42bc0ba011f4f4cf7f9`); ne pas merger #171 séparément.
- Le correctif commande défaut sur devise tenant, validation des codes et verrou après commandes/bons; tests EUR, invalid currency, lock.
- #168 : **race P1** reste possible si changement de devise (COUNT puis UPDATE) et création document concurrente ne partagent pas une transaction/locking/serialization. Nécessite un lot dédié et test concurrent.

### #167 — sécurité relances/XSS

- Head exact `4e848f3b98b1bc93635f0dab01a7d752fd2b18cd`, CI 3/3 success.
- Findings précédemment commentés : test XSS API hostile, scheduler multi-devise (séparation des soldes par devise, idempotence clé de run) à compléter; aucune approbation.

## Migrations

Version courante `CURRENT_SCHEMA_VERSION=23`.
Migrations présentes :
- `server/database/migrations/003_professional_modules.sql`
- `server/database/migrations/004_paiements_comptabilite_achats.sql`
- `server/database/migrations/005_portail_crm_international_ia.sql`
- `server/database/migrations/006_company_groups.sql`
- `server/database/migrations/007_email_outbox.sql`
- `server/database/migrations/008_company_group_email_proof.sql`
- `server/database/migrations/009_team_invitation_email_proof.sql`
- `server/database/migrations/010_saas_subscriptions_simulation.sql`
- `server/database/migrations/011_comptabilite_contrepas_factures.sql`
- `server/database/migrations/012_comptabilite_correspondances.sql`

#149 propose une migration additive 012 alors que main possède déjà `012_comptabilite_correspondances.sql` et version 23. Risque : installation déjà v23 ne rejoue pas cette migration. Requis : migration 013/version24, tests upgrade/replay, FK composée tenant; validation humaine OHADA avant fusion. Aucun changement de données historiques ni migration exécutée.

## Workflows CI

- `.github/workflows/lint.yml` — blob `1c924553556d`
- `.github/workflows/package-source-zip.yml` — blob `f6f28a9aafc3`
- `.github/workflows/test.yml` — blob `a748864b071a`

## PR ouvertes (42) — snapshot complet

| PR | Titre | Head SHA | Branche head | Base |
|---|---|---|---|---|
| #171 | fix(pro): use tenant currency for orders and lock history | `e7a2bcd3818d` | `fix/pro-orders-tenant-currency-20261123` | `fix/webhook-local-timezone-dynamic-currency-20261123` |
| #170 | docs(audit): rapport d'exécution run 3 — 23 novembre | `6fa59a42ebb1` | `audit/execution-report-20261123-run3` | `main` |
| #169 | docs(audit): rapport d'exécution run 2 — 22 novembre | `dff61fb42a42` | `audit/execution-report-20261122-run2` | `main` |
| #168 | fix: fuseau local, devise du tenant et isolation des routes | `b07000daa766` | `fix/webhook-local-timezone-dynamic-currency-20261123` | `main` |
| #167 | fix: devise des emails, relances impayés et échappement HTML | `4e848f3b98b1` | `fix/audit-devise-relances-escape` | `main` |
| #166 | docs(audit): rapport d'exécution initial du 22 novembre | `dc7e6f55c5f7` | `audit/execution-report-20261122-run1` | `main` |
| #164 | test(security): empêcher la divulgation des hashes de réinitialisation | `a10bc748a38b` | `test/security-auth-reset-token-redaction-20261122` | `main` |
| #159 | security(invoices): retirer le code public de la liste paginée | `1c6bf875b982` | `security/invoice-list-verification-code-redaction-20261122` | `main` |
| #157 | a11y(navigation): fermer le menu mobile avec Échap | `c37403034a25` | `a11y/mobile-sidebar-escape-focus-20261122` | `main` |
| #156 | a11y(dashboard): ajouter un accès clavier au contenu principal | `8f45795c3df5` | `a11y/dashboard-skip-navigation-20261122` | `main` |
| #155 | ux(settings): grille responsive pour les coordonnées entreprise | `99670cdf2969` | `ux/settings-company-fields-grid-20261122` | `main` |
| #154 | ux(workspace): navigation mobile compacte par domaine | `185e0487c954` | `ux/pro-workspace-mobile-domain-rail-20261122` | `main` |
| #153 | test(trial): vérifier l'expiration sur la première requête protégée | `29932fbbefe3` | `test/free-trial-expiry-session-guard-20261122` | `main` |
| #149 | feat(accounting): configure expense category account mappings (schema v23) | `6f82b82dfab5` | `feature/ohada-expense-account-mappings-20261122` | `main` |
| #147 | integration: réconcilier comptabilité OHADA et essai gratuit v21 avec main actuel | `e8b2dc9c6f20` | `integration/reconcile-main-v21-20261122` | `main` |
| #146 | fix(integration): reconcile OHADA, 15-day trial and audit retention on current main | `62ea473892b1` | `integration/schema-v22-main-reconciled-20261122` | `main` |
| #145 | fix(accounting): retain invoice reversal events (schema v22) | `5b6ba8bf3b05` | `fix/accounting-event-audit-retention-v22-run2-20261122` | `integration/schema-v21-accounting-trial-20261122` |
| #144 | fix(accounting): retain invoice reversal events on invoice deletion (schema v22) | `90b718abcbef` | `fix/accounting-event-audit-retention-v22-20261122` | `integration/schema-v21-accounting-trial-20261122` |
| #143 | fix(accounting): map cheque payments to bank and reject unknown methods | `17d25a5e3686` | `fix/refund-payment-method-mapping-rebased-20261122` | `integration/schema-v21-accounting-trial-20261122` |
| #142 | feat(accounting, trial): integrate invoice lifecycle and 15-day trial on schema v21 | `decb8da2e48e` | `integration/schema-v21-accounting-trial-20261122` | `main` |
| #141 | ci: add workspace UI structure regression checks | `2a09ccf8bfdb` | `ci/workspace-ui-structure-tests-20261122` | `feat/workspace-settings-navigation-20261121` |
| #140 | ci(lint): couvrir les routes backend et tests de protection | `32d1c1f56cb9` | `ci/lint-history-protection-backend-20261122` | `main` |
| #139 | fix(a11y): improve professional workspace status contrast | `baa9ea6a6881` | `fix/pro-workspace-status-contrast-20261122` | `main` |
| #138 | fix(inventory): protect products with stock or history | `27d5a6c27d5d` | `fix/product-delete-stock-history-protection-20261122` | `main` |
| #137 | fix(accounting): protect clients with linked history | `f2aada8d5c01` | `fix/client-delete-history-protection-20261122` | `main` |
| #136 | fix(accounting): protect posted expenses from edits and deletion | `4e0f2a893812` | `fix/expense-ledger-protection-20261122` | `main` |
| #135 | fix(accounting): preserve issued invoice history | `2c7f3cbde915` | `fix/invoice-delete-history-guard-20261122` | `main` |
| #134 | fix(a11y): badge Entreprise lisible en thème sombre | `52021018d789` | `fix/enterprise-badge-contrast-main-20261122` | `main` |
| #133 | fix(a11y): corriger le contraste des aperçus de modèles | `6b3cd9ffd544` | `fix/accessibility-template-preview-contrast-20261122` | `fix/accessibility-contrast-focus-main-20261121` |
| #132 | docs(audit): état initial et plan priorisé 22 novembre | `6543b3a70175` | `audit/initial-review-20261122` | `main` |
| #131 | docs: actualiser la feuille de route sur le main courant | `3d51f0afb669` | `docs/improvement-plan-main-20261122` | `main` |
| #130 | fix(a11y): contraste WCAG AA et focus clavier sur les deux thèmes | `0b819127cc8b` | `fix/accessibility-contrast-focus-main-20261121` | `main` |
| #129 | feat(workspace): navigation par domaines et paramètres structurés | `868027e1edc8` | `feat/workspace-settings-navigation-20261121` | `main` |
| #128 | feat(trial,workspace): essai 15 jours et organisation professionnelle | `e3b91dc4ae45` | `feat/15-day-trial-entitlements-20261121` | `main` |
| #127 | fix(pdf): pagination A4 du devis Executive (28 lignes) | `400ce60ddb8f` | `fix/quote-executive-a4-pagination-20261121` | `main` |
| #126 | feat(landing): présentation vidéo Sunupilot — portage sur main actuel | `817b10da7b85` | `integration/sunupilot-video-main-20261121` | `main` |
| #118 | feat(landing): vidéo Sunupilot — capture locale automatisée des écrans | `29dd7ccc8084` | `feature/video-presentation-spark-sunupilot` | `main` |
| #115 | test(accounting): cover expense posting and tenant isolation | `3873c1d1dbaa` | `test/ohada-expense-ledger-integrity-20261121` | `main` |
| #114 | docs: centralize SamaFacture Pro improvement roadmap | `ff2cae7bd378` | `docs/improvement-plan-20261121` | `main` |
| #110 | test(accessibility): cover light/dark keyboard navigation and contrast | `722b5bfce067` | `test/accessibility-dark-keyboard-rebased-20261120` | `main` |
| #102 | test(accessibility): couvrir le thème sombre et le parcours clavier | `86aeeb6f4be2` | `test/accessibility-dark-keyboard-20261118` | `main` |
| #99 | Adopt SunuPilot branding — indigo and baobab green | `3f70466d0b6b` | `rebrand/optigest` | `main` |

## PR fermées (125) — snapshot complet

| PR | Titre | État |
|---|---|---|
| #1 | SamaFacture Pro — modernisation UI et modules professionnels | merged |
| #2 | Modèles de factures et devis — enrichissement des informations et du rendu | merged |
| #3 | Audit correctif : sauvegardes, sécurité des sessions, paiements et quotas | not merged |
| #4 | UI polish: animations accessibles et recette visuelle responsive | merged |
| #5 | Refonte du tableau de bord SamaFacture Pro — palette et navigation | merged |
| #6 | Ajouter une cloche de notifications à la barre supérieure | merged |
| #7 | Phases 2 à 4 — Paiements réels, comptabilité OHADA et achats/stocks | merged |
| #8 | Phases 5 à 7 — Portail client, CRM, internationalisation et IA | merged |
| #9 | Build a temporary local Docker test ZIP | not merged |
| #10 | UI : navigation compacte et espace de travail élargi | merged |
| #11 | Audit UI — navigation compacte et amélioration de la visibilité | not merged |
| #12 | UI : organisation professionnelle des pages métier | merged |
| #13 | UI : organiser les pages métier comme un logiciel professionnel | not merged |
| #14 | UI : finaliser la structure professionnelle des pages métier | not merged |
| #15 | UI : harmoniser les pages métier pour un logiciel de gestion professionnel | merged |
| #16 | Fix Docker startup: single MySQL schema init and Redis readiness | merged |
| #17 | Améliorer la visibilité et la cohérence des icônes | merged |
| #18 | Professionnaliser l’interface et les documents, renforcer la responsivité et la montée en charge | merged |
| #19 | Stabiliser la CI avec des tests MySQL séquentiels | merged |
| #20 | Professionnaliser la page Abonnement et ses icônes | not merged |
| #21 | Finaliser les factures et devis imprimés en A4 | merged |
| #22 | Présenter les modèles de facture dans une galerie visuelle | not merged |
| #23 | Galerie de 19 modèles, impression fiable, WhatsApp et audit transversal | merged |
| #24 | Sécurité : révocation des sessions, correctif liaison Google, filtrag… | merged |
| #25 | Fix subscription page icons and visual regression checks | merged |
| #26 | Fix PDF worker startup ordering after API readiness | merged |
| #27 | Improve sidebar icon semantics and enforce full icon coverage | merged |
| #28 | Improve sidebar navigation accessibility | merged |
| #29 | Fix monthly invoice quota with schema migration v8 | merged |
| #30 | Add transactional monthly invoice quota with schema migration v8 | not merged |
| #31 | Harden session revocation and payment provider timeouts | merged |
| #32 | Publish complete database backups atomically | merged |
| #33 | Publish database backups only after atomic validation | not merged |
| #34 | Prevent local environment secrets from entering Docker images | not merged |
| #35 | Test that backup archives stay temporary until dump completion | merged |
| #36 | Harden invoice settlement, paid status and payment idempotency | merged |
| #37 | Exclude local secrets from Docker and require npm lockfile | merged |
| #38 | Make monthly invoice quota initialization deterministic | merged |
| #39 | Agrandir légèrement le logo et les icônes de navigation | merged |
| #40 | Ajouter cinq modèles modernes de facture et de devis | merged |
| #41 | Préparer l’archive du code fusionné sur main | not merged |
| #42 | Fiabiliser les PDF et corriger le thème système à l'impression | merged |
| #43 | Améliorer le mobile, les aperçus A4 et l’espace professionnel | merged |
| #44 | Sécurité : rendre la révocation des sessions immédiate entre workers | merged |
| #45 | Sécuriser la sauvegarde, la rétention et la restauration de la base | merged |
| #46 | fix(ui): keep mobile notifications inside viewport | merged |
| #47 | Éviter les mauvais destinataires WhatsApp pour les numéros locaux | merged |
| #48 | fix(ui): keep notifications visible above the mobile keyboard | merged |
| #49 | test(ui): cover notification placement with visual viewport offsets | merged |
| #50 | Fix: éviter la concurrence d'initialisation MySQL du worker PDF | merged |
| #51 | CI: bloquer les dépendances présentant une vulnérabilité npm | merged |
| #52 | security: redact sensitive tokens from HTTP access logs | merged |
| #53 | docs: ajouter le plan d’entreprise et la stratégie de lancement | merged |
| #54 | fix: remove Nginx upstream balancing warning | merged |
| #55 | audit: corriger la conservation des tâches PDF en attente | merged |
| #56 | fix(pdf): file durable avec acquittement et reprise, mentions paiement exactes | merged |
| #57 | fix(a11y): associer les libellés de la page Paramètres | merged |
| #59 | docs(staging): corriger la procédure Docker Compose et HTTPS | merged |
| #60 | feat(entreprise): socle multi-sociétés et cadrage de l’abonnement mensuel | merged |
| #62 | fix(entreprise): corriger la migration v10 et les invitations | not merged |
| #63 | fix(realtime): autoriser les groupes Entreprise dans les notifications | merged |
| #64 | docs(audit): documenter le risque de vérification des invitations multi-sociétés | merged |
| #65 | docs(billing): distinguer achat ponctuel et abonnement récurrent | not merged |
| #67 | docs(email): corriger le comportement SMTP local et tester la redaction | merged |
| #68 | feat: laisser le client choisir son moyen de paiement | merged |
| #69 | fix(security): vérifier l’adresse email avant le rattachement multi-sociétés | merged |
| #71 | feat(entreprise): centre de pilotage consolidé du groupe | merged |
| #72 | fix(team): sécuriser les invitations classiques par preuve email | merged |
| #73 | feat(ui): simplifier les espaces Entreprise et professionnel | merged |
| #74 | ci: exécuter le test réel de restauration des sauvegardes chiffrées | merged |
| #75 | fix(pdf): éviter les pages isolées dans les devis volumineux | merged |
| #76 | fix(pdf): améliorer la pagination des devis et factures | not merged |
| #77 | test(billing): verrouiller les abonnements récurrents non activés | merged |
| #78 | docs(billing): clarifier l’état réel des abonnements mensuels | not merged |
| #79 | feat(nav): moderniser la barre latérale et les icônes | merged |
| #80 | feat(entreprise): paginer la liste des sociétés du groupe | merged |
| #81 | feat(nav): moderniser le rail latéral avec libellés | merged |
| #82 | chore(agents): intégrer les skills design engineering | merged |
| #83 | docs(billing): cadrer l'architecture des abonnements mensuels | merged |
| #84 | feat(billing): préparer le moteur d'abonnement mensuel en simulation locale | merged |
| #85 | docs(ui): préparer les corrections responsive et animations | not merged |
| #86 | fix(ui): améliorer les interactions sidebar et Entreprise sur mobile | merged |
| #87 | feat(invoice): ajouter 3 modèles Pro et 4 modèles Entreprise | merged |
| #88 | docs(docker): clarifier le démarrage local avec Docker | merged |
| #89 | fix(ui): corriger la cohérence des thèmes clair et sombre | merged |
| #90 | fix(print): vérifier la typographie et l'impression A4 des 31 modèles | not merged |
| #91 | fix(invoice): améliorer les polices et l’impression A4 des factures et devis | merged |
| #92 | test(pdf): vérifier les polices incorporées et les marges A4 réelles | merged |
| #93 | fix(theme): garantir le contraste de l’aperçu facture en mode sombre | merged |
| #94 | test(theme): vérifier le mode sombre sur mobile | merged |
| #95 | test(theme): vérifier le mode clair sur mobile | merged |
| #96 | test(theme): vérifier le mode clair sur bureau | merged |
| #97 | fix(dashboard): améliorer la lisibilité du total des factures | merged |
| #98 | fix(responsive): corriger les tableaux au zoom 200 % | merged |
| #100 | test(visual): couvrir le zoom 200 % en thème sombre | merged |
| #101 | fix(accessibility): corriger les contrastes et auditer les 17 pages | merged |
| #103 | feat(brand): intégrer les fondations visuelles SUNUPILOT | merged |
| #104 | fix(pwa): fiabiliser le cycle de vie du service worker | merged |
| #105 | feat(dashboard): rapprocher les raccourcis de la référence Sunupilot | merged |
| #106 | test(stock): validate invoice warehouse routing | merged |
| #107 | feat(stock): route invoice movements to the selected warehouse | merged |
| #108 | fix(stock): éviter les deadlocks lors de l'initialisation du magasin principal | merged |
| #109 | fix(invoice): keep quotes available during warehouse API outages | merged |
| #111 | fix(invoice): keep print banners inside the A4 printable area | merged |
| #112 | fix(pdf): repeat company and document identity on continuation pages | merged |
| #113 | fix(pdf): preserve company date and number formats in headless PDFs | not merged |
| #116 | test(pdf): couvrir la pagination des factures longues | merged |
| #117 | fix(accounting): reverse invoice entries on cancellation and reactivation | merged |
| #119 | feat(accounting): distinguish cash and bank expense payments | merged |
| #120 | fix(accounting): reverse refund entries in cash and bank journals | merged |
| #121 | fix(pdf): préserver le cachet sur les écrans mobiles | merged |
| #122 | test(visual): fournir un QR code aux fixtures mobiles facture/devis | not merged |
| #123 | test(pdf): garantir une facture courte sur une page A4 | merged |
| #124 | fix(invoice): afficher les montants des lignes sans scroll mobile | merged |
| #125 | fix(pdf): pagination A4 cohérente des factures et devis longs | merged |
| #148 | reconcile: port trial and accounting protections (schema v22) onto current main | merged |
| #150 | feat(accounting): configure OHADA sales and expense mappings | merged |
| #151 | fix(print): preserve full-width invoice banners on A4 | merged |
| #152 | test(accounting): couvrir les correspondances OHADA des dépenses | merged |
| #158 | docs(security): corriger les conseils CORS et proxy | merged |
| #160 | fix(backup): compatible avec le compte MySQL limité de Docker | merged |
| #161 | ux(dashboard): réduire le défilement mobile des modules | merged |
| #162 | test(security): couvrir expiration et changement email des invitations equipe | merged |
| #163 | security(backup): restreindre les permissions du dossier de sauvegarde | merged |
| #165 | docs(backup): sécuriser le transfert hors serveur rclone | merged |

## Branches (178) — snapshot complet

| Branche | SHA | Protégée |
|---|---|---|
| `a11y/dashboard-skip-navigation-20261122` | `8f45795c3df5` | no |
| `a11y/mobile-sidebar-escape-focus-20261122` | `c37403034a25` | no |
| `audit/execution-report-20261122-run1` | `dc7e6f55c5f7` | no |
| `audit/execution-report-20261122-run2` | `dff61fb42a42` | no |
| `audit/execution-report-20261123-run3` | `6fa59a42ebb1` | no |
| `audit/fix-backup-and-runtime-20261110` | `9ea9a9aa00d4` | no |
| `audit/fix-enterprise-migration-invitation-20261116` | `0b93cf9e37fe` | no |
| `audit/fix-nginx-upstream-order-20261116` | `5e93abdc37d4` | no |
| `audit/fix-realtime-company-groups-20261116-run1` | `e5c3d8020b40` | no |
| `audit/fix-reset-email-docs-and-redaction-test-20261116` | `a53c96daa1c2` | no |
| `audit/initial-review-20261122` | `6543b3a70175` | no |
| `audit/invoice-pdf-typography-print-20261118` | `7cb2d43cf3aa` | no |
| `audit/npm-audit-gate-2026-11-16` | `63a344d9154b` | no |
| `audit/rapport-approfondi-2026-11-16-run2` | `1aee93310304` | no |
| `audit/securite-2026-11-15` | `9939413ad492` | no |
| `audit/security-multisocietes-review-20261116-run3` | `4acf4d365c89` | no |
| `audit/ui-runtime-pages-polish-20261113` | `094c34f33a45` | no |
| `audit/visual-viewport-offset-regression-20261116` | `f744b2039678` | no |
| `automation/audit-fixes-20261116-0150` | `a423dca17e30` | no |
| `automation/visual-viewport-notifications-20261116-0243` | `64f5b2c2ec8e` | no |
| `brand/sunupilot-identity-foundation` | `63f8eb27a5ff` | no |
| `chore/emil-design-skills-20261117` | `70f8ea190bfd` | no |
| `ci/lint-history-protection-backend-20261122` | `32d1c1f56cb9` | no |
| `ci/package-main-after-pr39-pr40` | `8c725a00cd3b` | no |
| `ci/real-restore-smoke-20261117` | `8864ab9478d0` | no |
| `ci/workspace-ui-structure-tests-20261122` | `2a09ccf8bfdb` | no |
| `docs/backup-offsite-pinned-rclone-20261122` | `76aa447d8bee` | no |
| `docs/business-plan-samafacture-pro` | `ac07f0788ee6` | no |
| `docs/correct-one-time-plan-billing-2026-11-16` | `43592f99b6f7` | no |
| `docs/fix-staging-compose-runbook-20261116` | `22c0dae280e3` | no |
| `docs/improvement-plan-20261121` | `ff2cae7bd378` | no |
| `docs/improvement-plan-main-20261122` | `3d51f0afb669` | no |
| `docs/local-docker-bootstrap-20261117` | `eeea9c4a7100` | no |
| `docs/production-env-security-guidance-20261122` | `be0f2789cceb` | no |
| `docs/subscription-monthly-architecture-20261117` | `430e2010b1be` | no |
| `docs/subscriptions-current-state-20261117` | `e618e88c7be3` | no |
| `docs/ui-polish-plans-20261117` | `137a9b01d3ea` | no |
| `feat/abonnement-choix-moyen-paiement` | `3f32787dd561` | no |
| `feat/accounting-expense-payment-mode-20261121` | `08a1c025744a` | no |
| `feat/dashboard-reference-layout` | `11d55850b647` | no |
| `feat/dashboard-reference-modules-20261119` | `f3cbbc669629` | no |
| `feat/dashboard-reference-redesign-20261112` | `6cf80f4c547b` | no |
| `feat/enterprise-command-center-20261117` | `ae7e0e8e59f0` | no |
| `feat/enterprise-company-pagination-20261117` | `3b8d8ebc171b` | no |
| `feat/enterprise-multi-company-foundation-20261116` | `c19e12959de8` | no |
| `feat/enterprise-page-structure-2026-11-13` | `e39910166ba4` | no |
| `feat/enterprise-page-structure-v2-2026-11-13` | `745a98b586ef` | no |
| `feat/enterprise-pages-v2-2026-11-13` | `e9992176d76f` | no |
| `feat/enterprise-workspace-ux-20261117` | `14cdd3c48c0b` | no |
| `feat/invoice-stock-warehouse-20261119` | `30bcfaa58ebf` | no |
| `feat/invoice-template-gallery-2026-11-15-v2` | `570bf60cad5f` | no |
| `feat/invoice-template-gallery-2026-11-15` | `70d95aac18e3` | no |
| `feat/invoice-templates-pro-enterprise-20261117` | `4de3da440926` | no |
| `feat/invoice-warehouse-stock-20261119` | `e9ac3c69d928` | no |
| `feat/invoice-warehouse-stock-main-20261119` | `158a9e0663d1` | no |
| `feat/monthly-invoice-quota-v8-2026-11-15` | `f3b2690913b9` | no |
| `feat/ohada-account-mappings-20261122` | `ca3cb8fbf594` | no |
| `feat/phases-2-4-paiements-compta-achats-20261112` | `f028da580224` | no |
| `feat/phases-5-7-portal-international-automation-20261112` | `a3a43402f59d` | no |
| `feat/professional-subscription-page-2026-11-15` | `cf58665a9083` | no |
| `feat/responsive-scaling-2026-11-15` | `f7d10afed88a` | no |
| `feat/sidebar-icon-label-navigation-20261117` | `c8bc6af9181b` | no |
| `feat/sidebar-navigation-visual-refresh-20261117` | `314c06e7e9ec` | no |
| `feat/subscription-engine-local-simulation-20261117` | `c077af1465c2` | no |
| `feat/sunupilot-dashboard-reference` | `11d55850b647` | no |
| `feat/templates-factures-devis-complets` | `81aa9fa67012` | no |
| `feat/topbar-notifications-bell-20261112` | `a36472e66f18` | no |
| `feat/ui-motion-visual-recette-20261112` | `1ae8c307b3cf` | no |
| `feat/workspace-settings-navigation-20261121` | `868027e1edc8` | no |
| `feat/5-nouveaux-modeles-facture` | `342a3e43c5b8` | no |
| `feat/15-day-trial-entitlements-20261121` | `e3b91dc4ae45` | no |
| `feature/ohada-expense-account-mappings-20261122` | `6f82b82dfab5` | no |
| `feature/video-presentation-spark-sunupilot` | `29dd7ccc8084` | no |
| `fix/a11y-settings-labels-20261116` | `4b275916eefa` | no |
| `fix/accessibility-contrast-focus-main-20261121` | `0b819127cc8b` | no |
| `fix/accessibility-template-preview-contrast-20261122` | `6b3cd9ffd544` | no |
| `fix/accounting-event-audit-retention-v22-20261122` | `90b718abcbef` | no |
| `fix/accounting-event-audit-retention-v22-run2-20261122` | `5b6ba8bf3b05` | no |
| `fix/accounting-invoice-cancellation-reversal-20261121` | `ba756d098884` | no |
| `fix/accounting-refund-journal-reversal-20261121` | `b45f47975434` | no |
| `fix/atomic-backup-publish-2026-11-15` | `081d93123608` | no |
| `fix/atomic-encrypted-backups-2026-11-15` | `03a36a61b7c4` | no |
| `fix/audit-devise-relances-escape` | `4e848f3b98b1` | no |
| `fix/backup-directory-permissions-20261122` | `1c3a12bacd9c` | no |
| `fix/backup-retention-guard-2026-11-16` | `e277ca8a8412` | no |
| `fix/ci-serial-tests-2026-11-15` | `4a74afa8dcea` | no |
| `fix/client-delete-history-protection-20261122` | `f2aada8d5c01` | no |
| `fix/dashboard-donut-count-20261118` | `2d4d7619350a` | no |
| `fix/docker-context-secrets-and-lockfile-2026-11-15` | `52d4b81b3ff8` | no |
| `fix/docker-local-startup-mysql-redis-swagger` | `2f021548666e` | no |
| `fix/enterprise-badge-contrast-main-20261122` | `52021018d789` | no |
| `fix/enterprise-invitation-email-proof-20261116` | `4347d572f4e7` | no |
| `fix/expense-ledger-protection-20261122` | `4e0f2a893812` | no |
| `fix/invoice-delete-history-guard-20261122` | `2c7f3cbde915` | no |
| `fix/invoice-footer-stamp-mobile-20261121` | `7c562612e897` | no |
| `fix/invoice-mobile-table-cards-20261121` | `67f7721d5123` | no |
| `fix/invoice-pdf-continuation-identity-20261121` | `885b7b42a7d4` | no |
| `fix/invoice-print-and-payment-stamp-2026-11-15` | `ed6c1467affe` | no |
| `fix/invoice-print-banner-geometry-20261121` | `0ec7c3eeb59f` | no |
| `fix/invoice-print-banner-spacing-20261122` | `4eec7b226911` | no |
| `fix/invoice-print-typography-20261118` | `d8805a202dd9` | no |
| `fix/invoice-settlement-integrity-2026-11-15` | `30318cf3cf48` | no |
| `fix/invoice-stock-principal-warehouse` | `383c885a969b` | no |
| `fix/light-dark-theme-consistency-20261118` | `bf497de04d01` | no |
| `fix/mobile-invoice-line-columns` | `9019ec2dfca2` | no |
| `fix/monthly-invoice-quota-schema-v8-2026-11-15` | `69028f5946e9` | no |
| `fix/mysql-backup-limited-privileges-20261122` | `bdca6bec1c5b` | no |
| `fix/navigation-compact-sidebar-2026-11-13` | `508607c7cc69` | no |
| `fix/pdf-headless-user-formatting-20261121` | `862d31a76342` | no |
| `fix/pdf-pagination-extras-flow-20261117` | `2e7dd32a3eec` | no |
| `fix/pdf-print-pagination-20261117` | `b8e344915cea` | no |
| `fix/pdf-stream-ack-payment-disclosures-20261116` | `a576e5e1fec8` | no |
| `fix/pdf-worker-db-readiness-2026-11-16` | `59d341a15462` | no |
| `fix/pdf-worker-health-and-sidebar-icons-2026-11-15` | `04304461cafa` | no |
| `fix/pdf-worker-wait-for-api-health-2026-11-15` | `941f235f5f4b` | no |
| `fix/pro-orders-tenant-currency-20261123` | `e7a2bcd3818d` | no |
| `fix/pro-workspace-status-contrast-20261122` | `baa9ea6a6881` | no |
| `fix/product-delete-stock-history-protection-20261122` | `27d5a6c27d5d` | no |
| `fix/purchase-receipt-warehouse-deadlock-20261119` | `f0f43c3d1e7a` | no |
| `fix/quota-registry-initialization-robustness-2026-11-15` | `c8ea3204dcdc` | no |
| `fix/quote-executive-a4-pagination-20261121` | `400ce60ddb8f` | no |
| `fix/quote-warehouse-resilience-20261120` | `8d0a4d299017` | no |
| `fix/refund-payment-method-mapping-20261122` | `3265810b25f3` | no |
| `fix/refund-payment-method-mapping-rebased-20261122` | `17d25a5e3686` | no |
| `fix/revoke-jwt-on-logout-2026-11-15` | `a20939278417` | no |
| `fix/session-revocation-and-payment-timeouts-2026-11-15` | `46f280761b61` | no |
| `fix/sidebar-aria-current-2026-11-15` | `1066c1c4d02e` | no |
| `fix/subscription-disabled-state-tests-docs-20261117` | `60f57e272b27` | no |
| `fix/subscription-icons-main-2026-11-15` | `3316731d6119` | no |
| `fix/sunupilot-pwa-lifecycle` | `86da24a1c6e8` | no |
| `fix/team-invitation-email-proof-20261117` | `8e1b84dffe59` | no |
| `fix/ui-icons-legibility-2026-11-15` | `0d7c5390f474` | no |
| `fix/ui-responsive-polish-20261117` | `5efe69b69853` | no |
| `fix/visual-qr-fixture-20261121` | `df6070e367ae` | no |
| `fix/webhook-local-timezone-dynamic-currency-20261123` | `b07000daa766` | no |
| `fix/whatsapp-country-guard-2026-11-16` | `a49756cd21ec` | no |
| `improve/pdf-page3-balance-20261121` | `115ab9f0e2f1` | no |
| `improve/pdf-page3-balance-main-20261121` | `3bab7c770052` | no |
| `integration/main-company-invitation-email-proof-20261117` | `70750be430c8` | no |
| `integration/reconcile-main-v21-20261122` | `e8b2dc9c6f20` | no |
| `integration/schema-v21-accounting-trial-20261122` | `decb8da2e48e` | no |
| `integration/schema-v22-main-reconciled-20261122` | `62ea473892b1` | no |
| `integration/sunupilot-video-main-20261121` | `817b10da7b85` | no |
| `main` | `b43a94fc2937` | yes |
| `qa/test-pdf-24-modeles` | `d3b70a09c598` | no |
| `rebase/pr106-main-20261121-run1` | `383c885a969b` | no |
| `rebase/pr110-main-20261121-run1` | `ca1d1abdc9c6` | no |
| `rebrand/optigest` | `3f70466d0b6b` | no |
| `reconciliation/schema-v21-main-base-20261122` | `d9c428aaa916` | no |
| `security/docker-ignore-local-secrets-2026-11-15` | `4d2c20e28ee2` | no |
| `security/immediate-session-revocation-2026-11-16` | `d6887ce043b8` | no |
| `security/invoice-list-verification-code-redaction-20261122` | `1c6bf875b982` | no |
| `security/redact-secret-urls-in-logs-2026-11-16` | `d27f55b581ba` | no |
| `test/accessibility-audit-business-pages-20261118` | `468caba29865` | no |
| `test/accessibility-dark-keyboard-20261118` | `86aeeb6f4be2` | no |
| `test/accessibility-dark-keyboard-rebased-20261120` | `722b5bfce067` | no |
| `test/backup-atomic-visibility-2026-11-15` | `f4c463e5ec76` | no |
| `test/dark-theme-zoom-200-sweep-20261118` | `6fe85dfd3076` | no |
| `test/expense-accounting-mappings-regression-20261122` | `46d95cfd1e0d` | no |
| `test/free-trial-expiry-session-guard-20261122` | `29932fbbefe3` | no |
| `test/invoice-long-pdf-pagination-20261121` | `41fb9896ab4b` | no |
| `test/invoice-short-pdf-one-page-20261121` | `c592c7046f78` | no |
| `test/invoice-short-pdf-one-page-main-20261121` | `f49d35212535` | no |
| `test/ohada-expense-ledger-integrity-20261121` | `3873c1d1dbaa` | no |
| `test/pdf-font-embedding-and-visual-print-20261118` | `42b5a0bcf439` | no |
| `test/security-auth-reset-token-redaction-20261122` | `a10bc748a38b` | no |
| `test/team-invitation-expiry-email-change-20261122` | `4fa9a6878a98` | no |
| `test/theme-dark-mobile-sweep-20261118` | `55c985deecd6` | no |
| `test/theme-dark-sweep-20261118` | `7bd4d2e94fe0` | no |
| `test/theme-light-desktop-sweep-20261118` | `dfe8ce45fdb4` | no |
| `test/theme-light-mobile-sweep-20261118` | `b77108576d2c` | no |
| `test/workspace-zoom-200-sweep-20261118` | `dd64ea0274ce` | no |
| `tooling/local-docker-test-bundle-20261112` | `b88eeebb659d` | no |
| `ui/augmenter-logo-icones-sidebar` | `63af3d94dc35` | no |
| `ui/modern-responsive-polish` | `a2faa30e320e` | no |
| `ux/dashboard-mobile-module-rail-20261122` | `53eadfe851b4` | no |
| `ux/pro-workspace-mobile-domain-rail-20261122` | `185e0487c954` | no |
| `ux/settings-company-fields-grid-20261122` | `99670cdf2969` | no |

## 15 derniers commits main

| SHA | Date UTC | Message |
|---|---|---|
| `b43a94fc2937` | 2026-11-22T23:00:10Z | docs(backup): sécuriser le transfert hors serveur rclone |
| `e6a2caf04f06` | 2026-11-22T22:43:06Z | Merge pull request #163 from morn53426-ui/fix/backup-directory-permissions-20261122 |
| `1c3a12bacd9c` | 2026-11-22T22:36:47Z | Merge latest main invitation-security test into backup directory hardening |
| `596b3311f12c` | 2026-11-22T22:33:54Z | test(security): couvrir expiration et changement email des invitations equipe (#162) |
| `b8df6bfac18e` | 2026-11-22T22:27:19Z | Merge dashboard update and keep backup permission lint target |
| `cc728a65336a` | 2026-11-22T22:26:11Z | Merge dashboard module rail and main into backup directory permissions fix |
| `8d0f287f46a9` | 2026-11-22T22:24:22Z | ux(dashboard): réduire le défilement mobile des modules (#161) |
| `f3844b627efc` | 2026-11-22T22:17:53Z | fix(sync): conserver server/.env.example de main |
| `1d42ba738607` | 2026-11-22T22:17:22Z | fix(sync): conserver le modèle .env courant de main |
| `d6a054483a11` | 2026-11-22T22:16:41Z | Merge latest main into backup directory permissions hardening |
| `06c3589daf5f` | 2026-11-22T22:16:08Z | Merge latest main while preserving private backup directory permissions |
| `5f1c09d655b3` | 2026-11-22T22:15:02Z | docs(security): corriger les conseils CORS et proxy (#158) |
| `db790c1d25cd` | 2026-11-22T22:08:02Z | refactor(backup): supprimer le mkdir redondant |
| `620b919b8f31` | 2026-11-22T22:07:00Z | Merge main and MySQL backup permissions into backup-directory-permissions |
| `d736f90ee003` | 2026-11-22T22:06:18Z | fix(backup): compatible avec le compte MySQL limité de Docker (#160) |

## Planning P0–P3

| Priorité | Lot | Gate |
|---|---|---|
| P0 | Résoudre timeout cleanup #171 et tests exacts | Suite complète green sur SHA, rebase stack, revue humaine |
| P0 | #167 XSS/scheduler tests | CI exacte green, revue sécurité humaine |
| P0 | #168 race changement devise | Sérialisation transactionnelle, test concurrent, CI exacte |
| P0 | #159/#164 sécurité | Rebase main, revue diff, CI exacte, validation humaine |
| P1 | #149 mapping OHADA | Migration 013/v24, FK tenant, upgrade/replay, validation humaine OHADA |
| P1 | Intégration v21/v22 | Réconcilier migrations/écritures, idempotence, historique; validation humaine |
| P2 | UX, accessibilité, impression/PDF | petites PR, tests responsive/print |
| P3 | Branding, documentation, vidéo | après stabilisation |

## Risques / décisions

1. Timeout CI #171 sur head initial; correctif cleanup sur nouveau head, CI tests encore en cours.
2. Race concurrente devise #168 non résolue.
3. #149 migration versioning bloquant.
4. #159/#164 base stale; CI green sur SHA ancien ne valide pas rebase.
5. #167 XSS/scheduler tests à compléter; approbation humaine manquante.
6. Branch protection classique 403; ruleset confirmé, 0 approval imposée par config.
7. CI des PR ouvertes n'a pas été auditée individuellement dans ce run; tableau branches/PR est inventaire, pas certificat de tests.
8. Main CI exact green; aucune fusion effectuée dans ce run.

## Préservation

- branches, données, volumes, backups et historique comptable préservés.
- Aucun push direct/force push main; aucune suppression; aucun bypass.
- Aucun paiement réel, déploiement production, migration ou opération destructive.
- Les rapports run1 (#166), run2 (#169), run3 (#170) sont conservés; ce fichier run4 est un nouveau rapport, sans écrasement.


## Mise à jour post-snapshot (23 novembre, 02:08 UTC)

- PR #171 head précédent `e7a2bcd3818da6cf015c06855b62da7a2697d132` : CI **3/3 green**. Tests Node/MySQL, ESLint, ZIP; restauration chiffrée réelle, smoke cluster, recette responsive **147 captures sur 7 largeurs**. Le timeout précédent sur `9b70c35fef2e12726274ae4b726ca50c5e54b8e3` est corrigé par l’ordre de cleanup (suppression explicite commandes test avant utilisateur).
- Revue complémentaire a trouvé `server/tests/setup.js` absent de la liste ESLint. Correction ajoutée à #171, commit `953489e79a9a6779b03e9c436559b925904f5635`, ajout du helper cleanup et du workflow lint lui-même dans les paths/commande. **CI du nouveau SHA en cours** (Tests Node/MySQL, ZIP, ESLint); ne pas utiliser les résultats de `e7a2bcd` comme validation du nouveau head.
- PR #172 (ce rapport) : ZIP green sur `75c5e9917b89c7bb22ea7d24f3da941685538ec2`, Tests Node/MySQL en cours. Cette mise à jour documentaire déclenchera une nouvelle CI sur son head.
- Aucun merge; approbation indépendante humaine toujours requise pour les PR applicatives et sécurité.
