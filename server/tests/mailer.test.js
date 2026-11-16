'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('sendMail sans SMTP ne journalise ni destinataire, ni sujet, ni lien secret', async () => {
  const keys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const mailerPath = require.resolve('../config/mailer');
  const cachedMailer = require.cache[mailerPath];

  for (const key of keys) delete process.env[key];
  delete require.cache[mailerPath];

  const { sendMail } = require('../config/mailer');
  const warnings = [];
  const originalWarn = console.warn;
  const secretUrl = 'https://example.test/reinitialiser?token=reset-token-never-log';

  console.warn = (...args) => warnings.push(args.map(String).join(' '));
  try {
    const result = await sendMail({
      to: 'sensitive-recipient@example.test',
      subject: 'sensitive subject',
      text: secretUrl,
      html: '<a href="' + secretUrl + '">Réinitialiser</a>'
    });

    assert.deepEqual(result, { sent: false, reason: 'smtp_not_configured' });
    const output = warnings.join('\n');
    assert.match(output, /SMTP non configuré/);
    assert.doesNotMatch(output, /sensitive-recipient@example\.test|sensitive subject|reset-token-never-log/);
  } finally {
    console.warn = originalWarn;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    delete require.cache[mailerPath];
    if (cachedMailer) require.cache[mailerPath] = cachedMailer;
  }
});

test("l'exemple d'environnement n'annonce plus l'affichage d'un lien de réinitialisation dans les logs", () => {
  const example = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8');
  assert.match(example, /aucun email\s+n'est envoyé/i);
  assert.doesNotMatch(example, /lien de\s*réinitialisation s'affiche dans la console/i);
});
