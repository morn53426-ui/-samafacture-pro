'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('the public HTML and vector assets use SunuPilot', () => {
  const publicDir = path.join(root, 'public');
  const pages = fs.readdirSync(publicDir).filter((name) => name.endsWith('.html'));

  assert.ok(pages.length > 0, 'public HTML pages should be present');
  for (const page of pages) {
    const content = read(path.join('public', page));
    assert.doesNotMatch(
      content,
      /Sama\s*Facture(?:\s*Pro)?|OptiGest/i,
      `legacy visible brand found in public/${page}`
    );
  }

  const home = read('public/index.html');
  assert.match(home, /SunuPilot/);
  assert.match(home, /images\/sunupilot-logo\.svg/);
  const logo = read('public/images/sunupilot-logo.svg');
  const icon = read('public/images/sunupilot-icon.svg');
  assert.match(logo, /<title[^>]*>SunuPilot<\/title>/);
  assert.match(logo, /#18265B/);
  assert.match(logo, /#087A3D/);
  const styles = read('public/css/style.css');
  assert.match(styles, /--brand-blue:\s*#18265B/i);
  assert.match(styles, /--brand-green:\s*#087A3D/i);
  assert.match(icon, /<title[^>]*>SunuPilot<\/title>/);
  assert.doesNotMatch(logo + icon, /OptiGest|SamaFacture/i);
});

test('PWA metadata and service-worker shell use the SunuPilot assets', () => {
  const manifest = JSON.parse(read('public/manifest.json'));
  const iconSources = manifest.icons.map((icon) => icon.src);

  assert.equal(manifest.name, 'SunuPilot');
  assert.equal(manifest.short_name, 'SunuPilot');
  assert.equal(manifest.theme_color, '#18265B');
  assert.ok(iconSources.includes('images/icon-192.png'));
  assert.ok(iconSources.includes('images/sunupilot-icon.svg'));

  const serviceWorker = read('public/sw.js');
  assert.match(serviceWorker, /sunupilot-shell-v4/);
  assert.match(serviceWorker, /\/js\/brand-config\.js/);
  assert.match(serviceWorker, /\/images\/sunupilot-logo\.svg/);
  assert.match(serviceWorker, /\/images\/sunupilot-icon\.svg/);
});

test('the support form never routes to the former brand mailbox', () => {
  const supportPage = read('public/support.html');
  const brandConfig = read('public/js/brand-config.js');

  assert.doesNotMatch(supportPage, /samafacture\.pro/i);
  assert.match(supportPage, /SUNUPILOT_CONFIG\?\.supportEmail/);
  assert.match(supportPage, /supportSubmit\.disabled = true/);
  assert.match(brandConfig, /supportEmail:\s*''/);
});

test('the application sends the new CSRF header while the backend keeps legacy compatibility', () => {
  const api = read('public/js/api.js');
  const middleware = read('server/middleware/auth.js');

  assert.ok(api.includes('window.SUNUPILOT_API_URL || window.OPTIGEST_API_URL || window.SAMAFACTURE_API_URL'));
  assert.match(api, /'X-Requested-With': 'SunuPilot'/);
  assert.ok(middleware.includes("new Set(['SunuPilot', 'OptiGest', 'SamaFacturePro'])"));
});

test('mobile and backend package metadata consistently use SunuPilot', () => {
  const capacitor = JSON.parse(read('mobile/capacitor.config.json'));
  const mobilePackage = JSON.parse(read('mobile/package.json'));
  const serverPackage = JSON.parse(read('server/package.json'));
  const serverLock = JSON.parse(read('server/package-lock.json'));

  assert.equal(capacitor.appName, 'SunuPilot');
  assert.equal(capacitor.appId, 'com.sunupilot.app');
  assert.equal(mobilePackage.name, 'sunupilot-mobile');
  assert.equal(serverPackage.name, 'sunupilot-server');
  assert.equal(serverLock.name, serverPackage.name);
  assert.equal(serverLock.packages[''].name, serverPackage.name);
});
