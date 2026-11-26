const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { optionalText, optionalIsoDate } = require('../utils/optional-fields');

describe('Utilitaires partagés de champs optionnels', () => {
  test('optionalText transforme les valeurs absentes ou blanches en null', () => {
    assert.equal(optionalText(undefined, 20), null);
    assert.equal(optionalText(null, 20), null);
    assert.equal(optionalText('   ', 20), null);
  });

  test('optionalText nettoie les espaces et respecte la longueur maximale', () => {
    assert.equal(optionalText('  Référence client  ', 30), 'Référence client');
    assert.equal(optionalText('123456789', 5), '12345');
  });

  test('optionalIsoDate distingue une valeur absente, une date valide et une date invalide', () => {
    assert.equal(optionalIsoDate(undefined), null);
    assert.equal(optionalIsoDate(''), null);
    assert.equal(optionalIsoDate(' 2024-02-29 '), '2024-02-29');
    assert.equal(optionalIsoDate('2024-02-30'), undefined);
    assert.equal(optionalIsoDate('2024-13-01'), undefined);
    assert.equal(optionalIsoDate('29/02/2024'), undefined);
  });
});
