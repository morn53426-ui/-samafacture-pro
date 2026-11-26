'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const securityRoute = fs.readFileSync(
  path.join(__dirname, '..', 'routes', 'security.js'),
  'utf8'
);

const page = fs.readFileSync(
  path.join(__dirname, '..', '..', 'public', 'professionnel.html'),
  'utf8'
);

test('le centre de sécurité expose les alertes et dossiers selon les permissions', () => {
  for (const id of [
    'pro-security-center',
    'security-open-count',
    'security-critical-count',
    'security-investigation-count',
    'security-alert-status',
    'security-alert-assignee-wrap',
    'security-alert-assignee',
    'security-investigation-assignee',
    'security-refresh',
    'security-alerts-list',
    'security-investigation-form',
    'security-investigations-list',
    'security-center-feedback'
  ]) {
    assert.match(page, new RegExp('id="' + id + '"'), 'contrôle du centre de sécurité absent : ' + id);
  }
  assert.match(page, /security\.alerts\.read/);
  assert.match(page, /security\.alerts\.manage/);
  assert.match(page, /security\.investigations\.read/);
  assert.match(page, /security\.investigations\.manage/);
  assert.match(page, /securityRequest\('GET', '\/pro\/security\/alerts\/summary'\)/);
  assert.match(page, /securityRequest\('POST', '\/pro\/security\/investigations'/);
  assert.match(page, /securityRequest\('PATCH', '\/pro\/security\/investigations\//);
  assert.match(page, /X-SF-Company-Owner/);
  assert.match(page, /data-security-action="ack"/);
  assert.match(page, /data-security-action="note"/);
  assert.match(page, /data-security-action="assign-alert"/);
  assert.match(page, /data-security-action="assign-investigation"/);
  assert.match(page, /data-security-action="history"/);
  assert.match(page, /security\/assignees/);
  assert.match(page, /security.alerts.manage/);
  assert.match(page, /setHidden\('pro-security-center'/);
});

test('le middleware sécurité est limité au préfixe /security et ne bloque pas les autres routes /api/pro', () => {
  assert.match(securityRoute, /if \(!req\.path\.startsWith\('\/security\/'\)\) return next\(\)/);
});

test('les libellés des alertes et investigations sont échappés avant affichage', () => {
  assert.match(page, /escapeHtml\(alert\.title\)/);
  assert.match(page, /escapeHtml\(alert\.description/);
  assert.match(page, /escapeHtml\(item\.reference\)/);
  assert.match(page, /escapeHtml\(item\.title\)/);
});
