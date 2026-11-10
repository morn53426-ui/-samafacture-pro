# Recette de préproduction — SamaFacture Pro

Ce document décrit le contrôle à réaliser sur un environnement **staging séparé** avant toute fusion vers `main` ou mise en production. La réussite de GitHub Actions ne remplace pas cette recette manuelle.

## 1. Isoler l'environnement

- Utiliser un sous-domaine distinct, par exemple `staging.votre-domaine.tld`, avec son propre certificat TLS.
- Utiliser une base dédiée, par exemple `samafacture_staging`, et un utilisateur MySQL dédié. Ne jamais connecter cette instance à la base de production.
- Utiliser Redis de staging (service Compose séparé ou instance/DB Redis réservée à la préproduction).
- Utiliser un espace de sauvegarde distinct de la production.
- Ne pas copier des données personnelles réelles en staging. Créer des utilisateurs, clients, factures et documents fictifs.
- Conserver le SHA Git exact testé pour pouvoir reproduire la recette.

## 2. Préparer les variables

Depuis la racine du dépôt :

```bash
cp server/.env.example server/.env
```

Renseigner au minimum les variables suivantes dans `server/.env` :

| Variable | Valeur attendue en staging |
|---|---|
| `NODE_ENV` | `production` pour vérifier les mêmes protections qu'en production |
| `PORT` | `4000` dans le conteneur |
| `APP_URL` | URL HTTPS du sous-domaine staging |
| `JWT_SECRET` | Secret aléatoire d'au moins 32 caractères, propre à staging |
| `DATA_ENCRYPTION_KEY` | Clé aléatoire propre à staging, conservée durablement |
| `DB_NAME` | Nom de base de staging, jamais le nom de la base de production |
| `DB_USER` / `DB_PASSWORD` | Compte MySQL dédié à staging |
| `DB_ROOT_PASSWORD` | Mot de passe fort utilisé pour initialiser le conteneur MySQL |
| `ALLOWED_ORIGINS` | Origine HTTPS de staging, sans chemin |
| `BACKUP_ENABLED` | `true`, avec un stockage de sauvegarde réservé à staging |
| `BACKUP_DIR` | Répertoire persistant prévu pour les sauvegardes de staging |

Générer deux secrets différents, puis les conserver dans un gestionnaire de secrets :

```bash
openssl rand -hex 48
openssl rand -hex 32
```

Le premier résultat peut servir pour `JWT_SECRET`, le second pour `DATA_ENCRYPTION_KEY`. Ne pas publier les secrets dans Git, les tickets ou les captures d'écran. Ne pas changer `DATA_ENCRYPTION_KEY` après avoir créé des webhooks chiffrés, sauf si les secrets concernés sont recréés.

Le fichier Compose définit `REDIS_URL=redis://redis:6379` dans le réseau interne. Ne remplacez pas cette adresse par `localhost` depuis un conteneur. Configurez SMTP avec une boîte de test qui ne contacte aucun client réel. Gardez les clés des prestataires en mode sandbox/test lorsqu'un parcours existant les utilise.

## 3. Vérifier la configuration et démarrer

La procédure Compose référence explicitement `server/.env`. Depuis la racine du dépôt :

```bash
docker compose --env-file server/.env config --quiet
docker compose --env-file server/.env build --pull
docker compose --env-file server/.env up -d
docker compose --env-file server/.env ps
```

Contrôler les journaux de chaque service :

```bash
docker compose --env-file server/.env logs --tail=200 mysql redis app pdf-worker nginx
```

Les conteneurs `mysql` et `redis` doivent être sains. Le conteneur `app` doit passer à l'état `healthy` : son contrôle Docker appelle `/api/ready`, qui vérifie MySQL et Redis lorsque Redis est configuré. `/api/health` reste une sonde de vie du processus et ne prouve pas que la base est disponible.

Les migrations sont appliquées au démarrage de l'application. Faire une sauvegarde vérifiée de la base de staging avant le premier démarrage sur une base qui contient déjà des données.

## 4. Vérifier les sondes et le frontend

Depuis une machine qui peut joindre l'URL HTTPS de staging :

```bash
curl -fsS https://staging.votre-domaine.tld/api/health
curl -fsS https://staging.votre-domaine.tld/api/ready
curl -fsSI https://staging.votre-domaine.tld/
```

Résultats attendus :
- `/api/health` renvoie HTTP 200 et `status: ok`.
- `/api/ready` renvoie HTTP 200 et `status: ready`, avec MySQL actif et Redis actif s'il est configuré.
- La page d'accueil se charge en HTTPS sans erreur serveur.

Le script non destructif suivant automatise ces contrôles de base :

```bash
cd server
SAMAFACTURE_BASE_URL=https://staging.votre-domaine.tld npm run smoke:staging
```

Le script vérifie aussi qu'une route métier protégée refuse une requête sans jeton. Il ne crée ni ne modifie de données.

