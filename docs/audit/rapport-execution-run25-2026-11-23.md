# Audit et exécution — Run 25 — 23 novembre 2026

> Rapport append-only. Les rapports historiques ne sont ni remplacés ni réécrits. Snapshot GitHub vérifié le 23 novembre 2026 à 18:16 UTC puis complété pendant le Run 25. Aucune fusion, migration ou opération sur des données n'a été exécutée pendant ce run.

## 1. Snapshot du dépôt

- Dépôt : `morn53426-ui/-samafacture-pro` (public).
- Branche par défaut : `main`.
- SHA main observé : `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c`.
- Ce commit correspond à la fusion de la PR #194.
- Branches : **220** (pages REST : 100 + 100 + 20). Toutes conservées.
- Pull Requests : **207** (pages REST : 100 + 100 + 7).
  - ouvertes : **58** ;
  - fusionnées : **117** ;
  - fermées sans fusion : **32**.
- Aucun branchement, commit ou historique n'a été supprimé.

## 2. Main et CI après la PR #194

PR #194 — sécurité des relations multi-tenant facture/client/paiement :
- head fusionné : `970832f4bb45bb348dae99967183e917beeeb7e3` ;
- commit de fusion / main observé : `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c` ;
- statut GitHub : merged le 23 novembre 2026 à 16:53:15 UTC.

Checks de la PR #194 sur le head exact `970832f4bb45bb348dae99967183e917beeeb7e3` :
- Tests Node.js et MySQL : success — run [45218709676](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45218709676) ;
- ESLint : success — run [45218710123](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45218710123) ;
- Build complete source archive : success — run [45218710373](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45218710373).

CI post-fusion de main :
- check `Tests Node.js et MySQL` sur le SHA exact `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c` : completed / success — [run 45221526816](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45221526816).
- Le check-runs API sur le SHA de main n'expose qu'un check post-fusion (Tests Node.js et MySQL). Aucun statut post-fusion distinct ESLint/ZIP n'est revendiqué ici.
- Aucun nouveau merge effectué au Run 25.

## 3. Workflows et migrations repérés sur main

Workflows présents :
- `.github/workflows/test.yml`
- `.github/workflows/lint.yml`
- `.github/workflows/package-source-zip.yml`

Migrations sous `server/database/migrations/` :
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

Autres fichiers de migration historiques repérés à la racine :
- `migration_2026_08_30_stabilite.sql`
- `migration_2026_11_15_token_version.sql`
- `migration_facture_personnalisation.sql`
- `migration_index_reset_token.sql`
- `migration_scalabilite_30_41.sql`

Inventaire uniquement en lecture. **Aucune migration n'a été exécutée** au Run 25.

## 4. P0 — règles de protection GitHub

Ruleset `protect main`, id `27410527`, état `active`, ciblant `refs/heads/main`.

Règles lues :
- suppression de branche : interdite ;
- non-fast-forward / force push : interdit ;
- Pull Request obligatoire ;
- résolution des threads : obligatoire ;
- checks requis : `Tests Node.js et MySQL` et `Build complete source archive` ;
- `required_approving_review_count = 0` ;
- `require_code_owner_review = false` ;
- `require_last_push_approval = false` ;
- aucun acteur de bypass (current_user_can_bypass = never).

**Risque P0 :** le ruleset bloque les suppressions et force push mais n'exige pas d'approbation humaine. Cette configuration administrative n'a pas été modifiée. Une validation spécifique du propriétaire est requise avant tout changement de règles de protection ; recommandation à étudier : au moins une approbation indépendante et une approbation après le dernier push, avec révocation des reviews obsolètes.

## 5. Sécurité multi-tenant — consolidation après #194

Code relu sur `main` SHA `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c` :
- `server/routes/professionnel.js` : le relevé client joint `pro_refund_requests` au paiement par `p.user_id = r.user_id`, puis la facture par `f.user_id = p.user_id`.
- `server/tests/professional-tenant.test.js` : test de non-régression simulant une référence de paiement cross-tenant, avec restauration de la fixture dans un bloc `finally`.
- `server/routes/factures.js` : relation facture/client avec égalité des propriétaires et retrait de `verification_code` des réponses de liste ; le détail authentifié conserve le code requis pour le QR.
- `server/routes/clients.js` : historique client renvoyé sans `verification_code`.

