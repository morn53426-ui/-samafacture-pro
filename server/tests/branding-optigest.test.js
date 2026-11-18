'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('the public HTML uses OptiGest and no longer exposes the previous product name', () => {
  const publicDir = path.join(root, 'public');
  const pages = fs.readdirSync(publicDir).filter((name) => name.endsWith('.html'));

  assert.ok(pages.length > 0, 'public HTML pages should be present');
  for (const page of pages) {
    const content = read(path.join('public', page));
    assert.doesNotMatch(
      content,
      /Sama\s*Facture(?:\s*Pro)?/i,
      `legacy visible brand found in public/${page}`
    );
  }

  const home = read('public/index.html');
  assert.match(home, /OptiGest/);
  assert.match(home, /images\/optigest-logo\.svg/);
});

test('PWA metadata and service-worker shell use the OptiGest assets', () => {
  const manifest = JSON.parse(read('public/manifest.json'));
  const iconSources = manifest.icons.map((icon) => icon.src);

  assert.equal(manifest.name, 'OptiGest');
  assert.equal(manifest.short_name, 'OptiGest');
  assert.ok(iconSources.includes('images/icon-192.png'));
  assert.ok(iconSources.includes('images/optigest-icon.svg'));

  const serviceWorker = read('public/sw.js');
  assert.match(serviceWorker, /optigest-shell-v\d+/);
  assert.match(serviceWorker, /\/js\/brand-config\.js/);
  assert.match(serviceWorker, /\/images\/optigest-logo\.svg/);
  assert.match(serviceWorker, /\/images\/optigest-icon\.svg/);
});

test('the support form never routes to the former brand mailbox', () => {
  const supportPage = read('public/support.html');
  const brandConfig = read('public/js/brand-config.js');

  assert.doesNotMatch(supportPage, /samafacture\.pro/i);
  assert.match(supportPage, /OPTIGEST_CONFIG\?\.supportEmail/);
  assert.match(supportPage, /supportSubmit\.disabled = true/);
  assert.match(brandConfig, /supportEmail:\s*''/);
});

test('the application sends the new CSRF header while the backend keeps legacy compatibility', () => {
  const api = read('public/js/api.js');
  const middleware = read('server/middleware/auth.js');

  assert.match(api, /'X-Requested-With': 'OptiGest'/);
  assert.match(middleware, /new Set\\(\\['OptiGest', 'SamaFacturePro'\\]\\)/);
});

test('mobile and backend package metadata consistently use OptiGest', () => {
  const capacitor = JSON.parse(read('mobile/capacitor.config.json'));
  const mobilePackage = JSON.parse(read('mobile/package.json'));
  const serverPackage = JSON.parse(read('server/package.json'));
  const serverLock = JSON.parse(read('server/package-lock.json'));

  assert.equal(capacitor.appName, 'OptiGest');
  assert.equal(capacitor.appId, 'com.optigest.app');
  assert.equal(mobilePackage.name, 'optigest-mobile');
  assert.equal(serverPackage.name, 'optigest-server');
  assert.equal(serverLock.name, serverPackage.name);
  assert.equal(serverLock.packages[''].name, serverPackage.name);
});
