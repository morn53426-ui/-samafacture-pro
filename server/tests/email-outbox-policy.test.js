'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_ATTEMPTS,
  RETRY_DELAYS_SECONDS,
  retryDelaySeconds,
  safeErrorCode,
  extractEmailVerificationToken
} = require('../email-outbox');

describe('Politique de reprise de l’outbox email', () => {
  test('applique des délais progressifs bornés entre les tentatives', () => {
    assert.equal(MAX_ATTEMPTS, 8);
    assert.deepEqual(RETRY_DELAYS_SECONDS, [60, 300, 1800, 7200, 21600, 43200, 86400]);
    assert.equal(retryDelaySeconds(1), 60);
    assert.equal(retryDelaySeconds(2), 300);
    assert.equal(retryDelaySeconds(3), 1800);
    assert.equal(retryDelaySeconds(7), 86400);
    assert.equal(retryDelaySeconds(0), 60);
    assert.equal(retryDelaySeconds(99), 86400);
  });

  test('extrait le jeton de preuve du fragment sans l’exposer dans la query string', () => {
    const invitationToken = 'a'.repeat(64);
    const verificationToken = 'b'.repeat(64);
    const url = 'https://samafacture.example/invitation.html?type=company-group#token=' +
      invitationToken + '&verification_token=' + verificationToken;
    assert.equal(extractEmailVerificationToken(url), verificationToken);
  });

  test('conserve la compatibilité des anciens emails dont le jeton est dans la query string', () => {
    const verificationToken = 'c'.repeat(64);
    const url = 'https://samafacture.example/invitation.html?type=company-group&verification_token=' + verificationToken;
    assert.equal(extractEmailVerificationToken(url), verificationToken);
  });

  test('refuse une URL de preuve malformée', () => {
    assert.equal(extractEmailVerificationToken('not a URL'), '');
  });

  test('ne conserve que des codes d’erreur sûrs et bornés', () => {
    assert.equal(safeErrorCode({ code: 'ECONNECTION' }), 'ECONNECTION');
    assert.equal(safeErrorCode({ reason: 'smtp_not_configured' }), 'smtp_not_configured');
    assert.equal(safeErrorCode({ code: 'SMTP secret recipient@example.test' }), 'email_delivery_failed');
    assert.equal(safeErrorCode(new Error('private SMTP response')), 'email_delivery_failed');
  });
});
