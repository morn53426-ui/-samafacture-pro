# SamaFacture Pro

Plateforme de facturation pour commerçants, freelances, artisans et PME — inspirée de Brisk Invoicing, pensée pour l'Afrique (Wave, Orange Money, PayDunya).

Ceci est une **base fonctionnelle (MVP)** couvrant le cœur du cahier des charges : authentification, gestion des clients, produits, factures, devis, paiements et tableau de bord. Le reste du cahier des charges (app mobile native, 2FA, IA de génération de facture, multi-utilisateurs avancé, etc.) est indiqué en fin de document comme feuille de route.

## Ce qui est inclus

- **Backend** : Node.js + Express + **MySQL** (`mysql2`), authentification JWT + bcrypt, API REST complète.
- **Frontend** : pages HTML/CSS/JS vanilla, responsive, avec menu latéral façon Brisk Invoicing, graphiques (Chart.js).
- **Fonctionnalités** :
  - Inscription / connexion (JWT)
  - Tableau de bord (chiffre d'affaires, factures payées/en attente/en retard, derniers paiements, derniers clients, évolution mensuelle en graphique)
  - Clients (CRUD, montant dû/payé calculé automatiquement)
  - Produits (CRUD, prix HT, TVA, stock)
  - Factures et devis : création avec lignes multiples, calcul automatique (sous-total, TVA, remise, livraison, total)
  - Transformation d'un devis en facture en un clic
  - Enregistrement de paiements (Wave, Orange Money, PayDunya, Stripe, espèces, etc.) avec mise à jour automatique du statut
  - Vue facture imprimable → export PDF via l'impression du navigateur (Ctrl/Cmd+P → "Enregistrer en PDF")
  - Dépenses (CRUD) pour suivre les sorties d'argent
  - Rapports : ventes par jour/semaine/mois/année/client/produit, export CSV, résumé comptable (recettes, dépenses, bénéfice net, TVA collectée)
  - Paramètres entreprise : logo, nom, adresse, devise, **6 modèles de facture** (Classique, Moderne, Minimaliste, ✦ Élégant, ✦ Corporate, ✦ Créatif — les 3 derniers réservés au plan Pro), affichés sur les factures
  - Centre d'aide (FAQ), Support technique (formulaire de contact) et Politique de confidentialité
  - Interface responsive : menu latéral escamotable sur mobile/tablette, tableaux et grilles adaptatifs
  - **Fonctionnalités Pro** : dupliquer une facture/devis, envoyer par email au client (avec lien de consultation en ligne sans compte), relance automatique par email pour les factures en attente/retard, QR code de vérification d'authenticité sur chaque document imprimé, signature électronique, factures récurrentes (génération automatique hebdomadaire/mensuelle/annuelle)

## Installation avec WAMPserver

### 1. Démarrer WAMPserver

Lancez WAMPserver et attendez que l'icône dans la barre des tâches soit **verte** (MySQL et Apache démarrés). Seul le service **MySQL** est nécessaire ici — Apache/PHP ne sont pas utilisés, le serveur Node.js sert lui-même le site.

Par défaut, WAMPserver expose MySQL sur `localhost:3306` avec l'utilisateur `root` et **aucun mot de passe**. Si vous avez changé ces identifiants, adaptez le fichier `.env` (étape 3).

### 2. Installer Node.js

Si ce n'est pas déjà fait, installez [Node.js](https://nodejs.org/) (version 18 ou plus récente). WAMPserver ne fournit que MySQL/Apache/PHP ; Node.js s'installe séparément et fait tourner le backend de l'application.

### 3. Configurer et lancer le serveur

```bash
cd server
npm install
copy .env.example .env    (ou "cp .env.example .env" sous Git Bash/Mac/Linux)
npm start
```

Le fichier `.env` contient déjà les valeurs par défaut d'une installation WAMPserver standard :

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=samafacture
```

Au démarrage, le serveur :
1. Se connecte à MySQL avec ces identifiants.
2. **Crée automatiquement la base `samafacture`** si elle n'existe pas encore.
3. Crée automatiquement toutes les tables (`users`, `clients`, `produits`, `factures`, `facture_lignes`, `paiements`, `depenses`) si elles n'existent pas.

Vous pouvez vérifier le résultat dans **phpMyAdmin** (accessible depuis le menu WAMPserver → phpMyAdmin, ou `http://localhost/phpmyadmin`) : la base `samafacture` doit apparaître avec ses tables.

Si vous préférez importer le schéma manuellement via phpMyAdmin, le fichier `server/database/schema.sql` peut être importé tel quel (onglet "Importer" de phpMyAdmin, après avoir créé/sélectionné la base `samafacture`).

### 4. Ouvrir l'application

Le serveur démarre sur `http://localhost:4000` et sert à la fois l'API (`/api/...`) et le frontend statique (dossier `public/`). Ouvrez `http://localhost:4000` dans votre navigateur — pas besoin de configurer un VirtualHost Apache, Node.js gère tout lui-même sur son propre port.

### Dépannage

- **`ECONNREFUSED` ou "Impossible de se connecter à MySQL"** → WAMPserver n'est pas démarré, ou l'icône n'est pas encore verte. Attendez quelques secondes après le lancement de WAMPserver.
- **`ER_ACCESS_DENIED_ERROR`** → les identifiants dans `.env` (`DB_USER` / `DB_PASSWORD`) ne correspondent pas à votre configuration MySQL. Vérifiez dans phpMyAdmin ou le fichier `wampmanager` la configuration de votre utilisateur MySQL.
- **Port 3306 déjà utilisé** → un autre service MySQL tourne peut-être en parallèle (ex. XAMPP). Changez `DB_PORT` dans `.env` ou arrêtez l'autre service.
- **Port 4000 déjà utilisé** → changez `PORT` dans `.env` du serveur Node.js.

## Structure du projet

```
SamaFacturePro/
├── server/
│   ├── app.js               → point d'entrée Express (connexion MySQL + démarrage)
│   ├── config/db.js         → pool de connexions MySQL + création auto de la base/schéma
│   ├── middleware/auth.js   → vérification JWT
│   ├── routes/               → auth, clients, produits, factures, dashboard, depenses, rapports
│   └── database/schema.sql   → schéma MySQL complet (users, clients, produits, factures, lignes, paiements, depenses)
└── public/
    ├── login.html / register.html
    ├── dashboard.html
    ├── clients.html / produits.html
    ├── factures.html / devis.html / nouvelle-facture.html / facture-detail.html
    ├── depenses.html / rapports.html
    ├── parametres.html
    ├── aide.html / support.html / confidentialite.html / conditions.html
    ├── css/style.css
    └── js/ (api.js, sidebar.js)
```

## Déploiement en ligne (au-delà de WAMPserver local)

Pour héberger l'application en dehors de votre machine :
1. Utilisez un hébergeur MySQL managé (ex. PlanetScale, Railway, un VPS avec MySQL).
2. Renseignez ses identifiants dans `.env` (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).
3. Déployez le dossier `server/` (qui sert aussi `public/`) sur Render, Railway ou un VPS classique.

### Avec Docker (VPS / serveur dédié)

Pour un hébergement auto-géré avec Docker plutôt qu'une plateforme comme Render/Railway :

```bash
cp server/.env.example server/.env   # renseignez vos valeurs (JWT_SECRET est généré
                                      # automatiquement au premier démarrage si laissé tel quel)
docker compose --env-file server/.env up -d --build
docker compose logs -f app
```

`docker-compose.yml` (à la racine du dépôt) démarre deux services : l'API (`Dockerfile`, basé
sur `node:20-bookworm-slim` avec Chromium système pour la génération PDF) et une base MySQL
dédiée dans un réseau Docker privé — jamais exposée directement sur Internet. Si vous préférez
un MySQL managé externe, supprimez le service `mysql` du fichier et pointez `DB_HOST` vers
votre base dans `server/.env`.

