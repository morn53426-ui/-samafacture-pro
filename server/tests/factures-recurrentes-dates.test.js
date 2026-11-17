const { test } = require('node:test');
const assert = require('node:assert/strict');
const { addInterval, parseDateOnly } = require('../routes/factures-recurrentes');

test('les échéances mensuelles gardent le jour initial au-delà des mois courts', () => {
  assert.equal(addInterval('2026-01-31', 'mensuelle', 31), '2026-02-28');
  assert.equal(addInterval('2026-02-28', 'mensuelle', 31), '2026-03-31');
  assert.equal(addInterval('2026-03-31', 'mensuelle', 31), '2026-04-30');
  assert.equal(addInterval('2026-04-30', 'mensuelle', 31), '2026-05-31');
});

test('les échéances annuelles conservent le 29 février comme jour d’ancrage', () => {
  assert.equal(addInterval('2024-02-29', 'annuelle', 29), '2025-02-28');
  assert.equal(addInterval('2025-02-28', 'annuelle', 29), '2026-02-28');
  assert.equal(addInterval('2027-02-28', 'annuelle', 29), '2028-02-29');
});

test('les échéances hebdomadaires utilisent des dates calendaires UTC', () => {
  assert.equal(addInterval('2026-12-28', 'hebdomadaire', 28), '2027-01-04');
});

test('rejette les dates impossibles et les formats non ISO', () => {
  assert.throws(() => parseDateOnly('2026-02-31'), /invalide/);
  assert.throws(() => parseDateOnly('31/12/2026'), /AAAA-MM-JJ/);
  assert.throws(() => parseDateOnly('2026-01-01-extra'), /AAAA-MM-JJ/);
});
