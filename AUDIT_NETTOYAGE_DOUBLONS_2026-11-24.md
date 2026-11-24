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
