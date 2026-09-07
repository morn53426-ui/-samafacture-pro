// Tests unitaires purs (pas de base de données, pas de serveur HTTP) pour la vérification
// de signature des webhooks Wave et du hash IPN PayDunya — la partie la plus sensible de
// la phase 3 (sécurité des paiements), testée isolément de toute API externe.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-de-test-ne-jamais-utiliser-en-production';

describe('Signature Wave (HMAC-SHA256 + anti-rejeu)', () => {
  const secretOriginal = process.env.WAVE_SIGNING_SECRET;
  before(() => { process.env.WAVE_SIGNING_SECRET = 'secret-wave-de-test'; });
  after(() => { process.env.WAVE_SIGNING_SECRET = secretOriginal; });

  function signer(timestamp, rawBody) {
    return crypto.createHmac('sha256', process.env.WAVE_SIGNING_SECRET).update(timestamp + rawBody).digest('hex');
  }

  test('une signature correcte et récente est acceptée', () => {
    const { verifierSignatureWave } = require('../config/payments');
    const rawBody = JSON.stringify({ event: 'checkout.session.completed' });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signer(timestamp, rawBody);
    assert.equal(verifierSignatureWave(rawBody, `t=${timestamp},v1=${signature}`), true);
  });

  test('une signature incorrecte est rejetée', () => {
    const { verifierSignatureWave } = require('../config/payments');
    const rawBody = JSON.stringify({ event: 'checkout.session.completed' });
    const timestamp = String(Math.floor(Date.now() / 1000));
    assert.equal(verifierSignatureWave(rawBody, `t=${timestamp},v1=0000invalide0000`), false);
  });

  test('un corps modifié après signature est détecté (intégrité)', () => {
    const { verifierSignatureWave } = require('../config/payments');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signer(timestamp, JSON.stringify({ event: 'a' }));
    const corpsModifie = JSON.stringify({ event: 'b' });
    assert.equal(verifierSignatureWave(corpsModifie, `t=${timestamp},v1=${signature}`), false);
  });

  test('une signature valide mais trop ancienne (> 5 min) est rejetée (anti-rejeu)', () => {
    const { verifierSignatureWave } = require('../config/payments');
    const rawBody = JSON.stringify({ event: 'checkout.session.completed' });
    const timestampAncien = String(Math.floor(Date.now() / 1000) - 10 * 60); // 10 minutes
    const signature = signer(timestampAncien, rawBody);
    assert.equal(verifierSignatureWave(rawBody, `t=${timestampAncien},v1=${signature}`), false);
  });

  test('un en-tête de signature absent est rejeté sans erreur', () => {
    const { verifierSignatureWave } = require('../config/payments');
    assert.equal(verifierSignatureWave('{}', undefined), false);
  });
});

describe('Hash IPN PayDunya', () => {
  const clefOriginale = process.env.PAYDUNYA_MASTER_KEY;
  before(() => { process.env.PAYDUNYA_MASTER_KEY = 'clef-maitre-de-test'; });
  after(() => { process.env.PAYDUNYA_MASTER_KEY = clefOriginale; });

  test('le hash correct (sha512 de la clé maître) est accepté', () => {
    const { verifierHashPaydunya } = require('../config/payments');
    const hash = crypto.createHash('sha512').update(process.env.PAYDUNYA_MASTER_KEY).digest('hex');
    assert.equal(verifierHashPaydunya(hash), true);
  });

  test('un hash incorrect est rejeté', () => {
    const { verifierHashPaydunya } = require('../config/payments');
    assert.equal(verifierHashPaydunya('hash-invalide'), false);
  });

  test('un hash absent est rejeté sans erreur', () => {
    const { verifierHashPaydunya } = require('../config/payments');
    assert.equal(verifierHashPaydunya(undefined), false);
  });
});
