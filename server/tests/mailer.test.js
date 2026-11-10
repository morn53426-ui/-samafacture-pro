const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sendMail } = require('../config/mailer');

test('en production, un SMTP absent ne journalise jamais le contenu du mail', async (t) => {
  const oldNodeEnv = process.env.NODE_ENV;
  const oldSmtpHost = process.env.SMTP_HOST;
  const oldSmtpUser = process.env.SMTP_USER;
  const oldSmtpPassword = process.env.SMTP_PASSWORD;
  const oldLog = console.log;
  const logged = [];

  t.after(() => {
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldNodeEnv;
    if (oldSmtpHost === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = oldSmtpHost;
    if (oldSmtpUser === undefined) delete process.env.SMTP_USER;
    else process.env.SMTP_USER = oldSmtpUser;
    if (oldSmtpPassword === undefined) delete process.env.SMTP_PASSWORD;
    else process.env.SMTP_PASSWORD = oldSmtpPassword;
    console.log = oldLog;
  });

  process.env.NODE_ENV = 'production';
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;
  console.log = (...args) => logged.push(args.join(' '));

  await assert.rejects(
    sendMail({
      to: 'client@example.test',
      subject: 'Réinitialisation',
      text: 'Jeton secret: reset-token-qui-ne-doit-pas-apparaitre'
    }),
    (err) => err.code === 'SMTP_NOT_CONFIGURED'
  );

  assert.deepEqual(logged, []);
  assert.equal(logged.join(' ').includes('reset-token-qui-ne-doit-pas-apparaitre'), false);
});
