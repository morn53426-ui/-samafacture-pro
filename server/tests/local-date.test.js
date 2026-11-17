const { test } = require('node:test');
const assert = require('node:assert/strict');
const { localDateString } = require('../utils/local-date');

test('la date civile dépend du fuseau de l’entreprise, pas du fuseau du serveur', () => {
  const instant = new Date('2026-11-16T23:30:00.000Z');
  assert.equal(localDateString('Africa/Dakar', instant), '2026-11-16');
  assert.equal(localDateString('Europe/Paris', instant), '2026-11-17');
  assert.equal(localDateString('America/New_York', instant), '2026-11-16');
});

test('le calcul civil reste correct lors du changement d’heure été/hiver', () => {
  assert.equal(
    localDateString('Europe/Paris', new Date('2026-03-29T22:30:00.000Z')),
    '2026-03-30'
  );
  assert.equal(
    localDateString('America/New_York', new Date('2026-11-01T04:30:00.000Z')),
    '2026-11-01'
  );
});

test('un fuseau historique invalide revient à UTC sans arrêter le planificateur', () => {
  assert.equal(
    localDateString('Invalid/Legacy-Timezone', new Date('2026-11-16T23:30:00.000Z')),
    '2026-11-16'
  );
});

test('rejette un instant invalide', () => {
  assert.throws(() => localDateString('UTC', new Date('invalid')), /Instant invalide/);
});
