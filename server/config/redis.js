const { createClient } = require('redis');

let client = null;
let connected = false;

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
    client.on('end', () => { connected = false; });
  }
  return client;
}

async function initRedis() {
  if (!isRedisConfigured()) return null;
  const redis = getRedisClient();
  if (!redis.isOpen) await redis.connect();
  connected = true;
  await redis.ping();
  console.log('🔴 Redis connecté : cache/rate-limit/realtime multi-instance disponibles.');
  return redis;
}

async function closeRedis() {
  if (client?.isOpen) await client.quit();
  connected = false;
}

function isRedisReady() {
  return connected && !!client?.isReady;
}

module.exports = { getRedisClient, initRedis, closeRedis, isRedisConfigured, isRedisReady };
