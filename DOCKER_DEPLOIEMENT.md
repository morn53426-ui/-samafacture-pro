# Docker — démarrage rapide SamaFacture Pro

## Démarrage immédiat

Depuis la racine du projet :

```bash
docker compose up -d
```

Puis :

```bash
docker compose ps
docker compose logs -f app
```

L'application est disponible sur `http://localhost:4000` (ou `http://IP_DU_SERVEUR:4000` sur un VPS).

## Ce que Docker démarre

- `app` : API Node.js + frontend, en cluster.
- `pdf-worker` : traitement asynchrone des PDF.
- `mysql` : base MySQL persistante.
- `redis` : file/cache partagé pour les traitements et le temps réel.
- `nginx` : reverse proxy interne exposé sur le port 4000.

Le schéma MySQL est initialisé automatiquement par l'application.

## Mise en production publique

Avant d'exposer le service à Internet :

1. Remplacer `JWT_SECRET`, `DB_ROOT_PASSWORD` et `DB_PASSWORD` dans `.env`.
2. Mettre `APP_URL` et `ALLOWED_ORIGINS` sur le vrai domaine HTTPS.
3. Configurer TLS (certificat) devant Nginx.
4. Passer `PAYDUNYA_MODE` en `live` uniquement après validation des clés de production.
5. Ne pas exposer le port MySQL.
6. Conserver les volumes Docker et mettre les sauvegardes hors du serveur.

## Commandes utiles

```bash
docker compose ps
docker compose logs -f
docker compose restart app
docker compose down
docker compose up -d --build
```

Pour augmenter les instances API, utiliser un hôte disposant de ressources suffisantes et Redis opérationnel, puis :

```bash
docker compose up -d --scale app=3
```

Ne supprimez pas `mysql_data` si vous souhaitez conserver les données.