Le conteneur applicatif inclut :
- une vérification de santé Docker (`HEALTHCHECK`) réutilisant `/api/health` (qui teste la vraie connexion MySQL) ;
- `dumb-init` comme processus n°1, pour que l'arrêt propre déjà implémenté dans `app.js` (fin des requêtes en cours, fermeture du pool MySQL) se déclenche réellement à l'arrêt du conteneur ;
- un utilisateur système non-root.

**TLS / reverse proxy** : `deploy/nginx.conf.example` fournit une configuration nginx type
(terminaison TLS, en-têtes `X-Forwarded-*`, support WebSocket pour les notifications temps
réel). N'oubliez pas `TRUST_PROXY=true` dans `server/.env` lorsque l'app tourne derrière un
reverse proxy — sinon le rate-limiting et les logs verraient l'IP du proxy au lieu de celle
du visiteur.

**CORS en production** : définissez `ALLOWED_ORIGINS` dans `server/.env` (ex.
`https://votredomaine.com`) avant une mise en production réelle. Sans cette variable, l'API
reste ouverte à toute origine (comportement historique du projet, conservé pour ne pas casser
un déploiement existant) — un avertissement s'affiche au démarrage si `NODE_ENV=production`
et que la variable est absente.

### Intégration continue

`.github/workflows/tests.yml` exécute automatiquement `npm test` contre une vraie base MySQL
(service Docker fourni par GitHub Actions) à chaque push et pull request sur `main`. C'est la
vérification que l'audit de ce projet n'a pas pu faire lui-même faute d'accès réseau/MySQL
dans l'environnement d'analyse — cette CI donne la confirmation réelle que les tests passent.

