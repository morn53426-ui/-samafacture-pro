const { test } = require('node:test');
const assert = require('node:assert/strict');
const { positiveInt, getRuntimeConfig } = require('../config/runtime');

test('configuration runtime utilise des bornes sûres', () => {
  assert.equal(positiveInt('50', 20, { min: 1, max: 100 }), 50);
  assert.equal(positiveInt('999', 20, { min: 1, max: 100 }), 20);
  assert.equal(positiveInt('abc', 20), 20);
});

test('configuration runtime expose des valeurs scalables', () => {
  const previousPool = process.env.DB_POOL_SIZE;
  const previousQueue = process.env.DB_QUEUE_LIMIT;
  process.env.DB_POOL_SIZE = '40';
  process.env.DB_QUEUE_LIMIT = '500';
  const config = getRuntimeConfig();
  assert.equal(config.dbPoolSize, 40);
  assert.equal(config.dbQueueLimit, 500);
  if (previousPool === undefined) delete process.env.DB_POOL_SIZE; else process.env.DB_POOL_SIZE = previousPool;
  if (previousQueue === undefined) delete process.env.DB_QUEUE_LIMIT; else process.env.DB_QUEUE_LIMIT = previousQueue;
});


test('la production refuse HTTP et exige exactement son origine HTTPS publique', () => {
  const names = ['NODE_ENV', 'JWT_SECRET', 'APP_URL', 'ALLOWED_ORIGINS', 'REDIS_URL', 'BACKUP_ENCRYPTION_KEY'];
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));

  try {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'secret-de-test-pas-utilisable-qui-depasse-32-caracteres';
    process.env.BACKUP_ENCRYPTION_KEY = 'ab'.repeat(32);
    process.env.APP_URL = 'http://factures.example.com';
    process.env.ALLOWED_ORIGINS = 'http://factures.example.com';
    assert.throws(() => require('../config/runtime').validateProductionConfig(), /HTTPS/);

    process.env.APP_URL = 'https://factures.example.com';
    process.env.ALLOWED_ORIGINS = 'https://factures.example.com';
    assert.doesNotThrow(() => require('../config/runtime').validateProductionConfig());

    process.env.ALLOWED_ORIGINS = 'https://autre-domaine.example.com';
    assert.throws(() => require('../config/runtime').validateProductionConfig(), /APP_URL/);
  } finally {
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
});
