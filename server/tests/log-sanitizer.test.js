const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  sanitizeRequestTargetForLog,
  sanitizeReferrerForLog
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
    assert.match(config, /map\s+\$http_referer\s+\$sf_log_referer/);
    assert.match(config, /access_log\s+\/dev\/stdout\s+sf_safe/);
    assert.match(format[1], /\$sf_log_uri/);
    assert.match(format[1], /\$sf_log_referer/);
    assert.doesNotMatch(format[1], /\$request_uri|\$http_referer|\$request\b/);
  });
});
