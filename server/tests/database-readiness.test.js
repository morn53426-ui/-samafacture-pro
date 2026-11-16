const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { waitForDatabase } = require('../config/database-readiness');

describe('Disponibilité MySQL du worker PDF', () => {
  test('réessaie après une indisponibilité transitoire puis continue', async () => {
    let calls = 0;
    const waits = [];
    const retries = [];
    const fakePool = {
      async query(sql) {
        assert.equal(sql, 'SELECT 1');
        calls += 1;
        if (calls < 3) throw new Error('ECONNREFUSED');
        return [[{ 1: 1 }], []];
      }
    };

    await waitForDatabase(fakePool, {
      maxAttempts: 4,
      delayMs: 25,
      sleepFn: async ms => waits.push(ms),
      onRetry: (err, attempt, maxAttempts) => retries.push({ message: err.message, attempt, maxAttempts })
    });

    assert.equal(calls, 3);
    assert.deepEqual(waits, [25, 25]);
    assert.deepEqual(retries, [
      { message: 'ECONNREFUSED', attempt: 1, maxAttempts: 4 },
      { message: 'ECONNREFUSED', attempt: 2, maxAttempts: 4 }
    ]);
  });

  test('signale une erreur après le nombre maximal de tentatives', async () => {
    let calls = 0;
    const fakePool = {
      async query() {
        calls += 1;
        throw new Error('Access denied');
      }
    };

    await assert.rejects(
      waitForDatabase(fakePool, {
        maxAttempts: 3,
        delayMs: 0,
        sleepFn: async () => {}
      }),
      /MySQL reste indisponible après 3 tentatives : Access denied/
    );
    assert.equal(calls, 3);
  });

  test('refuse une configuration de tentatives invalide', async () => {
    await assert.rejects(
      waitForDatabase({ query: async () => {} }, { maxAttempts: 0 }),
      /maxAttempts doit être un entier supérieur ou égal à 1/
    );
  });
});
