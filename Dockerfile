# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Image de production pour SamaFacture Pro.
#
# A construire depuis la RACINE du dépôt (celle où se trouvent server/ et public/) :
#   docker build -t samafacture-pro .
# Le contexte doit inclure les deux dossiers, car server/app.js sert le frontend statique
# depuis ../public (chemin relatif à server/, voir express.static(PUBLIC_DIR) dans app.js).
#
# Basée sur node:26-bookworm-slim (pas "alpine") : Puppeteer a besoin de Chromium et de
# ses bibliothèques système (libnss3, libatk, etc.), disponibles en paquets .deb standards
# mais pas toujours compatibles/simples à installer sous Alpine (musl) — c'est le choix
# recommandé par la documentation officielle de Puppeteer pour un déploiement Docker fiable.
# ---------------------------------------------------------------------------
FROM node:26-bookworm-slim

# Dépendances système requises par Chromium (Puppeteer, génération PDF — voir
# server/utils/pdf.js) + mysqldump (sauvegarde automatique quotidienne — voir
# server/config/backup.js) + certificats TLS à jour (appels sortants vers
# Wave/PayDunya/Google) + dumb-init (voir plus bas, gestion propre de l'arrêt).
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    default-mysql-client \
    ca-certificates \
    fonts-liberation \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Indique à Puppeteer d'utiliser le Chromium système installé ci-dessus plutôt que de
# télécharger sa propre copie (~300 Mo) pendant `npm install` — image plus légère, et
# évite un téléchargement qui pourrait échouer selon les restrictions réseau du build.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

# Manifestes npm copiés seuls d'abord, pour profiter du cache Docker. Si un lockfile est
# fourni, npm ci garantit des installations reproductibles ; sinon npm install permet au projet
# de rester buildable (le dépôt actuel ne contient pas encore de package-lock.json).
COPY server/package*.json ./server/
ARG REQUIRE_LOCKFILE=false
RUN cd server && if [ -f package-lock.json ]; then npm ci --omit=dev; elif [ "$REQUIRE_LOCKFILE" = "true" ]; then echo "ERREUR: server/package-lock.json requis pour ce build" >&2; exit 1; else npm install --omit=dev --no-audit --no-fund; fi

# Code serveur, puis frontend statique (servi par Express depuis ../public — voir app.js).
COPY server ./server
COPY public ./public

# Utilisateur non-root : limite l'impact d'une éventuelle faille dans une dépendance
# (Chromium/Puppeteer tourne déjà en sandbox limité par --no-sandbox, voir utils/pdf.js —
# s'exécuter en non-root ici est une couche de défense supplémentaire).
RUN groupadd --system samafacture && useradd --system --gid samafacture --home /app samafacture \
    && mkdir -p /app/server/backups && chown -R samafacture:samafacture /app
USER samafacture

WORKDIR /app/server
EXPOSE 4000

# Vérification de disponibilité : /api/ready vérifie une requête MySQL et Redis lorsqu'il est
# configuré. /api/health reste une sonde de vie qui ne dépend volontairement pas de la base.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/ready', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# dumb-init comme PID 1 : transmet correctement SIGTERM/SIGINT au process Node pour que
# l'arrêt propre déjà implémenté dans app.js (fermeture du pool MySQL, requêtes en cours
# terminées avant de quitter) se déclenche réellement, au lieu d'être ignoré par le PID 1
# (comportement par défaut du noyau Linux pour les signaux reçus par le PID 1).
ENTRYPOINT ["dumb-init", "--"]

# Mode cluster par défaut (voir server/cluster.js) : exploite tous les cœurs CPU alloués au
# conteneur. Réglable via WEB_CONCURRENCY si vous préférez fixer explicitement le nombre de
# workers plutôt que de suivre os.cpus().length du conteneur (utile si le conteneur a accès
# à plus de cœurs que ce qui lui est réellement alloué en pratique, via des cgroups limités).
CMD ["node", "cluster.js"]
