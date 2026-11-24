# Audit ciblé — doublons de code et de pull requests (24 novembre 2026)

## Portée et sécurité des changements

- Branche dédiée : `audit/dead-code-consolidation-20261124-run33`
- Base exacte : `main` au commit `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c`
- Aucun changement poussé sur `main`.
- Aucune branche ou PR supprimée, fermée ou fusionnée.
- Aucune migration, donnée, facture, écriture comptable, sauvegarde, volume Docker ou configuration de paiement modifiée.

## Nettoyage de code confirmé

### Échappement HTML des emails d’authentification

**Fichier :** `server/routes/auth.js`

Le fichier contenait une fonction locale `echapperHtml()` reproduisant le comportement de `escapeHtmlEmail()` dans `server/utils/email-escape.js`. Dans le fichier audité, cette fonction locale n’était appelée que pour le nom affiché dans l’email de réinitialisation du mot de passe.

**Correction préparée :**
- importer `escapeHtmlEmail` depuis l’utilitaire partagé ;
- remplacer l’appel local pour le nom de l’utilisateur ;
- retirer la copie locale devenue redondante ;
- ajouter une garde dans `server/tests/email-escape.test.js` pour empêcher le retour de cette duplication.

Le helper partagé conserve le même encodage des caractères HTML (`& < > " '`). Le changement ne touche ni le lien de réinitialisation, ni sa durée de validité, ni la logique d’authentification.

## Doublons de pull requests confirmés

### PR #209 et PR #211 — grille responsive des coordonnées entreprise

- Les deux PR changent exactement les mêmes trois fichiers :
  - `.github/workflows/lint.yml`
  - `public/parametres.html`
  - `server/tests/parametres-accessibility.test.js`
- Les deux branches divergent depuis le même commit de base ; elles ne sont pas une relation simple parent/enfant.
- Le contenu examiné converge sur la même grille responsive des coordonnées entreprise.
- La variante #211 comprend un contrôle explicite de la règle CSS `display: grid` et borne la zone inspectée dans le test ; la variante #209 contrôle explicitement le RIB pleine largeur dans sa grille.

**Recommandation :** retenir #211 comme base candidate à une consolidation, après comparaison finale de la capture responsive et du test complet. Garder #209 ouvert tant qu’une décision humaine n’autorise pas sa fermeture. Aucune PR n’a été modifiée ou fermée par cet audit.

## Correctifs existants examinés — sans duplication de code

- #220 : conversion d’un conflit d’email concurrent en HTTP 409 ; CI observée verte sur son head.
- #221 : assainissement des erreurs SQL avant journalisation ; CI observée verte sur son head.
- #218 : protection des historiques lors de la réinitialisation ; CI observée verte sur son head.
- #219 : tests complémentaires pour la protection des historiques ; aucune exécution CI n’était remontée au moment de la vérification.

Ces PR sont des correctifs distincts, pas des fichiers morts à supprimer. Elles restent inchangées et non fusionnées.

## Code mort : limites et décision

Aucun autre symbole ou fichier n’a été supprimé : un nom inutilisé dans un extrait ou un fichier isolé ne suffit pas à prouver qu’il n’est pas chargé dynamiquement, référencé par HTML, migration, script, API ou outil de déploiement. La recherche de code GitHub n’a pas fourni de résultats exploitables pour une analyse globale des références.

Un inventaire global fiable nécessite une exécution locale/CI de l’analyse statique sur l’arbre complet (JS frontend, routes backend, scripts, migrations et tests), suivie d’une vérification des références HTML/dynamiques et d’une suite de non-régression. Cette étape reste à faire avant toute suppression supplémentaire.

## Validation

Les tests locaux n’ont pas été exécutés depuis cette session. La CI GitHub doit valider le nouveau head de cette branche avant qu’un correctif soit déclaré validé. La revue PDF/impression, la recette sur téléphone physique et la validation OHADA restent hors du périmètre de ce petit nettoyage.

## Contrôle statique automatisé ajouté à la branche

Pour passer d'une revue manuelle partielle à un relevé reproductible, la branche ajoute :

