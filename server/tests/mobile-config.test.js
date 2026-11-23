const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateCapacitorConfig } = require('../../mobile/scripts/check-capacitor-config');

const mobileDir = path.resolve(__dirname, '..', '..', 'mobile');
const baseConfig = JSON.parse(fs.readFileSync(
  path.join(mobileDir, 'capacitor.config.json'),
  'utf8'
));

function validConfig(overrides = {}) {
  return {
    ...baseConfig,
    ...overrides,
    server: {
      ...baseConfig.server,
      url: 'https://facturation.sama-cloud.sn',
      ...overrides.server
    }
  };
}

test('le domaine placeholder actuel bloque la génération native', () => {
  const errors = validateCapacitorConfig(baseConfig, { mobileDir });
  assert.ok(errors.some(error => error.includes('domaine d’exemple')));
});

test('une configuration publique HTTPS valide passe la pré-vérification', () => {
  assert.deepEqual(validateCapacitorConfig(validConfig(), { mobileDir }), []);
});

test('les URL HTTP, locales et privées sont refusées', () => {
  const urls = [
    'http://facturation.sama-cloud.sn',
    'https://localhost',
    'https://127.0.0.1',
    'https://192.168.1.20',
    'https://8.8.8.8',
    'https://service.local',
    'https://votredomaine.com.'
  ];

  for (const url of urls) {
    const errors = validateCapacitorConfig(validConfig({ server: { url } }), { mobileDir });
    assert.ok(errors.length > 0, url + ' doit être rejetée');
  }
});

test('les identifiants intégrés, query strings et fragments sont refusés', () => {
  for (const url of [
    'https://user:password@facturation.sama-cloud.sn',
    'https://facturation.sama-cloud.sn/?token=secret',
    'https://facturation.sama-cloud.sn/#session'
  ]) {
    const errors = validateCapacitorConfig(validConfig({ server: { url } }), { mobileDir });
    assert.ok(errors.length > 0, url + ' doit être rejetée');
  }
});

test('appId, appName, webDir et cleartext doivent être valides', () => {
  const invalid = validConfig({
    appId: 'Sama Facture',
    appName: '',
    webDir: '../missing-public-directory',
    server: { cleartext: true }
  });
  const errors = validateCapacitorConfig(invalid, { mobileDir });
  assert.ok(errors.some(error => error.includes('appId')));
  assert.ok(errors.some(error => error.includes('appName')));
  assert.ok(errors.some(error => error.includes('webDir')));
  assert.ok(errors.some(error => error.includes('cleartext')));
});
