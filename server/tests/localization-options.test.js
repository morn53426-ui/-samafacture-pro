const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  SUPPORTED_COUNTRIES,
  SUPPORTED_CURRENCIES,
  SUPPORTED_TIMEZONES
} = require('../config/localization');

const AFRICAN_COUNTRIES = [
  'DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CG','CD','CI','DJ',
  'EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG',
  'MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO',
  'ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW'
];

test('les 54 pays africains sont proposés dans les paramètres de localisation', () => {
  assert.equal(AFRICAN_COUNTRIES.length, 54);
  for (const country of AFRICAN_COUNTRIES) {
    assert.ok(SUPPORTED_COUNTRIES.includes(country), 'Pays africain manquant : ' + country);
  }
});

test('les marchés européens prioritaires et nord-américains sont proposés', () => {
  for (const country of ['FR','BE','CH','DE','ES','IT','NL','PT','IE','GB','US','CA']) {
    assert.ok(SUPPORTED_COUNTRIES.includes(country), 'Pays manquant : ' + country);
  }
});

test('les devises de référence africaines et européennes sont utilisables dans les factures', () => {
  for (const currency of ['XOF','XAF','GNF','NGN','GHS','KES','ZAR','EGP','MAD','EUR','GBP','CHF','USD','CAD']) {
    assert.ok(SUPPORTED_CURRENCIES.includes(currency), 'Devise manquante : ' + currency);
  }
  assert.equal(new Set(SUPPORTED_CURRENCIES).size, SUPPORTED_CURRENCIES.length,
    'La liste des devises ne doit pas contenir de doublons.');
});

test('tous les fuseaux proposés sont reconnus par le runtime Intl', () => {
  assert.equal(new Set(SUPPORTED_TIMEZONES).size, SUPPORTED_TIMEZONES.length,
    'La liste des fuseaux ne doit pas contenir de doublons.');
  for (const timeZone of SUPPORTED_TIMEZONES) {
    assert.doesNotThrow(
      () => new Intl.DateTimeFormat('en', { timeZone }),
      'Fuseau IANA invalide : ' + timeZone
    );
  }
});