- `server/knip.json` : déclare les points d'entrée backend (serveur, cluster, sauvegarde/restauration, worker PDF, scripts et tests) et les fichiers JavaScript du backend à analyser.
- `.github/workflows/audit-statique.yml` : exécute Knip 6.48.0 sur le backend à chaque PR ciblant `main` qui touche le serveur, puis archive le rapport JSON pendant 14 jours.
- `scripts/audit-public-script-references.js` : compare les 14 scripts `public/js` aux balises `<script src>` HTML et aux références littérales des ressources frontend ; signale les liens locaux cassés et les candidats sans référence statique. Les candidats ne font pas échouer la CI et ne sont jamais supprimés automatiquement.

### Interprétation des résultats

Knip construit un graphe à partir des points d'entrée déclarés ; les rapports ne sont fiables que si ces entrées couvrent les chargements réels. Les pages HTML et fonctions frontend globales ont un chemin de chargement distinct, couvert ici par le scanner dédié des balises `script`. Les chemins calculés à l'exécution, scripts injectés par le serveur et références générées demandent encore une revue manuelle.

**Aucune suppression additionnelle n'est faite dans cette phase.** Les rapports CI du nouveau head sont attendus avant de transformer un candidat en suppression. Le workflow n'autorise ni suppression automatique, ni changement des dépendances, ni modification de données ou du schéma.

## Résultats Knip après nettoyage — head `c003109d89474f003629b57aa8e32e160e488d49`

Le rapport JSON de l'exécution CI du head `c003109...` contient `issues: []` après les ajustements ci-dessous.

Les 12 exports non consommés détectés au passage précédent étaient répartis sur 10 modules. Le nettoyage final a :
- supprimé l'export de `isMonitoringEnabled` (fonction conservée en usage interne) ;
- retiré des exports `claimPendingEmails`, `isEmailJobDeliverable`, `markEmailCancelled` (implémentations conservées, utilisées par le worker) ;
- retiré l'export `ensureTestHttpServer` (fonction conservée, appelée par `setupTestDatabase`) ;
- retiré les exports `TYPES_CATALOGUE`, `TRIAL_PLANS`, `parseJob`, `sendWebhookRequest`, `parseCivilDate` et `parsePermissions` (fonctions/constantes internes conservées quand elles ont un usage dans leur module) ;
- supprimé la fonction `positiveInt` de `server/utils/validation.js`, qui n'avait pas de consommateur détecté, ainsi que son export.

**Aucun fichier applicatif complet n'a été supprimé.** Les fonctions nécessaires au comportement interne des workers, webhooks, essais, permissions et comptabilité restent en place. L'API publique d'aucun endpoint n'a été changée volontairement ; les exports internes de modules privés ont été resserrés.

## Détection des duplications de code

Ajout du job CI `Détection des blocs de code dupliqués` avec jscpd `5.4.3`, seuil de détection initial de 80 tokens et 8 lignes, sur les fichiers JavaScript de production backend/frontend (`server/app.js`, `server/cluster.js`, `server/config`, `server/middleware`, `server/routes`, `server/services`, `server/utils`, `public/js`). Le résultat est archivé en JSON pendant 14 jours.

Ce premier passage est un relevé, pas un gate : un bloc commun peut être volontaire (formats, contrats et règles comptables identiques). Chaque paire devra être examinée avant de fusionner en une abstraction ou de supprimer un bloc.

## Extraction du deuxième doublon utilitaire exact

Le scan jscpd a confirmé que les deux définitions de `optionalText()` et `optionalIsoDate()` étaient identiques dans `server/routes/factures.js` et `server/routes/professionnel.js`.

Correction :
- création de `server/utils/optional-fields.js` ;
- les deux routes importent maintenant les fonctions partagées ;
- suppression des deux définitions locales ;
- ajout de `server/tests/optional-fields.test.js` pour les valeurs absentes, les chaînes blanches, le tronquage, les dates valides, les dates impossibles et le format non pris en charge ;
- ajout du nouveau test à ESLint.

Le contrat est conservé : champ absent/chaîne vide → `null` ; date syntaxiquement ou calendriquement invalide → `undefined` ; date valide → chaîne `YYYY-MM-DD`. Aucune règle fiscale, de facture, de paiement ou comptable n'est modifiée.

