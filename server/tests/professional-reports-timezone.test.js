const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readDomainSource } = require('./helpers/route-source');

const source = readDomainSource('professionnel');
const start = source.indexOf("router.get('/reports/forecast'");
const end = source.indexOf("router.get('/reports/custom'", start);
const forecast = source.slice(start, end);

test('le rapport prévisionnel utilise le fuseau horaire enregistré pour l’historique', () => {
  assert.match(forecast, /SELECT fuseau_horaire FROM users WHERE id = \? LIMIT 1/);
  assert.match(forecast, /localDateString\(accounts\?\.\[0\]\?\.fuseau_horaire \|\| 'Africa\/Dakar'\)/);
  assert.match(forecast, /p\.date_paiement >= DATE_SUB\(\?, INTERVAL 6 MONTH\)/);
});

test('les documents Pro utilisent aussi la date civile du compte comme date de secours', () => {
  assert.match(source, /async function safeDateForUser\(value, userId\)/);
  assert.match(source, /SELECT fuseau_horaire FROM users WHERE id = \? LIMIT 1/);
  assert.match(source, /return localDateString\(accounts\?\.\[0\]\?\.fuseau_horaire \|\| 'Africa\/Dakar'\)/);
});

test('les commandes fournisseurs acceptent les mêmes devises que les autres documents', () => {
  assert.match(source, /if \(!SUPPORTED_CURRENCIES\.includes\(orderCurrency\)\)/);
  assert.doesNotMatch(source, /const supportedCurrencies = \['FCFA','XOF','XAF','GNF'/);
});

test('les mois prévisionnels sont calculés depuis le calendrier civil de l’entreprise', () => {
  assert.match(forecast, /const \[yearPart, monthPart\] = localToday\.slice\(0, 7\)\.split\('-'\)\.map\(Number\)/);
  assert.match(forecast, /const monthIndex = yearPart \* 12 \+ monthPart - 1 \+ i/);
  assert.doesNotMatch(forecast, /new Date\(new Date\(\)\.getFullYear\(\), new Date\(\)\.getMonth\(\)/);
});
