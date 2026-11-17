'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { encryptEmailPayload, decryptEmailPayload } = require('../utils/email-outbox-crypto');

describe('Chiffrement du contenu de l’outbox email', () => {
  test('chiffre et déchiffre le destinataire et le lien d’invitation', () => {
    const previous = process.env.DATA_ENCRYPTION_KEY;
    process.env.DATA_ENCRYPTION_KEY = 'a'.repeat(64);
    try {
      const payload = {
        to: 'societe@example.test',
        subject: 'Invitation SamaFacture Pro',
        text: 'Acceptez cette invitation : https://example.test/invitation.html?token=' + 'b'.repeat(64)
      };
      const encrypted = encryptEmailPayload(payload);
      assert.match(encrypted, /^v1:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/i);
      assert.doesNotMatch(encrypted, /societe@example\.test/);
      assert.doesNotMatch(encrypted, /b{64}/);
      assert.deepEqual(decryptEmailPayload(encrypted), payload);
    } finally {
      if (previous === undefined) delete process.env.DATA_ENCRYPTION_KEY;
      else process.env.DATA_ENCRYPTION_KEY = previous;
    }
  });

  test('refuse un contenu altéré ou chiffré avec une autre clé', () => {
    const previous = process.env.DATA_ENCRYPTION_KEY;
    process.env.DATA_ENCRYPTION_KEY = 'c'.repeat(64);
    try {
      const encrypted = encryptEmailPayload({
        to: 'destinataire@example.test',
        subject: 'Test',
        text: 'Message de test'
      });
      const altered = encrypted.slice(0, -1) + (encrypted.endsWith('0') ? '1' : '0');
      assert.throws(() => decryptEmailPayload(altered));
      process.env.DATA_ENCRYPTION_KEY = 'd'.repeat(64);
      assert.throws(() => decryptEmailPayload(encrypted));
    } finally {
      if (previous === undefined) delete process.env.DATA_ENCRYPTION_KEY;
      else process.env.DATA_ENCRYPTION_KEY = previous;
    }
  });

  test('refuse un payload invalide et exige une clé disponible', () => {
    const previousKey = process.env.DATA_ENCRYPTION_KEY;
    const previousJwt = process.env.JWT_SECRET;
    try {
      process.env.DATA_ENCRYPTION_KEY = 'e'.repeat(64);
      assert.throws(() => encryptEmailPayload('texte'), /objet/);
      delete process.env.DATA_ENCRYPTION_KEY;
      delete process.env.JWT_SECRET;
      assert.throws(() => encryptEmailPayload({
        to: 'destinataire@example.test',
        subject: 'Test',
        text: 'Message'
      }), /requis/);
    } finally {
      if (previousKey === undefined) delete process.env.DATA_ENCRYPTION_KEY;
      else process.env.DATA_ENCRYPTION_KEY = previousKey;
      if (previousJwt === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousJwt;
    }
  });
});
