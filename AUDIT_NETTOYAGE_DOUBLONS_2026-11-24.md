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


## Audit complémentaire des PR #179, #188, #171, #182, #183, #185 et #190 — 24 novembre 2026

### État commun des branches

Les sept PR examinées restent ouvertes, en brouillon et non fusionnées. GitHub les marque toutes `mergeable_state: dirty` et `rebaseable: false` par rapport à leur base : elles ne sont donc pas fusionnables en l'état.

Comparaison de chaque head au `main` audité (`c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c`) :

| PR | Sujet | En avance | En retard | Fichiers touchés | Lecture |
|---|---|---:|---:|---:|---|
| #179 | Sécurité des relations facture/client/paiement/tenant | 23 | 47 | 8 | Variante de sécurité plus ancienne |
| #188 | Même périmètre multi-tenant, avec checkout | 10 | 42 | 7 | Variante plus récente et plus ciblée |
| #171 | Devise des commandes, affichage, relances, timezone et assainissement UI | 63 | 47 | 31 | Ancien lot large, plusieurs sujets distincts |
| #182 | Verrou de devise du compte et commande professionnelle | 10 | 45 | 7 | Étape intermédiaire |
| #183 | Verrou atomique des premières écritures métier | 21 | 45 | 13 | PR empilée sur la branche de #182, pas sur main |
| #185 | Verrou atomique de devise et premières écritures | 13 | 45 | 13 | Variante ciblant directement main |
| #190 | Même verrou atomique, basée sur un main plus récent | 15 | 42 | 11 | Variante la plus récente du lot |

Les nombres de commits/en avance ne mesurent pas la quantité de code utile : ces branches ont accumulé des commits de préparation et leurs bases ont divergé du main depuis leur création.

### Groupe sécurité multi-tenant — #179 et #188

Les deux PR traitent le même défaut : une jointure pouvait suivre un identifiant de facture, client, commande ou paiement sans vérifier que le parent et l'enfant appartenaient au même `user_id`.

- Les patches partagent les corrections de tableau de bord, factures, factures récurrentes et rapports.
- #179 contient aussi des modifications de jointures professionnelles et de la liste API publique.
- #188 est basé sur une base cinq commits plus récente que celle de #179 ; plusieurs filtres professionnels et le filtre client de l'API publique qui apparaissaient dans le diff de #179 sont déjà présents dans cette base plus récente.
- #188 ajoute explicitement la contrainte tenant-aware à la lecture du statut checkout et davantage de fixtures/assertions de régression.
- Le `main` actuel contient ces contrôles : jointures factures/clients, paiements/factures, commandes/clients, bons de livraison/commandes/clients, avoirs/factures, acomptes, liens de paiement et checkout. La lecture API publique des factures impose également `c.user_id = f.user_id`.
- Le test actuel `server/tests/professional-tenant.test.js` couvre les références croisées sur factures, récurrences, paiements, API publique, commandes, livraison, avoirs, acomptes, liens de paiement et checkout, avec vérification des permissions du membre en lecture seule.

**Conclusion sécurité :** les corrections fonctionnelles principales des PR #179/#188 sont déjà présentes dans le main et sa suite de tests. Elles sont considérées comme *supersédées par le code actuel*, et non comme deux lots à fusionner. La comparaison ligne à ligne de tout le reste de leurs tests/commentaires peut être conservée comme contrôle final avant toute décision de fermeture.

### Groupe devise et concurrence — #171, #182, #183, #185 et #190

Ces PR se recoupent mais n'ont pas toutes le même périmètre :

