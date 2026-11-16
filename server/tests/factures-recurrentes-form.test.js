const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicRoot = path.join(__dirname, '..', '..', 'public');
const page = fs.readFileSync(path.join(publicRoot, 'factures-recurrentes.html'), 'utf8');
const api = fs.readFileSync(path.join(publicRoot, 'js', 'api.js'), 'utf8');

test("le formulaire charge le fuseau horaire enregistré pour le compte", () => {
  assert.ok(page.includes("Api.get('/auth/me')"));
  assert.ok(page.includes("accountTimezone = user?.fuseau_horaire || 'Africa/Dakar'"));
});

test("la date initiale du formulaire utilise le formateur civil partagé", () => {
  assert.ok(page.includes('dateCivileAujourdhui(accountTimezone)'));
  assert.ok(api.includes('function dateCivileAujourdhui(timeZone, now = new Date())'));
  assert.ok(api.includes('timeZone: candidateZone'));
  assert.ok(api.includes("formatInZone('UTC')"));
  assert.doesNotMatch(page, /prochaine_date['"]\)\.value = new Date\(\)\.toISOString/);
});
