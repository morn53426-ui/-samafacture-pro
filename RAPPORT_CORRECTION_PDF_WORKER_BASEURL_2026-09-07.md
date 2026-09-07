# Rapport de correction — génération de PDF cassée (service `pdf-worker` en Docker)

Date : 2026-09-07

## Problème constaté

La génération de PDF échouait systématiquement pour tout ce qui passe par la file
d'attente asynchrone (`enqueuePdfJob` → Redis → `server/workers/pdf-worker.js` →
`genererPdfFacture`).

`server/utils/pdf.js` fait naviguer un Chromium headless (Puppeteer) vers
`PDF_BASE_URL` (ou, à défaut, `APP_URL`) pour charger la vraie page
`facture-detail.html` et l'imprimer. Dans `docker-compose.yml`, `APP_URL` provient de
`.env` et vaut `http://localhost:4000`.

Cette valeur est correcte pour le conteneur `app` (qui écoute lui-même sur ce port),
mais **pas pour le conteneur `pdf-worker`** : c'est un conteneur Docker séparé qui ne
fait tourner que `workers/pdf-worker.js`, sans aucun serveur HTTP local. Depuis ce
conteneur, `localhost:4000` ne répond à rien — Puppeteer échouait donc à charger la
page (timeout / connexion refusée), et chaque job PDF de la file finissait en `failed`.

La génération PDF synchrone déclenchée directement depuis les routes du conteneur
`app` (`server/routes/factures.js`) fonctionnait, elle, normalement — `localhost:4000`
y désigne bien le serveur Express en cours d'exécution.

## Correction appliquée

- Ajout de `PDF_BASE_URL: http://app:4000` dans le bloc `environment` du service
  `pdf-worker` de `docker-compose.yml`. `PDF_BASE_URL` est prioritaire sur `APP_URL`
  dans `utils/pdf.js` — Puppeteer joint désormais le conteneur `app` via le réseau
  Docker interne (`samafacture_net`), exactement comme le fait déjà nginx
  (`server app:4000 resolve` dans `deploy/nginx.scalable.conf.example`).
- `APP_URL` n'a pas été modifié : il reste utilisé tel quel ailleurs (emails, sitemap,
  robots.txt) où il doit correspondre au vrai domaine public, pas à une adresse interne.
- Aucun fichier applicatif, route ou schéma SQL modifié.

## Pour appliquer en environnement déjà déployé

```bash
docker compose up -d --build pdf-worker
```

Pas besoin de reconstruire `app`, `mysql` ni `redis`.
