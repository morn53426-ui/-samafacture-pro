const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  sanitizeRequestTargetForLog,
  sanitizeReferrerForLog,
  sanitizeErrorForLog,
  sanitizeSentryEvent
} = require('../utils/log-sanitizer');

describe('Journalisation HTTP sans secrets dans les URL', () => {
  test('retire entièrement les paramètres de requête, dont les jetons de réinitialisation', () => {
    assert.equal(
      sanitizeRequestTargetForLog('/reinitialiser-mot-de-passe.html?token=secret-reset&source=email'),
      '/reinitialiser-mot-de-passe.html'
    );
    assert.equal(
      sanitizeRequestTargetForLog('/consulter.html?id=42&code=secret-code'),
      '/consulter.html'
    );
  });

  test('masque le code final des routes publiques consulter et verifier', () => {
    assert.equal(
      sanitizeRequestTargetForLog('/api/public/consulter/42/abcdef0123456789?debug=1'),
      '/api/public/consulter/42/[redacted]'
    );
    assert.equal(
      sanitizeRequestTargetForLog('/api/public/verifier/42/abcdef0123456789'),
      '/api/public/verifier/42/[redacted]'
    );
  });

  test('masque aussi le jeton des liens de paiement publics', () => {
    assert.equal(
      sanitizeRequestTargetForLog('/api/public/paiement/abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'),
      '/api/public/paiement/[redacted]'
    );
  });

  test('conserve un chemin non sensible sans sa query string', () => {
    assert.equal(
      sanitizeRequestTargetForLog('/api/factures?page=2&limit=20'),
      '/api/factures'
    );
    assert.equal(sanitizeRequestTargetForLog('/api/health'), '/api/health');
  });

  test('limite le referrer à son origine', () => {
    assert.equal(
      sanitizeReferrerForLog('https://app.example.sn/reinitialiser.html?token=secret'),
      'https://app.example.sn'
    );
    assert.equal(sanitizeReferrerForLog('-'), '-');
    assert.equal(sanitizeReferrerForLog('valeur invalide'), '-');
  });

  test('Morgan utilise les jetons de journalisation assainis', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    assert.match(source, /morgan\.token\('sf-url'/);
    assert.match(source, /morgan\.token\('sf-referrer'/);
    assert.match(source, /:sf-url/);
    assert.match(source, /:sf-referrer/);
    assert.match(source, /sanitizeRequestTargetForLog\(req\.originalUrl/);
    assert.doesNotMatch(source, /morgan\(process\.env\.NODE_ENV === 'production' \? 'combined' : 'dev'/);
  });

  test('Nginx n’écrit que le chemin assaini et le referrer réduit à son origine', () => {
    const config = fs.readFileSync(
      path.join(__dirname, '..', '..', 'deploy', 'nginx.scalable.conf.example'),
      'utf8'
    );
    const format = config.match(/log_format\s+sf_safe\s+([\s\S]*?);/);
    assert.ok(format, 'le format sf_safe doit être défini');
    assert.match(config, /map\s+\$uri\s+\$sf_log_uri/);
    assert.match(config, /\[redacted\]/);
    assert.ok(
      config.includes('~*^(/api/public/paiement)/[^/]+$ $1/[redacted];'),
      'le jeton des liens de paiement publics doit être masqué par Nginx'
    );
    assert.match(config, /map\s+\$http_referer\s+\$sf_log_referer/);
    assert.match(config, /access_log\s+\/dev\/stdout\s+sf_safe/);
    assert.match(format[1], /\$sf_log_uri/);
    assert.match(format[1], /\$sf_log_referer/);
    assert.doesNotMatch(format[1], /\$request_uri|\$http_referer|\$request\b/);
  });
});


describe('Assainissement des événements Sentry et erreurs SQL', () => {
  const EMAIL = 'client.confidentiel@example-test.com';
  const HASH = '$2a$10$NcaUVhCGlIC5lQv/dxTDeO69e3LvvKZ7bcj5ct.se7HwydT6l.5tG';
  const TOKEN = 'jeton-session-secret-123456789';

  function erreurMysql() {
    const message = `Duplicate entry '${EMAIL}' for key 'uk_users_email'`;
    return Object.assign(new Error(message), {
      code: 'ER_DUP_ENTRY',
      errno: 1062,
      sqlState: '23000',
      sqlMessage: message,
      sql: `INSERT INTO users (email, password_hash) VALUES ('${EMAIL}', '${HASH}')`
    });
  }

  test('sanitizeErrorForLog retire SQL et sqlMessage, masque les valeurs et garde les codes utiles', () => {
    const original = erreurMysql();
    const safe = sanitizeErrorForLog(original);
    const output = require('node:util').inspect(safe, { depth: 5 });

    assert.doesNotMatch(output, /client\.confidentiel/);
    assert.doesNotMatch(output, /\$2a\$10\$/);
    assert.doesNotMatch(output, /INSERT INTO|VALUES/);
    assert.equal(safe.code, 'ER_DUP_ENTRY');
    assert.equal(safe.errno, 1062);
    assert.equal(safe.sqlState, '23000');
    assert.match(safe.message, /Duplicate entry '\[masqué\]'/);
    assert.equal(safe.sql, undefined);
    assert.equal(safe.sqlMessage, undefined);
    assert.match(safe.stack, /\n\s+at /);
    assert.match(original.sql, /INSERT INTO users/);
    assert.match(original.message, /client\.confidentiel/);
  });

  test('beforeSend supprime SQL, email, hash, jeton, cookies et corps de requête de l’événement', () => {
    const rawMessage = `Duplicate entry '${EMAIL}' for key 'uk_users_email'`;
    const event = {
      event_id: 'event-test',
      message: rawMessage,
      exception: {
        values: [{
          type: 'Error',
          value: rawMessage,
          stacktrace: {
            frames: [{
              filename: 'server/routes/auth.js',
              function: 'register',
              vars: { email: EMAIL, password_hash: HASH, sql: `INSERT INTO users VALUES ('${EMAIL}')` }
            }]
          },
          mechanism: { type: 'generic', data: { sql: `INSERT INTO users VALUES ('${EMAIL}')` } }
        }]
      },
      extra: {
        __serialized__: {
          code: 'ER_DUP_ENTRY',
          errno: 1062,
          sqlState: '23000',
          sql: `INSERT INTO users (email, password_hash) VALUES ('${EMAIL}', '${HASH}')`,
          sqlMessage: rawMessage
        },
        note: 'diagnostic conservé'
      },
      request: {
        url: `https://app.example.sn/api/auth/register?token=${TOKEN}`,
        headers: { authorization: `Bearer ${TOKEN}`, cookie: `session=${TOKEN}` },
        data: { email: EMAIL, password: HASH }
      },
      user: { id: '42', email: EMAIL }
    };
    const original = JSON.parse(JSON.stringify(event));
    const safe = sanitizeSentryEvent(event);
    const output = JSON.stringify(safe);

    assert.ok(safe);
    assert.doesNotMatch(output, /client\.confidentiel/);
    assert.doesNotMatch(output, /\$2a\$10\$/);
    assert.doesNotMatch(output, /jeton-session-secret|Bearer|session=/);
    assert.doesNotMatch(output, /INSERT INTO|password_hash|sqlMessage/);
    assert.match(safe.message, /Duplicate entry '\[masqué\]'/);
    assert.equal(safe.exception.values[0].value, safe.message);
    assert.equal(safe.extra.__serialized__.code, 'ER_DUP_ENTRY');
    assert.equal(safe.extra.__serialized__.errno, 1062);
    assert.equal(safe.extra.__serialized__.sqlState, '23000');
    assert.equal(safe.extra.__serialized__.sql, undefined);
    assert.equal(safe.exception.values[0].stacktrace.frames[0].vars, undefined);
    assert.equal(safe.exception.values[0].mechanism.data, undefined);
    assert.equal(safe.request.url, '/api/auth/register');
    assert.equal(safe.request.headers, undefined);
    assert.equal(safe.request.data, undefined);
    assert.equal(safe.user.id, '42');
    assert.equal(safe.user.email, undefined);
    assert.deepEqual(event, original, 'l’événement Sentry d’origine ne doit pas être modifié');
  });

  test('un événement non objet est renvoyé sans transformation', () => {
    assert.equal(sanitizeSentryEvent(null), null);
    assert.equal(sanitizeSentryEvent('texte'), 'texte');
  });

  test('monitoring configure beforeSend et nettoie aussi les captures manuelles', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'config', 'monitoring.js'), 'utf8');
    assert.match(source, /beforeSend:\s*sanitizeSentryEvent/);
    assert.match(source, /captureException\(sanitizeErrorForLog\(err\)\)/);

    const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    assert.match(appSource, /sanitizeErrorForLog\(err\)/);
    assert.match(appSource, /sanitizeErrorForLog\(reason\)/);
    assert.doesNotMatch(appSource, /console\.error\([^\n]*, (?:err|reason)\);/);
  });

  test('masque aussi les valeurs des erreurs MySQL « Incorrect … value »', () => {
    const message = "Incorrect integer value: 'abc' for column 'stock' at row 1";
    const original = Object.assign(new Error(message), {
      code: 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD',
      sqlState: 'HY000'
    });
    const safe = sanitizeErrorForLog(original);

    assert.match(safe.message, /value: '\[masqué\]' for column 'stock'/);
    assert.doesNotMatch(safe.message, /abc/);
    assert.equal(original.message, message, 'l’erreur source doit rester intacte');
  });

  test('ne modifie pas une erreur SQL source et laisse les erreurs non SQL inchangées', () => {
    const sql = `INSERT INTO users (email) VALUES ('${EMAIL}')`;
    const original = Object.assign(new Error(`Duplicate entry '${EMAIL}' for key 'uk_users_email'`), {
      code: 'ER_DUP_ENTRY',
      sqlState: '23000',
      sql,
      sqlMessage: `Duplicate entry '${EMAIL}' for key 'uk_users_email'`
    });
    const originalMessage = original.message;
    const originalStack = original.stack;
    const safe = sanitizeErrorForLog(original);

    assert.notEqual(safe, original);
    assert.equal(safe.sql, undefined);
    assert.equal(safe.sqlMessage, undefined);
    assert.doesNotMatch(safe.stack, /client\.confidentiel/);
    assert.equal(original.message, originalMessage);
    assert.equal(original.stack, originalStack);
    assert.equal(original.sql, sql);
    assert.match(original.sqlMessage, /client\.confidentiel/);

    const ordinaryError = new Error('erreur applicative non SQL');
    assert.equal(sanitizeErrorForLog(ordinaryError), ordinaryError);
    assert.equal(sanitizeErrorForLog('texte'), 'texte');
    assert.equal(sanitizeErrorForLog(null), null);
    assert.equal(sanitizeErrorForLog(undefined), undefined);
  });

});
