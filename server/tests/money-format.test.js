const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatAmountWithCurrency, roundMoney, normalizeCurrency } = require('../utils/money-format');

test('les devises sans décimales restent entières et gardent leur code', () => {
  assert.equal(formatAmountWithCurrency('1000.00', 'FCFA'), '1 000 FCFA');
  assert.equal(formatAmountWithCurrency(1234567.5, 'xof'), '1 234 568 XOF');
});

test('les autres devises gardent deux décimales et ne montrent jamais FCFA', () => {
  const label = formatAmountWithCurrency('1000.00', 'EUR');
  assert.equal(label, '1 000,00 EUR');
  assert.ok(!label.includes('FCFA'));
  assert.equal(formatAmountWithCurrency(0.1 + 0.2, 'USD'), '0,30 USD');
});

test('un reste à payer flottant est arrondi au centime avant affichage', () => {
  assert.equal(roundMoney(1999.9999999999998), 2000);
  assert.equal(formatAmountWithCurrency(1999.9999999999998, 'EUR'), '2 000,00 EUR');
});

test('une devise absente retombe sur FCFA et les valeurs invalides valent 0', () => {
  assert.equal(normalizeCurrency(null), 'FCFA');
  assert.equal(normalizeCurrency(' eur '), 'EUR');
  assert.equal(formatAmountWithCurrency('abc', 'EUR'), '0,00 EUR');
});

test('le résultat ne contient pas d’espace insécable', () => {
  assert.ok(!/[\u202F\u00A0]/.test(formatAmountWithCurrency(1234567, 'FCFA')));
});