Les PR historiques suivantes sont désormais couvertes en tout ou partie par #194. Elles sont conservées ouvertes, sans fermeture ni suppression de branche :
| PR | Comparaison `main...head` | Décision |
|---|---:|---|
| #177 | diverged, 6 commits ahead / 47 behind | redondante : redaction des codes déjà intégrée |
| #199 | diverged, 3 ahead / 41 behind | correctif relevé remboursements intégré par #194 |
| #179 | diverged, 23 ahead / 47 behind | supersédée par la consolidation #194 |
| #188 | diverged, 10 ahead / 42 behind | supersédée par la consolidation #194 |
| #203 | diverged, 6 ahead / 39 behind | redondante : redaction déjà intégrée |

Pour ces cinq PR, les checks combinés du head n'ont pas retourné de statut exploitable au moment du Run 25. Les validations historiques ne sont pas transférées. Des commentaires d'audit Run 25 ont été publiés sur chacune :
- #177 comment 7109947043 ;
- #199 comment 7109947841 ;
- #179 comment 7109948778 ;
- #188 comment 7109949613 ;
- #203 comment 7109950311.

Ne pas rebaser ou fusionner ces branches à l'aveugle : elles divergent fortement de main et leur objectif est déjà couvert par #194.

## 6. P1 — cycle comptable et migrations v21/v22

### PR #142 — cycle de vie facture, comptabilité et essai de 15 jours
- base historique : `8453ee6d8e633f151523236eecff1bc0e0cf877b` ;
- head historique : `decb8da2e48e8f7a93fc63202f00fe0b4170e6e2` ;
- comparaison avec main courant : diverged, **77 commits ahead / 140 behind**, 48 chemins modifiés.
- Checks sur le head historique exact : Tests run 45027909669 success, ESLint run 45027909637 success, ZIP run 45027909640 success.
- Le lot inclut les changements de cycle de vie comptable, essai gratuit 15 jours et migration v21 (011).

Les anciens checks sont verts sur leur ancien SHA, mais ne couvrent aucune synchronisation sur main courant. Aucun rebase automatique, aucune exécution de migration et aucune fusion. Une reprise devra être faite sur branche dédiée, avec revue des conflits sur les 48 chemins, CI complète sur le nouveau SHA et validation humaine spécifique comptabilité/migration.

Commentaire d'audit publié : #142, comment 7109969249.

### PR #145 — conservation des événements de contrepassation, schéma v22
- base empilée : PR #142 / head `decb8da2e48e8f7a93fc63202f00fe0b4170e6e2` ;
- head historique : `5b6ba8bf3b05e4155697159c60cf4b5051196bf8` ;
- comparaison main courant : diverged, **92 commits ahead / 140 behind**.
- Checks sur ce head historique exact : Tests run 45029642007 success, ESLint run 45029642012 success, ZIP run 45029642014 success.

Risque précis : la migration v22 retire la FK `fk_pro_compta_facture_events_invoice` de la table des événements de contrepassation afin de conserver l'événement après une suppression SQL de facture. `facture_id` peut alors rester orphelin ; les événements sont toujours rattachés au tenant par `user_id`. Il s'agit d'un changement de schéma affectant une piste d'audit comptable. L'ancienne CI verte ne suffit pas à autoriser la migration.

**Blocage conservatoire :** validation humaine spécifique du propriétaire métier/comptable requise avant toute fusion ; revue de la migration et des scénarios de conservation/purge nécessaire. Aucune migration n'a été lancée.

Commentaire d'audit publié : #145, comment 7109969931.

## 7. P1 — devise des commandes commerciales

PR #210 — `fix(currency): enforce company base currency for sales orders` :
- base SHA : `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c` (main du snapshot) ;
- head exact : `fa92faeccf886fa3d67f4c8003fbc7b2f0ccf5ad` ;
- 2 fichiers modifiés ;
- Test Node/MySQL : success — [45224583486](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45224583486) ;
- ESLint : success — [45224583453](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45224583453) ;
- ZIP : success — [45224583450](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/45224583450).

