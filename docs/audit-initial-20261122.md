# Audit initial SamaFacture Pro — 22 novembre 2026 (actualisation 02:41 UTC)

## 1. Périmètre et méthode
- Dépôt : `morn53426-ui/-samafacture-pro`
- Branche de référence : `main`
- HEAD observé : `8453ee6d8e633f151523236eecff1bc0e0cf877b` (merge PR #123, 21 novembre 2026 19:20 UTC).
- Inventaire branches distantes : 140 noms retournés, pagination terminée (100 + 40).
- PR ouvertes visibles dans la recherche : 16. La recherche des PR « all states » via ce connecteur a retourné un résultat vide non exploitable; cet audit confirme les PR ouvertes, pas un historique exhaustif des PR fermées/fusionnées.
- Permissions GitHub disponibles : admin/maintain/push sur le dépôt. Aucun changement sur main.
- Aucun clone local ni environnement d'exécution de tests n'est disponible via le connecteur utilisé; tests locaux non exécutés dans cette session.

## 2. État de main et CI
- SHA main : `8453ee6d8e633f151523236eecff1bc0e0cf877b`.
- Commits récents observés : merge #123 (test facture courte A4), #121 (cachet mobile), #116 (pagination PDF long), #124 (table facture mobile); les commits listés sont datés du 21 novembre.
- Status checks combinés sur main : liste vide.
- Runs Actions associés au SHA main : aucun retourné par l'endpoint consulté. Cela ne signifie pas que les workflows n'existent pas ni que les tests sont réussis; visibilité/endpoint CI limitée.
- README main décrit Node.js, Express, MySQL, frontend vanilla, Docker Compose avec app, PDF worker, MySQL, Redis et proxy Nginx; tests backend et recette visuelle sont prévus, mais leur exécution locale n'a pas été possible ici.
- `package.json` à la racine n'a pas été trouvé; README et fichiers backend indiquent que les commandes de tests se lancent dans `server/`. À revalider avec un clone.

## 3. Branches
138 branches distantes recensées; aucun branch delete ni réécriture de ref effectuée. Les branches comprennent de nombreux lots historiques `audit/`, `fix/`, `feat/`, `test/`, `docs/`, `security/`, `integration/` et `rebase/`. L'inventaire complet est consultable dans l'onglet Branches GitHub; cette session n'a supprimé ni renommé ni fusionné aucune branche.

## 4. PR ouvertes prioritaires et statut CI observé
- #132 — audit initial/plan, draft, head `audit/initial-review-20261122`, SHA `b195b6cd07e61409b8721e932e488d9a47fc6dbe`: Tests automatisés success, Package source ZIP success.
- #128 — essai 15 jours + workspace + accès plan OHADA, draft, SHA `e3b91dc4ae459fc4fdd65b63dd440f632ccd4217`: Tests success, ESLint success, Package ZIP success.
- #117 — contrepassation annulation/réactivation facture, ouverte non-draft, SHA `ba756d09888474477a19c182b42c1298ef092dd8`: Tests success, ESLint success, Package ZIP success.
- #115 — intégrité comptabilisation dépenses et isolation tenant, ouverte non-draft, SHA `3873c1d1dbaa114af2aec991b1f49e48702f82a1`: Tests success, Package ZIP success.
- #125 — pagination facture longue, ouverte non-draft, SHA `7d9617d00c2bbe94199f497ddf851f0afbf1315c`: Tests success, ESLint success, Package ZIP success.
- #127 — pagination devis Executive, draft: endpoint status/runs n'a pas fourni de résultat exploitable (ref not found).
- #130 — accessibilité contrastes/clavier, draft, SHA `c607f397c4db35ff12e356ec15ed0919553b748e`: ESLint success, Package ZIP success, Tests automatisés in progress au moment du contrôle.
- #129 — navigation professionnelle/paramètres, draft: vérifications structurelles annoncées dans la description; tests CI à confirmer.
- #126 — vidéo Sunupilot, draft: description signale le master MP4 absent de la branche et fallback animé; tests ciblés antérieurs déclarés, CI courante à revalider.
- #131 — feuille de route actualisée, draft.
- #114, #118, #99, #102, #110 — PR historiques visibles encore ouvertes; leur pertinence, base/head, doublons et CI doivent être vérifiés avant toute décision.
- #127 et #125 sont liés par un cas de pagination devis Executive identifié dans la description de #127.

Les statuts ci-dessus sont un échantillon vérifié par SHA de PR; ils ne représentent pas un résultat de tests local et les statuts « success » ne valent que pour les runs GitHub retournés.

## 5. Constats / risques / hypothèses
### P0 — intégrité et sécurité
1. Vérifier isolation multi-tenant sur toutes les routes, groupes/sociétés, invitations, rôles et références croisées; les PR #115/#117 portent des tests/correctifs ciblés, mais une revue complète du code reste nécessaire.
2. Valider transactions/idempotence sur factures, remboursements, dépenses, contrepassations, stocks et clôtures; vérifier qu'une transition ne produit ni double écriture ni déséquilibre.
3. Vérifier révocation des sessions/JWT, CSRF, secrets dans logs, configuration Docker et contexte de build, SSRF/webhooks, sauvegardes chiffrées/atomiques et restauration isolée.
4. CI et protections main: status checks visibles non concluants pour main; vérifier configuration de protection/règles requises avant toute fusion.

### P1 — comptabilité OHADA et documents
1. Revue indépendante du plan de comptes, journaux, débit/crédit, TVA, lettrage/rapprochement, écritures de correction, annulation/réactivation et multi-sociétés. Le socle SYSCOHADA doit être validé par un expert-comptable local; aucune certification réglementaire ne peut être déduite des PR.
2. Recette PDF facture/devis courts et longs, modèles, A4, logos/QR/signature/cachet, polices, bandeaux, pied de page et pagination; #125/#127 portent des cas identifiés.
3. Vérifier worker PDF, queue Redis, retries/ack/reprise, readiness et erreurs de génération/impression.

### P1 — essai gratuit / SaaS
1. Revue #128 des 15 jours depuis première inscription pour Standard/Pro/Entreprise, UTC, migrations additive/idempotentes, expirations, invitations, changement de plan sans reset, entitlements et conservation des données.
2. Confirmer que checkout, mandat, prélèvement et paiement réel restent désactivés; l'essai ne doit pas activer de débit ni supprimer les données à expiration.

### P2 — UX, responsive, Docker et CI/CD
1. Recette mobile/tablette/desktop, zoom 200%, thèmes clair/sombre, clavier, labels, focus et VoiceOver/NVDA.
2. Navigation par domaines, paramètres à accès rapide, réduction de scroll, icônes et cohérence visuelle.
3. Docker local: démarrage, healthchecks, secrets, migration, volumes persistants, backups/restores; ne pas supprimer volumes.
4. CI/CD: tests unitaires/integration MySQL, lint, audit dépendances, visuel/PDF, build/package, smoke staging non destructif, puis contrôles de sécurité.
5. Landing vidéo: livrable MP4 absent signalé dans #126; ne pas considérer le fallback comme livraison vidéo finale.

## 6. Planning technique priorisé
### Lot 0 — inventaire/revue (maintenant)
- Synchroniser les preuves GitHub et l'état des PR/branches; confirmer main HEAD.
- Lire le code des PR ciblées et comparer avec main; détecter doublons, conflits et branches obsolètes.
- Produire une matrice risques/tests/acceptation.

### Lot 1 — sécurité, données et isolation (P0)
- Multi-tenant, permissions, invitation, révocation sessions, secrets/logs, webhook SSRF.
- Backup atomique/chiffré, rétention non destructive, restauration dans base isolée.
- Tests adversariaux et migrations idempotentes.

### Lot 2 — comptabilité OHADA (P0)
- Dépenses, paiements, remboursements, facture annulée/réactivée, contre-écritures, idempotence, balance, tenant isolation.
- Vérifier chaque journal équilibré et les liens/audit trail; test concurrentiel et transactions.

### Lot 3 — factures/devis/PDF/impression (P1)
- Cas court 1 page, long 28+ lignes, tous les modèles, pagination, fonts, logos, QR, cachet, signature, tableaux mobile.
- Génération PDF réelle, inspection visuelle, navigateur et worker; tests de reprise/erreur.

### Lot 4 — essai 15 jours et workspace (P1)
- Inscription Standard/Pro/Entreprise; démarrage UTC; durée fixe 15 jours; expiration; invitation; changements plan; entitlements.
- Vérifier conservation des données, aucun paiement réel et aucun renouvellement/mandat.

### Lot 5 — responsive/accessibilité/UX (P2)
- Campagne pages métier 320–1920 px, zoom 200%, deux thèmes, Tab/Maj+Tab, focus/contraste, lecteurs d'écran.
- Workspace/Paramètres, navigation compactée, iconographie cohérente, réduction des scrolls.

### Lot 6 — Docker/CI/CD (P2)
- Docker build, secrets/context, non-root, healthchecks, MySQL/Redis, PDF worker, proxy.
- Pipeline PR: lint, tests, security/dependency scan, visual/PDF, build, smoke staging; règles main et approbation humaine.

### Lot 7 — release readiness (P2/P3)
- Recette staging, sauvegarde/restauration, monitoring, rollback documenté, release notes et risques acceptés.
- Aucune mise en production ou activation paiement sans autorisation explicite.

## 7. Protocole permanent par lot
- Analyse approfondie basée sur le HEAD actuel, pas sur les rapports anciens.
- Formuler problème, preuves, cause racine, dépendances, options, risques et choix.
- Branch dédiée créée depuis main à jour; changements minimaux, aucun push direct sur main.
- Tests ciblés + non-régression réellement exécutés; vérifier indépendamment diff, logs et statut CI.
- PR descriptive; draft si validations incomplètes. Aucun merge/close sans autorisation.
- Aucun delete de branche, volume, donnée, backup; aucun paiement réel.

## 8. Résultats de cette exécution
- Inventaire GitHub read-only: terminé (main SHA et 138 branches; PR ouvertes visibles).
- CI: échantillon PR vérifié; main status/runs non visibles par endpoints interrogés.
- Code review approfondie du dépôt: non effectuée, car accès source/clone et exécution locale ne sont pas disponibles dans cette session.
- Tests locaux: 0 exécuté; aucun résultat de test local revendiqué.
- Modifications produit: aucune.
- Mise à jour du rapport d'audit sur la branche dédiée `audit/initial-review-20261122` uniquement.
- Main, PR (merge/close), branches, volumes, données et sauvegardes: non modifiés/supprimés.
- Paiement réel: non activé.


## 9. Actualisation indépendante — 22 novembre 2026, 03:29 UTC

### Référence GitHub actuelle
- `main` reste au SHA `8453ee6d8e633f151523236eecff1bc0e0cf877b`; aucune modification directe.
- Branches distantes : **140** (100 + 40), **138 SHA de tête uniques**; les refs doublonnées ne sont pas supprimées.
- PR ouvertes : **16**.
- Les 10 derniers runs consultés sur `main`: **9 réussites**, **1 échec plus ancien**. Le run sur le HEAD 8453ee6d a réussi. Ce constat corrige l'ancienne note indiquant aucun run visible.
- Le statut legacy combiné sur le commit n'a pas de status entries; les Actions check-runs sont la source consultée pour cette vérification.

### Échec P2 confirmé et correction proposée en PR
- **PR #130** : run Tests automatisés échoué sur `server/tests/visual/recette-visuelle.js`, fonction `verifyBusinessPagesAccessibility`, page Paramètres, badge `invoice-template-tier.tier-enterprise`. Texte `rgb(10,122,69)`, fond `rgb(23,61,43)`, ratio **2,23:1** vs seuil 4,5:1. Lint et package ZIP réussis.
- **PR #133** : tentative de correction du badge sur la branche dépendante de #130; **aucun check-run** retourné. Les workflows `pull_request` ciblent seulement `main`, la branche multi-sociétés et `fix/invoice-pdf-continuation-identity-20261121`; le target branch de #133 ne déclenche donc pas les contrôles usuels.
- **PR #134 (nouvelle correction indépendante depuis main)** : `fix/enterprise-badge-contrast-main-20261122`, 2 fichiers, 3 commits, 33 additions / 4 deletions selon compare. Palette explicite en clair/sombre et assertion Puppeteer sur le contraste calculé du badge Entreprise en thème clair, sombre et système-sombre. Ratios calculés: 6,61:1 et 8,39:1. ESLint et ZIP réussis; Tests automatisés **en cours** au dernier contrôle. Aucun merge.

### Conflit d'intégration P1 — version du schéma
- PR #117 `fix/accounting-invoice-cancellation-reversal-20261121`: `CURRENT_SCHEMA_VERSION=20`, v19 contrepassations facture, v20 mode de règlement dépense; tests de migration attendent 20.
- PR #128 `feat/15-day-trial-entitlements-20261121`: `CURRENT_SCHEMA_VERSION=19`, v19 dates/état d'essai; tests attendent 19.
- Les deux branches ajoutent des colonnes différentes de façon additive, mais elles ne peuvent pas être intégrées telles quelles sans harmoniser `db.js`, commentaires de migration et tests d'attente. Le plan d'intégration doit définir une version combinée (par exemple v21), réconcilier les deux ensembles d'ajouts et rerun migrations/tests sur la base main courante. Aucun changement de migration n'a été fait pendant cette exécution.

### PR ouvertes — actualisation des statuts et recommandations
| PR | Statut CI observé | Base / divergence | Recommandation |
|---|---|---|---|
| #134 | ESLint + ZIP OK; tests en cours | main courant, ahead | Attendre tests visuels avant merge |
| #130 | Tests échoués; ESLint + ZIP OK | main courant, ahead 13 | Bloquée par contraste; corriger et rerun |
| #133 | aucun check-run | dépend de #130 | ne pas considérer validée; workflow ne déclenche pas sur cette base |
| #128 | tests, ESLint, ZIP OK (run sur SHA courant consulté) | main courant, ahead 39 | garder draft; résoudre collision version 19/20 avec #117 |
| #117 | tests, ESLint, ZIP OK | ahead 47; 18 fichiers dans compare | revue ciblée, intégrer avec version de schéma combinée |
| #115 | tests + ZIP OK | diverged, behind 23 | rebase sur main puis CI; ne pas fusionner sur ancien base |
| #125 | tests, ESLint, ZIP OK | main courant, ahead 43, 5 fichiers | candidate après revue PDF et tests visuels |
| #127 | tests, ESLint, ZIP OK | main courant, ahead 5, 3 fichiers | candidate après recette A4 devis Executive |
| #129 | tests, ESLint, ZIP OK | main courant, ahead 9, 6 fichiers | candidate après revue des URL/actions et recette UX |
| #126 | tests + ZIP OK | main courant, ahead 30, 20 fichiers | préférer l'évaluation de cette PR « portage sur main » à #118 si le diff confirme le doublon |
| #118 | tests + ZIP OK | diverged, behind 23 | comparer au #126; ne pas intégrer les deux sans justification |
| #131 | tests + ZIP OK | main courant, ahead 4 | feuille de route plus récente; comparer/remplacer #114 |
| #114 | tests + ZIP OK | diverged, behind 50 | obsolète/duplicata probable de #131, conserver pour historique |
| #110 | tests échoués; lint + ZIP OK | diverged, behind 53 | rebase puis analyser les échecs; doublon #102 |
| #102 | tests échoués; lint + ZIP OK | diverged, behind 228 | ancienne branche de tests accessibilité; préférer #110 après rebase si le diff reste utile |
| #99 | tests échoués; lint + ZIP OK | diverged, behind 228, 84 fichiers | très large rebranding; corriger/rebaser et revue complète avant intégration |
| #132 | tests + ZIP OK | main courant, ahead 2 | audit doc; garder draft tant que rapport complet non fini |

### Branches non PR — comparaison partielle avec main
Les comparaisons effectuées sur un échantillon de 15 refs révèlent plusieurs branches uniquement en retard (par exemple `audit/npm-audit-gate-2026-11-16`, `audit/securite-2026-11-15`, `audit/security-multisocietes-review-20261116-run3`) et de nombreuses refs divergeantes. Certaines branches de backup/runtime ou UI anciennes ont de gros écarts d'historique. **La comparaison ahead/behind et le diff de toutes les 140 branches ne sont pas entièrement terminés dans cette exécution**; ne supprimer aucune branche sur cette base. La liste complète des noms est sur GitHub.

### Correction effectuée dans cette exécution
- Création de la branche `fix/enterprise-badge-contrast-main-20261122` depuis main.
- Deux commits de correction et tests; PR draft **#134** créée. Main n'a pas été modifiée.
- CI GitHub déclenchée; tests automatisés encore en cours. Tests locaux non exécutés (aucun clone/environnement local disponible dans ce runtime).

### Limites / prochain lot
- Revue code approfondie de toutes les 140 branches, tous les commits, diffs, dates et CI n'est pas achevée; cette actualisation couvre branches (noms et SHA), PR ouvertes et comparaisons ciblées.
- Le statut de protection main n'a pas pu être lu via endpoint de protection (403 de l'intégration); la protection reste attestée par la metadata branch `protected=true`.
- Priorité prochaine: attendre CI #134, corriger/revalider #130, préparer la migration combinée #117/#128, rebaser #115 et comparer les PR doublons #118/#126, #114/#131, #102/#110.


