const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(
  path.join(__dirname, '..', '..', 'public', 'factures-recurrentes.html'),
  'utf8'
);

test("le formulaire utilise la date civile du navigateur, pas la date UTC", () => {
  assert.match(page, /maintenant\.getFullYear\(\)/);
  assert.match(page, /maintenant\.getMonth\(\) \+ 1/);
  assert.match(page, /maintenant\.getDate\(\)/);
  assert.match(page, /document\.getElementById\('prochaine_date'\)\.value = dateLocale/);
  assert.doesNotMatch(page, /prochaine_date['"]\)\.value = new Date\(\)\.toISOString/);
});