## Sécurité et fiabilité

Les points suivants ont été audités et corrigés :
- **Protection XSS** : toutes les données saisies par les utilisateurs (noms, notes, commentaires...) sont échappées avant affichage.
- **Clé JWT** : générée aléatoirement et sauvegardée automatiquement dans `.env` au premier démarrage (plus de valeur par défaut prévisible).
- **Anti brute-force** : les tentatives de connexion et de création de compte sont limitées par adresse IP.
- **Numérotation des factures** : incrément atomique via une table de compteurs dédiée, sans risque de doublon même en cas de requêtes simultanées.
- **Validation serveur** : les montants, quantités et taux de TVA négatifs ou aberrants sont rejetés/corrigés côté serveur, pas seulement côté formulaire.
- **Anti double-soumission** : les boutons se désactivent pendant l'enregistrement pour éviter les doublons créés par un double-clic.

## ⚠️ Sauvegarde de la base de données — à lire absolument

**C'est le point le plus important pour une utilisation réelle.** Sans sauvegarde, une panne de disque ou une base corrompue efface définitivement toutes vos factures, clients et paiements.

### Ce qui est automatique dès l'installation

Une sauvegarde complète de la base MySQL se déclenche **chaque nuit à 2h du matin** (heure réglable), compressée (`.sql.gz`) et enregistrée dans `server/backups/`. Les sauvegardes de plus de 14 jours sont supprimées automatiquement pour ne pas remplir le disque. Aucune configuration n'est nécessaire : ça fonctionne dès `npm start`, tant que `mysqldump` est accessible (fourni avec WAMPserver).

Réglages disponibles dans `.env` (tous facultatifs, voir `.env.example`) :
```
BACKUP_ENABLED=true          # false pour désactiver complètement
BACKUP_HOUR=2                # heure de déclenchement (0-23)
BACKUP_RETENTION_DAYS=14     # nombre de jours conservés
BACKUP_DIR=./backups         # dossier de destination
MYSQLDUMP_PATH=mysqldump     # chemin complet si mysqldump n'est pas dans le PATH système
```

**Trouver le chemin de `mysqldump.exe` sous WAMPserver** : il se trouve dans un dossier du type `C:\wamp64\bin\mysql\mysql8.0.xx\bin\mysqldump.exe` (le numéro de version varie). Copiez ce chemin complet dans `MYSQLDUMP_PATH`.

### Vérifier que ça fonctionne

Lancez une sauvegarde immédiate pour tester votre configuration, sans attendre 2h du matin :
```bash
cd server
npm run backup
```
Un fichier `samafacture-AAAA-MM-JJThh-mm-ss.sql.gz` doit apparaître dans `server/backups/`. En cas d'erreur, le message indique généralement s'il s'agit d'un problème de chemin `mysqldump` ou d'identifiants MySQL.

### Restaurer une sauvegarde

```bash
cd server/backups
gunzip -k samafacture-2026-08-01T02-00-00.sql.gz
mysql -u root -p samafacture < samafacture-2026-08-01T02-00-00.sql
```
*(sous Windows sans `gunzip`, utilisez 7-Zip ou WinRAR pour décompresser le fichier `.sql.gz`, puis importez le `.sql` obtenu via phpMyAdmin, onglet "Importer".)*

### ⚠️ Ce que l'automatisation ne fait PAS

Les sauvegardes automatiques restent **sur le même disque dur** que la base de données elle-même. En cas de panne matérielle, de vol de l'ordinateur, ou d'incendie, elles seraient perdues en même temps que tout le reste. **Copiez régulièrement le dossier `server/backups/` hors de cette machine** :
- le plus simple : synchronisez `server/backups/` avec Google Drive, Dropbox ou OneDrive (installez leur application de synchronisation de dossier)
- ou copiez-le manuellement sur une clé USB / disque externe une fois par semaine
- pour une vraie mise en production, un stockage cloud (S3, Backblaze...) avec une tâche planifiée est recommandé

