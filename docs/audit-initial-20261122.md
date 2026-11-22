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