- #171 est le lot le plus large : format monétaire, devise dynamique dans les pages produits/factures, emails et relances, timezone d'entreprise, webhook et échappement de messages d'erreur UI. Ce n'est pas un doublon pur du verrouillage transactionnel.
- #182 est une étape antérieure, limitée principalement aux routes profil/commande et aux tests de devise.
- #183 est empilée sur la branche de #182 : sa base est `fix/pro-orders-tenant-currency-main-20261123`, pas `main`. Elle n'a aucun check-run sur son head actuel.
- #185 et #190 ont des patches applicatifs et de tests identiques sur dix fichiers : `auth.js`, `depenses.js`, `factures-recurrentes.js`, `factures.js`, `produits.js`, `professionnel.js`, `public-api.js`, `auth-currency.test.js`, `currency-lock-concurrency.test.js` et `setup.js`. La différence de patch observée porte sur les déclencheurs du workflow ESLint ; #185 modifie aussi les workflows packaging/tests, contrairement à #190.
- #190 est basé sur une base plus récente et son diff est moins chargé de changements de workflow ; c'était le meilleur candidat historique à conserver si le correctif n'était pas encore dans main.

**Vérification du main actuel :** le verrou est maintenant présent dans `PUT /auth/entreprise` et les premières écritures métier. Les routes de création de dépense, produit, facture, modèle récurrent, commande professionnelle et facture via API verrouillent le compte dans la transaction avant de figer la devise. Le générateur récurrent verrouille également le modèle et le client. La suite `server/tests/currency-lock-concurrency.test.js` existe sur main et couvre les changements de devise concurrents avec commande, produit, dépense, modèle récurrent, écriture comptable manuelle, achat fournisseur, devis/facture et API publique. Le helper `server/utils/money-format.js`, les relances locales par fuseau et le formatage par devise des emails sont aussi présents ; les pages produits/factures affichent la devise d'entreprise et les erreurs UI sont échappées.

**Conclusion devise :** les principaux apports fonctionnels des branches #171/#182/#183/#185/#190 sont déjà intégrés au main actuel. La variante #190 est la plus propre des anciennes branches de verrouillage, mais elle ne doit pas être fusionnée ni rebasée juste pour réintroduire du code qui existe déjà. La présence d'une fonction dans main a été vérifiée dans les routes et tests nommés ci-dessus ; cette conclusion ne remplace pas une comparaison exhaustive de chaque ligne non fonctionnelle des 31 fichiers de #171.

### CI sur les heads examinés

| PR | Contrôles sur le head exact examiné |
|---|---|
| #179 | Aucun check-run sur le head actuel ; un ancien head a eu Tests, ESLint et ZIP réussis |
| #188 | Aucun check-run sur le head actuel ; un ancien head a eu un échec de tests, puis un head antérieur était vert |
| #171 | Tests, ESLint et ZIP réussis sur le head `953489e` |
| #182 | Tests, ESLint et ZIP réussis sur le head `a078a35` |
| #183 | Aucun check-run sur le head actuel |
| #185 | Tests, ESLint et ZIP réussis sur le head `50b9fcc` |
| #190 | Tests, ESLint et ZIP réussis sur le head `0abc044` |

Les succès historiques n'annulent pas le statut `dirty` et ne valident pas une intégration sur le main actuel. #179/#188/#183 n'ont pas de validation CI retrouvée sur leur head actuel.

### Décision et garde-fous

1. Ne pas fusionner #179, #188, #171, #182, #183, #185 ou #190 : tous les heads sont périmés par rapport à main et marqués dirty.
2. Considérer #179/#188 et le lot de devise #171/#182/#183/#185/#190 comme des candidats supersédés par les implémentations et tests présents dans main.
3. Ne fermer aucune PR sans décision explicite ; ne supprimer aucune branche.
4. Avant toute clôture, faire une dernière comparaison des différences résiduelles et vérifier qu'elles ne contiennent ni test unique utile ni correctif non repris.
5. Ne pas réintroduire de migrations, de modifications de schéma, de changement de règles de calcul OHADA ou d'activation de paiement réel dans cet audit.

Aucune branche, PR, donnée, facture, sauvegarde ou volume n'a été modifié ou supprimé pendant cette comparaison.


## Comparaison ciblée des PR #209 et #211 — grille responsive des coordonnées entreprise

### État des branches et du main

