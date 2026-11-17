const { test } = require('node:test');
const assert = require('node:assert/strict');
const { reserveMonthlyInvoiceQuota } = require('../utils/invoice-quota');

function fakeConnection({ plan = 'gratuit', fuseauHoraire = 'Europe/Paris', used = 0 } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes('SELECT plan, fuseau_horaire')) {
        return [[{ plan, fuseau_horaire: fuseauHoraire }], []];
      }
      if (sql.includes('SELECT nombre_factures FROM facture_usage_mensuelle')) {
        return [[{ nombre_factures: used }], []];
      }
      return [{ affectedRows: 1 }, []];
    }
  };
}

test('le quota mensuel bascule au premier jour local du compte, même si UTC est encore la veille', async () => {
  const conn = fakeConnection({ fuseauHoraire: 'Europe/Paris' });
  const result = await reserveMonthlyInvoiceQuota(
    conn,
    42,
    { now: new Date('2026-10-31T23:30:00.000Z') }
  );

  assert.equal(result.allowed, true);
  const usageQuery = conn.calls.find(call => call.sql.includes('facture_usage_mensuelle'));
  assert.deepEqual(usageQuery.params, [42, '2026-11-01']);
});

test('le quota conserve la période de novembre pour Dakar à la même seconde UTC', async () => {
  const conn = fakeConnection({ fuseauHoraire: 'Africa/Dakar' });
  const result = await reserveMonthlyInvoiceQuota(
    conn,
    42,
    { now: new Date('2026-10-31T23:30:00.000Z') }
  );

  assert.equal(result.allowed, true);
  const usageQuery = conn.calls.find(call => call.sql.includes('facture_usage_mensuelle'));
  assert.deepEqual(usageQuery.params, [42, '2026-10-01']);
});