Revue statique : le endpoint `POST /api/pro/orders` refuse avec HTTP 409 une devise supportée différente de la devise de base, avant insertion. Deux tests couvrent FCFA→EUR et EUR→FCFA et vérifient l'absence d'insertion incohérente. Aucun enregistrement historique, calcul de montant, TVA ou écriture comptable n'est modifié.

**Décision restante :** confirmer côté produit/comptabilité que les commandes multi-devises doivent rester interdites jusqu'à la disponibilité d'un moteur de conversion, notamment pour les intégrations API externes. CI verte ne constitue pas cette décision. PR maintenue en Draft, pas d'approbation ni fusion.

Commentaire de revue publié : #210, comment 7109970724.

## 8. Plan de suivi P0–P3

| Priorité | Lot | État au Run 25 | Étape sûre suivante |
|---|---|---|---|
| P0 | Approbation indépendante / ruleset main | protection active mais 0 approbation requise | demander validation du propriétaire avant changement administratif |
| P0 | Isolation multi-tenant factures/paiements/remboursements | consolidation #194 fusionnée, CI du head et test post-merge vert | poursuivre la revue de chemins non couverts sans dupliquer les corrections |
| P1 | Cycle comptable et essai 15 jours v21 (#142) | head ancien, 140 commits derrière | plan de reprise dédié, analyse de conflits, revue humaine |
| P1 | Conservation événement contrepassation v22 (#145) | head ancien, migration critique | validation comptable spécifique avant reprise/fusion |
| P1 | Devise commandes (#210) | CI complète verte sur le head courant | arbitrage métier/comptable avant sortie de Draft |
| P2 | Paramètres responsive (#211/#209/#155) | candidats en concurrence | comparer les diffs et effectuer recette navigateur multi-largeurs/zoom avant de choisir un seul lot |
| P2 | Navigation mobile (#208/#154) | candidats en concurrence | vérifier accessibilité clavier, focus, Escape et responsive avant intégration |
| P2 | Impression/PDF A4 | plusieurs corrections déjà intégrées auparavant | recette visuelle réelle : largeur du bandeau, titre FACTURE non coupé, polices, pages longues |
| P3 | Documentation et CI | rapports précédents conservés | continuer les rapports append-only et consolider les critères de recette |

## 9. Journal d'exécution Run 25

Actions réalisées :
- [x] Snapshot main vérifié sur SHA exact.
- [x] Inventaire paginé de 220 branches et 207 PR.
- [x] Vérification workflows, migrations et ruleset.
- [x] Vérification des checks exacts de la PR #194 et du commit post-merge main.
- [x] Relecture statique des jointures de remboursement, des listes facture et de l'historique client.
- [x] Comparaison des cinq PR de sécurité historiques avec main et commentaires conservatoires publiés.
- [x] Vérification des checks exacts et de la divergence des PR #142, #145 et #210.
- [x] Rapport Run 25 créé dans un nouveau fichier, sans écraser les rapports historiques.
- [ ] Aucun merge réalisé au Run 25.
- [ ] Aucun test exécuté localement depuis ce runtime.
- [ ] Aucune recette navigateur manuelle réalisée au Run 25.
- [ ] Aucune migration exécutée.

Garanties de préservation :
- aucun push direct ou force push sur `main` ;
- aucune branche ou PR supprimée ou fermée ;
- aucune donnée, écriture comptable historique, sauvegarde ou volume modifié ;
- aucun secret ou moyen de paiement réel activé ;
- aucun déploiement en production ;
- aucune modification de protection GitHub sans validation spécifique.

**Décision Run 25 :** main reste stable sur le SHA vérifié et le test post-fusion est vert. Les lots de sécurité déjà absorbés ne seront pas fusionnés une seconde fois. Les migrations v21/v22 et la règle de devise restent bloquées aux validations métier/humaines requises. Les prochaines actions doivent commencer par la gouvernance P0 et la planification de reprise des branches divergentes, sans toucher aux données historiques.
