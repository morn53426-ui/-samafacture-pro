const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const scheduler = fs.readFileSync(require.resolve('../config/scheduler'), 'utf8');

test('les relances automatiques chargent le fuseau propre à chaque entreprise', () => {
  assert.match(scheduler, /SELECT a\.\*, u\.fuseau_horaire FROM pro_automations a JOIN users u ON u\.id = a\.user_id/);
  assert.match(scheduler, /const companyLocalDate = localDateString\(automation\.fuseau_horaire \|\| 'Africa\/Dakar'\)/);
});

test('les relances de devis comparent les dates avec le jour civil du compte', () => {
  assert.match(scheduler, /f\.date_validite BETWEEN \? AND DATE_ADD\(\?, INTERVAL \? DAY\)/);
  assert.doesNotMatch(scheduler, /f\.date_validite BETWEEN CURDATE\(\)/);
});

test('les relances d’impayés calculent le retard depuis la date civile du compte', () => {
  assert.match(scheduler, /f\.date_echeance <= DATE_SUB\(\?, INTERVAL \? DAY\)/);
  assert.doesNotMatch(scheduler, /f\.date_echeance <= DATE_SUB\(CURDATE\(\)/);
});

test('les alertes de stock utilisent une clé journalière locale par entreprise', () => {
  assert.match(scheduler, /const runKey = 'stock:' \+ companyLocalDate/);
  assert.doesNotMatch(scheduler, /const runKey = 'stock:' \+ new Date\(\)\.toISOString\(\)/);
});