## Scan jscpd après extraction — head `24c24a949a11da56b52843aaf1e7296f8fb8fcf4`

Rapport JSON de l'exécution CI :
- Fichiers JavaScript analysés : 61.
- Lignes analysées : 17 326.
- Blocs identiques restants : **10**.
- Lignes dupliquées : **176** (1,02 %).
- Avant extraction des validateurs : 11 blocs et 191 lignes dupliquées (1,10 %).

### Blocs restants à examiner

| Fichiers / plages | Taille | Lecture de risque |
|---|---:|---|
| `routes/depenses.js:114–146` / `routes/produits.js:134–165` | 33 lignes | Queue transactionnelle et documentation de routes différentes ; abstraction de transaction à évaluer |
| `routes/factures.js:1374–1390` / `routes/factures.js:1475–1491` | 17 lignes | Rejeu idempotent d'un paiement ; le chemin initial et le chemin de récupération après `ER_DUP_ENTRY` ont des comportements de repli différents |
| `routes/produits.js:160–169` / `routes/produits.js:308–325` | 10 lignes | Recherche/verrouillage du produit dans modification et suppression ; vérifier les gardes de stock et d'historique avant factorisation |
| `routes/professionnel.js:892–917` / `routes/professionnel.js:1005–1030` | 26 lignes | Acceptation et vérification d'invitation d'équipe ; tokens et conditions de sécurité diffèrent |
| `routes/professionnel.js:999–1008` / `routes/professionnel.js:1637–1646` | 10 lignes | Validation des tokens dans deux parcours professionnels proches |
| `routes/professionnel.js:1435–1446` / `routes/professionnel.js:1811–1822` | 12 lignes | Contrôles de membres/groupes ; dépendances tenant à vérifier |
| `routes/professionnel.js:1506–1530` / `routes/professionnel.js:1643–1667` | 25 lignes | Verrous et validations de parcours de groupe/invitation |
| `routes/professionnel.js:1530–1549` / `routes/professionnel.js:1667–1685` | 20 lignes | Contrôles qui suivent ces verrous ; ne pas mutualiser sans garder le même ordre transactionnel |
| `routes/professionnel.js:1621–1631` / `routes/professionnel.js:1741–1751` | 11 lignes | Validation de jeton/compte similaire sur deux endpoints |
| `routes/professionnel.js:2769–2780` / `routes/professionnel.js:2903–2908` | 12 lignes | Champs/écritures de commandes professionnelles à comparer au niveau métier |

Ces 10 blocs restent **non modifiés** dans cette PR : les répétitions d'idempotence, de transactions, de permissions et d'invitations peuvent porter des différences fonctionnelles invisibles à un détecteur de clones. Le prochain lot recommandé est une revue séparée des routes professionnelles multi-sociétés et de l'idempotence des paiements, avec tests de concurrence, de tenant et de non-régression avant toute extraction.

## Validation CI observée sur le head `24c24a949a11da56b52843aaf1e7296f8fb8fcf4`

- ESLint : succès.
- Packaging ZIP : succès.
- Knip : succès, `issues: []`.
- Références frontend : succès, aucune référence locale cassée.
- jscpd : succès, rapport archivé ; les clones sont signalés mais ne font pas échouer le build.
- Suite Node/MySQL : encore en cours au moment de la rédaction ; aucun résultat final ne doit être annoncé avant la fin.


## Mise à jour de validation et de couverture paiement — 24 novembre 2026

Cette section remplace les statuts de CI antérieurs qui indiquaient encore une suite en cours sur les anciens heads.

### Dernier head entièrement validé avant regroupement des tests — `ea135d6de5e5f8521670c16a6cb87b81357548df`

Exécution GitHub Actions :
- Tests automatisés, run `45375463122` : **succès**.
- ESLint, run `45375462885` : **succès**.
- Audit statique, run `45375462912` : **succès**.
- Packaging ZIP, run `45375462891` : **succès**.