## 10. Actualisation — anomalie suppression facture et correction PR #135 (03:34 UTC)

### P1 confirmé — suppression d'une facture avec historique
Revue read-only de `server/routes/factures.js` et migrations 003/004/005 : `DELETE /factures/:id` verrouillait le document puis le supprimait sans vérifier paiements, remboursements, écritures comptables, lignes comptables, avoirs, acomptes, liens/checkouts, bons de livraison, documents ou décisions portail. Les FK `ON DELETE CASCADE` supprimeraient certains liens (notamment paiements) ; les lignes comptables peuvent perdre le lien à la facture (`ON DELETE SET NULL`). Les mouvements de stock ne possèdent pas de facture_id, donc les factures avec produits ne sont pas supprimables de façon traçable.

### Correction préparée — PR #135
- Branche `fix/invoice-delete-history-guard-20261122`, basée sur main SHA `8453ee6d8e633f151523236eecff1bc0e0cf877b`.
- PR draft: https://github.com/morn53426-ui/-samafacture-pro/pull/135
- Refus 409 `DOCUMENT_HISTORIQUE_PROTEGE` si historique financier/comptable/commercial/documentaire lié ou ligne stock.
- Comptabilisation invoice verrouille la facture dans la même transaction que l'écriture, pour sérialiser avec la suppression; retour 409 si supprimée/annulée avant posting.
- 5 tests ajoutés: paiement, ledger, stock, concurrence delete/post, service-only delete conservé.
- ZIP réussi; tests automatisés et ESLint en cours après mise à jour du head (dernier SHA `03777247701a50d0562f01f5be16986da51b9930`). Tests locaux non exécutés. **Ne pas merge avant CI.**

### Actualisation PR #134
- Test Puppeteer étendu pour badge Entreprise en thème clair, sombre et système-sombre.
- Head actuel `52021018d7894b637d311af7d036cea220248195`; ESLint/ZIP réussis, Tests automatisés en cours.

### Revue multi-sociétés (échantillon de code main)
- Migration 006: table `pro_company_group_companies` ne crée le rattachement que dans la route de vérification email `company-group/invitations/accept/verify`, après token 20 minutes et confirmation email; les invitations non acceptées n'ont pas de ligne de membership.
- `resolveTenant` se base sur ce membership et vérifie le plan Enterprise du propriétaire; l'accès groupe observé ne paraît pas bypasser l'acceptation. Aucun correctif de sécurité multi-tenant effectué sur ce point.
- Reste à tester de façon adversariale toutes les routes/API, rôles, membres, groupe et changement de tenant; ce contrôle partiel ne vaut pas certification d'isolation.

### Statut
La branche audit PR #132 a été actualisée et CI est relancée. Les tests locaux, Docker, MySQL, Redis, PDF et recette complète restent non exécutés dans ce runtime.


