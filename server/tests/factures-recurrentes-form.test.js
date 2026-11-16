const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(
  path.join(__dirname, '..', '..', 'public', 'factures-recurrentes.html'),
  'utf8'
);

test("le formulaire charge le fuseau horaire enregistré pour le compte", () => {
  assert.match(page, /Api\.get\('\/auth\/me'\)/);
  assert.match(page, /accountTimezone = user\?\.fuseau_horaire \|\| 'Africa\/Dakar'/);
});

test("la date initiale est calculée dans le fuseau IANA du compte", () => {
  assert.match(page, /new Intl\.DateTimeFormat\('en-US'/);
  assert.match(page, /timeZone: zone/);
  assert.match(page, /dateCivileAujourdhui\(accountTimezone\)/);
  assert.match(page, /parts\.year \+ '-' \+ parts\.month \+ '-' \+ parts\.day/);
  assert.doesNotMatch(page, /prochaine_date['"]\)\.value = new Date\(\)\.toISOString/);
});