Détails vérifiés dans les logs et artefacts :
- Les deux tests HTTP ajoutés pour les paiements idempotents ont chacun affiché `✔`.
- Le résumé de la commande principale affiche 626 tests, 625 réussites et 0 échec ; une commande complémentaire distincte affiche 1 réussite et 0 échec.
- La restauration d'une sauvegarde chiffrée de test, le démarrage cluster avec MySQL/Redis et la recette visuelle responsive ont terminé avec succès.
- Knip : `issues: []`.
- Scanner frontend : 39 pages HTML, 58 fichiers texte frontend et 14 scripts chargés ; zéro référence JS locale cassée et zéro candidat sans référence statique.
- jscpd : 10 clones, 176 lignes dupliquées sur 17 326 (1,0158 %), **0 nouveau clone** sur ce passage.

### Regroupement des tests de paiements

La relecture de l'ensemble des tests a montré que `server/tests/paiements.test.js` possédait déjà un scénario de deux requêtes HTTP simultanées avec la même `Idempotency-Key`. Pour éviter un doublon de tests :
- le scénario concurrent redondant a été retiré de `server/tests/factures.test.js` ;
- le test HTTP existant dans `server/tests/paiements.test.js` est renforcé : il exige maintenant exactement un statut 201 et un statut 200, puis vérifie `idempotent_replay: true` sur la réponse de rejeu ;
- un test complémentaire y vérifie qu'une clé déjà employée sur une première facture renvoie 409 si elle est réutilisée sur une seconde facture, sans enregistrer de second paiement ni modifier le solde de cette seconde facture.

Le commit de regroupement est `acb276bc0dc85545c4119a4f09248845ddba2092`. La CI déclenchée par les commits intermédiaires de ce regroupement ne ciblait pas encore exactement ce head lors de la rédaction de cette section ; les nouveaux résultats doivent être contrôlés sur le head final avant de déclarer ce dernier validé.

### Portée et limites

Aucune logique de paiement, écriture financière, règle comptable OHADA, migration ou donnée n'a été modifiée dans cette étape : seules les assertions de tests ont été renforcées et regroupées. La PR reste en brouillon ; aucun merge ni déploiement n'a été effectué.


## Validation finale du head du PR #223 — 24 novembre 2026

Head vérifié : `a2a0645d42f1f15a8eaa2b42df15110b1ed0367a` (branche `audit/dead-code-consolidation-20261124-run33`, PR #223).

Les quatre workflows déclenchés sur ce head sont terminés avec succès :

| Contrôle | Run GitHub Actions | Résultat |
|---|---:|---|
| Tests Node.js et MySQL | `45377480121` | Succès |
| ESLint — fichiers JavaScript ciblés | `45377480111` | Succès |
| Audit statique (Knip, jscpd, références frontend) | `45377479953` | Succès |
| Packaging ZIP | `45377480157` | Succès |

Détail des tests :
- Suite principale : **625 tests, 624 réussites, 0 échec, 1 ignoré**.
- Le test ignoré est le scénario de restauration réelle avec les clients MySQL, non lancé dans la suite générique.
- Ce scénario est exécuté séparément dans le même job avec `RUN_REAL_RESTORE_SMOKE=true`, `mysqldump` et `mysql` : **1 test, 1 réussite, 0 échec, 0 ignoré**. L'archive de sauvegarde a été chiffrée AES-256-GCM, puis restaurée avec succès.
- Les deux scénarios HTTP d'idempotence de paiement sont verts : concurrence (réponses 201 et 200 avec `idempotent_replay: true`) et réutilisation inter-factures (409, aucun second paiement).
- Les tests PDF/impression vérifient les 31 modèles en vrai PDF A4 pour factures et devis, la mise en page courte/longue, les polices et la pagination.
- La recette visuelle responsive est passée et ses captures ont été archivées.

Le rapport statique confirme les résultats précédemment consignés : Knip `issues: []`, aucune référence JS locale cassée, 10 clones/176 lignes dupliquées (1,02 %) et aucun nouveau clone détecté lors du dernier scan disponible.

**Conclusion :** le code et les tests du PR #223 sont validés par la CI sur le head indiqué. Cette validation ne constitue pas une recette métier OHADA complète ni une validation sur imprimantes physiques. La PR reste en brouillon et n'est pas fusionnée.
