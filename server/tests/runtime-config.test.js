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
