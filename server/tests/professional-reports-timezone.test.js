const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(require.resolve('../routes/professionnel'), 'utf8');
const start = source.indexOf("router.get('/reports/forecast'");
const end = source.indexOf("router.get('/reports/custom'", start);
const forecast = source.slice(start, end);

test('le rapport prévisionnel utilise le fuseau horaire enregistré pour l’historique', () => {
  assert.match(forecast, /SELECT fuseau_horaire FROM users WHERE id = \? LIMIT 1/);
  assert.match(forecast, /localDateString\(accounts\?\.\[0\]\?\.fuseau_horaire \|\| 'Africa\/Dakar'\)/);
  assert.match(forecast, /p\.date_paiement >= DATE_SUB\(\?, INTERVAL 6 MONTH\)/);
});

test('les mois prévisionnels sont calculés depuis le calendrier civil de l’entreprise', () => {
  assert.match(forecast, /const \[yearPart, monthPart\] = localToday\.slice\(0, 7\)\.split\('-'\)\.map\(Number\)/);
  assert.match(forecast, /const monthIndex = yearPart \* 12 \+ monthPart - 1 \+ i/);
  assert.doesNotMatch(forecast, /new Date\(new Date\(\)\.getFullYear\(\), new Date\(\)\.getMonth\(\)/);
});
