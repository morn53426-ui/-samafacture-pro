'use strict';

const crypto = require('node:crypto');

function encryptionKey() {
  const secret = process.env.DATA_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('DATA_ENCRYPTION_KEY ou JWT_SECRET est requis pour chiffrer les emails en attente.');
  }
  return crypto.createHash('sha256')
    .update(String(secret) + '|samafacture-pro|email-outbox-v1')
    .digest();
}

function encryptEmailPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Le contenu email doit être un objet.');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return [
    'v1',
    iv.toString('hex'),
    cipher.getAuthTag().toString('hex'),
    ciphertext.toString('hex')
  ].join(':');
}

function decryptEmailPayload(encrypted) {
  const parts = String(encrypted || '').split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Contenu email chiffré illisible.');
  }
  const iv = Buffer.from(parts[1], 'hex');
  const tag = Buffer.from(parts[2], 'hex');
  const ciphertext = Buffer.from(parts[3], 'hex');
  if (iv.length !== 12 || tag.length !== 16 || !ciphertext.length) {
    throw new Error('Contenu email chiffré invalide.');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const payload = JSON.parse(plaintext.toString('utf8'));
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      typeof payload.to !== 'string' || typeof payload.subject !== 'string' ||
      (typeof payload.text !== 'string' && typeof payload.html !== 'string')) {
    throw new Error('Structure du contenu email invalide.');
  }
  return payload;
}

module.exports = { encryptEmailPayload, decryptEmailPayload };