Les deux PR sont ouvertes, en brouillon, non fusionnées et déclarées fusionnables par GitHub. Elles ciblent toutes deux `main`, sont en avance de trois commits et en retard de zéro commit sur le main contrôlé. Le fichier `public/parametres.html` et le test `server/tests/parametres-accessibility.test.js` du main ne contiennent pas encore la classe `settings-company-fields-grid` : le correctif reste donc utile.

Les deux PR touchent exactement les mêmes trois fichiers :
- `.github/workflows/lint.yml`
- `public/parametres.html`
- `server/tests/parametres-accessibility.test.js`

### Équivalence du rendu

Le HTML des neuf champs est identique dans les deux branches : nom, adresse, téléphone, email, NINEA, RCCM, site web, banque et RIB. Les conditions de règlement et mentions légales restent après le conteneur de grille.

Le CSS fonctionnel est également identique :
- deux colonnes avec `minmax(0, 1fr)` sur grand écran ;
- une seule colonne sous 700 px ;
- champs autorisés à rétrécir avec `min-width: 0` ;
- RIB pleine largeur via `grid-column: 1 / -1` sur grand écran.

Les différences relèvent surtout de la documentation CSS, de l'organisation de la liste des fichiers ciblés par ESLint et des assertions de test.

### Différences des tests

- #209 ajoute 39 lignes et 1 suppression. Son test vérifie les neuf identifiants de champ, la classe pleine largeur du RIB, les deux colonnes, la colonne mobile, et la présence des deux champs légaux.
- #211 ajoute 51 lignes et 1 suppression. Son test vérifie les neuf identifiants, la classe pleine largeur du RIB, la propriété `display: grid`, les deux colonnes, la colonne mobile et le maintien du formulaire unique.

**Candidat recommandé : #211**, car il vérifie explicitement `display: grid` et la conservation du formulaire unique. Avant de déclarer le test définitif, conserver aussi une assertion explicite que les conditions de règlement et les mentions légales sont hors de la grille, comme l'intention du test #209 le demande.

### CI sur les heads exacts

| PR | Tests Node/MySQL | ESLint | Packaging ZIP |
|---|---|---|---|
| #209 — `9888f76` | run `45223608140` : succès | run `45223608516` : succès | run `45223608500` : succès |
| #211 — `4518451` | run `45225973762` : succès | run `45225973707` : succès | run `45225973680` : succès |

Les deux branches ont une CI verte sur leur head relevé et GitHub les déclare fusionnables. Cela ne vaut pas autorisation de fusion.

### Décision

- Conserver #211 comme candidat principal pour revue finale.
- Ne pas fusionner #209 en doublon ; garder sa comparaison et son test comme référence pour le contrôle des champs légaux.
- Ne fermer aucune des deux PR et ne modifier aucune branche sans autorisation explicite.

Aucun changement de code n'a été fait dans #209 ou #211 pendant cette comparaison.


### Mise à jour après renforcement du test #211 — 24 novembre 2026

Le candidat #211 a reçu un contrôle supplémentaire dans `server/tests/parametres-accessibility.test.js`, sans modification du HTML ou du CSS :
- le champ RIB doit être présent dans la grille ;
- le conteneur de grille doit se fermer après le champ RIB ;
- les conditions de règlement et les mentions légales doivent rester à l'extérieur de ce conteneur ;
- les assertions précédentes (neuf champs, RIB pleine largeur, `display: grid`, deux colonnes, une colonne mobile et formulaire unique) sont conservées.

Head testé : `a9caf95bd16049c4922f4b4bb405b421b7888fb1`.

CI sur ce head :
- Tests automatisés run `45390855502` : succès.
- ESLint run `45390855498` : succès.
- Packaging ZIP run `45390855495` : succès.
- La nouvelle assertion « les coordonnées de l’entreprise sont dans une grille responsive fermée avant les champs légaux » est explicitement verte dans les logs.
- Suite principale : 621 tests, 620 réussites, 0 échec, 1 ignoré.
- Restauration réelle chiffrée via les clients MySQL : 1 réussite, 0 échec.
- Smoke test MySQL/Redis : succès.
- Recette visuelle responsive : succès ; artefact `samafacture-recette-visuelle-1898` publié (329 fichiers).

