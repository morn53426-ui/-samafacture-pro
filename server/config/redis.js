const { createClient } = require('redis');

let client = null;
let connected = false;
let connectionPromise = null;

function isRedisConfigured() {
  return Boolean(process.env.REDIS_URL);
}

function getRedisClient() {
  if (!isRedisConfigured()) return null;
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (err) => {
      console.error('⚠️ Redis :', err.message);
      connected = false;
    });
    client.on('ready', () => { connected = true; });
    client.on('end', () => {
      connected = false;
      connectionPromise = null;
    });
  }
  return client;
}

/**
 * Ouvre Redis une seule fois et partage la promesse entre tous les appelants.
 * Le rate-limit peut demander ses scripts Lua dès le chargement d'app.js, avant
 * que start() n'ait eu le temps d'appeler initRedis(). Chaque commande attend donc
 * explicitement que la connexion soit prête au lieu d'appeler sendCommand sur un
 * client encore fermé (ClientClosedError).
 */
function ensureRedisConnected() {
  const redis = getRedisClient();
  if (!redis) return Promise.resolve(null);
  if (redis.isReady) {
    connected = true;
    return Promise.resolve(redis);
  }

  if (!connectionPromise) {
    connectionPromise = (async () => {
      if (!redis.isOpen) {
        await redis.connect();
      } else {
        // Une connexion peut être en cours de rétablissement après une coupure.
        await new Promise((resolve, reject) => {
          if (redis.isReady) return resolve();
          const onReady = () => { cleanup(); resolve(); };
          const onEnd = () => {
            cleanup();
            reject(new Error('La connexion Redis s’est fermée avant de redevenir disponible.'));
          };
          const cleanup = () => {
            redis.off('ready', onReady);
            redis.off('end', onEnd);
          };
          redis.once('ready', onReady);
          redis.once('end', onEnd);
        });
      }
      connected = true;
      return redis;
    })().catch((err) => {
      connected = false;
      connectionPromise = null;
      throw err;
    });
  }

  return connectionPromise;
}

async function initRedis() {
  if (!isRedisConfigured()) return null;
  const redis = await ensureRedisConnected();
  await redis.ping();
  console.log('🔴 Redis connecté : cache/rate-limit/realtime multi-instance disponibles.');
  return redis;
}

async function closeRedis() {
  if (client?.isOpen) await client.quit();
  connected = false;
  connectionPromise = null;
}

function isRedisReady() {
  return connected && !!client?.isReady;
}

module.exports = {
  getRedisClient,
  ensureRedisConnected,
  initRedis,
  closeRedis,
  isRedisConfigured,
  isRedisReady
};
