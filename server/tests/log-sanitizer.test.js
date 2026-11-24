const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const util = require('node:util');
const {
  sanitizeRequestTargetForLog,
  sanitizeReferrerForLog,
  sanitizeErrorForLog
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

describe('Journalisation des erreurs SQL sans valeurs sensibles', () => {
  const HASH = '$2a$10$NcaUVhCGlIC5lQv/dxTDeO69e3LvvKZ7bcj5ct.se7HwydT6l.5tG';
  const EMAIL = 'cliente.privee@exemple-test.com';
  function erreurMysql() {
    const message = `Duplicate entry '${EMAIL}' for key 'uk_users_email'`;
    return Object.assign(new Error(message), {
      code: 'ER_DUP_ENTRY', errno: 1062, sqlState: '23000', sqlMessage: message,
      sql: `INSERT INTO users (email, password_hash) VALUES ('${EMAIL}', '${HASH}')`
    });
  }

  test('une erreur mysql2 ne laisse plus fuiter ni la requête, ni le hash, ni l’email', () => {
    const sortie = util.inspect(sanitizeErrorForLog(erreurMysql()), { depth: 5 });
    assert.doesNotMatch(sortie, /\$2a\$10\$/, 'le hash de mot de passe ne doit pas être journalisé');
    assert.doesNotMatch(sortie, /cliente\.privee/, 'l’email cité par MySQL doit être masqué');
    assert.doesNotMatch(sortie, /INSERT INTO|VALUES/, 'la requête SQL avec ses valeurs ne doit pas être journalisée');
  });

  test('conserve de quoi diagnostiquer : nom, code, errno, sqlState, message masqué et pile', () => {
    const sure = sanitizeErrorForLog(erreurMysql());
    assert.equal(sure.name, 'Error');
    assert.equal(sure.code, 'ER_DUP_ENTRY');
    assert.equal(sure.errno, 1062);
    assert.equal(sure.sqlState, '23000');
    assert.match(sure.message, /Duplicate entry '\[masqué\]' for key 'uk_users_email'/);
    assert.match(sure.stack, /\n\s+at /, 'la pile d’appels doit rester exploitable');
    assert.doesNotMatch(sure.stack, /cliente\.privee/);
  });

  test('masque aussi les valeurs citées par « Incorrect … value »', () => {
    const err = Object.assign(new Error("Incorrect integer value: 'abc' for column 'stock' at row 1"), { code: 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD', sqlState: 'HY000' });
    assert.match(sanitizeErrorForLog(err).message, /value: '\[masqué\]' for column 'stock'/);
  });

  test('ne modifie pas l’erreur d’origine', () => {
    const err = erreurMysql();
    sanitizeErrorForLog(err);
    assert.match(err.sql, /INSERT INTO users/);
    assert.match(err.message, /cliente\.privee/);
  });

  test('une erreur non SQL et les valeurs non objet sont renvoyées inchangées', () => {
    const err = new Error('Boom');
    assert.equal(sanitizeErrorForLog(err), err);
    assert.equal(sanitizeErrorForLog('texte'), 'texte');
    assert.equal(sanitizeErrorForLog(undefined), undefined);
    assert.equal(sanitizeErrorForLog(null), null);
  });

  test('app.js assainit les erreurs SQL avant console.error et Sentry', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    assert.match(source, /const erreurSecurisee = sanitizeErrorForLog\\(err\\);\\s*console\\.error[\\s\\S]*?erreurSecurisee\\);\\s*captureException\\(erreurSecurisee\\);/);
    assert.match(source, /const erreurSecurisee = sanitizeErrorForLog\\(reason instanceof Error \\? reason : new Error\\(String\\(reason\\)\\)\\);[\\s\\S]*?console\\.error[\\s\\S]*?captureException\\(erreurSecurisee\\);/);
    assert.match(source, /const erreurSecurisee = sanitizeErrorForLog\\(err\\);[\\s\\S]*?console\\.error[\\s\\S]*?captureException\\(erreurSecurisee\\);/);
    assert.doesNotMatch(source, /console\\.error\\([^\\n]*, (?:err|reason)\\);/, 'aucun console.error ne doit recevoir l’erreur brute');
    assert.doesNotMatch(source, /captureException\\((?:err|reason)\\)/, 'Sentry ne doit jamais recevoir l’erreur SQL brute');
  });
});