## 5. Parcours métier à réaliser dans le navigateur

Créer un compte propriétaire de test et un second compte membre. Utiliser uniquement des données fictives.

- **Authentification** : inscription, déconnexion, connexion, réinitialisation de session et accès refusé sans authentification.
- **Catalogue et clients** : créer, modifier, consulter et supprimer un client et un produit fictifs.
- **Facturation** : établir un devis, le convertir en facture, générer le PDF, consulter la version publique avec code/QR et vérifier les montants et la TVA.
- **Encaissements** : enregistrer un paiement manuel de test, contrôler le solde restant et l'historique. Les liens/QR de cette extension sont des demandes de paiement ; ils ne déclenchent pas un débit Wave/Orange Money/PayDunya.
- **Équipe** : inviter le second compte, accepter l'invitation, ouvrir l'espace entreprise, attribuer le rôle lecture seule et vérifier qu'une création/modification est refusée.
- **Séparation des entreprises** : tester deux espaces distincts et confirmer qu'un utilisateur ne voit ni ne modifie les clients, factures, documents et caisses de l'autre entreprise.
- **Ventes et gestion** : créer une commande, un bon de livraison, un avoir de test, un acompte, un établissement, une caisse et des mouvements. Vérifier le solde et les historiques.
- **Documents** : déposer un PDF/JPEG/PNG fictif, le télécharger, vérifier le refus des formats non autorisés et des fichiers dépassant 5 Mo. Ne pas considérer la validation MIME comme un antivirus : l'analyse antivirus n'est pas intégrée.
- **Rapports** : comparer le chiffre d'affaires, les paiements, dépenses et marges avec les écritures fictives réellement créées.
- **Automatisations** : tester une relance email vers la boîte de test et une livraison webhook vers un endpoint HTTPS public contrôlé. Vérifier signature et retries. Ne pas cibler localhost, une IP privée, ni un service de production.
- **Responsive** : refaire au minimum les parcours connexion, liste clients, facture, paiement et espace professionnel sur mobile Safari/Chrome et sur ordinateur.

## 6. Vérifier les emails, les webhooks et les paiements

- Les invitations et relances doivent arriver uniquement dans la boîte de test configurée.
- Contrôler le contenu des liens, l'expiration des invitations et l'absence de secrets dans les emails et journaux.
- Pour un webhook, vérifier la signature HMAC-SHA256, le statut de livraison et le comportement après réponse HTTP en erreur.
- Ne pas tester avec un compte marchand réel ni effectuer de transactions réelles.
- Les nouveaux liens et QR codes de la zone professionnelle sont des demandes de paiement, pas une intégration d'encaissement automatique.
- Les demandes de remboursement restent un suivi interne : la restitution effective auprès du prestataire doit être manuelle tant qu'un connecteur dédié n'est pas réalisé.
- WhatsApp automatique, antivirus des pièces jointes et signature qualifiée/certifiée ne sont pas disponibles dans cette version.

## 7. Vérifier sauvegarde et restauration

1. Déclencher une sauvegarde de staging depuis le service applicatif ou la commande documentée.
2. Vérifier que l'archive existe, qu'elle n'est pas vide et que `gzip -t archive.sql.gz` réussit.
3. Restaurer l'archive dans une **base de test temporaire distincte**, jamais par-dessus staging ou production.
4. Vérifier les tables, les comptes de test, les factures et les montants restaurés.
5. Consigner le résultat, la durée et l'emplacement de l'archive. Une sauvegarde non restaurée n'est pas une preuve de restauration opérationnelle.

## 8. Critères de validation avant fusion

La recette est acceptée uniquement si :
- les services Docker sont sains et `/api/ready` est stable ;
- les tests automatisés GitHub Actions sont verts ;
- les parcours métier prioritaires sont terminés sans erreur bloquante ;
- les permissions et l'isolation entre entreprises ont été vérifiées avec deux comptes ;
- les PDFs sont de vrais fichiers lisibles ;
- les emails et webhooks de test fonctionnent sans contacter de destinataires réels ;
- une sauvegarde a été restaurée avec succès dans une base distincte ;
- les limites fonctionnelles décrites dans `MODULES_PROFESSIONNELS.md` sont acceptées et ne sont pas présentées comme des fonctions déjà intégrées.

Consigner le SHA de la branche, les appareils/navigateurs testés, les résultats, les anomalies ouvertes et le nom de la personne qui a validé. Ne fusionner qu'après fermeture des anomalies bloquantes et validation explicite de la recette.

## 9. Nettoyage après la recette

Arrêter et supprimer les conteneurs staging selon la politique de conservation, sans supprimer les volumes tant que les preuves de recette et sauvegardes ne sont pas archivées. Révoquer les comptes/jetons de test, désactiver les webhooks et SMTP de test, et conserver les secrets staging séparés de ceux de production.
