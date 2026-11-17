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

**Deux fichiers d'environnement sont utilisés :** `--env-file .env` à la racine sert à l'interpolation des variables Compose ; `env_file: ./server/.env` injecte les paramètres applicatifs dans `app` et `pdf-worker`. Ne remplacez pas le premier par `server/.env`. Pour une préproduction isolée, utilisez également un nom de projet Docker distinct et suivez [RECETTE_PREPRODUCTION.md](RECETTE_PREPRODUCTION.md).

5. Vérifier la configuration, puis démarrer :

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml config --quiet
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml up -d --build
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml ps
```

L'URL publique est `https://APP_DOMAIN`. En mode production, le serveur refuse de démarrer si `APP_URL` ou `ALLOWED_ORIGINS` n'utilise pas exactement cette origine HTTPS publique.

Ne publiez jamais le port MySQL. N'exposez pas le port HTTP local 4000. Gardez les volumes Docker et ne lancez pas `docker compose down -v`.

## Montée en charge horizontale

Le chemin de production est **Caddy (HTTPS) → Nginx (répartition) → réplicas API**. Nginx restaure l'adresse client transmise par Caddy avant le routage persistant `ip_hash`; Redis reste partagé pour Socket.IO et les limites de requêtes.

Profil de départ à mesurer sur votre VPS :

- `WEB_CONCURRENCY=2` : deux processus Node par conteneur API.
- `DB_POOL_SIZE=10` : dix connexions MySQL au maximum par processus.
- `DB_QUEUE_LIMIT=200` : file d'attente locale bornée par processus.
- `DB_POOL_SIZE=10` est également appliqué à chaque worker PDF.

Exemple pour trois conteneurs API et deux workers PDF :

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml up -d --build --scale app=3 --scale pdf-worker=2
```

Budget de connexions à vérifier avant d'augmenter les réplicas :

```text
(conteneurs API × WEB_CONCURRENCY × DB_POOL_SIZE)
+ (workers PDF × DB_POOL_SIZE)
+ connexions réservées à l'administration et aux tâches système
```

Avec le profil ci-dessus, les pools applicatifs peuvent ouvrir jusqu'à **80 connexions MySQL** (3 × 2 × 10 + 2 × 10), avant les connexions réservées. Ajustez `max_connections` et la mémoire MySQL en fonction du VPS ; augmenter le pool sans dimensionner MySQL déplace simplement le goulot d'étranglement. Mesurez le temps de réponse p95/p99, les connexions actives, la file d'attente et la mémoire avant chaque augmentation.

La génération PDF reste asynchrone et isolée de l'API. Augmentez le nombre de workers PDF séparément avec `--scale pdf-worker=N`, en gardant un budget MySQL et mémoire adapté à chaque worker. Les tests à forte charge doivent être exécutés sur un environnement de staging dédié, avec une machine de génération de charge séparée ; une configuration multi-instance n'est pas une garantie de capacité sans mesure sur l'infrastructure cible.

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

Pour augmenter le nombre d'instances API, utiliser la commande de montée en charge ci-dessus : Caddy transmet le trafic à Nginx, qui répartit les requêtes entre les réplicas app. Ne supprimez jamais le volume `mysql_data` si vous souhaitez conserver les données.
