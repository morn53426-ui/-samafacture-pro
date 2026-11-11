# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Image SamaFacture Pro — Node 24 / Debian Bookworm.
# Construire depuis la racine du dépôt : docker compose up -d --build
# Chromium système est conservé pour Puppeteer, et default-mysql-client fournit
# mysqldump au planificateur de sauvegarde.
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim

# Certains réseaux Docker Desktop/FAI ont une connectivité IPv6 partielle.
# Forcer IPv4 et activer les caches BuildKit limite les timeouts et les re-téléchargements.
RUN printf 'Acquire::ForceIPv4 "true";\nAcquire::Retries "3";\n' \
    > /etc/apt/apt.conf.d/99-network-retries

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update \
    && apt-get install -y --no-install-recommends \
        chromium \
        default-mysql-client \
        ca-certificates \
        fonts-liberation \
        dumb-init \
    && apt-get clean

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

# Créer le compte avant les COPY : les fichiers de l'application seront copiés
# directement avec le bon propriétaire, sans chown -R sur tout /app/node_modules.
RUN groupadd --system samafacture \
    && useradd --system --gid samafacture --home /app samafacture

# Le lockfile est obligatoire : npm ci installe exactement les versions validées.
COPY server/package.json server/package-lock.json ./server/
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    cd server && npm ci --omit=dev --no-audit --no-fund

# --chown applique les droits pendant la copie ; évite la longue opération chown -R.
# .dockerignore exclut les node_modules locaux et surtout les fichiers .env du poste hôte.
COPY --chown=samafacture:samafacture server ./server
COPY --chown=samafacture:samafacture public ./public

# Seuls ces répertoires doivent être inscriptibles à l'exécution.
# Les volumes Docker montés par Compose héritent de ces permissions à leur création.
RUN mkdir -p /app/server/backups /app/server/pdf-jobs \
    && chown samafacture:samafacture /app/server/backups /app/server/pdf-jobs

USER samafacture
WORKDIR /app/server
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/ready', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "cluster.js"]