## 11. Actualisation — dépenses comptabilisées et état PR (03:38 UTC)

### P1 confirmé — source dépense modifiable/supprimable après posting
Revue de `server/routes/depenses.js` et `server/routes/professionnel.js`: `DELETE /depenses/:id` ne vérifiait pas l'écriture `pro_compta_ecritures` (`source_type='depense'`, `source_id`). `PUT /depenses/:id` pouvait modifier montant/date/libellé/catégorie après posting. Le grand livre conservait la source et pouvait diverger de la dépense. Le posting lisait la dépense avant la transaction; une édition concurrente pouvait faire comptabiliser une valeur obsolète.

### Correction proposée — PR #136
- Branche `fix/expense-ledger-protection-20261122`, PR draft https://github.com/morn53426-ui/-samafacture-pro/pull/136.
- PUT/DELETE transactionnels avec `SELECT ... FOR UPDATE`; refus 409 `DEPENSE_COMPTABILISEE_PROTEGEE` après posting.
- Posting verrouille la dépense et compare montant/date/libellé/catégorie avec les lignes proposées; un posting obsolète est refusé 409.
- 3 tests: source comptabilisée protégée, non comptabilisée modifiable/supprimable, race édition/posting sans divergence.
- CI (tests, ESLint, ZIP) en cours au dernier contrôle; tests locaux non exécutés. Ne pas merger avant résultats.

### Mise à jour PR #135 — politique plus sûre
La PR #135 a été renforcée: **toutes les factures émises ne peuvent plus être supprimées**, même sans historique. La suppression de produits peut détacher `facture_lignes.produit_id`; la présence de mouvements stock devient indétectable depuis la facture. Les factures doivent donc être annulées/contrepassées; les devis sans historique restent supprimables. Head `5d676373238d14c85dffd340d77f0940d6535968`, mergeable true, CI relancée.

