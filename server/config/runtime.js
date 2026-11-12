'use strict';

function positiveInt(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return fallback;
  return n;
}

function getRuntimeConfig() {
  return {
    port: positiveInt(process.env.PORT, 4000, { min: 1, max: 65535 }),
    dbPoolSize: positiveInt(process.env.DB_POOL_SIZE, 20, { min: 1, max: 500 }),
    dbQueueLimit: positiveInt(process.env.DB_QUEUE_LIMIT, 2000, { min: 0, max: 100000 }),
    shutdownTimeoutMs: positiveInt(process.env.SHUTDOWN_TIMEOUT_MS, 10000, { min: 1000, max: 120000 }),
    healthTimeoutMs: positiveInt(process.env.HEALTH_TIMEOUT_MS, 3000, { min: 250, max: 30000 })
  };
}

// Le changement manuel de formule n'est permis que dans les environnements explicitement
// destinés au développement ou aux tests. Une variable NODE_ENV absente/inconnue doit
// échouer de façon sûre, afin qu'un déploiement mal configuré ne puisse pas attribuer Pro.
function isManualPlanSelectionEnabled() {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
}

function validateProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;
  const errors = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) errors.push('JWT_SECRET doit contenir au moins 32 caractères.');
  if (process.env.REDIS_URL && !/^rediss?:\/\//i.test(process.env.REDIS_URL)) errors.push('REDIS_URL doit être une URL redis:// ou rediss:// valide.');
  if (process.env.ALLOWED_ORIGINS) {
    for (const origin of process.env.ALLOWED_ORIGINS.split(',').map(x => x.trim()).filter(Boolean)) {
      try { new URL(origin); } catch { errors.push(`ALLOWED_ORIGINS contient une origine invalide : ${origin}`); }
    }
  }
  if (errors.length) throw new Error(`Configuration production invalide :\n- ${errors.join('\n- ')}`);
}

module.exports = { getRuntimeConfig, validateProductionConfig, positiveInt, isManualPlanSelectionEnabled };
