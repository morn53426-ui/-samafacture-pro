# Rapport d'audit et d'exécution — Run 20 — 23 novembre 2026

> Rapport **nouveau et append-only**. Les rapports Runs 1–19 et les PR historiques restent intacts. Inventaire des branches/PR pris juste avant la création de cette branche de rapport.

## 1. État du dépôt

- Dépôt : [morn53426-ui/-samafacture-pro](https://github.com/morn53426-ui/-samafacture-pro)
- Branche par défaut : `main`; dépôt public, non archivé.
- Main exact au début de ce run : [`047e7badf4fccd91644af74e0968089b23246c93`](https://github.com/morn53426-ui/-samafacture-pro/commit/047e7badf4fccd91644af74e0968089b23246c93)
- Commit parent : `f8a61187e8b8df7dc319d611dd58fb02dd0aa336`.
- Inventaire : **212 branches**, **54 PR ouvertes**, **145 PR fermées** (113 fusionnées, 32 fermées sans fusion), **3 issues ouvertes**.
- Le nombre de PR ouvertes est issu de l'API Pull Requests `state=open`; les PR ne sont pas confondues avec les issues.

## 2. Merge réalisé pendant ce run

### PR #202 — contraste du badge Entreprise (P2)

- [PR #202](https://github.com/morn53426-ui/-samafacture-pro/pull/202), head exact `268ccf303e4332f47e73910043f601e4083b97e0`, base exacte `f8a61187e8b8df7dc319d611dd58fb02dd0aa336`.
- Diff : `public/parametres.html`, `server/tests/visual/recette-visuelle.js`; aucun DDL, API, calcul financier, donnée, paiement ou historique comptable.
- Revue technique statique enregistrée en COMMENT GitHub (review id 6023496393), thread non résolu : aucun.
- Contraste calculé : **6,61:1 clair**, **8,39:1 sombre**; recette Chromium réelle couvre clair, sombre choisi et sombre système.
- CI sur head exact : Tests #45191709097 **success**, ESLint #45191708824 **success**, ZIP #45191708650 **success**.
- PR sortie du Draft puis fusion squash à 14:35:23 UTC; commit de merge [`047e7badf4fccd91644af74e0968089b23246c93`](https://github.com/morn53426-ui/-samafacture-pro/commit/047e7badf4fccd91644af74e0968089b23246c93). Branche conservée (suppression automatique après merge désactivée).

## 3. CI post-fusion — commit exact main

Workflow push Tests automatisés #45195824844 : [run](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45195824844), SHA `047e7badf4fccd91644af74e0968089b23246c93`.

Snapshot à la rédaction :
- Validation Docker Compose, construction image avec sentinel secrets, npm ci, Chromium, audit npm, script smoke : **success**.
- Tests Node.js/MySQL : **success**.
- Restauration réelle de sauvegarde chiffrée : **success**.
- Smoke cluster MySQL/Redis : **success**.
- Recette visuelle responsive : **in_progress** au snapshot; publication des captures dépend de cette étape.
- Le workflow ZIP et ESLint ne sont pas déclenchés sur push main (PR-only / path-filtered). Leur succès PR #202 est exact au head PR, non présenté comme post-merge.

**Aucune fusion suivante avant la completion et le succès de la recette visuelle sur `047e7badf4fccd91644af74e0968089b23246c93`.** Si cette recette échoue, arrêt des fusions et diagnostic.

## 4. Règles de protection observées

Ruleset actif [#27410527 « protect main »](https://github.com/morn53426-ui/-samafacture-pro/rules/27410527), scope `refs/heads/main` :
- suppression de branche et non-fast-forward interdits;
- PR obligatoire, conversations de revue résolues, contrôle des changements non attribués;
- checks requis : `Tests Node.js et MySQL`, `Build complete source archive`;
- 0 approbation requise par paramètre du ruleset; aucun bypass actor; `current_user_can_bypass=never`.
- L'endpoint branch-protection classique retourne 403 « Resource not accessible by integration »; seule la lecture du ruleset est confirmée.
- Repo : squash/merge/rebase permis; auto-merge désactivé; branche supprimée après merge désactivée.

## 5. Revue des candidats prioritaires

| PR | SHA head vérifié | Base / divergence actuelle | CI sur SHA exact | Décision |
|---|---|---|---|---|
| #194 [tenant/security](https://github.com/morn53426-ui/-samafacture-pro/pull/194) | `900163220356db9c443e11e5f6208760d49a62f2` | base `c0a3b569…`; **2 commits behind main**, 20 ahead, 12 fichiers | Tests #45188705205 success; ESLint #45188705209 success; ZIP #45188705073 success | Draft; revue COMMENT #6023556666; validation humaine sécurité obligatoire; synchroniser et rerun CI |
| #203 [verification_code](https://github.com/morn53426-ui/-samafacture-pro/pull/203) | `2059e3744ce88eface5c00e52c459c7e6edc5235` | base `f8a61187…`; 1 behind, 6 commits | #45191717740 Tests success; #45191717706 ESLint success; #45191717720 ZIP success | Sous-ensemble de #194; ne pas fusionner séparément |
| #199 [refund tenant join](https://github.com/morn53426-ui/-samafacture-pro/pull/199) | `b212dbc0bac111c77023c1ad42c58514786aeaca` | base `b0b52e66…`; 3 behind, 3 commits | #45156601143 Tests success; #45156601267 ESLint success; #45156601096 ZIP success | Doublon inclus dans #194; ne pas fusionner séparément |
| #192 [currency locking](https://github.com/morn53426-ui/-samafacture-pro/pull/192) | `8a11e00bb976979403e9d3fcfa8e767a074b5423` | base `b0b52e66…`; 3 behind, 11 commits/11 fichiers | #45138383987 Tests success; #45138383956 ESLint success; #45138383828 ZIP success | Draft; commentaire de revue #6023561470; lot financier, validation OHADA humaine obligatoire |
| #142 [schema v21 trial/accounting](https://github.com/morn53426-ui/-samafacture-pro/pull/142) | `decb8da2e48e8f7a93fc63202f00fe0b4170e6e2` | base `8453ee6d…`; 102 behind, 77 commits/48 fichiers | #45027909669 Tests success; #45027909637 ESLint success; #45027909640 ZIP success | Stack très divergente; migrations v21 déjà dans main v23; ne pas fusionner sans réconciliation et validation humaine |
| #145 [schema v22 retention](https://github.com/morn53426-ui/-samafacture-pro/pull/145) | `5b6ba8bf3b05e4155697159c60cf4b5051196bf8` | empilée sur #142; 102 behind, 92 ahead, 15 commits/7 fichiers | #45029642007 Tests success; #45029642012 ESLint success; #45029642014 ZIP success | Stack historique; main inclut déjà v22; préservation historique comptable, validation humaine |
| #201 [rapport Run 15](https://github.com/morn53426-ui/-samafacture-pro/pull/201) | `63493905494fc1e1a54d9e277c03aba34c1e2b31` | base `f8a61187…`; désormais 2 behind main | #45192646532 Tests success; #45192646558 ZIP success | Rapport historique Draft, ne pas écraser; nouveau Run 20 préparé |

Revue statique de #194 : joins tenant-aware dans factures, clients, dashboard, rapports, assistant, récurrents, paiements/checkout, liens publics et remboursements; listes masquent `verification_code`, détail authentifié conserve ce champ, fixtures cross-tenant testées avec restauration en `finally`. Aucun défaut bloquant évident dans le périmètre relu, mais cela ne remplace pas la validation humaine de sécurité.

## 6. Migrations et compatibilité

Main `CURRENT_SCHEMA_VERSION=23` :
- v21 : dates UTC et essai 15 jours, sans attribution rétroactive;
- v22 : retire la FK facture→événement comptable afin de préserver les événements de contrepassation en cas de suppression exceptionnelle de facture (FK tenant→users conservée);
- v23 : index composé `(id,user_id)` des comptes et table `pro_compta_correspondances` avec FK composite tenant-aware (migration 012).
- Migrations 003–012 présentes; la migration 012 est additive et idempotente (`CREATE TABLE IF NOT EXISTS`). Les lots #142/#145 sont des branches très divergentes et ne doivent pas être fusionnés en doublon. Toute modification de DDL/historique comptable exige validation humaine.

## 7. Workflows CI

- `.github/workflows/test.yml` : PR + push main; Node 26, MySQL 8/Redis, compose validation, Docker image secrets sentinel, npm audit strict, tests Node en concurrence 1, restore smoke chiffré, smoke cluster, recette responsive.
- `.github/workflows/lint.yml` : ESLint JS ciblé sur PR par filtres de chemins.
- `.github/workflows/package-source-zip.yml` : ZIP complet et `unzip -t` sur PR uniquement.
- CI post-merge main : tests push uniquement; archive ZIP n'est pas exécutée sur main.

## 8. Plan P0–P3

| Priorité | Lot | Prochaines actions / critères |
|---|---|---|
| **P0** | Isolation tenant + codes publics (#194) | Synchroniser sur main exact sans force-push; rerun tests/lint/ZIP sur nouveau SHA; revue indépendante; validation humaine sécurité; vérifier 404/public/détail/listes et accessibilité des clients UI avant merge |
| **P1** | Devise de base / verrou concurrent (#192) | Synchroniser; rerun tests de concurrence; revue OHADA; valider invariant premier document/commande/dépense/produit/récurrent/API; validation humaine |
| **P1** | Historique comptable v22, essai v21, mappings v23 | Réconcilier les branches historiques (#142/#145) avec main v23; revue migrations et sauvegarde; validation humaine avant DDL/historique |
| **P1** | Remboursements et intégrité tenant (#199) | Consolidé dans #194; ne pas merger doublon; réauditer fixtures et relations |
| **P1** | Sauvegarde/restauration & Docker | CI post-merge en cours; préserver backups/volumes; smoke staging non-prod seulement |
| **P2** | UX/accessibilité/print/mobile | #202 badge contrast merged; sélectionner les PRs actuelles, synchroniser, recette Chromium clair/sombre/mobile, pas de merge d'anciennes branches divergentes |
| **P3** | Docs/branding/vidéo/abonnements récurrents | Continuer doc append-only; fournisseurs/mandats récurrents restent bloqués tant que consentement et autorisation écrite non validés |

## 9. Issues ouvertes (paiements)

| Issue | Sujet | État |
|---|---|---|
| [#70](https://github.com/morn53426-ui/-samafacture-pro/issues/70) | feat: préparer le moteur d’abonnements mensuels avec renouvellement opt-in | enhancement |
| [#66](https://github.com/morn53426-ui/-samafacture-pro/issues/66) | billing: sélectionner et valider un vrai fournisseur de paiement récurrent | enhancement |
| [#61](https://github.com/morn53426-ui/-samafacture-pro/issues/61) | P1 — valider le prélèvement récurrent mensuel des plans SaaS | enhancement, payments, priority:p1 |

Aucun paiement réel, mandat récurrent ou déploiement production n'est activé par ce run.

## 10. Historique main récent (12 commits)

| SHA | Message | Date UTC |
|---|---|---|
| [`047e7badf4fc`](https://github.com/morn53426-ui/-samafacture-pro/commit/047e7badf4fccd91644af74e0968089b23246c93) | fix(a11y): badge Entreprise lisible en thème sombre | 2026-11-23T14:35:22Z |
| [`f8a61187e8b8`](https://github.com/morn53426-ui/-samafacture-pro/commit/f8a61187e8b8df7dc319d611dd58fb02dd0aa336) | a11y(dashboard): keyboard skip link on current main | 2026-11-23T14:03:46Z |
| [`c0a3b569e3e6`](https://github.com/morn53426-ui/-samafacture-pro/commit/c0a3b569e3e685183376be8428c4696d8c767ccd) | a11y(navigation): close mobile sidebar with Escape | 2026-11-23T11:59:09Z |
| [`b0b52e660af6`](https://github.com/morn53426-ui/-samafacture-pro/commit/b0b52e660af61fa781dc9a761165dd72977f969a) | fix(mobile): validate Capacitor public HTTPS before native builds | 2026-11-23T08:22:09Z |
| [`b276eba52b51`](https://github.com/morn53426-ui/-samafacture-pro/commit/b276eba52b5179f351efe68d18cf540a170c70fd) | test(security): cover reset token hash redaction | 2026-11-23T08:09:51Z |
| [`262707e11d6f`](https://github.com/morn53426-ui/-samafacture-pro/commit/262707e11d6f362820bf07018647df4312791444) | ci(lint): include auth reset token redaction tests | 2026-11-23T08:00:09Z |
| [`aa4bf4f64c4b`](https://github.com/morn53426-ui/-samafacture-pro/commit/aa4bf4f64c4be58c4ad69064f4ef58f8411450a2) | test(security): cover reset token hash redaction on current main | 2026-11-23T08:00:07Z |
| [`13111355a0d2`](https://github.com/morn53426-ui/-samafacture-pro/commit/13111355a0d2bc71ee0f3a01b504179b2d136926) | fix: fuseau local, devise du tenant et isolation | 2026-11-23T07:58:23Z |
| [`19fcafb0be02`](https://github.com/morn53426-ui/-samafacture-pro/commit/19fcafb0be02c261ea799236fed046bdce80a291) | fix: devises, relances et échappement HTML | 2026-11-23T07:57:52Z |
| [`b43a94fc2937`](https://github.com/morn53426-ui/-samafacture-pro/commit/b43a94fc2937b0108077501a0260358c8569e11f) | docs(backup): sécuriser le transfert hors serveur rclone | 2026-11-22T23:00:10Z |
| [`e6a2caf04f06`](https://github.com/morn53426-ui/-samafacture-pro/commit/e6a2caf04f0648d30419042c97cb63b6a14a05f8) | Merge pull request #163 from morn53426-ui/fix/backup-directory-permissions-20261122 | 2026-11-22T22:43:06Z |
| [`1c3a12bacd9c`](https://github.com/morn53426-ui/-samafacture-pro/commit/1c3a12bacd9c6a761247756562ea77ebe50ef41d) | Merge latest main invitation-security test into backup directory hardening | 2026-11-22T22:36:47Z |

## 11. PR fermées — résumé

- **145 fermées**, dont **113 fusionnées**, **32 fermées sans merge**.
- Dernières fermées : #202 (merge badge), #200 (Échap menu mobile), #197 (skip link), #191/#189/#186/#184 (tentatives abandonnées), #187 (préflight mobile merge), #181 (redaction reset token merge), #174/#173 (branches mobile abandonnées), #168/#167 (devise/fuseau/escape merge), #165 (backup docs merge), #163 (permissions backup merge), #162/#161/#160 (invitations/dashboard/backup merge), #159 (redaction ancienne tentative non merge), #158 (guidance proxy merge), #152/#151/#150 (OHADA/print merge).

## 12. Inventaire complet des branches (snapshot 212)

1. `a11y/dashboard-skip-link-main-current-run13`
2. `a11y/dashboard-skip-navigation-20261122`
3. `a11y/mobile-sidebar-escape-focus-20261122`
4. `a11y/sidebar-escape-main-current-run15`
5. `audit/execution-report-20261122-run1`
6. `audit/execution-report-20261122-run2`
7. `audit/execution-report-20261123-run3`
8. `audit/execution-report-20261123-run4`
9. `audit/execution-report-20261123-run5`
10. `audit/execution-report-20261123-run6`
11. `audit/execution-report-20261123-run11`
12. `audit/execution-report-20261123-run12`
13. `audit/execution-report-20261123-run13`
14. `audit/execution-report-20261123-run14`
15. `audit/execution-report-20261123-run15`
16. `audit/fix-backup-and-runtime-20261110`
17. `audit/fix-enterprise-migration-invitation-20261116`
18. `audit/fix-nginx-upstream-order-20261116`
19. `audit/fix-realtime-company-groups-20261116-run1`
20. `audit/fix-reset-email-docs-and-redaction-test-20261116`
21. `audit/initial-review-20261122`
22. `audit/invoice-pdf-typography-print-20261118`
23. `audit/npm-audit-gate-2026-11-16`
24. `audit/rapport-approfondi-2026-11-16-run2`
25. `audit/securite-2026-11-15`
26. `audit/security-multisocietes-review-20261116-run3`
27. `audit/ui-runtime-pages-polish-20261113`
28. `audit/visual-viewport-offset-regression-20261116`
29. `automation/audit-fixes-20261116-0150`
30. `automation/visual-viewport-notifications-20261116-0243`
31. `brand/sunupilot-identity-foundation`
32. `chore/emil-design-skills-20261117`
33. `ci/lint-history-protection-backend-20261122`
34. `ci/package-main-after-pr39-pr40`
35. `ci/real-restore-smoke-20261117`
36. `ci/workspace-ui-structure-tests-20261122`
37. `docs/backup-offsite-pinned-rclone-20261122`
38. `docs/business-plan-samafacture-pro`
39. `docs/correct-one-time-plan-billing-2026-11-16`
40. `docs/fix-staging-compose-runbook-20261116`
41. `docs/improvement-plan-20261121`
42. `docs/improvement-plan-main-20261122`
43. `docs/local-docker-bootstrap-20261117`
44. `docs/production-env-security-guidance-20261122`
45. `docs/subscription-monthly-architecture-20261117`
46. `docs/subscriptions-current-state-20261117`
47. `docs/ui-polish-plans-20261117`
48. `feat/abonnement-choix-moyen-paiement`
49. `feat/accounting-expense-payment-mode-20261121`
50. `feat/dashboard-reference-layout`
51. `feat/dashboard-reference-modules-20261119`
52. `feat/dashboard-reference-redesign-20261112`
53. `feat/enterprise-command-center-20261117`
54. `feat/enterprise-company-pagination-20261117`
55. `feat/enterprise-multi-company-foundation-20261116`
56. `feat/enterprise-page-structure-2026-11-13`
57. `feat/enterprise-page-structure-v2-2026-11-13`
58. `feat/enterprise-pages-v2-2026-11-13`
59. `feat/enterprise-workspace-ux-20261117`
60. `feat/invoice-stock-warehouse-20261119`
61. `feat/invoice-template-gallery-2026-11-15-v2`
62. `feat/invoice-template-gallery-2026-11-15`
63. `feat/invoice-templates-pro-enterprise-20261117`
64. `feat/invoice-warehouse-stock-20261119`
65. `feat/invoice-warehouse-stock-main-20261119`
66. `feat/mobile-config-preflight`
67. `feat/monthly-invoice-quota-v8-2026-11-15`
68. `feat/ohada-account-mappings-20261122`
69. `feat/phases-2-4-paiements-compta-achats-20261112`
70. `feat/phases-5-7-portal-international-automation-20261112`
71. `feat/professional-subscription-page-2026-11-15`
72. `feat/responsive-scaling-2026-11-15`
73. `feat/sidebar-icon-label-navigation-20261117`
74. `feat/sidebar-navigation-visual-refresh-20261117`
75. `feat/subscription-engine-local-simulation-20261117`
76. `feat/sunupilot-dashboard-reference`
77. `feat/templates-factures-devis-complets`
78. `feat/topbar-notifications-bell-20261112`
79. `feat/ui-motion-visual-recette-20261112`
80. `feat/workspace-settings-navigation-20261121`
81. `feat/5-nouveaux-modeles-facture`
82. `feat/15-day-trial-entitlements-20261121`
83. `feature/ohada-expense-account-mappings-20261122`
84. `feature/video-presentation-spark-sunupilot`
85. `fix/a11y-settings-labels-20261116`
86. `fix/accessibility-contrast-focus-main-20261121`
87. `fix/accessibility-template-preview-contrast-20261122`
88. `fix/accounting-event-audit-retention-v22-20261122`
89. `fix/accounting-event-audit-retention-v22-run2-20261122`
90. `fix/accounting-invoice-cancellation-reversal-20261121`
91. `fix/accounting-refund-journal-reversal-20261121`
92. `fix/atomic-backup-publish-2026-11-15`
93. `fix/atomic-encrypted-backups-2026-11-15`
94. `fix/audit-devise-relances-escape`
95. `fix/backup-directory-permissions-20261122`
96. `fix/backup-retention-guard-2026-11-16`
97. `fix/ci-serial-tests-2026-11-15`
98. `fix/client-delete-history-protection-20261122`
99. `fix/dashboard-donut-count-20261118`
100. `fix/docker-context-secrets-and-lockfile-2026-11-15`
101. `fix/docker-local-startup-mysql-redis-swagger`
102. `fix/enterprise-badge-contrast-current-main-run19-20261123`
103. `fix/enterprise-badge-contrast-main-20261122`
104. `fix/enterprise-invitation-email-proof-20261116`
105. `fix/expense-ledger-protection-20261122`
106. `fix/invoice-delete-history-guard-20261122`
107. `fix/invoice-footer-stamp-mobile-20261121`
108. `fix/invoice-mobile-table-cards-20261121`
109. `fix/invoice-pdf-continuation-identity-20261121`
110. `fix/invoice-print-and-payment-stamp-2026-11-15`
111. `fix/invoice-print-banner-geometry-20261121`
112. `fix/invoice-print-banner-spacing-20261122`
113. `fix/invoice-print-typography-20261118`
114. `fix/invoice-settlement-integrity-2026-11-15`
115. `fix/invoice-stock-principal-warehouse`
116. `fix/light-dark-theme-consistency-20261118`
117. `fix/mobile-invoice-line-columns`
118. `fix/mobile-nonpublic-hostnames-20261123`
119. `fix/mobile-nonpublic-hostnames-current-main-20261123`
120. `fix/mobile-preflight-current-main-20261123`
121. `fix/mobile-preflight-main-20261123`
122. `fix/mobile-preflight-main-after-security-20261123`
123. `fix/monthly-invoice-quota-schema-v8-2026-11-15`
124. `fix/mysql-backup-limited-privileges-20261122`
125. `fix/navigation-compact-sidebar-2026-11-13`
126. `fix/pdf-headless-user-formatting-20261121`
127. `fix/pdf-pagination-extras-flow-20261117`
128. `fix/pdf-print-pagination-20261117`
129. `fix/pdf-stream-ack-payment-disclosures-20261116`
130. `fix/pdf-worker-db-readiness-2026-11-16`
131. `fix/pdf-worker-health-and-sidebar-icons-2026-11-15`
132. `fix/pdf-worker-wait-for-api-health-2026-11-15`
133. `fix/pro-orders-tenant-currency-20261123`
134. `fix/pro-orders-tenant-currency-main-20261123`
135. `fix/pro-workspace-status-contrast-20261122`
136. `fix/product-delete-stock-history-protection-20261122`
137. `fix/purchase-receipt-warehouse-deadlock-20261119`
138. `fix/quota-registry-initialization-robustness-2026-11-15`
139. `fix/quote-executive-a4-pagination-20261121`
140. `fix/quote-warehouse-resilience-20261120`
141. `fix/refund-payment-method-mapping-20261122`
142. `fix/refund-payment-method-mapping-rebased-20261122`
143. `fix/revoke-jwt-on-logout-2026-11-15`
144. `fix/session-revocation-and-payment-timeouts-2026-11-15`
145. `fix/sidebar-aria-current-2026-11-15`
146. `fix/subscription-disabled-state-tests-docs-20261117`
147. `fix/subscription-icons-main-2026-11-15`
148. `fix/sunupilot-pwa-lifecycle`
149. `fix/team-invitation-email-proof-20261117`
150. `fix/tenant-currency-atomic-current-main-20261123`
151. `fix/tenant-currency-atomic-latest-main-20261123`
152. `fix/tenant-currency-atomic-lock-20261123`
153. `fix/tenant-currency-atomic-lock-main-20261123`
154. `fix/tenant-currency-atomic-main-20261123`
155. `fix/tenant-currency-final-main-20261123`
156. `fix/ui-icons-legibility-2026-11-15`
157. `fix/ui-responsive-polish-20261117`
158. `fix/visual-qr-fixture-20261121`
159. `fix/webhook-local-timezone-dynamic-currency-20261123`
160. `fix/whatsapp-country-guard-2026-11-16`
161. `improve/pdf-page3-balance-20261121`
162. `improve/pdf-page3-balance-main-20261121`
163. `integration/main-company-invitation-email-proof-20261117`
164. `integration/reconcile-main-v21-20261122`
165. `integration/schema-v21-accounting-trial-20261122`
166. `integration/schema-v22-main-reconciled-20261122`
167. `integration/sunupilot-video-main-20261121`
168. `main`
169. `qa/test-pdf-24-modeles`
170. `rebase/pr106-main-20261121-run1`
171. `rebase/pr110-main-20261121-run1`
172. `rebrand/optigest`
173. `reconciliation/schema-v21-main-base-20261122`
174. `security/docker-ignore-local-secrets-2026-11-15`
175. `security/immediate-session-revocation-2026-11-16`
176. `security/invoice-client-tenant-current-main-after-181-20261123`
177. `security/invoice-client-tenant-scope-20261123`
178. `security/invoice-client-tenant-scope-current-main-20261123`
179. `security/invoice-list-verification-code-redaction-20261122`
180. `security/invoice-tenant-scope-final-main-20261123`
181. `security/invoice-verification-code-redaction-main-20261123-run7`
182. `security/redact-secret-urls-in-logs-2026-11-16`
183. `security/redact-verification-codes-current-main-run19-20261123`
184. `security/redact-verification-codes-main-current-20261123-run12`
185. `security/refund-statement-tenant-join-20261123-run14`
186. `security/reset-token-hash-redaction-main-current-20261123`
187. `security/tenant-relations-main-current-20261123-run12`
188. `test/accessibility-audit-business-pages-20261118`
189. `test/accessibility-dark-keyboard-20261118`
190. `test/accessibility-dark-keyboard-rebased-20261120`
191. `test/backup-atomic-visibility-2026-11-15`
192. `test/dark-theme-zoom-200-sweep-20261118`
193. `test/expense-accounting-mappings-regression-20261122`
194. `test/free-trial-expiry-session-guard-20261122`
195. `test/invoice-long-pdf-pagination-20261121`
196. `test/invoice-short-pdf-one-page-20261121`
197. `test/invoice-short-pdf-one-page-main-20261121`
198. `test/ohada-expense-ledger-integrity-20261121`
199. `test/pdf-font-embedding-and-visual-print-20261118`
200. `test/security-auth-reset-token-redaction-20261122`
201. `test/team-invitation-expiry-email-change-20261122`
202. `test/theme-dark-mobile-sweep-20261118`
203. `test/theme-dark-sweep-20261118`
204. `test/theme-light-desktop-sweep-20261118`
205. `test/theme-light-mobile-sweep-20261118`
206. `test/workspace-zoom-200-sweep-20261118`
207. `tooling/local-docker-test-bundle-20261112`
208. `ui/augmenter-logo-icones-sidebar`
209. `ui/modern-responsive-polish`
210. `ux/dashboard-mobile-module-rail-20261122`
211. `ux/pro-workspace-mobile-domain-rail-20261122`
212. `ux/settings-company-fields-grid-20261122`

## 13. Inventaire complet des PR ouvertes (54)

| PR | Titre | Branche head | SHA head | SHA base | Draft/Ready |
|---|---|---|---|---|
| [#203](https://github.com/morn53426-ui/-samafacture-pro/pull/203) | security(invoices): redact verification codes from list responses | `security/redact-verification-codes-current-main-run19-20261123` | `2059e3744ce88eface5c00e52c459c7e6edc5235` | `f8a61187e8b8df7dc319d611dd58fb02dd0aa336` | Draft |
| [#201](https://github.com/morn53426-ui/-samafacture-pro/pull/201) | docs(audit): rapport d'exécution runs 15–17 — 23 novembre | `audit/execution-report-20261123-run15` | `63493905494fc1e1a54d9e277c03aba34c1e2b31` | `f8a61187e8b8df7dc319d611dd58fb02dd0aa336` | Draft |
| [#199](https://github.com/morn53426-ui/-samafacture-pro/pull/199) | fix(security): scope client statement refunds to tenant payment | `security/refund-statement-tenant-join-20261123-run14` | `b212dbc0bac111c77023c1ad42c58514786aeaca` | `b0b52e660af61fa781dc9a761165dd72977f969a` | Draft |
| [#198](https://github.com/morn53426-ui/-samafacture-pro/pull/198) | docs(audit): execution report run 14 — 23 November | `audit/execution-report-20261123-run14` | `e6cc9a40ab92f0eaf9fa9f5c1aa02150d449fb62` | `b0b52e660af61fa781dc9a761165dd72977f969a` | Draft |
| [#196](https://github.com/morn53426-ui/-samafacture-pro/pull/196) | docs(audit): execution report run 13 — 23 November | `audit/execution-report-20261123-run13` | `539a9430c78f83908ce7b404d98804309b19d578` | `b0b52e660af61fa781dc9a761165dd72977f969a` | Draft |
| [#195](https://github.com/morn53426-ui/-samafacture-pro/pull/195) | docs(audit): execution report run 12 — 23 November | `audit/execution-report-20261123-run12` | `b54c4b9fa1334b00663beb2ee26762a7f58e2853` | `b0b52e660af61fa781dc9a761165dd72977f969a` | Draft |
| [#194](https://github.com/morn53426-ui/-samafacture-pro/pull/194) | security(tenant): harden invoice, client and payment isolation | `security/tenant-relations-main-current-20261123-run12` | `900163220356db9c443e11e5f6208760d49a62f2` | `c0a3b569e3e685183376be8428c4696d8c767ccd` | Draft |
| [#193](https://github.com/morn53426-ui/-samafacture-pro/pull/193) | security(invoices): redact verification codes from list responses | `security/redact-verification-codes-main-current-20261123-run12` | `fb6324d34b024072f98d7c1347a0da330922aba4` | `b0b52e660af61fa781dc9a761165dd72977f969a` | Draft |
| [#192](https://github.com/morn53426-ui/-samafacture-pro/pull/192) | fix(currency): serialize tenant currency and first business writes | `fix/tenant-currency-final-main-20261123` | `8a11e00bb976979403e9d3fcfa8e767a074b5423` | `b0b52e660af61fa781dc9a761165dd72977f969a` | Draft |
| [#190](https://github.com/morn53426-ui/-samafacture-pro/pull/190) | fix(currency): serialize tenant currency and first business writes | `fix/tenant-currency-atomic-current-main-20261123` | `0abc0440d11b67ad513bc1e2793d7bb558d37229` | `b276eba52b5179f351efe68d18cf540a170c70fd` | Draft |
| [#188](https://github.com/morn53426-ui/-samafacture-pro/pull/188) | security(tenant): enforce ownership across invoice-related records | `security/invoice-client-tenant-current-main-after-181-20261123` | `39f27a324412cefae046181e22430ba79f24b5c5` | `b276eba52b5179f351efe68d18cf540a170c70fd` | Draft |
| [#185](https://github.com/morn53426-ui/-samafacture-pro/pull/185) | fix(currency): serialize tenant currency changes and first business writes | `fix/tenant-currency-atomic-main-20261123` | `50b9fcc21b6655347d4feac1eb319dad38982996` | `13111355a0d2bc71ee0f3a01b504179b2d136926` | Draft |
| [#183](https://github.com/morn53426-ui/-samafacture-pro/pull/183) | fix(currency): serialize tenant currency changes and orders | `fix/tenant-currency-atomic-lock-main-20261123` | `4a73d68d91ff3d7360e868d034bc6a1d8816966f` | `1c51012381bc2142a3df22b16fd38d03e788cbbc` | Draft |
| [#182](https://github.com/morn53426-ui/-samafacture-pro/pull/182) | fix(pro): use tenant currency for orders and lock history | `fix/pro-orders-tenant-currency-main-20261123` | `a078a351d714fa05e4ecf5901040135e06dc6383` | `13111355a0d2bc71ee0f3a01b504179b2d136926` | Draft |
| [#180](https://github.com/morn53426-ui/-samafacture-pro/pull/180) | docs(audit): execution report run 11 — 23 November | `audit/execution-report-20261123-run11` | `2f1b11e77d5120fc14f4124460c4dda632e1850e` | `b43a94fc2937b0108077501a0260358c8569e11f` | Draft |
| [#179](https://github.com/morn53426-ui/-samafacture-pro/pull/179) | security(invoices): enforce client and payment tenant ownership | `security/invoice-client-tenant-scope-20261123` | `5f554950cba1c4f0ea5dc6383b4f4588f7b61c64` | `b43a94fc2937b0108077501a0260358c8569e11f` | Draft |
| [#178](https://github.com/morn53426-ui/-samafacture-pro/pull/178) | fix(currency): serialize tenant currency changes and orders | `fix/tenant-currency-atomic-lock-20261123` | `70b4c68858997f8fcfa61dd40fb415a31b9b3f22` | `953489e79a9a6779b03e9c436559b925904f5635` | Draft |
| [#177](https://github.com/morn53426-ui/-samafacture-pro/pull/177) | security(invoices): redact verification code from list API | `security/invoice-verification-code-redaction-main-20261123-run7` | `f68ab94eb1d4c2c01d08331321cda293ab0a264f` | `b43a94fc2937b0108077501a0260358c8569e11f` | Draft |
| [#176](https://github.com/morn53426-ui/-samafacture-pro/pull/176) | docs(audit): rapports d'exécution runs 6 à 10 — 23 novembre | `audit/execution-report-20261123-run6` | `8083f938c80ccba4ff499cdf3a6bddef95f29f3f` | `b43a94fc2937b0108077501a0260358c8569e11f` | Draft |
| [#175](https://github.com/morn53426-ui/-samafacture-pro/pull/175) | docs(audit): rapport d'exécution run 5 — 23 novembre | `audit/execution-report-20261123-run5` | `f9f95b734deb3fe9ecacfbb257686085b3fa53a6` | `b43a94fc2937b0108077501a0260358c8569e11f` | Draft |
| [#172](https://github.com/morn53426-ui/-samafacture-pro/pull/172) | docs(audit): rapport d'exécution run 4 — 23 novembre | `audit/execution-report-20261123-run4` | `14688f7a8fd8fe5d9b3cdde50bb546ac7485f30e` | `b43a94fc2937b0108077501a0260358c8569e11f` | Draft |
| [#171](https://github.com/morn53426-ui/-samafacture-pro/pull/171) | fix(pro): use tenant currency for orders and lock history | `fix/pro-orders-tenant-currency-20261123` | `953489e79a9a6779b03e9c436559b925904f5635` | `13111355a0d2bc71ee0f3a01b504179b2d136926` | Draft |
| [#170](https://github.com/morn53426-ui/-samafacture-pro/pull/170) | docs(audit): rapport d'exécution run 3 — 23 novembre | `audit/execution-report-20261123-run3` | `6fa59a42ebb12bb9d6f8a266059125b81991ff95` | `b43a94fc2937b0108077501a0260358c8569e11f` | Draft |
| [#169](https://github.com/morn53426-ui/-samafacture-pro/pull/169) | docs(audit): rapport d'exécution run 2 — 22 novembre | `audit/execution-report-20261122-run2` | `dff61fb42a429fce93ed1fc6f0a3c9f355ced6f4` | `b43a94fc2937b0108077501a0260358c8569e11f` | Draft |
| [#166](https://github.com/morn53426-ui/-samafacture-pro/pull/166) | docs(audit): rapport d'exécution initial du 22 novembre | `audit/execution-report-20261122-run1` | `dc7e6f55c5f7d357400f78c26dcfa469b75c3cef` | `b43a94fc2937b0108077501a0260358c8569e11f` | Draft |
| [#157](https://github.com/morn53426-ui/-samafacture-pro/pull/157) | a11y(navigation): fermer le menu mobile avec Échap | `a11y/mobile-sidebar-escape-focus-20261122` | `c37403034a25bad6d4ecd0867066ce8c258bdd9c` | `00d52ca8acdced3d81d39bf592a916d6729c4e98` | Ready |
| [#156](https://github.com/morn53426-ui/-samafacture-pro/pull/156) | a11y(dashboard): ajouter un accès clavier au contenu principal | `a11y/dashboard-skip-navigation-20261122` | `8f45795c3df521ffb021947d5376bfaa22a832ca` | `8d0f287f46a96cb0697d7a0be9f6fe055b6e5a51` | Ready |
| [#155](https://github.com/morn53426-ui/-samafacture-pro/pull/155) | ux(settings): grille responsive pour les coordonnées entreprise | `ux/settings-company-fields-grid-20261122` | `99670cdf29694c73e0a09038380af250704e89c3` | `00d52ca8acdced3d81d39bf592a916d6729c4e98` | Ready |
| [#154](https://github.com/morn53426-ui/-samafacture-pro/pull/154) | ux(workspace): navigation mobile compacte par domaine | `ux/pro-workspace-mobile-domain-rail-20261122` | `185e0487c95489b8748c1d33418317c5aaf77eb7` | `8d0f287f46a96cb0697d7a0be9f6fe055b6e5a51` | Ready |
| [#153](https://github.com/morn53426-ui/-samafacture-pro/pull/153) | test(trial): vérifier l'expiration sur la première requête protégée | `test/free-trial-expiry-session-guard-20261122` | `29932fbbefe39bad5bb5c3a187a6ade99cafafd3` | `00d52ca8acdced3d81d39bf592a916d6729c4e98` | Ready |
| [#145](https://github.com/morn53426-ui/-samafacture-pro/pull/145) | fix(accounting): retain invoice reversal events (schema v22) | `fix/accounting-event-audit-retention-v22-run2-20261122` | `5b6ba8bf3b05e4155697159c60cf4b5051196bf8` | `decb8da2e48e8f7a93fc63202f00fe0b4170e6e2` | Draft |
| [#142](https://github.com/morn53426-ui/-samafacture-pro/pull/142) | feat(accounting, trial): integrate invoice lifecycle and 15-day trial on schema v21 | `integration/schema-v21-accounting-trial-20261122` | `decb8da2e48e8f7a93fc63202f00fe0b4170e6e2` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft |
| [#141](https://github.com/morn53426-ui/-samafacture-pro/pull/141) | ci: add workspace UI structure regression checks | `ci/workspace-ui-structure-tests-20261122` | `2a09ccf8bfdb3b26b84482b7445902f266fb1dbf` | `868027e1edc8c0e7ad1d5f25e78d90d24b50c5f4` | Draft |
| [#140](https://github.com/morn53426-ui/-samafacture-pro/pull/140) | ci(lint): couvrir les routes backend et tests de protection | `ci/lint-history-protection-backend-20261122` | `32d1c1f56cb9c2b46890aae5b0b72136b13660a8` | `00d52ca8acdced3d81d39bf592a916d6729c4e98` | Draft |
| [#139](https://github.com/morn53426-ui/-samafacture-pro/pull/139) | fix(a11y): improve professional workspace status contrast | `fix/pro-workspace-status-contrast-20261122` | `baa9ea6a688121c580b9f95c1933a2a15663f07f` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft |
| [#138](https://github.com/morn53426-ui/-samafacture-pro/pull/138) | fix(inventory): protect products with stock or history | `fix/product-delete-stock-history-protection-20261122` | `27d5a6c27d5d3066c1f6aaa04e03945caa165974` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft |
| [#137](https://github.com/morn53426-ui/-samafacture-pro/pull/137) | fix(accounting): protect clients with linked history | `fix/client-delete-history-protection-20261122` | `f2aada8d5c016998591fc0b31771de11c3b8ed50` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft |
| [#136](https://github.com/morn53426-ui/-samafacture-pro/pull/136) | fix(accounting): protect posted expenses from edits and deletion | `fix/expense-ledger-protection-20261122` | `4e0f2a893812df88a2dd4a9bed2c26224ea9f656` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft |
| [#135](https://github.com/morn53426-ui/-samafacture-pro/pull/135) | fix(accounting): preserve issued invoice history | `fix/invoice-delete-history-guard-20261122` | `2c7f3cbde915e19ea484236c7a76ad7008f485ae` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft |
| [#134](https://github.com/morn53426-ui/-samafacture-pro/pull/134) | fix(a11y): badge Entreprise lisible en thème sombre | `fix/enterprise-badge-contrast-main-20261122` | `52021018d7894b637d311af7d036cea220248195` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft |
| [#133](https://github.com/morn53426-ui/-samafacture-pro/pull/133) | fix(a11y): corriger le contraste des aperçus de modèles | `fix/accessibility-template-preview-contrast-20261122` | `6b3cd9ffd5446b13e71ca9108c61ade2fde4af5e` | `c607f397c4db35ff12e356ec15ed0919553b748e` | Draft |
| [#132](https://github.com/morn53426-ui/-samafacture-pro/pull/132) | docs(audit): état initial et plan priorisé 22 novembre | `audit/initial-review-20261122` | `6543b3a701753341dae348032f9d08f003e2d796` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft |
| [#131](https://github.com/morn53426-ui/-samafacture-pro/pull/131) | docs: actualiser la feuille de route sur le main courant | `docs/improvement-plan-main-20261122` | `3d51f0afb669ebdddc18c2601cd123d89c206683` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft |
| [#130](https://github.com/morn53426-ui/-samafacture-pro/pull/130) | fix(a11y): contraste WCAG AA et focus clavier sur les deux thèmes | `fix/accessibility-contrast-focus-main-20261121` | `0b819127cc8bdbf8410611642d51b257431e84a6` | `00d52ca8acdced3d81d39bf592a916d6729c4e98` | Draft |
| [#129](https://github.com/morn53426-ui/-samafacture-pro/pull/129) | feat(workspace): navigation par domaines et paramètres structurés | `feat/workspace-settings-navigation-20261121` | `868027e1edc8c0e7ad1d5f25e78d90d24b50c5f4` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft |
| [#128](https://github.com/morn53426-ui/-samafacture-pro/pull/128) | feat(trial,workspace): essai 15 jours et organisation professionnelle | `feat/15-day-trial-entitlements-20261121` | `e3b91dc4ae459fc4fdd65b63dd440f632ccd4217` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Ready |
| [#127](https://github.com/morn53426-ui/-samafacture-pro/pull/127) | fix(pdf): pagination A4 du devis Executive (28 lignes) | `fix/quote-executive-a4-pagination-20261121` | `400ce60ddb8f23e4f37fe836058f180682c2f0c7` | `00d52ca8acdced3d81d39bf592a916d6729c4e98` | Ready |
| [#126](https://github.com/morn53426-ui/-samafacture-pro/pull/126) | feat(landing): présentation vidéo Sunupilot — portage sur main actuel | `integration/sunupilot-video-main-20261121` | `817b10da7b85ce9ca3eb0d4a8312f258349b5647` | `8453ee6d8e633f151523236eecff1bc0e0cf877b` | Draft |
| [#118](https://github.com/morn53426-ui/-samafacture-pro/pull/118) | feat(landing): vidéo Sunupilot — capture locale automatisée des écrans | `feature/video-presentation-spark-sunupilot` | `29dd7ccc8084ce91f9c7eee975610fdd039a67f4` | `f49d352125352d009da9abebd2ceecbb122c6d6b` | Ready |
| [#115](https://github.com/morn53426-ui/-samafacture-pro/pull/115) | test(accounting): cover expense posting and tenant isolation | `test/ohada-expense-ledger-integrity-20261121` | `3873c1d1dbaa114af2aec991b1f49e48702f82a1` | `f49d352125352d009da9abebd2ceecbb122c6d6b` | Ready |
| [#114](https://github.com/morn53426-ui/-samafacture-pro/pull/114) | docs: centralize SamaFacture Pro improvement roadmap | `docs/improvement-plan-20261121` | `ff2cae7bd378680ec20a9998851665a166c539c8` | `5478809ee73e25f381503a20712893e6cc6c8a2b` | Ready |
| [#110](https://github.com/morn53426-ui/-samafacture-pro/pull/110) | test(accessibility): cover light/dark keyboard navigation and contrast | `test/accessibility-dark-keyboard-rebased-20261120` | `722b5bfce06704a645dbe27b1516333e980dd920` | `f42f69e184f92bec26d76442a1249593b64f795f` | Ready |
| [#102](https://github.com/morn53426-ui/-samafacture-pro/pull/102) | test(accessibility): couvrir le thème sombre et le parcours clavier | `test/accessibility-dark-keyboard-20261118` | `86aeeb6f4be28ad4d76622e3a26ac0304326dc73` | `b5863a0d346d42c7cecb2618d7cb87028bd3e8b0` | Draft |
| [#99](https://github.com/morn53426-ui/-samafacture-pro/pull/99) | Adopt SunuPilot branding — indigo and baobab green | `rebrand/optigest` | `3f70466d0b6bc1ab41f082e31324d5702bd39966` | `b5863a0d346d42c7cecb2618d7cb87028bd3e8b0` | Ready |

## 14. Préservation et limites

- Aucun push direct ou force push sur main; aucune branche supprimée; aucun volume, données, sauvegarde ou historique comptable touché.
- Aucun paiement réel, mandat, déploiement ou opération destructive.
- Fusion #202 uniquement, non critique et sans migration.
- Le CI post-merge main `047e7badf4fccd91644af74e0968089b23246c93` reste à compléter sur la recette visuelle au snapshot initial; aucune autre fusion avant succès.
- Branch protection classique non accessible (403); ruleset actif lu et documenté.
