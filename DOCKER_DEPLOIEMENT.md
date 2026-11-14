# Docker — SamaFacture Pro

## Prérequis et versions

Le runtime du projet est **Node.js 26 LTS** (image Docker `node:26-bookworm-slim`). Pour une installation hors Docker, utilisez Node.js 26 LTS et installez les dépendances depuis le lockfile versionné :

```bash
cd server
npm ci
```

Ne supprimez pas `server/package-lock.json` et n'utilisez pas `npm install` pour déployer une version existante : le lockfile assure que l'environnement installé correspond aux versions testées dans la CI.

## Développement local

Depuis la racine du dépôt :

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

L'interface locale est accessible sur `http://localhost:4000`. Le proxy HTTP de développement est lié à `127.0.0.1` : il n'expose pas un endpoint HTTP public non chiffré sur le VPS.

## Déploiement public HTTPS

Le fichier `docker-compose.production.yml` ajoute Caddy, qui obtient et renouvelle automatiquement le certificat TLS. Le port HTTP public sert uniquement à la validation ACME et redirige vers HTTPS.

1. Faire pointer le DNS A/AAAA du domaine vers le VPS.
2. Autoriser les ports TCP 80/443 et UDP 443 dans le pare-feu et chez l'hébergeur.
3. Ajouter les variables d'infrastructure dans le fichier `.env` à la racine (ne jamais le committer) :

```dotenv
APP_DOMAIN=app.votre-domaine.com
DB_NAME=samafacture
DB_USER=samafacture
DB_PASSWORD=mot-de-passe-base-long-et-aleatoire
DB_ROOT_PASSWORD=autre-mot-de-passe-root-long-et-aleatoire
JWT_SECRET=secret-aleatoire-d-au-moins-32-caracteres
```

4. Dans `server/.env` (fichier secret non versionné), configurer les secrets de l'application, dont une clé dédiée au chiffrement des sauvegardes :

```dotenv
BACKUP_ENCRYPTION_KEY=64-caracteres-hexadecimaux
```

Générer cette clé avec `openssl rand -hex 32`, la conserver dans un gestionnaire de secrets et stocker une copie hors du VPS. Sans une clé valide, l'application refuse de démarrer en production afin de ne pas produire de sauvegardes en clair.

5. Vérifier la configuration, puis démarrer :

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml config --quiet
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml up -d --build
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml ps
```

L'URL publique est `https://APP_DOMAIN`. En mode production, le serveur refuse de démarrer si `APP_URL` ou `ALLOWED_ORIGINS` n'utilise pas exactement cette origine HTTPS publique.

Ne publiez jamais le port MySQL. N'exposez pas le port HTTP local 4000. Gardez les volumes Docker et ne lancez pas `docker compose down -v`.

## Sauvegardes et restauration

Les sauvegardes quotidiennes utilisent un verrou MySQL partagé entre les workers. La date de dernière sauvegarde n'est mise à jour qu'après réussite de `mysqldump`, vérification du fichier et fermeture du flux ; un échec laisse donc la possibilité de réessayer au contrôle horaire suivant.

En production, chaque dump est compressé puis chiffré en AES-256-GCM dans `app_backups` sous la forme `.sql.gz.enc`. Le fichier n'est restauré qu'après vérification du tag d'authentification. Pour restaurer, utilisez une base cible vide et exécutez depuis le conteneur applicatif :

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml exec app \
  npm run restore -- /app/server/backups/nom-de-sauvegarde.sql.gz.enc
```

Les sauvegardes restent dans un volume du même VPS : le chiffrement protège les fichiers au repos, mais ne protège pas contre la perte complète du serveur. Configurez également une réplication régulière de ce volume chiffré vers un stockage indépendant (objet S3 compatible ou serveur distant), et testez périodiquement une restauration.

Sauvegarde manuelle :

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml exec app npm run backup
```

## Commandes utiles

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml logs -f app
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml restart app
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml down
```

Pour augmenter le nombre d'instances API, utiliser un hôte dimensionné en conséquence, Redis partagé et le proxy Caddy configuré vers le service app. Ne supprimez jamais le volume `mysql_data` si vous souhaitez conserver les données.
