const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { resolveSocketTenant } = require('../realtime');

describe('Sélection d’entreprise Socket.IO', () => {
  test('un propriétaire rejoint son propre espace sans requête SQL', async () => {
    let called = false;
    const tenant = await resolveSocketTenant(12, '12', async () => { called = true; return [[]]; });
    assert.equal(tenant, 12); assert.equal(called, false);
  });

  test('un membre rejoint uniquement une entreprise avec adhésion active', async () => {
    const calls = [];
    const tenant = await resolveSocketTenant(25, '12', async (sql, params) => { calls.push({ sql, params }); return [[{ owner_user_id: 12 }]]; });
    assert.equal(tenant, 12); assert.deepEqual(calls[0].params, [25, 12]); assert.match(calls[0].sql, /active = 1/);
  });

  test('une sélection falsifiée ou une adhésion inactive est refusée', async () => {
    await assert.rejects(resolveSocketTenant(25, 'not-an-id', async () => [[]]), /Sélection d’entreprise invalide/);
    await assert.rejects(resolveSocketTenant(25, '99', async () => [[]]), /Adhésion à cette entreprise absente ou inactive/);
  });
});