Une sauvegarde qui reste uniquement sur le serveur qui peut tomber en panne n'est qu'une protection partielle.

## Tests automatisés

Des tests couvrent l'authentification et la création de factures — en particulier le calcul de la TVA (avec et sans remise) et la numérotation séquentielle, **y compris sous concurrence** (10 créations de facture lancées en parallèle, pour vérifier qu'aucun numéro n'est jamais dupliqué).

### Lancer les tests

Les tests utilisent une base de données MySQL séparée (`samafacture_test` par défaut), créée et initialisée automatiquement — aucune préparation manuelle nécessaire, juste WAMPserver démarré.

```bash
cd server
npm install
npm test
```

Pour utiliser un nom de base différent :
```bash
TEST_DB_NAME=ma_base_de_test npm test
```

### Où les ajouter

Les tests se trouvent dans `server/tests/`. Chaque nouveau fichier `*.test.js` y est automatiquement détecté (`node --test tests/`, le testeur intégré à Node.js — aucune dépendance supplémentaire à part `supertest` pour simuler des requêtes HTTP). `tests/setup.js` fournit les outils communs (email de test unique, nettoyage automatique des données créées).

**Recommandation** : avant chaque mise à jour importante du code de facturation ou d'authentification, lancez `npm test` — c'est exactement le genre de vérification qui aurait détecté immédiatement le bug `consulter.html` évoqué plus haut.

## Suivi des erreurs en production (Sentry)