**Décision confirmée :** #211 est le meilleur candidat entre #209 et #211 pour une revue finale, car son test couvre aussi la fermeture du conteneur et la conservation des champs légaux hors grille. Cela ne constitue pas une autorisation de fusion. Les deux PR restent ouvertes et en brouillon.


## Audit approfondi des PR #179 et #188 — sécurité multi-tenant

Audit effectué le 24 novembre 2026 en comparant les deux descriptions, leurs patches, leurs têtes actuelles, leurs statuts CI et les fichiers de `main`.

### Métadonnées observées

| Élément | PR #179 | PR #188 |
|---|---|---|
| Titre | `security(invoices): enforce client and payment tenant ownership` | `security(tenant): enforce ownership across invoice-related records` |
| Branche | `security/invoice-client-tenant-scope-20261123` | `security/invoice-client-tenant-current-main-after-181-20261123` |
| Head observé | `5f554950cba1c4f0ea5dc6383b4f4588f7b61c64` | `39f27a324412cefae046181e22430ba79f24b5c5` |
| Base SHA enregistré | `b43a94fc2937b0108077501a0260358c8569e11f` | `b276eba52b5179f351efe68d18cf540a170c70fd` |
| Fichiers de la PR | 8 | 7 |
| Commits de la PR | 23 | 10 |
| État | ouverte, brouillon, non fusionnée | ouverte, brouillon, non fusionnée |
| Mergeable au dernier relevé | false | false |

Les branches ne partent pas du même commit. Le comparatif de leurs heads les signale comme divergentes (15 commits d'un côté et 23 de l'autre depuis leur base commune), et non comme deux branches simples l'une de l'autre. Comparées au `main` actuel au moment de l'audit, les têtes sont respectivement en avance de 23 / en retard de 47 commits (#179), et en avance de 10 / en retard de 42 commits (#188). Elles ne doivent pas être fusionnées telles quelles.

### Recouvrement fonctionnel confirmé

Les deux PR poursuivent le même objectif : empêcher des relations SQL mal rattachées de révéler des données d'une autre entreprise. Leurs patches se recouvrent sur :
- listes et détails de factures, relance et envoi email ;
- paiements associés au détail de facture ;
- agrégats du tableau de bord et rapports par client ;
- listing et génération des factures récurrentes, avec validation transactionnelle du client ;
- commandes, bons de livraison, avoirs, acomptes, paiements et liens de paiement professionnels ;
- tests de régression dans `server/tests/professional-tenant.test.js`.

#179 modifie aussi `server/routes/public-api.js` pour joindre le client avec `c.user_id = f.user_id`. #188 ne présente pas cette modification dans son propre patch, mais son arbre contient déjà cette garde. Elle est également présente dans `main` : ce n'est donc pas un correctif à réappliquer.

### Vérification de l'arbre `main`

La lecture des fichiers de `main` confirme que les protections principales sont déjà présentes :
- `dashboard.js` : relation paiement → facture → client filtrée par tenant ;
- `factures-recurrentes.js` : client filtré dans la liste, verrouillé et validé avant génération ;
- `factures.js` : client et facture du même tenant, paiements filtrés par `user_id`, mises à jour limitées au tenant ;
- `professionnel.js` : jointures tenant-aware pour remboursements, paiements, commandes, livraisons, avoirs, acomptes, liens et checkouts ;
- `public-api.js` : le client associé à une facture publique doit appartenir au même tenant ;
- `rapports.js` : agrégats par client limités aux factures et clients du même tenant.

La suite actuelle `server/tests/professional-tenant.test.js` dans `main` fait 469 lignes et comprend également des tests dédiés :
- les routes publiques et l’assistant excluent les relations inter-entreprises ;
- le relevé client exclut les remboursements liés à un paiement d’un autre tenant ;
- les permissions lecture seule ne sont pas élargies pour tester les API keys ;
- les dépendances de fixtures multi-tenant sont nettoyées dans l'ordre compatible avec les clés étrangères.

