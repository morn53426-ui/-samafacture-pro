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

function validateProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;
  const errors = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) errors.push('JWT_SECRET doit contenir au moins 32 caractères.');
  if (!process.env.APP_URL) {
    errors.push('APP_URL doit être configurée avec le domaine public HTTPS.');
  } else {
    try {
      const publicUrl = new URL(process.env.APP_URL);
      if (publicUrl.protocol !== 'https:') errors.push('APP_URL doit utiliser HTTPS en production.');
      if (!publicUrl.hostname || ['localhost', '127.0.0.1'].includes(publicUrl.hostname)) {
        errors.push('APP_URL doit utiliser un nom de domaine public, pas localhost.');
      }
    } catch {
      errors.push('APP_URL doit être une URL publique valide.');
    }
  }
  if (!process.env.ALLOWED_ORIGINS) {
    errors.push('ALLOWED_ORIGINS doit autoriser explicitement le domaine HTTPS public.');
  }
  if (process.env.REDIS_URL && !/^rediss?:\/\//i.test(process.env.REDIS_URL)) errors.push('REDIS_URL doit être une URL redis:// ou rediss:// valide.');
  if (process.env.ALLOWED_ORIGINS) {
    for (const origin of process.env.ALLOWED_ORIGINS.split(',').map(x => x.trim()).filter(Boolean)) {
      try { new URL(origin); } catch { errors.push(`ALLOWED_ORIGINS contient une origine invalide : ${origin}`); }
    }
  }
  if (process.env.APP_URL && process.env.ALLOWED_ORIGINS) {
    try {
      const publicOrigin = new URL(process.env.APP_URL).origin;
      const allowed = process.env.ALLOWED_ORIGINS.split(',').map(x => x.trim()).filter(Boolean);
      if (!allowed.includes(publicOrigin)) {
        errors.push('ALLOWED_ORIGINS doit inclure exactement l’origine HTTPS de APP_URL.');
      }
      for (const origin of allowed) {
        try {
          if (new URL(origin).protocol !== 'https:') errors.push(`ALLOWED_ORIGINS doit utiliser HTTPS : ${origin}`);
        } catch {
          // L'erreur de format est déjà signalée dans la validation ci-dessus.
        }
      }
    } catch {
      // L'erreur de format de APP_URL est déjà signalée plus haut.
    }
  }
  if (errors.length) throw new Error(`Configuration production invalide :\n- ${errors.join('\n- ')}`);
}

module.exports = { getRuntimeConfig, validateProductionConfig, positiveInt };