Par défaut, les erreurs serveur sont seulement journalisées dans la console — si personne ne regarde les logs, une panne chez un client réel peut passer inaperçue. En connectant [Sentry](https://sentry.io) (gratuit jusqu'à 5 000 erreurs/mois), vous recevez une alerte automatique par email dès qu'une erreur survient, avec la pile d'appels complète pour la déboguer rapidement.

1. Créez un compte gratuit sur [sentry.io](https://sentry.io), puis un projet de type "Node.js"
2. Copiez l'URL "DSN" fournie
3. Renseignez-la dans `server/.env` :
   ```
   SENTRY_DSN=https://xxxxxxxx@xxxxx.ingest.sentry.io/xxxxxxx
   ```
4. Relancez le serveur — le message `🛰️ Suivi des erreurs Sentry activé.` doit apparaître au démarrage

Sans cette configuration, tout continue de fonctionner normalement (comportement actuel, aucun changement).

## Performance et montée en charge

- **Mode cluster** (`npm run start:cluster`) : lance un processus par cœur CPU, avec redémarrage automatique en cas de plantage d'un worker.
- **Compression gzip/brotli** des réponses HTTP.
- **Requêtes SQL parallélisées** partout où c'est possible (tableau de bord, rapports, détail de facture) au lieu de s'exécuter une par une.
- **Pool de connexions MySQL** réglable via `DB_POOL_SIZE` (20 par défaut).
- **Limitation de requêtes générale** (300/minute/IP en plus des limites spécifiques sur l'authentification) pour absorber un pic de trafic sans tomber.
- **Mise en cache des fichiers statiques** (1 jour) en production (`NODE_ENV=production`).
- **Arrêt propre** : les requêtes en cours se terminent avant l'arrêt du serveur, le pool MySQL est fermé proprement.

**Limite honnête** : ces optimisations permettent à un seul serveur d'absorber un trafic bien plus élevé qu'une configuration par défaut, mais "des milliers d'utilisateurs simultanés" en continu nécessite en pratique plusieurs serveurs derrière un répartiteur de charge et une base de données dédiée (pas WAMPserver en local). Le code est prêt pour cette évolution (aucune donnée en mémoire locale au processus, tout passe par MySQL et des jetons JWT sans session serveur), mais l'infrastructure elle-même (plusieurs machines) doit être mise en place séparément le moment venu.

## Génération de PDF (téléchargement et pièce jointe email)

La facture "imprimable" (`facture-detail.html`) peut être exportée en vrai fichier PDF de deux façons :
- **Téléchargement direct** — bouton "⬇️ Télécharger le PDF" sur la page de détail (`GET /api/factures/:id/pdf`).
- **Pièce jointe email** — les emails envoyés via "Envoyer" et "Relancer" y joignent automatiquement le PDF (en plus du lien de consultation en ligne déjà présent). Si la génération du PDF échoue pour une raison quelconque, l'email part quand même sans pièce jointe plutôt que d'échouer entièrement.

**Fonctionnement technique** : un navigateur headless (Puppeteer) charge la vraie page `facture-detail.html` (avec un jeton temporaire de 2 minutes injecté directement, sans passer par une route publique) puis l'imprime en PDF — exactement le même rendu que ce que l'utilisateur voit à l'écran (logo, QR code, signature, les 6 modèles), sans dupliquer ce rendu dans une deuxième librairie PDF.

**Ce que ça implique en pratique** :
- Puppeteer installe son propre Chromium (~300 Mo) au premier `npm install` — normal, ce n'est pas une erreur.
- Chaque génération de PDF est nettement plus coûteuse en mémoire/CPU qu'un appel API classique. Un seul navigateur est réutilisé (pas relancé à chaque demande), et un maximum de 3 générations simultanées est appliqué pour éviter qu'un pic de demandes ne sature le serveur — au-delà, les demandes suivantes attendent leur tour au lieu d'échouer.
- Sur un hébergement Linux très limité en ressources (petit mutualisé), cette fonctionnalité peut nécessiter un plan supérieur ou un service séparé dédié à la génération de PDF. Sur Windows (WAMPserver local, développement) et sur la plupart des VPS/hébergements dédiés, elle fonctionne sans configuration supplémentaire.
- `APP_URL` doit être correctement renseigné dans `.env` (voir plus haut) : c'est l'adresse que Puppeteer utilise pour charger la page à imprimer.

## Notifications en temps réel (Socket.io)

L'application pousse des notifications instantanées au navigateur, sans rechargement de page ni sondage répété du serveur : facture marquée payée, nouveau client ajouté, quota du plan Gratuit atteint. Elles apparaissent sous forme de petites notifications ("toast") en bas de l'écran, sur tous les onglets/appareils connectés au même compte.

**Isolation stricte par compte** : chaque connexion est authentifiée avec le même jeton JWT que l'API, et ne peut jamais recevoir les notifications d'un autre utilisateur.

**Mode cluster** (`npm run start:cluster`) : Socket.io ne fonctionne pas correctement en mode cluster sans configuration particulière (une notification émise par un worker n'atteint pas forcément un client connecté à un autre worker). Ce projet utilise les paquets officiels `@socket.io/sticky` et `@socket.io/cluster-adapter` pour résoudre ça nativement, sans dépendance supplémentaire (pas de Redis à installer). Aucune configuration additionnelle n'est nécessaire — que vous lanciez `npm start` ou `npm run start:cluster`, ça fonctionne.

**Limite connue** : si c'est vous-même qui venez de déclencher l'action (ex : vous venez d'enregistrer un paiement), la page affiche déjà sa propre confirmation, et la notification temps réel peut s'ajouter en double sur ce même onglet. Pas gênant en pratique, mais à garder en tête.

## Référencement (SEO)

- La page d'accueil (`index.html`) est une vraie page publique avec balises meta (description, Open Graph, Twitter Card, URL canonique) — les visiteurs déjà connectés sont redirigés vers leur tableau de bord, les autres (et les moteurs de recherche) voient la page normalement.
- `robots.txt` et `sitemap.xml` générés automatiquement à partir de `APP_URL`, qui autorisent l'indexation des pages publiques (accueil, connexion, inscription, aide, support, confidentialité, conditions) et bloquent celles qui nécessitent une connexion.
- Les pages légales (confidentialité, conditions) et d'aide sont accessibles sans compte, avec leurs propres balises meta.

**Pour être bien référencé**, pensez à renseigner `APP_URL` avec votre vrai nom de domaine une fois en ligne (pas `localhost`), et à soumettre `sitemap.xml` à [Google Search Console](https://search.google.com/search-console).

## Paiement des abonnements (Wave, Orange Money, carte bancaire)

Le passage à un plan payant (Starter, Pro, Entreprise) peut se faire réellement via :
- **Wave for Business** — paiement direct
- **PayDunya** — agrégateur qui gère en une seule intégration Orange Money **et** la carte bancaire (Visa/Mastercard)

Tant que ces identifiants ne sont pas renseignés dans `server/.env`, un simple sélecteur de plan reste disponible dans Paramètres pour tester gratuitement les fonctionnalités en local — aucun bouton de paiement cassé, aucune erreur.

### Configurer Wave
1. Créez un compte sur [business.wave.com](https://business.wave.com), section "Developers" (validation sous 48–72h, NINEA requis)
2. Récupérez votre clé API et votre secret de signature de webhook
3. Renseignez `WAVE_API_KEY` et `WAVE_SIGNING_SECRET` dans `.env`
4. Configurez l'URL de webhook dans le tableau de bord Wave : `https://votredomaine.com/api/abonnement/webhook/wave`

### Configurer PayDunya (Orange Money + carte)
1. Créez un compte sur [paydunya.com](https://paydunya.com)
2. Créez une "App" dans le tableau de bord pour obtenir vos 4 clés
3. Renseignez `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_PUBLIC_KEY`, `PAYDUNYA_TOKEN`
4. Laissez `PAYDUNYA_MODE=test` tant que votre compte n'est pas validé en mode réel (aucun argent réel ne circule en mode test)

**⚠️ Important** : les API Wave et PayDunya (endpoints, formats de réponse) peuvent évoluer. Le code suit leur documentation au moment de son écriture — vérifiez-la avant une mise en production réelle, en particulier les URLs d'API et le format des webhooks.

Les tarifs des plans (5 000 / 15 000 / 35 000 FCFA par mois pour Starter/Pro/Entreprise) sont définis dans `server/routes/abonnement.js` — à ajuster selon votre marché.

## Authentification : Google et mot de passe oublié

### Connexion avec Google (facultatif)

Le bouton "Se connecter avec Google" n'apparaît que si vous configurez un identifiant OAuth :
1. Allez sur [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Créez un identifiant OAuth 2.0 de type "Application Web"
3. Ajoutez `http://localhost:4000` (ou votre domaine) dans "Origines JavaScript autorisées"
4. Copiez l'identifiant client dans `server/.env` :
   ```
   GOOGLE_CLIENT_ID=votre-identifiant.apps.googleusercontent.com
   ```

Sans cette configuration, le bouton reste simplement masqué — la connexion classique (email/mot de passe) continue de fonctionner normalement.

### Mot de passe oublié

Fonctionne dès l'installation, même sans configuration : si aucun SMTP n'est renseigné dans `.env`, le lien de réinitialisation s'affiche directement dans la console du serveur (pratique pour tester en local). Pour un envoi par email réel, renseignez dans `server/.env` :
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-adresse@gmail.com
SMTP_PASSWORD=un-mot-de-passe-d-application-google
```
(Avec Gmail, il faut un ["mot de passe d'application"](https://myaccount.google.com/apppasswords), pas votre mot de passe habituel.)

## Feuille de route (non inclus dans cette version)

- Intégrations réelles des paiements (Wave, Orange Money, PayDunya, Stripe, PayPal) — actuellement les méthodes sont enregistrées manuellement, sans passerelle de paiement connectée.
- Application mobile native (React Native / Flutter) avec scan QR/code-barres et mode hors ligne.
- Génération de facture par IA à partir d'un texte libre.
- Signature électronique interactive (dessin/upload de signature).
- Authentification à deux facteurs (2FA), chiffrement AES avancé.
- Multi-utilisateurs avec rôles et permissions personnalisées par entreprise.
- Espace administrateur SaaS (gestion des abonnements, statistiques globales, support).
- Notifications par SMS/WhatsApp (les relances et envois par **email** sont déjà disponibles, voir factures.html/devis.html).
- Comptabilité avancée (journal, balance détaillée) — l'export Excel et le résumé comptable (recettes/dépenses/bénéfice/TVA) sont déjà disponibles dans Rapports.
- Marketing site complet (tarifs, blog...) — la page d'accueil existe déjà (`index.html`).

Cette base est volontairement pensée pour être étendue module par module plutôt que livrée comme une coquille vide : chaque fonctionnalité listée ci-dessus peut s'ajouter en suivant les patterns déjà en place (une route Express + une page HTML).

## Déploiement scalable

Pour une charge importante, utiliser `docker-compose.yml` avec Redis et Nginx, puis plusieurs réplicas API :

```bash
docker compose --env-file server/.env up -d --build
docker compose --env-file server/.env up -d --scale app=3
```

Configurer au minimum `REDIS_URL=redis://redis:6379`, `TRUST_PROXY=1`, `WEB_CONCURRENCY` et `DB_POOL_SIZE` selon les ressources du serveur. Le rate-limit et Socket.IO utilisent Redis en mode multi-conteneurs. Voir `deploy/nginx.scalable.conf.example` et `LOAD_TEST_10000.md`.

**Important :** plusieurs milliers d'utilisateurs simultanés nécessitent un test de charge réel sur l'infrastructure cible. La présence d'une architecture horizontale ne constitue pas à elle seule une garantie de 10 000 VU.
