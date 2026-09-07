// Vérifie la logique du keyGenerator de apiLimiter (server/app.js) — voir
// AMELIORATIONS_SCALABILITE.md §7 : comptage par utilisateur authentifié plutôt que par IP.
// Non exécuté dans cet environnement (jsonwebtoken n'est pas installé ici, voir
// AUDIT_PRODUCTION.md §1.1) — à lancer avec `npm test` une fois `npm install` fait. La logique
// ci-dessous est une copie exacte de celle de server/app.js, à garder synchronisée si elle
// change là-bas (app.js n'exporte rien : c'est le point d'entrée du serveur, pas un module
// testable directement).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-de-test-ne-jamais-utiliser-en-production';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

function keyGenerator(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      return `user:${payload.id}`;
    } catch {
      // repli sur l'IP
    }
  }
  return req.ip;
}

function jetonPour(id) {
  return jwt.sign({ id, email: 'x@x.sn', role: 'user', nom: 'X' }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

describe('apiLimiter — comptage par utilisateur plutôt que par IP', () => {
  test('deux utilisateurs différents derrière la même IP obtiennent deux clés différentes', () => {
    const memeIp = '203.0.113.5';
    const cle1 = keyGenerator({ headers: { authorization: `Bearer ${jetonPour(1)}` }, ip: memeIp });
    const cle2 = keyGenerator({ headers: { authorization: `Bearer ${jetonPour(2)}` }, ip: memeIp });
    assert.notEqual(cle1, cle2, 'deux utilisateurs distincts ne doivent pas partager le même quota');
    assert.equal(cle1, 'user:1');
    assert.equal(cle2, 'user:2');
  });

  test('sans jeton (visiteur anonyme) → repli sur l\'IP, comportement inchangé', () => {
    const cle = keyGenerator({ headers: {}, ip: '203.0.113.9' });
    assert.equal(cle, '203.0.113.9');
  });

  test('un jeton invalide/forgé (mauvaise signature) → repli sur l\'IP, pas sur l\'identifiant réclamé', () => {
    // Un jeton signé avec une autre clé ne doit JAMAIS permettre de compter contre le quota de
    // l'utilisateur qu'il prétend être — sinon n'importe qui pourrait épuiser le quota d'un
    // autre en devinant son id numérique.
    const jetonForge = jwt.sign({ id: 42 }, 'une-autre-cle-que-le-serveur-nutilise-pas');
    const cle = keyGenerator({ headers: { authorization: `Bearer ${jetonForge}` }, ip: '203.0.113.9' });
    assert.equal(cle, '203.0.113.9', 'doit retomber sur l\'IP, jamais sur "user:42"');
  });

  test('un jeton expiré → repli sur l\'IP', () => {
    const jetonExpire = jwt.sign({ id: 7 }, process.env.JWT_SECRET, { expiresIn: -10 });
    const cle = keyGenerator({ headers: { authorization: `Bearer ${jetonExpire}` }, ip: '203.0.113.9' });
    assert.equal(cle, '203.0.113.9');
  });
});