### État courant des refs/PRs
- Branches distantes : **142**; head SHA uniques estimés **140**.
- PR ouvertes : **19** (16 initiales + #134, #135, #136).
- #134: ESLint/ZIP réussis; tests automatisés en cours.
- #135: ESLint/ZIP réussis sur le head précédent; tests en cours sur le nouveau head après la règle de non-suppression de facture.
- #136: tests, ESLint et ZIP en cours.
- #132: tests en cours après actualisation de ce rapport.
- #130: tests visuels toujours en échec sur le badge Entreprise, #133 sans checks; #134 est la correction indépendante.
- `main` reste au SHA 8453ee6d8e633f151523236eecff1bc0e0cf877b, dernier run Tests automatisés réussi.


## 12. Actualisation — suppression client et nouvelles PRs (03:40 UTC)

### P1 confirmé — suppression client cascadait sur factures et paiements
`server/routes/clients.js` supprimait les factures/devis du client puis le client, sans préserver le grand livre. La FK client→factures `ON DELETE CASCADE` pouvait supprimer lignes et paiements; l'accès portail/CRM pouvait aussi disparaître en cascade. La restauration stock ne protège pas l'historique comptable.

### PR #137 — protection historique client
- Branche `fix/client-delete-history-protection-20261122`, PR draft https://github.com/morn53426-ui/-samafacture-pro/pull/137.
- Refus 409 `CLIENT_HISTORIQUE_PROTEGE` si facture, document, accès portail, décision portail ou activité CRM liée; client sans historique reste supprimable.
- DELETE transactionnel et verrou du client; plus de suppression de factures ni restauration de stock dans ce chemin.
- 3 tests: client facture/paiement préservés, activité CRM préservée, suppression sans historique autorisée.
- CI en cours; tests locaux non exécutés. Ne pas merge avant contrôles.

### Inventaire actuel
- Branches : **143**, SHA de tête uniques estimés **141**.
- PR ouvertes : **20** (16 initiales + #134, #135, #136, #137).
- #134 : **tous les contrôles verts**, Tests Node/MySQL, recette visuelle, Docker Compose, smoke cluster MySQL+Redis, restauration sauvegarde chiffrée, ESLint et ZIP.
- #135 : Tests automatisés en cours sur le head `5d676373...`; ESLint/ZIP réussis; mergeable true.
- #136 : tests automatisés en cours; branch mergeable true.
- #137 : tests automatisés en cours; package/lint en cours.
- #132 : tests automatisés en cours après actualisation du rapport.
- main toujours SHA `8453ee6d...`, aucune modification.


## 13. Actualisation — protection du stock catalogue (03:41 UTC)

### P1 confirmé — DELETE produit supprimait stock et détachait documents
`server/routes/produits.js` supprimait les produits avec stock positif, cascadait sur `pro_stocks_entrepots` et détachait les lignes de facture (`produit_id=NULL`). Les mouvements stock pouvaient perdre leur lien produit. Le test historique `produits-delete.test.js` confirmait explicitement cette suppression d'un produit stock 10 lié à une facture.

### PR #138
- Branche `fix/product-delete-stock-history-protection-20261122`, PR draft https://github.com/morn53426-ui/-samafacture-pro/pull/138.
- Refus 409 `PRODUIT_HISTORIQUE_PROTEGE` si stock catalogue/entrepôt non nul, facture liée ou mouvement historique; ne détache plus les lignes.
- Suppression permise uniquement si stock nul et aucun lien/historique.
- Tests modifiés/ajoutés pour produit vide, stock positif, mouvement à stock nul, facture liée et isolation tenant.
- CI déclenchée; tests locaux non exécutés.

### Inventaire actuel
- Branches : **144**; SHA de tête uniques estimés **142**.
- PR ouvertes : **21** (16 initiales + #134–#138).
- #134 : CI entièrement réussie (Node/MySQL, visuel responsive, Docker Compose, smoke cluster MySQL+Redis, restauration sauvegarde chiffrée, ESLint, ZIP).
- #135: tests en cours, ESLint/ZIP réussis sur head 5d676; mergeable true.
- #136: tests en cours, branch mergeable true.
- #137: tests en cours; head 922756; draft.
- #138: CI déclenchée; head aa954; mergeable true.
- #132: CI en cours après actualisation du rapport.
- main demeure 8453ee6d, inchangé.


## 14. Actualisation — migration ordering and PR117 review (03:42 UTC)

### Collision de migrations : impact concret
Le code `server/config/db.js` vérifié dans les deux branches n'exécute `runMigrations(conn)` que si le marqueur absent ou `meta.version < CURRENT_SCHEMA_VERSION`.
- PR #128 est version 19 et ses quatre champs d'essai sont ajoutés dans `columnsToEnsure` (dans `runMigrations`).
- PR #117 est version 20 et ajoute l'historique comptable facture + mode de règlement dépense, sans les quatre colonnes d'essai dans sa liste.
- Si #117 est intégré en premier (version20), #128 version19 ne lance pas `runMigrations` sur une base v20: les colonnes trial peuvent manquer.
- Si #128 est intégré en premier (version19), #117 version20 lance `runMigrations`, mais sa liste n'assure pas les colonnes trial; elles peuvent manquer aussi.
**Solution impérative d'intégration:** branch combinée avec version21, les colonnes trial et migration comptable incluses dans le même `runMigrations`, schema.sql combiné, commentaires et tests de migration/metadata mis à jour vers v21; tester les bases v18, v19 et v20 sur copie dédiée non destructive. Ne merge pas #117 et #128 telles quelles.

### Revue ciblée de PR #117
- Service `accounting-invoice-lifecycle.js`: verrou facture attendu par l'appelant, vérifie l'écriture précédente validée et équilibrée, inverse débit/crédit, journalise un événement, utilise des transitions annulation/réactivation idempotentes; tests de cycles multiples.
- Remboursements: demande cumulative vérifie `a_traiter/approuve/rembourse` sous verrou paiement; passage à `rembourse` exige référence prestataire, crée l'encaissement d'origine si absent, vérifie deux lignes trésorerie/client, et crée la contrepassation dans même transaction; met à jour `montant_paye` et statut facture. La revue de ce périmètre est positive mais CI de PR #117 ne remplace pas l'analyse de l'intégration.
- PR #117 est large: 70 commits dans PR metadata, 22 fichiers, incluant migration comptable, mode règlement dépense, remboursement, tests, workflows et responsive/PDF. Recommander de scinder les lots ou faire une revue diff complète avant intégration, car plusieurs changements indépendants et les workflows de CI se chevauchent avec #128.
- PR #128 est aussi large (39 commits, 26 fichiers): essai 15 jours, auth/expiration, navigation professionnelle, paramètres, comptes OHADA, tests et CSS. CI réussie sur le SHA contrôlé, mais collision version à résoudre.

### Statut actuel
- Branches: **144**, heads uniques estimés **142**.
- PR ouvertes: **21**.
- #134 CI entièrement verte.
- #135, #136, #137, #138 et #132 tests automatisés en cours; aucun résultat final n'est déclaré.
- #117 et #128 CI réussies sur leurs heads; ne pas fusionner avant version21 et rebase/intégration contrôlée.


## 15. Actualisation — échec CI PR #135 et correctifs de test (03:43 UTC)

### Résultat CI #135 (head `5d676373...`)
- ESLint: success.
- Package ZIP: success.
- Tests Node/MySQL: **failure**, 546 tests, 540 pass, 5 fail, 1 skipped.
- Échec 1: SQL parse error dans la suppression de devis, liste des paramètres de la sous-requête `pro_portal_quote_decisions` décalée (pair tenant manquant).
- Échecs 2–5: tests historiques attendaient 200 sur DELETE facture, désormais 409 (quota-paths, quota registry recovery, stock test et warehouse stock test). Le changement de politique est intentionnel; les tests doivent utiliser l'annulation et vérifier 409.

### Corrections préparées sur la même branche
- SQL: nombre de paramètres corrigé, requête simplifiée aux sous-requêtes historiques nécessaires; suppression du code de restitution stock de la route DELETE (les factures émises sont refusées; devis n'ont pas de mouvement stock).
- Tests: quota deletion désormais 409 et quota toujours compté; tests stock utilisent annulation/contrepassation au lieu de suppression et vérifient le stock; devis sans historique reste supprimable.
- Head courant PR #135 `2c7f3cbde915e19ea484236c7a76ad7008f485ae`; nouvelle CI en attente. Aucun test n'est déclaré réussi sur ce head avant résultats.

### Statut actuel
- Branches: 144; PRs ouvertes: 21.
- #134 CI entièrement verte.
- #135 tests sur head corrigé en attente; ESLint/ZIP green sur head précédent.
- #136, #137, #138 et #132 tests en cours.
- main reste 8453ee6d; aucune fusion.


## 16. Actualisation — PR #137/#138 CI failures and corrections (03:46 UTC)

### PR #137
- CI #44981654268: Tests Node/MySQL failed in the legacy stock test `supprimer le client restitue aussi le stock de ses factures actives`, which expected client deletion to restore stock (old destructive behavior).
- Test corrected on branch `fix/client-delete-history-protection-20261122` (head `93817546...`): delete client with invoice must return 409; stock unchanged; explicit invoice cancellation restores stock; client remains.
- CI rerun pending; do not declare PR green.

### PR #138
- CI #44981742132: Tests Node/MySQL failed in test `supprimer un produit sans stock mais avec mouvements est refusé`; the test had changed catalog stock via PUT, which did not create movement records, so deletion correctly returned 200.
- Test corrected on branch `fix/product-delete-stock-history-protection-20261122` (head `36b088d3...`): create real inventory adjustments +5 and -5 via `POST /api/pro/inventory/adjustments`, leaving zero stock with movement history; delete must return 409 and product remain.
- CI rerun pending; do not declare PR green.

### PR #136 validation
- Tests Node/MySQL: success, run `44981448565`.
- ESLint: success, run `44981448557`.
- ZIP: success, run `44981448559`.
- Head `4e0f2a89...`; PR #136 has all three checks green.

### Current status
- #134 all checks green.
- #135 tests in progress on corrected head `2c7f3cbd...`; ESLint and ZIP green.
- #136 fully green.
- #137 and #138 have corrected heads; CI pending.
- #132 report branch CI pending after latest documentation commit.
- main remains unchanged at 8453ee6d.


## 17. Inventaire final du run — 03:47 UTC

- Branches distantes: **144**; heads SHA uniques estimés: **142**.
- PR ouvertes: **21**; branches sans PR ouverte: **123**.
- Branches sans PR par préfixe: `fix/` 43, `feat/` 31, `audit/` 12, `test/` 12, `docs/` 7, `security/` 3, `automation/` 2, `ci/` 2, `ui/` 2, autres 9.
- Comparaisons ahead/behind/diff effectuées sur un échantillon de 15 branches non-PR et 16 PR; **les 144 branches ne sont pas toutes comparées en détail**. Noms complets des branches non-PR disponibles dans la liste GitHub.
- Aucune branche supprimée; aucune fusion.


## 18. Actualisation — sécurité, essais et dépendances d'intégration (03:48 UTC)

### Contrôles sécurité ciblés
- Authentification: `token_version` vérifiée par JWT, logout incrémente version et révoque les Bearer; réinitialisation de mot de passe incrémente également la version. Contrôle code, pas de test complet de toutes les routes.
- CORS: politique restrictive en production, `ALLOWED_ORIGINS` explicite; sans variable, production refuse les origines cross-origin.
- Isolation groupe multi-sociétés: membership ajouté seulement après acceptation email/token; `resolveTenant` vérifie membership et plan Enterprise. Contrôle ciblé positif, pas une recette adversariale complète.
- Résiduel P2: CSP `script-src/style-src unsafe-inline` (front inline historique) et /api/docs exclu; documented in SECURITY_REPORT. À réduire progressivement.
- Paiements réels: route abonnement `/payer` renvoie 503 `PAIEMENT_RECURRENT_NON_CONFIGURE`, aucun checkout/paiement activé.

### Trial 15 jours
Revue ciblée PR #128: Standard normalisé en `starter`, Pro/Entreprise; `UTC_TIMESTAMP()` et `DATE_ADD(... INTERVAL 15 DAY)`; fin exclusive; expiration ramène plan Gratuit; changement de formule conserve dates; invitations pending ne reçoivent pas un essai concurrent. Tests dédiés couvrent les 15 jours exacts, expiration, plan change et invitation. CI sur head consulté réussie. Intégration reste bloquée par migration version.

### Dépendances d'intégration
- #117 et #128: conflit version/schema/migrations et workflows CI; combiner en version21 avant intégration.
- #135/#136 touchent `professionnel.js`; #135 `factures.js`; #136 `depenses.js`; PR #117 touche ces routes et workflows. Rebase après intégration du lot accounting.
- #137 modifie `clients.js` et `stock.test.js`; rebase après #135 pour aligner les tests sur la politique non-suppression factures.
- #138 modifie `produits.js` et `produits-delete.test.js`; rebase après les migrations/PRs stock.
- #134 chevauche #130/#133 sur paramètres et visual test; CI #134 verte indépendante.
- #126/#118, #131/#114 et #110/#102 sont doublons probables; comparer diffs avant intégration.

### Statut courant
- #134 CI complète verte.
- #136 tests+lint+ZIP verts.
- #135 tests toujours en cours sur head corrigé; lint/ZIP verts.
- #137 tests en cours sur head corrigé; ZIP vert.
- #138 tests en cours sur head corrigé; ZIP vert.
- #132 audit docs tests en cours.
- 144 branches, 21 PR ouvertes; aucun merge ni suppression.


## 19. Actualisation indépendante — 22 novembre 2026, 04:26 UTC

### État GitHub revérifié
- `main` : SHA `8453ee6d8e633f151523236eecff1bc0e0cf877b`, aucun changement sur la branche principale.
- Branches distantes : **144**, **142 SHA de tête uniques**; pagination 100 + 44.
- PR ouvertes : **21**; toutes les PR examinées restent ouvertes, aucun merge/close effectué.
- `main` est signalée `protected=true` dans l'API branches. Un ruleset repository `protect main` (ID 27410527) est **active**. L'endpoint détaillé de branch protection répond 403; les règles exactes ne sont donc pas lisibles via ce connecteur.
- 5 runs Actions les plus récents sur main consultés : tous `completed/success`, dont le run sur HEAD 8453ee6d. Le status API legacy renvoie `pending` sans status entries; les Actions check-runs sont retenus comme preuve CI.

### Statuts CI actuels des PR prioritaires (sha exact contrôlé)
| PR | Checks | État |
|---|---|---|
| #132 | Tests Node/MySQL, archive ZIP | **2/2 success** |
| #134 | ESLint, Node/MySQL, ZIP | **3/3 success** |
| #135 | Node/MySQL, ESLint, ZIP | **3/3 success** |
| #136 | Node/MySQL, ESLint, ZIP | **3/3 success** |
| #137 | ZIP success; Node/MySQL en cours après derniers commits | **1 success, 1 pending** |
| #138 | ZIP en cours; Node/MySQL en cours après derniers commits | **2 pending** |
| #130 | Node/MySQL failed; ESLint + ZIP success | **bloquée** |
| #133 | aucun check-run visible; base sur #130 | **non validée, dépendance** |
| #128 | ESLint, ZIP, Node/MySQL | **3/3 success** |
| #117 | Node/MySQL, ESLint, ZIP | **3/3 success** |
| #115 | Node/MySQL, ZIP | **2/2 success** |
| #125 | ESLint, ZIP, Node/MySQL | **3/3 success** |
| #127 | Node/MySQL, ZIP, ESLint | **3/3 success** |

### Échec #130 — preuve du log
La recette visuelle `verifyBusinessPagesAccessibility` échoue sur `parametres`: badge `span.invoice-template-tier.tier-enterprise`, foreground `rgb(10,122,69)`, background `rgb(23,61,43)`, ratio **2,23:1** vs requis 4,5:1. #134 est une correction indépendante depuis main, avec CI entièrement verte; #133 est empilée sur #130 et ne possède aucun check-run visible.

### Revue approfondie supplémentaire — historique client (PR #137)
L'examen du schéma main et migrations 003/005 a trouvé deux références enfant non protégées dans le premier correctif : `factures_recurrentes` (FK client `ON DELETE CASCADE`) et `pro_commandes` (FK `ON DELETE RESTRICT`). De plus, les vérifications initiales filtrées par `user_id` pouvaient ignorer des références anomalement cross-tenant, puis les cascades/SET NULL s'exécuter quand même.
- Correctif commité sur la branche PR #137 : vérifier les références par `client_id` sans filtrage `user_id`, ajouter les comptes factures récurrentes et commandes, et bloquer aussi les documents/access portail/décisions/CRM.
- Tests supplémentaires : modèle facture récurrente et commande professionnelle; refus 409 et conservation client/références. Tests existants facture+paiement, CRM et client sans historique maintenus.
- Head actuel : `3792372ba36560a99045157a8dcfb13d482806d0`; archive ZIP réussie, Node/MySQL **en cours**. Le code a été vérifié, mais tests locaux non exécutés.

### Revue approfondie supplémentaire — références d'achat produit (PR #138)
Les migrations 004 montrent que `pro_commandes_fournisseurs_lignes.produit_id` et `pro_receptions_achats_lignes.produit_id` sont `ON DELETE SET NULL`. Le guard initial #138 protégeait stock, factures et mouvements, mais pas les lignes d'achat : supprimer le produit pouvait perdre le lien catalogue de l'historique achat.
- Correctif commité : refuser la suppression si des lignes de commande fournisseur sont liées, en plus du stock catalogue/entrepôt, lignes facture et mouvements.
- Test ajouté : produit à stock zéro lié à une ligne d'achat; DELETE 409, produit et référence achat conservés.
- Vérification indépendante du test a détecté un import `pool` absent; import corrigé avant CI.
- Head actuel : `e507b81c66fd306efba7f4f74322b0a99afdcca3`; archive et tests Node/MySQL **en cours**.

### Corrections P1 — état confirmé
- #135 facture : **tous les checks green** (tests, ESLint, archive). Toutes les factures émises protégées; devis sans historique supprimables; verrou partagé posting/delete; tests régression.
- #136 dépenses : **tous les checks green** (tests, ESLint, archive). Dépenses comptabilisées protégées contre modification/suppression; posting verrouillé et vérification source.
- #137 client : garde amélioré pour tous les enfants liés; CI incomplète en attente.
- #138 produit : garde inclut achats; CI incomplète en attente.
- #134 contraste badge : **3/3 checks green**.

### Planning et décisions de sécurité
1. Attendre CI des nouveaux heads #137/#138 et traiter tout nouvel échec avant de les déclarer prêts.
2. Revue humaine des diff #134–#138, vérifier les lock-order, les références SQL, la couverture des enfants et l'absence de bypass tenant.
3. Intégration #117 + #128 seulement via migration combinée version **21**; ne pas merge les versions 19/20 séparément.
4. Rebase/recette #115, puis #125/#127; comparer doublons #118/#126, #114/#131 et #102/#110.
5. Revue exhaustive des 144 branches, ahead/behind et CI reste non achevée; aucune branche ne doit être supprimée.
6. Tests locaux, Docker, MySQL/Redis, PDF et recette responsive complète non exécutés depuis ce runtime. Les statuts ci-dessus sont CI GitHub sur SHA précis, pas une validation locale.

### Actions réalisées pendant cette actualisation
- PR #137 : deux commits de garde/tests ajoutés; description actualisée.
- PR #138 : deux commits de garde/tests ajoutés puis correction d'import pool; description actualisée.
- Rapport d'audit actualisé sur la branche dédiée #132; aucun merge, close, delete, volume, donnée, backup ou paiement réel.


## 20. Actualisation — 22 novembre 2026, 04:30 UTC

### Comparaison ahead/behind ciblée des PR
Comparaison directe `main...branch` sur 19 refs ouvertes ciblées. Ces résultats ne remplacent pas la comparaison exhaustive de toutes les branches.
| PR | ahead | behind | commits | fichiers |
|---|---:|---:|---:|---:|
| #134 | 3 | 0 | 3 | 2 |
| #135 | 11 | 0 | 11 | 6 |
| #136 | 5 | 0 | 5 | 3 |
| #137 | 6 | 0 | 6 | 3 (avant derniers commits de test) |
| #138 | 6 | 0 | 6 | 2 (avant derniers commits de test) |
| #128 | 39 | 0 | 39 | 26 |
| #117 | 47 | 0 | 47 | 18 |
| #115 | 1 | 23 | 1 | 1 |
| #125 | 43 | 0 | 43 | 5 |
| #127 | 5 | 0 | 5 | 3 |
| #129 | 9 | 0 | 9 | 6 |
| #130 | 13 | 0 | 13 | 6 (avant fix badge) |
| #133 | 13 | 0 | 13 | 6; stacked on #130 |
| #131 | 4 | 0 | 4 | 1 |
| #114 | 4 | 50 | 4 | 1 |
| #118 | 42 | 23 | 42 | 15 |
| #126 | 30 | 0 | 30 | 20 |
| #102 | 13 | 228 | 13 | 3 |
| #110 | 15 | 53 | 15 | 5 |

### CI failures anciennes branches — diagnostics de log
- **#99 rebrand/optigest** : recette visuelle, contraste sombre de disponibilité **3,97:1** au lieu de 4,5:1; ESLint et archive ZIP green. PR non intégrable en l'état.
- **#102 accessibilité** : recette échoue sur focus visible des champs date natifs dans page Rapports, `input#from` et `input#to`, `focusVisible=false`, aucun indicateur. ESLint/ZIP green.
- **#110 accessibilité rebased** : recette échoue sur texte rouge des dépenses `td.mono`, contraste **4,23:1** au lieu de 4,5:1; ESLint/ZIP green. #130 contient des changements pour montants rouges et focus, mais doit passer la CI.
- #114/#131 feuilles de route : #114 est 50 commits derrière et diverge; #131 est basée sur main. Préférer la revue de #131, garder #114 historique.
- #118/#126 Sunupilot : #118 diverge et est 23 commits behind; #126 est basée sur main. #126 est candidate après revue diff (30 commits, 20 fichiers, 1 447 changements) et vérification média vidéo.
- #102/#110 : #102 est 228 commits behind, #110 53 commits behind; #110 est la base plus récente, mais CI encore en échec. Rebase/fix avant candidate.

### Actualisation #130 — correctif badge porté dans le lot accessibilité
- Le log CI #130 initial confirme badge 2,23:1; #134 standalone est green.
- Pour valider la correction complète du parcours accessibilité, les palettes du badge Entreprise et assertions de contraste (clair, sombre explicite, sombre système) de #134 ont été portées sur la branche #130.
- Head #130 : `bf6a02319439ac4b2c700ca3100e73bec01dfd06`; CI ESLint, tests et archive **en cours** au dernier contrôle. PR #134 reste séparée, green; aucun merge.

### Actualisation #137 — références cross-tenant
- Le test couvre maintenant aussi une activité CRM appartenant à l'entreprise B et référencée vers le client A; la suppression A doit être refusée et conserver la référence B. Le nettoyage test supprime B avant A.
- Head #137 : `6c7c04c772d7a78c4b7b9737b1f0931b7616fb2c`; ZIP success, Node/MySQL en cours. Tests locaux non exécutés.

### Actualisation #138 — stock et mouvements cross-tenant
- Les vérifications stock entrepôt et mouvements sont désormais par `produit_id` (pas `user_id`), car les FK cascade/SET NULL peuvent supprimer/détacher des références cross-tenant anormales.
- Test supplémentaire : stock entrepôt entreprise B référençant produit A; DELETE produit A doit renvoyer 409 et stock B reste 3.
- Head #138 : `d5bd445c8625013e75f02144e2a524b68fc336d7`; CI relancée après ces modifications, statut en attente.

### Branches — catégories exactes par préfixe
144 refs, 142 SHA de tête uniques : `fix/` 52, `feat/` 33, `test/` 15, `audit/` 13, `docs/` 9, `security/` 3, `automation/` 2, `ci/` 2, `improve/` 2, `integration/` 2, `rebase/` 2, `ui/` 2, puis `brand/` 1, `chore/` 1, `feature/` 1, sans préfixe 1, `qa/` 1, `rebrand/` 1, `tooling/` 1. Toutes les refs sont conservées.

### État CI du dernier contrôle
- #132 : ZIP success; Node/MySQL en cours après le rapport actualisé.
- #130 : 3 jobs en cours après le correctif badge.
- #137 : ZIP success; Node/MySQL en cours après test cross-tenant.
- #138 : ZIP success; Node/MySQL en cours après tests achat et cross-tenant.
- #134, #135, #136 : checks complets green sur heads précédents; #135/#136 n'ont pas reçu de commits depuis le contrôle green.
- #129, #131, #114, #118, #126 : tests Node/MySQL et ZIP green (ESLint aussi pour #129); #102/#110/#99 restent CI failing.

### Limites
- Comparaisons ahead/behind/diffs réalisées sur 19 PRs prioritaires seulement, pas les 144 branches.
- Aucun clone local, test local, Docker local, MySQL local, Redis local, PDF ou recette responsive complète exécutés.
- Aucun merge/close, aucune branche/data/volume/backup supprimé, main inchangé, paiement réel désactivé.


## 21. Vérification de sérialisation stock — 22 novembre 2026, 04:31 UTC

Lecture ciblée de `server/routes/professionnel.js` main (3 397 lignes) :
- `POST /inventory/adjustments` verrouille le produit avec `SELECT ... FOR UPDATE` avant d'ajuster stock et mouvement.
- `POST /inventory/transfers` verrouille le produit avant transfert et lignes d'entrepôt.
- La réception fournisseur verrouille le produit avant d'incrémenter le stock.
- Ces chemins utilisent le même verrou parent produit que le DELETE de PR #138, ce qui réduit le risque de course stock/delete sur les opérations examinées.
- Les enfants cross-tenant peuvent être créés uniquement via données anomalement liées/imports/direct SQL, mais les guards #137/#138 les protègent explicitement au DELETE.
- Ce contrôle de lock-order est ciblé; toutes les routes qui peuvent modifier produit, achats, factures ou stock n'ont pas été auditées exhaustivement.


## 22. État final du run — 22 novembre 2026, 04:32 UTC
- #130 head `bf6a023194`: ESLint + ZIP success; Node/MySQL en cours après fix badge.
- #137 head `6c7c04c772`: ZIP success; Node/MySQL en cours après test cross-tenant.
- #138 head `d5bd445c86`: ZIP success; Node/MySQL en cours après test achats + stock cross-tenant.
- #132 dernier commit docs `b2cb7f0787`: aucun check-run retourné; les commits sont documentation-only. L'ancien SHA initial #132 `69bcf74f` avait Tests Node/MySQL + archive green.
- #134/#135/#136: 3/3 checks green sur heads contrôlés.
- #133 reste Draft, base branch #130 (base SHA ancien `c607f397`), aucun check-run; il n'est pas validé et sa base est en retard sur #130.
- #130/#134 doublons partiels : #130 contient l'accessibilité générale + le badge désormais; #134 badge seul, green. Préférer #130 après CI green, mais ne pas fermer #134 sans autorisation.
- Aucun merge/close, aucun delete de branche, données, volumes ou backups; main inchangé. Tests locaux et Docker non exécutés.


## Actualisation du run 3 — 22 novembre 2026, 05:27 UTC

### Inventaire et état de référence
- Branches distantes : **145** (pagination 100 + 45). Cet endpoint renvoie les noms seulement; le nombre de SHA uniques n'a pas été recalculé.
- PR ouvertes : **22** (`is:open`). L'historique des PR fermées/fusionnées n'a pas été interrogé exhaustivement.
- `main` reste au HEAD `8453ee6d8e633f151523236eecff1bc0e0cf877b` d'après le commit récent retourné. L'endpoint Actions utilisé filtre les runs liés aux PR et ne retourne pas de runs main; le statut Actions de main n'est pas vérifié dans cette actualisation.

### CI vérifiée sur les HEAD des PR prioritaires
| PR | HEAD | Tests automatisés | ESLint | Archive ZIP | Note |
|---|---|---|---|---|---|
| #134 | 52021018 | succès | succès | succès | badge Entreprise |
| #135 | 2c7f3cbd | succès | succès | succès | facture émise protégée |
| #136 | 4e0f2a89 | succès | succès | succès | dépenses comptabilisées |
| #137 | 04de367f | en cours lors de l'actualisation | non retourné | succès | teardown corrigé après échec FK RESTRICT |
| #138 | d5bd445c | succès | non retourné | succès | stock/historique produit |
| #130 | bf6a0231 | **échec** | succès | succès | recette visuelle: `span.pro-status` page `professionnel`, contraste 2,23:1 (4,5:1 requis) |
| #139 | baa9ea6a | en cours | non retourné | succès | correction CSS dédiée badge résumé professionnel |
| #132 | 7b35953e | succès | non retourné | succès | rapport audit |
| #117 | ba756d09 | succès | succès | succès | base/head ancien; rebase/integration à vérifier |
| #128 | e3b91dc4 | succès | succès | succès | essai 15 jours/workspace; migration v19 à réconcilier avec #117 |
| #115 | 3873c1d1 | succès | non retourné | succès | base SHA plus ancien que main; rebase requis |
| #125 | 7d9617d0 | succès | succès | succès | pagination PDF long |
| #127 | 9bfc8aea | succès | succès | succès | devis Executive A4 |

### Échec CI #130 — cause confirmée
Le log du run `44985277196` indique sur la page Professionnel `span.pro-status`, texte « 9 outils · 4 rubriques », couleur `rgb(10,122,69)` sur `rgb(23,61,43)`, ratio **2,23:1**. Ce défaut de contraste préexistant sur main bloque la recette de la PR d'accessibilité.

### Corrections nouvelles dans ce run
- PR #139 draft : `fix/pro-workspace-status-contrast-20261122`, commit `baa9ea6a688121c580b9f95c1933a2a15663f07f`; CSS badge professionnel clair/sombre/sombre système. Ratios calculés pour surfaces de thème : 6,62:1 clair et 9,29:1 sombre; CI doit vérifier les couleurs calculées réellement rendues.
- PR #137 : commit de test `04de367f7c8ecbdbec03282c0ccac3edbc3a5488` nettoie explicitement le fixture de commande avant teardown, car `pro_commandes.client_id` utilise RESTRICT. CI relancée; statut non encore retourné.
- PR #138 : tests automatisés et archive ZIP green sur HEAD actuel.

### Priorités immédiates
1. Finir CI #139 et #137; si #137 échoue encore, examiner le log avant correction.
2. #130 reste bloquée par `.pro-status`; le correctif #139 doit être validé puis porté/rebasé dans la branche #130, sans merge autorisé.
3. Conserver #135/#136/#134 green; #138 green, revue humaine requise.
4. Réconcilier migrations #117/#128 (version combinée 21) avant intégration; ne pas merge.
5. Rebaser #115; comparer #125/#127 pour recette PDF; poursuivre les comparaisons détaillées des branches restantes.

Aucune modification directe de main, aucun merge/close, aucune suppression de branche, donnée, volume ou sauvegarde; paiements réels désactivés. Tests locaux et Docker local non exécutés.

## Actualisation run 4 — 22 novembre 2026, 06:28 UTC

### État frais du dépôt
- Pagination branches : **146** (100 + 46), **144 SHA uniques**; 23 PR ouvertes.
- Main toujours `8453ee6d8e633f151523236eecff1bc0e0cf877b`. Workflow Actions #1296 (21 nov. 19:20 UTC) : `Tests automatisés` success. Aucun commit sur main.
- Ruleset `protect main` ID 27410527 actif, ciblant main : règles deletion et non-fast-forward, PR obligatoire, résolution de threads, checks requis `Tests Node.js et MySQL` et `Build complete source archive`, approbations requises 0; bypass none. L’API classic branch protection signale `protected=true` mais `protection.enabled=false`; le ruleset est actif et vérifié.
- 21 branches de PR comparées à main (a/b ci-dessous), les 146 comparaisons exhaustives restent à faire. Les dates de commit pour chaque branche ne sont pas disponibles via la liste branches, donc non renseignées.

### Comparaisons ahead/behind actualisées
| PR | Ahead | Behind | Statut compare | Conclusion |
|---|---:|---:|---|---|
| #99 | 21 | 228 | diverged | Rebrand très ancien; CI tests failed |
| #102 | 13 | 228 | diverged | CI tests failed; très ancien |
| #110 | 15 | 53 | diverged | CI tests failed; rebase nécessaire |
| #114 | 4 | 50 | diverged | CI green mais roadmap ancienne |
| #115 | 1 | 23 | diverged | CI tests+ZIP green; rebase nécessaire |
| #117 | 47 | 0 | ahead | CI tests+ZIP+ESLint green; réconciliation migration #128 requise |
| #118 | 42 | 23 | diverged | CI tests+ZIP green; comparer avec #126 |
| #125 | 43 | 0 | ahead | CI 3/3 green; recette PDF à vérifier manuellement |
| #126 | 30 | 0 | ahead | CI tests+ZIP green; portage vidéo candidat |
| #127 | 5 | 0 | ahead | CI 3/3 green; recette devis A4 |
| #128 | 39 | 0 | ahead | CI tests+ZIP+ESLint green; intégration migration #117 version 21 |
| #130 | 16 | 0 | ahead | Nouveau head `378ff2a2`; CI tests en cours après port badge pro |
| #131 | 4 | 0 | ahead | CI tests+ZIP green; feuille de route récente |
| #133 | 13 | 0 | ahead | Aucun run CI sur head; branch review requise |
| #134 | 3 | 0 | ahead | CI 3/3 green |
| #135 | 11 | 0 | ahead | CI 3/3 green |
| #136 | 5 | 0 | ahead | CI 3/3 green |
| #137 | 8 | 0 | ahead | CI Tests+ZIP green; ESLint non déclenché pour ces chemins |
| #138 | 8 | 0 | ahead | CI Tests+ZIP green; ESLint non déclenché pour ces chemins |
| #139 | 1 | 0 | ahead | CI Tests+ZIP green |
| #140 | 2 | 0 | ahead | CI tests+ESLint en cours; ZIP green |

### CI actualisée — heads ouverts
- #134, #135, #136 : 3/3 checks success.
- #137, #138 : tests Node/MySQL et ZIP success; **aucun ESLint run** sur leurs HEAD, car le workflow `.github/workflows/lint.yml` ne couvre pas les routes clients/produits ni les tests concernés.
- #139 : Tests automatisés et ZIP success.
- #130 : ancien run échoue uniquement à la recette visuelle (badge `span.pro-status` 2,23:1). Cause confirmée dans les logs. Correctif port de #139 ajouté dans `public/css/enterprise-workspace.css`, commit `378ff2a2ce0b8e18355ce3ec374421b487b04187`. Sur ce head, ESLint+ZIP success, tests Node/MySQL encore in_progress.
- #140 : nouvelle PR draft pour étendre ESLint aux routes `server/routes/clients.js`, `server/routes/produits.js` et tests `client-history-protection`, `stock`, `produits-delete`; commit head `c4125b4d`. Tests et ESLint in_progress, ZIP success.
- #129 : tests+ESLint+ZIP green; #131 tests+ZIP green; #117/#128/#125/#127 tests+ZIP green; #126/#118 tests+ZIP green.
- #110/#102/#99 : tests failed, ESLint et ZIP green. #114 tests+ZIP green mais 50 commits behind. #115 tests+ZIP green mais 23 behind. #133 aucun run sur head.

### Corrections et nouveaux constats
- #130 : port du sélecteur contrasté `.pro-workspace-guide-head .pro-status` (clair `#066144`, sombre/sombre-système `#9DE7BC`) depuis la PR #139. Le test visuel #130 est à revalider sur head `378ff2a2`; ne pas déclarer la PR validée avant sa CI complète.
- #137 et #138 : tests CI Node/MySQL et package réussis; les jobs ESLint n’ont pas été déclenchés pour les fichiers modifiés. PR #140 corrige le périmètre du lint, mais ne lint pas encore le code de #137/#138 (PR #140 est basée sur main). Après validation #140, il faudra intégrer/rebaser la config sur ces branches et relancer leurs CI, sans merge automatique.
- #140 : 2 fichiers modifiés (`.github/workflows/lint.yml`, `eslint.config.mjs`), ajout de 5 chemins backend/test à la configuration et à la commande. CI en cours.

### Plan
1. Attendre les CI #130 et #140; examiner les logs en cas d’échec.
2. Si #140 green, rebaser/porter sa configuration lint dans les branches #137/#138 pour vérifier les fichiers réellement modifiés.
3. Revue des correctifs P1 #134–#139, puis migration combinée #117/#128 version 21 additive/idempotente.
4. Rebase #115; recette PDF/Responsive #125/#127; analyse doublons #118/#126, #114/#131, #102/#110.
5. Continuer l’audit détaillé des branches restantes; tests locaux/Docker/PDF/backup manuels non exécutés dans cet environnement.

### Protections
Aucun merge, PR fermé, branche supprimée, modification directe de main, donnée/volume/backups supprimé, ni paiement réel activé. Les corrections restent en PR draft.


## Run 4 — suivi correctif CI #140, 06:30 UTC
- Le premier lint #140 (`44993878778`) a échoué parce que la commande ESLint listait `server/tests/client-history-protection.test.js`, fichier absent de main (il est ajouté par #137). Log exact : « No files matching the pattern ... were found. »
- Correction minimaliste : commit `4656d588b321ae8e75b1cb0bc475a6ffabcd846b` retire ce fichier absent de la commande exécutée sur main, tout en gardant son chemin dans les filtres de déclenchement et la configuration ESLint. Lorsque #137 ajoute le test, le workflow pourra l’inclure.
- Head PR #140 maintenant `4656d588`; un nouveau run lint/test est attendu. Le run initial #140 tests Node/MySQL est encore en cours, ZIP green; lint initial failure, corrigé dans le nouveau commit, pas encore validé.
- #130 head `378ff2a2`: ESLint+ZIP green, tests Node/MySQL toujours in_progress au dernier contrôle.
- Inventaire des branches actualisé pour refléter le head #140 `4656d588`.


## Run 4 — actualisation CI après couverture ESLint, 06:32 UTC
- HEADs actualisés : #137 `f2aada8d`, #138 `44d02021`, #140 `d16c4c54`; inventory branch list regenerated (146 branches / 144 unique heads, 23 PR).
- #137/#138 : le workflow ESLint manquait les routes et tests backend. Les fichiers `.github/workflows/lint.yml` et `eslint.config.mjs` de #140 ont été portés sur les deux branches. **ESLint green sur les nouveaux heads** (#137 run 477, #138 run 478) et ZIP green; tests Node/MySQL en cours sur #137 run 1421 et #138 run 1422.
- #140 : ESLint green sur head `d16c4c54` (run 476), ZIP green (1122); tests Node/MySQL en cours (1420). Le premier lint failure #474 était causé par test absent sur main; condition de présence ajoutée pour que le test #137 soit linté lorsqu’il existe.
- #130 : head `378ff2a2`, ESLint green (473), ZIP green (1117), tests Node/MySQL/recette visuelle toujours in_progress (1415). Le badge professionnel corrigé; la recette visuelle est en cours.
- #139 : Tests et ZIP green; #134/#135/#136 3 checks green; #117/#128/#125/#127 3 checks green; #129 3 green; #131 tests+ZIP green; #118/#126 tests+ZIP green; #114 tests+ZIP green mais 50 behind; #115 tests+ZIP green mais 23 behind.
- #99/#102/#110 : tests CI failed sur HEAD; #133 aucun run CI sur head.
- #137/#138 ont temporairement des modifications identiques de configuration lint à #140, afin de vérifier leurs propres fichiers avant merge. Après intégration autorisée, les duplications seront réconciliées/rebasées.
- Aucun test local, Docker local, recette PDF manuelle, NVDA/VoiceOver ou merge effectué.


## Run 4 — corrections supplémentaires après CI, 06:35 UTC
- #130 test run 1415 sur head `378ff2a2` échoue encore à la recette visuelle, mais sur un second défaut : label sélectionné `Facture` dans `nouvelle-facture`, foreground `rgb(10,122,69)`, background `rgb(26,27,46)`, ratio 3,13:1. Le badge professionnel initial est corrigé; l’audit visuel continue et révèle le défaut de contraste du switch.
- Correction #130 commit `c420c63abc00964d7e5b3e3b2aaad024df776b45`: `.invoice-type-switch label:has(input:checked)` utilise `var(--emerald-text)` au lieu de l’accent décoratif `var(--emerald)`. Ratio calculé pour #9DE7BC/#1A1B2E = 11,76:1; #066144/#EAF3EC = 6,62:1 (calcul local, recette CI encore en attente). Head c420c63 ESLint+ZIP+tests déclenchés; ZIP green, ESLint/tests in progress.
- #138 : défaut découvert dans #138, suppression produit vérifiait `SUM(quantite)` entre entrepôts; des soldes +3 et -3 pourraient s’annuler et masquer des lignes non nulles. Correctif `SELECT id ... quantite <> 0 ... FOR UPDATE` et protection des lignes cross-tenant même si quantité nulle. Tests ajoutés pour net zéro et conservation des deux balances. Head `c4340b88`: ESLint green, ZIP green, tests en cours.
- #137 head `f2aada8d`: ESLint+ZIP green, tests en cours. #140 head `d16c4c54`: ESLint+ZIP green, tests en cours.
- #130/#138 CI en cours après nouveaux commits; aucune correction déclarée validée avant tests complets.


## Addendum — run 6, 22 novembre 2026

### État actuel confirmé
- `main` HEAD `8453ee6d8e633f151523236eecff1bc0e0cf877b`; CI Tests automatisés #1296 green.
- Ruleset `protect main` enforcement active; deletion/non-fast-forward blocked; PR required; required checks `Tests Node.js et MySQL` et `Build complete source archive`; thread resolution required; no bypass actors. Required approvals = 0. Classic branch-protection endpoint reports protected=true but protection.enabled=false; enforcement comes from the active ruleset.
- Branches 146, HEAD uniques 144, 23 PR ouvertes. L'inventaire complet noms/HEAD a été régénéré dans `docs/branch-inventory-20261122.md` (commit e0efa178) à partir des deux pages REST.

### Corrections et CI
- PR #137 client history protection: Tests Node/MySQL #1421, ESLint #477, ZIP #1123 green.
- PR #138 product/stock protection: Tests Node/MySQL #1429, ESLint #483, ZIP #1131 green. Net-zero warehouse balances (+3/-3) test included and passing.
- PR #139 pro-workspace contrast: Tests #1412 and ZIP #1114 green.
- PR #140 ESLint backend coverage: Tests #1420, ESLint #476, ZIP #1122 green.
- #134/#135/#136: all three checks green.
- PR #130 current head `780b357a`: ESLint #484 and ZIP #1132 green; Tests Node/MySQL #1430 still in progress. Previous #1428 visual failure on group-company page was caused by dark topbar controls and the percentage label on the conic-gradient. CSS correction was pushed only to the PR branch; do not declare the PR green until #1430 completes.

### Branch comparison and stale failures
All 23 open PR heads were compared with current main. #118, #115, #114 are ahead/behind or divergent and must not be integrated without rebase. #110/#102/#99 visual tests fail on their current heads; logs confirm #110 expense amount contrast 4.23:1, #102 native date input focus invisible, #99 dark availability badge 3.97:1. #129/#125/#127/#133/#132 have no workflow run visible on the queried heads.

### Schema integration blocker
PR #117 has CURRENT_SCHEMA_VERSION 20 (accounting invoice reversal v19, expense payment method v20); PR #128 has CURRENT_SCHEMA_VERSION 19 for the 15-day trial columns. Both CI suites are green, but direct integration would collide in version numbering. Plan a combined schema v21: retain accounting reversal and expense-payment migration, add trial fields in v21, ensure additive/idempotent migrations, and test upgrading main v18, accounting v20, and trial v19 databases with data preservation and re-run safety. No merge performed.

### Safety and scope
No direct main update, no merge/close, no branch deletion, no data/volume/backup deletion, no real payments enabled. Local tests/Docker and manual SYSCOHADA certification were not performed. Full diff/date review of non-PR branches remains outstanding.


## Addendum — run 7, 22 novembre 2026 (09:23 UTC)

### État actuel et limites de vérification
- Main confirmé au SHA `8453ee6d8e633f151523236eecff1bc0e0cf877b`; le commit récent est le merge PR #123. Les endpoints status et workflow-runs accessibles ont renvoyé zéro status et zéro run pour main; le run main #1296 mentionné dans l'addendum précédent n'est donc **pas revalidé sur ce run**.
- Branch names: 146; deux pages 100 + 46; noms identiques à l'inventaire précédent. L'inventaire mixte contient 145 SHA enregistrés et 143 valeurs uniques (self branch sans SHA); ce n'est pas un refresh global des refs. Dates de dernier commit non disponibles. HEADs actualisés pour 22 branches de PR et 62 branches sélectionnées sans PR ouverte.
- 23 PR ouvertes confirmées. Comparaisons fraîches main...head pour les 23; CI consultée pour les 23.

### PR ahead/behind (recalcul par SHA actuel; main = 8453ee6d)
| PR | Ahead | Behind | Remarque |
|---|---:|---:|---|
| #132 | 46 | 0 | rapport documentaire; dernier HEAD sans runs retournés |
| #130 | 20 | 0 | HEAD corrigé 9722ca99, CI relancée |
| #138 | 15 | 0 | stock/protection |
| #140 | 4 | 0 | lint backend |
| #137 | 10 | 0 | protection clients |
| #139 | 1 | 0 | contraste pro |
| #135 | 11 | 0 | protection factures |
| #136 | 5 | 0 | protection dépenses |
| #134 | 3 | 0 | badge Entreprise |
| #117 | 47 | 0 | contrepassations |
| #115 | 1 | 23 | diverged; rebase requis |
| #133 | 13 | 0 | base #130; non-mergeable, PR empilée |
| #125 | 43 | 0 | PDF page finale |
| #126 | 30 | 0 | vidéo landing |
| #131 | 4 | 0 | roadmap |
| #118 | 42 | 23 | diverged |
| #99 | 21 | 228 | diverged ancien |
| #114 | 4 | 50 | roadmap ancienne |
| #102 | 13 | 228 | diverged ancien |
| #110 | 15 | 53 | diverged ancien |
| #129 | 9 | 0 | workspace |
| #127 | 5 | 0 | devis Executive |
| #128 | 39 | 0 | essai 15 jours |

### CI fresh sur HEAD
| PR | Tests Node/MySQL | ESLint | ZIP |
|---|---|---|---|
| #132 | aucun run sur HEAD actuel; #1446 in_progress sur HEAD précédent, #1433 success plus ancien | — | aucun run sur HEAD actuel; #1148 in_progress sur HEAD précédent, #1135 success plus ancien |
| #130 | #1430 failure ancien HEAD; #1434 success nouveau | #484 success ancien; #485 success nouveau | #1132 success ancien; #1136 success nouveau |
| #138 | #1429 success | #483 success | #1131 success |
| #140 | #1420 success | #476 success | #1122 success |
| #137 | #1421 success | #477 success | #1123 success |
| #139 | #1412 success | workflow lint absent | #1114 success |
| #135 | #1393 success | #470 success | #1095 success |
| #136 | #1381 success | #464 success | #1083 success |
| #134 | #1376 success | #461 success | #1078 success |
| #117 | #1355 success | #446 success | #1057 success |
| #115 | #1220 success | workflow lint absent | #925 success |
| #133 | aucun run trouvé | aucun run | aucun run |
| #125 | #1369 success | #456 success | #1071 success |
| #126 | #1310 success | workflow lint absent | #1012 success |
| #131 | #1364 success | workflow lint absent | #1066 success |
| #118 | #1288 success | workflow lint absent | #992 success |
| #99 | #1014 failure | #165 success | #728 success |
| #114 | #1221 success | workflow lint absent | #926 success |
| #102 | #1120 failure | #268 success | #832 success |
| #110 | #1276 failure | #390 success | #981 success |
| #129 | #1326 success | #417 success | #1028 success |
| #127 | #1314 success | #405 success | #1016 success |
| #128 | #1331 success | #422 success | #1033 success |

### #130 — diagnostic CI et correctif run 7
- Tests Node/MySQL #1430 sur HEAD `780b357a` : les tests unitaires/integration, restauration chiffrée et smoke test Docker/MySQL/Redis ont terminé success; échec de la **recette visuelle** sur `groupe-entreprise`.
- Logs: `button#workspace-notification-toggle` foreground `#E8F1FB` sur surface `#F6F7F5`, ratio 1,06:1. Les labels localization/logout héritaient également du texte pâle sur surface/fallback clair (ratios signalés 1,06/1,14). Cause: override topbar qui forçait le texte pâle sur boutons à surface claire, contradictoire avec son commentaire.
- Correctif commit `9722ca99809cff46317ff82c5e604f86937c3790`, fichier `public/css/enterprise-workspace.css`: variables theme-aware navy `#082B50` en light, pâle `#E8F1FB` en dark, hover emerald adapté aux surfaces. Diff relu après commit.
- Calculs de couleur (non-browser): navy/cream 13,28:1; emerald foncé/green-light 6,80:1; texte clair/dark surface 11,91:1; hover dark 5,28:1. **Ces calculs ne remplacent pas la recette visuelle.**
- Nouveau HEAD PR #130 `9722ca99`, draft=true. Tests Node/MySQL #1434, ESLint #485 et ZIP #1136 sont tous success; la recette visuelle responsive a réussi. PR non fusionnée, revue humaine requise.
- Commentaire de suivi ajouté à la PR #130 (comment ID 7077143189).

### Branches sans PR — comparaison ciblée 62 (dates/CI non exhaustives)
Les nombres ci-dessous sont ahead/behind de main. Toutes ces branches n'ont pas été examinées diff ligne par ligne; les comparaisons et commits de tête sont rafraîchis pour ce sous-ensemble. Deux comparaisons complémentaires: `feat/enterprise-command-center-20261117` 8/400 (4 fichiers), `feat/enterprise-company-pagination-20261117` 0/359 (behind only).

**Audit/sécurité:**
- `audit/fix-backup-and-runtime-20261110`: 126/774, 41 fichiers; `audit/fix-enterprise-migration-invitation-20261116`: 14/585, 12 fichiers; `audit/fix-nginx-upstream-order-20261116`: 2/587, 2 fichiers; `audit/fix-realtime-company-groups-20261116-run1`: 3/585, 2 fichiers.
- `audit/fix-reset-email-docs-and-redaction-test-20261116`: 0/405; `audit/npm-audit-gate-2026-11-16`: 0/589; `audit/securite-2026-11-15`: 0/651; `audit/security-multisocietes-review-20261116-run3`: 0/402.
- `security/docker-ignore-local-secrets-2026-11-15`: 2/617, 2 fichiers; `security/immediate-session-revocation-2026-11-16`: 2/598, 1 fichier de test; `security/redact-secret-urls-in-logs-2026-11-16`: 10/588, 6 fichiers.

**Sauvegardes/Docker/workers/stock:**
- `fix/atomic-backup-publish-2026-11-15`: 1/617, 2 fichiers; `fix/atomic-encrypted-backups-2026-11-15`: 1/617, 2 fichiers; `fix/backup-retention-guard-2026-11-16`: 19/596, 8 fichiers.
- `fix/docker-context-secrets-and-lockfile-2026-11-15`: 3/614, 3 fichiers; `fix/docker-local-startup-mysql-redis-swagger`: 2/622, 4 fichiers.
- `fix/pdf-worker-db-readiness-2026-11-16`: 4/591, 3 fichiers; `fix/pdf-worker-health-and-sidebar-icons-2026-11-15`: 1/614, 2 fichiers; `fix/pdf-worker-wait-for-api-health-2026-11-15`: 1/620, 2 fichiers.
- `fix/purchase-receipt-warehouse-deadlock-20261119`: 0/70 (behind only).

**Comptabilité/abonnements/workspace/UI:**
- `fix/accounting-refund-journal-reversal-20261121`: 43/23, 18 fichiers; PR #120 closed/merged into `feat/accounting-expense-payment-mode-20261121` (non-main base). Cette branche feature est 44/23; #117 head contient la branche feature comme ancêtre et est 47/0.
- `feat/subscription-engine-local-simulation-20261117`: 0/303; `feat/enterprise-multi-company-foundation-20261116`: 99/401, 32 fichiers; `feat/enterprise-workspace-ux-20261117`: 37/398, 27 fichiers.
- `feat/invoice-templates-pro-enterprise-20261117`: 0/291; `feat/monthly-invoice-quota-v8-2026-11-15`: 1/617, 10 fichiers; `fix/monthly-invoice-quota-schema-v8-2026-11-15`: 1/616, 10 fichiers.
- `fix/session-revocation-and-payment-timeouts-2026-11-15`: 5/618, 5 fichiers; `fix/revoke-jwt-on-logout-2026-11-15`: 2/618, 2 fichiers.
- `feat/enterprise-command-center-20261117`: 8/400, 4 fichiers; `feat/enterprise-company-pagination-20261117`: 0/359 (behind only).

### Revue de diff ciblée (branches non-PR)
- Docker-secret test: branche `security/docker-ignore-local-secrets` ajoute sentinel .env/.server-env puis inspecte l'image; la branche est très ancienne (617 behind), porter le test sur main actuel plutôt que merger.
- Session revocation: branche `security/immediate-session-revocation` contient tests pour relecture `token_version` inter-worker, mais 598 behind et n'apporte pas de code d'implémentation dans le diff consulté; ne pas intégrer seule.
- Atomic backup: branches `fix/atomic-backup-publish` et `fix/atomic-encrypted-backups` publient via fichier temporaire + rename atomique et testent les fichiers temporaires; 617 behind, diff utile à porter/retester sur main.
- Backup retention branch: commit consulté concerne `require('dotenv').config()` dans restore script; 596 behind, pas une PR, revalider config/env sur main.
- Branches PDF-worker et startup Docker: peu de commits ahead, centaines behind; conserver les idées, pas intégrer sans rebase et CI.

### Schéma comptable / essai gratuit
- #117 et #128 restent CI green mais versions de schéma concurrentes (20 et 19). #120 est une PR fermée/merged sur une base feature, pas main; comparaison montre sa branche feature ancêtre de #117 head. Préparer une intégration combinée version 21, tests migration et isolation, sans merge.
- Aucun paiement réel activé.

### Sécurité / préservation
Aucune modification directe à main, merge/close de PR ouvertes, suppression de branche, données, sauvegarde ou volume Docker. Tests locaux/Docker et certification SYSCOHADA non exécutés. Audit des 61 branches restantes sans PR ouverte (diff, dates, CI) est encore incomplet.


### Documentation branch follow-up
- PR #132 latest head `9f6e89ff` is 43 ahead/0 behind; current CI Tests #1446 and ZIP #1148 are in_progress. Previous #1433/#1135 were green on an earlier HEAD; they do not validate the latest inventory updates.


### Run 7 — vingt comparaisons supplémentaires PDF / responsive (branches sans PR ouverte)
- `fix/invoice-print-and-payment-stamp-2026-11-15`: 8/653 (4 files).
- `fix/invoice-print-banner-geometry-20261121`: 0/54; `fix/invoice-print-typography-20261118`: 0/240; `fix/invoice-pdf-continuation-identity-20261121`: 0/24 (behind only).
- `fix/pdf-headless-user-formatting-20261121`: 2/39 (4 files); `fix/pdf-pagination-extras-flow-20261117`: 7/396 (4 files).
- `fix/pdf-print-pagination-20261117`: 0/394; `fix/pdf-stream-ack-payment-disclosures-20261116`: 0/423 (behind only).
- `test/invoice-long-pdf-pagination-20261121`: 0/16; `test/invoice-short-pdf-one-page-20261121`: 0/1 (behind only).
- `fix/mobile-invoice-line-columns`: 35/597 (7 files); `fix/invoice-mobile-table-cards-20261121`: 0/17; `fix/invoice-footer-stamp-mobile-20261121`: 0/7.
- `fix/visual-qr-fixture-20261121`: 1/21; `fix/ui-responsive-polish-20261117`: 0/301; `feat/responsive-scaling-2026-11-15`: 0/655; `ui/modern-responsive-polish`: 0/803 (behind only).
- `test/workspace-zoom-200-sweep-20261118`: 4/231; `test/dark-theme-zoom-200-sweep-20261118`: 2/230; `test/theme-dark-mobile-sweep-20261118`: 3/235.
- Les commits de tête de ces 20 branches sont rafraîchis dans l'inventaire. Les statuts CI de ces branches non-PR ne sont pas vérifiés (le connecteur workflow-runs ne retourne que les runs PR). Les branches behind-only semblent déjà intégrées/obsolètes au regard de main; celles qui sont diverged sont à porter sélectivement, jamais merge direct.


### Run 7 — dix comparaisons supplémentaires abonnements / workspace / modules
- `feat/abonnement-choix-moyen-paiement`: 0/568 (behind only).
- `feat/phases-2-4-paiements-compta-achats-20261112`: 45/717, 17 fichiers.
- `feat/phases-5-7-portal-international-automation-20261112`: 84/716, 23 fichiers.
- `feat/topbar-notifications-bell-20261112`: 5/718, 3 fichiers.
- `feat/ui-motion-visual-recette-20261112`: 0/753 (behind only).
- `feat/dashboard-reference-modules-20261119`: 0/74; `feat/dashboard-reference-redesign-20261112`: 0/719 (behind only).
- `feat/sidebar-icon-label-navigation-20261117`: 1/313, 9 fichiers; `feat/sidebar-navigation-visual-refresh-20261117`: 0/390 (behind only).
- `feat/enterprise-pages-v2-2026-11-13`: 174/703, 64 fichiers.
- Les HEADs de ces 10 branches sont mis à jour dans l'inventaire. Aucun workflow CI non-PR n'est validé sur ce run.
