# Recette de préproduction — PR #3

**Projet :** SamaFacture Pro  
**Branche :** `audit/fix-backup-and-runtime-20261110`  
**PR :** [#3](https://github.com/morn53426-ui/-samafacture-pro/pull/3)  
**Cible de la recette :** schéma MySQL v5 → v7, sessions, facturation, quotas, paiements d'abonnement et sauvegarde/restauration.

> Cette procédure ne déploie rien sur `main` et ne doit jamais utiliser la base de production comme base cible. Les opérations de cette recette se font sur une copie isolée, avec secrets et comptes propres à la préproduction.

## 1. Conditions de sécurité

- Préférer un VPS de staging séparé. À défaut, utiliser un répertoire de déploiement distinct, un projet Docker Compose distinct, un réseau et des volumes nommés distincts, ainsi qu'un port local non public.
- Ne jamais réutiliser le fichier `server/.env` de production, ses clés JWT/chiffrement, ses identifiants SMTP, Wave ou PayDunya.
- Ne jamais faire pointer le staging vers l'hôte, le nom de base ou les volumes MySQL de production.
- La copie contenant des données personnelles doit être chiffrée pendant le transfert, strictement limitée aux personnes autorisées, anonymisée avant ouverture de l'application, puis supprimée selon une durée courte définie.
- Utiliser des comptes de test et uniquement les environnements sandbox des prestataires. Aucun paiement réel pendant la recette.
- Faire une sauvegarde vérifiée avant toute opération. Ne jamais lancer les commandes de restauration sur la base de production.

## 2. Créer un environnement isolé

Sur le serveur de staging (ou dans un répertoire différent sur le VPS) :

```bash
sudo mkdir -p /opt/samafacture-preprod
sudo chown "$USER":"$USER" /opt/samafacture-preprod
cd /opt/samafacture-preprod
git clone --single-branch --branch audit/fix-backup-and-runtime-20261110 \
  https://github.com/morn53426-ui/-samafacture-pro.git .
git rev-parse HEAD
```

Vérifier que le commit affiché est celui de la tête de la PR au moment de la recette. Si la branche a avancé, récupérer le nouveau commit et refaire les contrôles CI avant de poursuivre.

Créer une configuration neuve :

```bash
cp server/.env.example server/.env
chmod 600 server/.env
nano server/.env
```

Configurer au minimum des valeurs exclusivement réservées au staging :

- `DB_NAME=samafacture_preprod`
- `DB_USER=samafacture_preprod`
- `DB_PASSWORD` et `DB_ROOT_PASSWORD` : mots de passe aléatoires uniques
- `JWT_SECRET` : secret aléatoire propre au staging
- `DATA_ENCRYPTION_KEY` : clé aléatoire propre au staging
- `APP_URL` : URL HTTPS du sous-domaine de staging
- `ALLOWED_ORIGINS` : origine HTTPS du staging
- `PAYDUNYA_MODE=test` ; clés sandbox uniquement, ou variables vides
- SMTP de test uniquement ; laisser les identifiants de production absents
- `HTTP_PORT=127.0.0.1:14001` pour ne pas publier directement le port de recette sur Internet

Générer les secrets dans un terminal sûr avec `openssl rand -hex 32` (ou `openssl rand -hex 48` pour `JWT_SECRET`). Ne pas les mettre dans Git, un ticket ou un journal. Le fichier d'environnement est chargé à la fois par Compose et par le service applicatif.

Valider la configuration puis démarrer uniquement MySQL et Redis :

```bash
docker compose -p samafacture-preprod --env-file server/.env config --quiet
docker compose -p samafacture-preprod --env-file server/.env up -d mysql redis
docker compose -p samafacture-preprod --env-file server/.env ps
```

Le nom de projet Compose `samafacture-preprod` doit rester identique pour toutes les commandes de cette recette : il isole les conteneurs, le réseau et les volumes de ceux du projet de production.

## 3. Préparer et restaurer la copie de base

1. Produire un dump cohérent de la base source avec `mysqldump --single-transaction`, en incluant routines, événements et triggers. Depuis le répertoire du déploiement de production, exécuter la commande ci-dessous. Remplacer le chemin de sortie par un emplacement temporaire protégé (droits 600, répertoire non public) :

```bash
set -euo pipefail
umask 077
docker compose --env-file server/.env exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump --single-transaction --routines --events --triggers --hex-blob -uroot "$MYSQL_DATABASE"' \
  | gzip > /secure/samafacture-preprod-brut.sql.gz
gzip -t /secure/samafacture-preprod-brut.sql.gz
sha256sum /secure/samafacture-preprod-brut.sql.gz
```

Cette commande doit être exécutée côté production uniquement pour lire/exporter la base. Elle n'effectue aucune restauration et n'écrit pas dans MySQL.
2. Vérifier le fichier avec `gzip -t` et calculer son empreinte avec `sha256sum`. Transférer le dump vers le staging par un canal SSH/SFTP chiffré.
3. Avant de démarrer l'application de staging, restaurer le dump dans la base `samafacture_preprod` du projet Docker de staging. Utiliser le compte root MySQL du conteneur de staging, jamais les identifiants de production.
4. Anonymiser les données personnelles présentes dans toutes les tables métier : utilisateurs, clients, fournisseurs, contacts, employés, adresses, téléphones, emails, identifiants fiscaux et bancaires, commentaires et pièces jointes. Remplacer également les emails par des adresses réservées au test sous `example.invalid`. Réinitialiser les mots de passe des comptes de test et supprimer les jetons de récupération, identifiants OAuth, secrets webhook et références marchandes réelles.
5. Si l'anonymisation exhaustive ne peut pas être garantie, ne pas ouvrir l'application sur cette copie : utiliser un jeu de données synthétique pour la recette.

Exemple de restauration d'un dump **déjà anonymisé** (adapter le chemin du fichier) :

```bash
set -euo pipefail
gzip -t /secure/samafacture-preprod-anonymisee.sql.gz
sha256sum /secure/samafacture-preprod-anonymisee.sql.gz

gunzip -c /secure/samafacture-preprod-anonymisee.sql.gz | \
  docker compose -p samafacture-preprod --env-file server/.env exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot "$MYSQL_DATABASE"'
```

Avant la migration, relever et conserver les résultats de ces requêtes sur la copie :

```sql
SELECT version, initialized_at FROM _samafacture_schema_meta WHERE id = 1;
SELECT COUNT(*) AS utilisateurs FROM users;
SELECT COUNT(*) AS clients FROM clients;
SELECT COUNT(*) AS factures FROM factures;
SELECT COUNT(*) AS paiements FROM paiements;
```

Pour vérifier le scénario demandé, la copie source doit refléter le schéma antérieur aux correctifs (version 5, si c'est bien la version actuellement présente dans la base source). Si la version est différente ou si la table de métadonnées manque, consigner le résultat et faire valider le scénario avant de lancer la migration.

## 4. Exécuter la migration v5 → v7

Le backend appelle `initDatabase()` avant d'accepter les requêtes. Le démarrage de l'API applique donc les migrations du schéma sous verrou MySQL. Démarrer l'API seule en premier :

```bash
docker compose -p samafacture-preprod --env-file server/.env up -d app
docker compose -p samafacture-preprod --env-file server/.env logs --tail=200 app
docker compose -p samafacture-preprod --env-file server/.env ps
```

Ne poursuivre que si l'API est saine et si les logs ne contiennent aucune erreur d'initialisation SQL ou de migration. Vérifier ensuite dans MySQL :

```sql
SELECT version, initialized_at FROM _samafacture_schema_meta WHERE id = 1;
SHOW COLUMNS FROM users LIKE 'token_version';
SHOW CREATE TABLE facture_usage_mensuelle;
SELECT COUNT(*) AS utilisateurs FROM users;
SELECT COUNT(*) AS factures FROM factures;
```

Critères : version du schéma égale à **7**, colonne `users.token_version` présente, table `facture_usage_mensuelle` présente et données métier conservées. Comparer les compteurs avec ceux relevés avant migration. Une différence inexpliquée bloque la recette.

Quand l'API est saine, démarrer les services restants :

```bash
docker compose -p samafacture-preprod --env-file server/.env up -d pdf-worker nginx
docker compose -p samafacture-preprod --env-file server/.env ps
```

## 5. Contrôles techniques non destructifs

Depuis le serveur de staging :

```bash
cd /opt/samafacture-preprod/server
SAMAFACTURE_BASE_URL=http://127.0.0.1:14001 \
ALLOW_HTTP_STAGING=true npm run smoke:staging
```

Pour tester également une session authentifiée, fournir temporairement un jeton d'un compte de test avec `SAMAFACTURE_STAGING_TOKEN`. Ne pas utiliser un jeton de production. Le script vérifie la liveness, la readiness MySQL/Redis, la page d'accueil et le refus d'une route API sans jeton. Il est non destructif ; il ne remplace pas les tests métier.

Si le staging est exposé derrière un proxy HTTPS, utiliser son URL HTTPS et ne pas activer `ALLOW_HTTP_STAGING`.

## 6. Recette fonctionnelle obligatoire

Cocher et conserver une preuve pour chaque cas :

- [ ] Connexion d'un compte de test ; isolation entre deux entreprises/comptes.
- [ ] Déconnexion : un ancien JWT est refusé ; vérifier aussi une deuxième session/appareil.
- [ ] Réinitialisation de mot de passe : lien à usage unique, lien expiré et ancien JWT révoqué.
- [ ] Quota mensuel : création normale, API publique, duplication, conversion devis → facture et génération récurrente.
- [ ] Quota : suppression d'une facture, changement de plan et créations concurrentes ne réinitialisent ni ne dépassent le compteur.
- [ ] Facture : TVA, remise, frais de livraison, arrondis, PDF et envoi SMTP de test.
- [ ] Paiements facture : acompte, solde, refus de marquer « payée » sans encaissement complet, refus de paiement sur devis ou facture annulée.
- [ ] Idempotence : même clé sur la même facture = rejeu contrôlé ; même clé sur une autre facture = HTTP 409.
- [ ] Abonnement : Wave/PayDunya en sandbox seulement ; vérifier signature, montant, doublon, expiration, rejeu après erreur et callback ancien.
- [ ] Interface navigateur : Chrome/Firefox et Safari iOS si disponible ; largeur mobile, création de facture, listes, PDF et navigation.
- [ ] Aucune erreur serveur non traitée, aucun secret ou jeton dans les logs.

Tout échec doit être décrit avec le commit testé, l'heure, le scénario, le résultat attendu, le résultat obtenu et une trace expurgée de tout secret ou donnée personnelle.

## 7. Exercice de sauvegarde et de restauration

Exécuter une sauvegarde depuis le conteneur de staging :

```bash
docker compose -p samafacture-preprod --env-file server/.env exec -T app npm run backup
```

Vérifier qu'une archive complète `.sql.gz` est produite et que `gzip -t` réussit. Copier l'archive vers l'hôte avec `docker compose -p samafacture-preprod --env-file server/.env cp app:/app/server/backups/NOM_ARCHIVE.sql.gz /secure/NOM_ARCHIVE.sql.gz` (remplacer `NOM_ARCHIVE.sql.gz` par le nom réel).

Créer une base temporaire distincte dans le MySQL de staging, puis restaurer dedans :

```bash
docker compose -p samafacture-preprod --env-file server/.env exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "CREATE DATABASE IF NOT EXISTS samafacture_restore_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"'

gunzip -c /secure/NOM_ARCHIVE.sql.gz | \
  docker compose -p samafacture-preprod --env-file server/.env exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot samafacture_restore_test'
```

Vérifier que les tables, le nombre d'utilisateurs, factures et paiements correspondent à la base source de la sauvegarde. Comparer au minimum les compteurs suivants dans la base restaurée :

```sql
SELECT COUNT(*) AS utilisateurs FROM samafacture_restore_test.users;
SELECT COUNT(*) AS factures FROM samafacture_restore_test.factures;
SELECT COUNT(*) AS paiements FROM samafacture_restore_test.paiements;
SELECT version FROM samafacture_restore_test._samafacture_schema_meta WHERE id = 1;
```

La restauration doit être faite dans cette base temporaire, jamais dans `samafacture_preprod` en activité ni dans la base de production. Noter la durée, la taille de l'archive et le résultat des contrôles. L'exercice local ne valide pas encore une sauvegarde hors VPS : cette copie externalisée et chiffrée reste un point de production distinct.

## 8. Préparer la fusion de la PR #3

La PR ne pourra passer en « Ready for review » qu'après les éléments suivants :

- [ ] CI verte sur le dernier SHA de la PR (pas seulement sur un ancien commit).
- [ ] Migration de la copie isolée terminée en version 7, sans perte inexpliquée.
- [ ] Tests de sessions, quotas, paiements et parcours de facturation validés.
- [ ] Sauvegarde puis restauration réussies dans une base distincte.
- [ ] Aucun défaut bloquant ni thread de revue non résolu.
- [ ] Rapport de recette complété et décision de mise en production explicitement approuvée.

Après validation : passer la PR en revue, relire le diff final, fusionner vers `main` avec la méthode retenue par le dépôt, puis déployer séparément selon une procédure de sauvegarde/retour arrière. La fusion ne déclenche pas à elle seule l'autorisation d'activer les paiements réels ou de déployer en production.

**État au moment de la rédaction :** PR #3 ouverte en brouillon ; CI GitHub Actions n° 94 réussie sur le SHA `8f4209c5ea23e4d6f8aa4a2675c549b15c38685f`. La recette réelle sur la copie de base n'est pas encore exécutée dans cet environnement.
