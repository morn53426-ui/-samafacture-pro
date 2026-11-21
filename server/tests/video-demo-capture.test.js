'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const capturePath = path.join(__dirname, '..', 'scripts', 'capture-video-demo.js');
const capture = fs.readFileSync(capturePath, 'utf8');

test('the capture runner is local-only and requires explicit confirmation', () => {
  assert.match(capture, /SUNUPILOT_CAPTURE_CONFIRM/);
  assert.match(capture, /SUNUPILOT_LOCAL_CAPTURE_ONLY/);
  assert.match(capture, /localhost/);
  assert.match(capture, /127\.0\.0\.1/);
  assert.match(capture, /current\.origin !== expectedOrigin/);
});

test('the capture runner accepts only the fictional demo account', () => {
  assert.match(capture, /demo\.video@sunupilot\.test/);
  assert.match(capture, /EMAIL !== 'demo\.video@sunupilot\.test'/);
  assert.match(capture, /SUNUPILOT_DEMO_PASSWORD/);
});

test('the capture list contains only the five approved app pages and two mobile shots', () => {
  for (const page of [
    '/dashboard.html', '/factures.html', '/devis.html',
    '/clients.html', '/rapports.html'
  ]) assert.ok(capture.includes(page), 'missing capture page: ' + page);
  assert.match(capture, /06-dashboard-mobile/);
  assert.match(capture, /07-facturation-mobile/);
  assert.doesNotMatch(capture, /\/parametres\.html|\/admin\.html|\/users\.html/);
});

test('the browser never takes a screenshot before successful demo login', () => {
  const login = capture.indexOf("await page.locator('#login-form button[type=\"submit\"]').click()");
  const auth = capture.indexOf("Boolean(localStorage.getItem('sf_token'))");
  const screenshot = capture.indexOf('page.screenshot(');
  assert.ok(login >= 0 && auth > login && screenshot > auth);
});

test('the capture runner has valid JavaScript syntax', () => {
  const result = spawnSync(process.execPath, ['--check', capturePath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'node --check failed');
});