### Écart précis dans la tête #188

Dans la requête de relevé client de la branche #188, la jointure est :
`pro_refund_requests r JOIN paiements p ON p.id = r.paiement_id JOIN factures f ON f.id = p.facture_id`.

Elle omet les deux contrôles :
- `p.user_id = r.user_id` ;
- `f.user_id = p.user_id`.

La branche #179 et `main` possèdent ces contrôles. La version #188 est donc moins stricte sur ce chemin et ne doit pas servir de base de reprise sans correction. La suite de test actuelle sur `main` contient précisément un scénario de remboursement lié à un paiement d'un autre tenant.

### Statuts CI sur les têtes exactes

Les têtes actuellement déclarées par les PR ne disposent pas de check-run ni de statut attaché à leur SHA exact au moment de cette vérification.

- #179 : des exécutions plus anciennes existent ; la suite tests, ESLint et ZIP ont été vertes sur le head précédent `4be36d680608a0287f7672693f69b04c26394bc7`. Cela ne valide pas le head actuel `5f554950...`.
- #188 : les exécutions antérieures incluent une suite de tests échouée sur `1e82c9b65dd91a665e5f6b255a8456bd8d4b8a23` (ESLint et ZIP verts) et une suite précédente réussie sur `3112b8e645ee2ac2d58639c766b09d282af6a2fd`. Aucun de ces résultats ne valide le head actuel `39f27a324...`.

### Conclusion et décision de consolidation

**Aucune des deux PR n'est un candidat de fusion direct.** Les corrections métier principales sont déjà intégrées à `main`, avec une couverture de test plus complète que les anciennes variantes. La branche #179 contient le contrôle manquant sur la chaîne des remboursements, contrairement à #188, mais ses changements sont eux aussi déjà représentés sur `main` ; son arbre est en outre fortement en retard. #188 est plus proche de la base initiale récente, mais n'apporte plus de valeur de code à fusionner et son head présente l'omission citée.

Recommandation : conserver les deux PR ouvertes et en brouillon tant qu'aucune autorisation explicite de fermeture n'est donnée ; ne pas cherry-pick ni fusionner leurs changements sans besoin identifié. En cas de nouvelle correction multi-tenant, partir du `main` actuel et ajouter un test dédié plutôt que reprendre l'une de ces branches anciennes.

Aucune branche, PR, donnée, migration, sauvegarde ou volume n'a été modifié pendant cet audit. Seul ce rapport d'audit est complété.


## Audit approfondi du groupe devise/verrous — PR #171, #182, #183, #185 et #190

Audit effectué le 24 novembre 2026 à partir des métadonnées, patches, CI sur les heads, des comparaisons de branches et des blobs présents dans `main`.

### Hiérarchie des branches

| PR | Head | Fichiers | Commits | Rôle observé |
|---|---|---:|---:|---|
| #171 | `953489e79a9a6779b03e9c436559b925904f5635` | 31 | 63 | Premier lot commandes/devise, empilé sur l'ancienne #168 ; également ajoute le formatage monétaire |
| #182 | `a078a351d714fa05e4ecf5901040135e06dc6383` | 7 | 10 | Reconstruction du delta commandes/devise de #171 sur le main après #167/#168 |
| #183 | `4a73d68d91ff3d7360e868d034bc6a1d8816966f` | 11 | 14 | Ajout du verrou atomique sur #182 ; 12 tests de concurrence ; PR empilée, base = head #182 |
| #185 | `50b9fcc21b6655347d4feac1eb319dad38982996` | 13 | 13 | Consolidation du lot #171/#178/#182/#183 sur le main après #167/#168 |
| #190 | `0abc0440d11b67ad513bc1e2793d7bb558d37229` | 11 | 15 | Consolidation plus récente sur le main après #181 ; candidate la plus récente historiquement |

Toutes ces PR sont encore ouvertes, en brouillon, non fusionnées et marquées non mergeables par GitHub au dernier relevé. La #183 est empilée sur #182 ; elle ne doit pas être considérée comme une PR autonome à fusionner sur `main`.

