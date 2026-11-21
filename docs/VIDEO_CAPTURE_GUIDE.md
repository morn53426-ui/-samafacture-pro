# Capture authentique des écrans Sunupilot — guide local

## Objectif

Créer un compte de démonstration séparé, alimenté uniquement par des données inventées, afin d'enregistrer les vrais écrans HTML/JS de Sunupilot dans un navigateur authentifié. Ce compte n'utilise aucune donnée d'un vrai client.

## Protection obligatoire

Le script `server/scripts/seed-video-demo.js` :
- refuse toute base dont le nom n'est pas exactement `samafacture_demo` ;
- exige la variable de confirmation `DEMO_SEED_CONFIRM=SUNUPILOT_DEMO_ONLY` ;
- crée un mot de passe aléatoire et haché avec bcrypt ;
- ne supprime et ne modifie aucune ligne existante ;
- s'arrête si le compte `demo.video@sunupilot.test` existe déjà.

Ne lance pas le script sur la base normale `samafacture`, ni sur une base de production.

## 1. Démarrer l'application sur la base dédiée

Sur Windows PowerShell, ouvre un premier terminal dans le dossier `server` du projet :

```powershell
$env:DB_NAME = "samafacture_demo"
npm start
```

Le serveur initialise alors le schéma sur la seule base `samafacture_demo`. Laisse cette fenêtre ouverte.

Si MySQL/WAMP utilise un mot de passe ou un port différent, renseigne `DB_PASSWORD` ou `DB_PORT` dans l'environnement PowerShell avant `npm start`. Le serveur doit être en mode local, jamais connecté à une base de production.

## 2. Créer les données fictives

Ouvre un deuxième terminal PowerShell dans le même dossier `server` :

```powershell
$env:DB_NAME = "samafacture_demo"
$env:DEMO_SEED_CONFIRM = "SUNUPILOT_DEMO_ONLY"
node scripts/seed-video-demo.js
```

Le terminal affiche une adresse email de démonstration et un mot de passe aléatoire. Copie le mot de passe immédiatement : il n'est pas enregistré en clair et ne sera pas réaffiché au prochain lancement.

Compte email :
`demo.video@sunupilot.test`

Le mot de passe est créé localement par le script à chaque création du compte ; aucun mot de passe fixe n'est intégré au dépôt.

## 3. Enregistrer les vrais écrans

Ouvre `http://localhost:4000/login.html`, connecte-toi avec les identifiants qui viennent d'être affichés, puis réalise les captures dans le navigateur :

| Ordre | Page locale | Ce qu'il faut capturer |
|---|---|---|
| 1 | `http://localhost:4000/dashboard.html` | Les quatre indicateurs, l'évolution des ventes, la répartition et les dernières factures |
| 2 | `http://localhost:4000/factures.html` | Les statuts payée, en attente et en retard, ainsi que les montants |
| 3 | `http://localhost:4000/devis.html` | La liste des devis et les actions de document |
| 4 | `http://localhost:4000/clients.html` | Le répertoire et les trois clients de démonstration |
| 5 | `http://localhost:4000/rapports.html` | Les paiements enregistrés, les dépenses, l'écart et le graphique |

Pour un rendu propre, utilise un navigateur de bureau en 1920 × 1080, zoom 100 %, largeur de fenêtre constante et barre du navigateur masquée seulement si cela ne rogne pas l'interface. Fais aussi une capture mobile en mode responsive, par exemple 390 × 844.

## 4. Envoyer les captures pour le montage

Fournis les cinq captures ordinateur (et éventuellement les vues mobiles). Vérifie qu'elles montrent uniquement les libellés et données fictifs DEMO. Ne photographie ni ne partage de noms, numéros, e-mails, adresses, pièces ou factures de vrais clients.

Les captures seront remplacées dans le montage à la place des reconstructions actuelles. La vidéo sera ensuite réexportée et les sous-titres recontrôlés.

## Données incluses

- 3 clients fictifs ;
- 4 fiches produits/services ;
- 3 factures : payée, partiellement réglée/en attente et en retard ;
- 1 devis ;
- 4 dépenses ;
- 2 règlements saisis manuellement (l'un par moyen Wave indiqué comme règlement reçu, l'autre en espèces).

Toutes les coordonnées, références et valeurs sont fictives. La présence d'une méthode Wave sur une ligne de paiement signifie uniquement qu'un règlement reçu est enregistré ; cela ne signifie pas qu'un paiement en ligne automatisé est actif.

## Nettoyage après l'enregistrement

La base `samafacture_demo` est indépendante. Après validation des captures, arrête le serveur local. Tu peux conserver cette base pour de futurs tournages ou la supprimer manuellement via phpMyAdmin uniquement après avoir vérifié deux fois que la base sélectionnée est bien `samafacture_demo`. Ne supprime jamais la base `samafacture` ou une base de production.

## Recette responsive déjà exécutée dans GitHub Actions

Sur le commit vidéo précédent, la recette visuelle CI a généré 147 vues de 21 pages sur sept largeurs : 320, 360, 390, 768, 1024, 1440 et 1920 pixels. Le rapport `rapport-recette-visuelle.json` indique zéro débordement horizontal sur ces 147 vues.

Les captures de ce rapport utilisent le jeu de données de stress `worst` (valeurs volontairement extrêmes) : elles servent à vérifier le responsive et ne doivent pas être utilisées dans le montage publicitaire.

Le script de création des données de démonstration est également couvert par `server/tests/video-demo-seed.test.js`, qui vérifie la base dédiée, le jeton de confirmation, l'absence de requêtes destructrices, le caractère fictif des données et la syntaxe JavaScript.
