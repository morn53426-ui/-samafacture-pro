const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { escapeHtmlEmail, sanitizeEmailHeader } = require('../utils/email-escape');
const { sendMail } = require('../config/mailer');

describe('Sécurité des emails sortants', () => {
  test('échappe le contenu HTML fourni par les utilisateurs', () => {
    assert.equal(escapeHtmlEmail(`<img src=x onerror="alert('x')"> & client`), '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp; client');
  });

  test('supprime les retours à la ligne des en-têtes email', () => {
    const header = 'Facture' + String.fromCharCode(13, 10) + 'Bcc: victime@example.com';
    assert.equal(sanitizeEmailHeader(header), 'Facture Bcc: victime@example.com');
  });

  test('ne journalise pas les destinataires, objets ou liens secrets sans SMTP', async () => {
    const old = { host: process.env.SMTP_HOST, user: process.env.SMTP_USER, password: process.env.SMTP_PASSWORD };
    process.env.SMTP_HOST = ''; process.env.SMTP_USER = ''; process.env.SMTP_PASSWORD = '';
    const logs = []; const originalWarn = console.warn;
    console.warn = (...args) => logs.push(args.join(' '));
    try {
      const result = await sendMail({ to: 'client-secret@example.com', subject: 'Sujet très privé', text: 'https://example.test/reset?token=secret-token' });
      assert.equal(result.sent, false);
      assert.equal(result.reason, 'smtp_not_configured');
      const output = logs.join(' ');
      assert.match(output, /SMTP non configuré/);
      assert.doesNotMatch(output, /client-secret|secret-token|Sujet très privé/);
    } finally {
      console.warn = originalWarn;
      if (old.host === undefined) delete process.env.SMTP_HOST; else process.env.SMTP_HOST = old.host;
      if (old.user === undefined) delete process.env.SMTP_USER; else process.env.SMTP_USER = old.user;
      if (old.password === undefined) delete process.env.SMTP_PASSWORD; else process.env.SMTP_PASSWORD = old.password;
    }
  });
});

const fs = require('node:fs');
const path = require('node:path');

test('les emails d’authentification réutilisent le helper HTML partagé', () => {
  const authRoute = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'auth.js'),
    'utf8'
  );
  assert.match(authRoute, /const \{ escapeHtmlEmail \} = require\('\.\.\/utils\/email-escape'\);/);
  assert.match(authRoute, /escapeHtmlEmail\(user\.nom\)/);
  assert.doesNotMatch(authRoute, /function echapperHtml\s*\(/,
    'Le helper local dupliqué ne doit pas réapparaître.');
});