### CI observée sur les heads exacts

| PR | Tests automatisés | ESLint | ZIP |
|---|---|---|---|
| #171 | run `45098452835` : succès | `45098452841` : succès | `45098452838` : succès |
| #182 | `45135648623` : succès | `45135648688` : succès | `45135648729` : succès |
| #183 | aucun run retrouvé sur la branche actuelle | — | — |
| #185 | `45135968638` : succès | `45135968603` : succès | `45135968543` : succès |
| #190 | `45137196795` : succès | `45137196790` : succès | `45137197090` : succès |

Ces résultats valident les têtes indiquées, pas une éventuelle réintégration sur le `main` actuel.

### Vérification d'intégration dans le main actuel

Head de `main` au contrôle : `c32ed40a6fc032717489a0a6ca421c0ad0f9fa6c`.

Les blobs de ces fichiers dans la branche #190 et dans `main` sont strictement identiques (SHA Git identique) :
- `server/routes/auth.js` ;
- `server/routes/depenses.js` ;
- `server/routes/produits.js` ;
- `server/routes/public-api.js` ;
- `server/tests/currency-lock-concurrency.test.js` (542 lignes) ;
- `server/tests/auth-currency.test.js` (150 lignes).

Les sections métier essentielles des autres fichiers ont également été vérifiées dans `main` :
- `professionnel.js` : création de commande sous `SELECT devise FROM users ... FOR UPDATE`, même verrou de compte que le changement de devise ;
- `factures.js` : relecture de la devise du compte sous verrou, rejet d'une devise facture différente de la devise de base, puis réservation du quota ;
- `factures-recurrentes.js` : verrou de compte lors de la création d'un modèle et relecture devise/fuseau sous verrou lors de la génération.

**Durcissement déjà présent dans main, absent de la tête #190 :** la génération d'une facture récurrente verrouille et vérifie également que son client appartient au même tenant. `main` renvoie `CLIENT_TENANT_MISMATCH` avant génération. Le fichier `factures-recurrentes.js` de #190 ne contient pas cette vérification supplémentaire ; son head n'est donc pas une base sûre pour écraser ou remplacer le fichier actuel.

Les têtes #185 et #190 sont divergentes (18 commits d'un côté et 13 de l'autre depuis leur base commune). #190 est plus récent historiquement, mais reste en retard d'environ 42 commits sur le `main` actuel et GitHub le marque non mergeable. #185 est encore plus ancien (environ 45 commits de retard). Il ne faut pas fusionner les deux versions ni les comparer comme des branches parent/enfant.

### Décision métier encore ouverte : commandes multi-devises

Dans `POST /api/pro/orders`, le code de `main` et la branche #190 utilise la devise explicitement transmise si elle est prise en charge, même si elle diffère de la devise de base du tenant. L'écran de commande actuel utilise la devise du tenant et ne propose pas le choix explicite. Les routes facture et achat fournisseur, elles, imposent la devise du tenant.

Cette différence n'est pas une simple duplication technique : elle définit une politique financière. Aucune modification n'est faite sans décision métier explicite. Les PR #171/#182/#185/#190 restent en brouillon sur ce point.

### Conclusion et recommandation

Le groupe #171/#182/#183/#185/#190 est une succession de versions empilées puis consolidées. Les verrous et les tests de concurrence principaux sont **déjà présents dans le main actuel**, ce qui est confirmé par les blobs identiques et la lecture des routes. Le main contient en plus des durcissements récents (notamment la validation du client de modèle récurrent).

**Aucune de ces PR ne doit être fusionnée ou cherry-pickée telle quelle.** Reprendre le main actuel comme seule source de vérité pour tout futur correctif de devise. Garder les cinq PR ouvertes et en brouillon sans les fermer ; la politique des commandes multi-devises reste à faire arbitrer avant tout changement de comportement.

Aucune branche, donnée, facture, migration, sauvegarde, volume ou règle financière n'a été modifié pendant cet audit. Seul ce rapport documentaire est complété.
