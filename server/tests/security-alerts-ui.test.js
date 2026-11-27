'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(
  path.join(__dirname, '..', '..', 'public', 'professionnel.html'),
  'utf8'
);

test('le centre de sécurité est indépendant des intégrations et réservé à security.read', () => {
  assert.match(page, /data-icon="shield-check"/);

  for (const id of [
    'pro-security',
    'security-section',
    'security-alert-filters',
    'security-alert-status',
    'security-refresh',
    'security-status',
    'security-alerts-list',
    'security-cases-list'
  ]) {
    assert.match(page, new RegExp('id="' + id + '"'), 'contrôle absent : ' + id);
  }

  const integrationsStart = page.indexOf('id="pro-integrations"');
  const securityStart = page.indexOf('id="pro-security"');
  assert.ok(integrationsStart >= 0 && securityStart > integrationsStart);
  assert.ok(page.indexOf('</section>', integrationsStart) < securityStart,
    'le centre de sécurité doit être indépendant des droits d’intégration');
  assert.match(page, /setHidden\('pro-security', !can\('security\.read'\)\)/);
  assert.match(page, /'security\.read':'security\.manage'/);
  assert.match(page, /if \(can\('security\.read'\)\) await loadSecurityCentre\(\)/);
});

test('le centre de sécurité utilise les routes dédiées et contrôle les actions de gestion', () => {
  assert.match(page, /Api\.get\('\/pro\/security-alerts\?/);
  assert.match(page, /Api\.get\('\/pro\/security-cases\?/);
  assert.match(page, /Api\.post\('\/pro\/security-cases'/);
  assert.match(page, /Api\.put\('\/pro\/security-alerts\//);
  assert.match(page, /Api\.put\('\/pro\/security-cases\//);
  assert.match(page, /if \(!button \|\| !can\('security\.manage'\)\) return/);
  assert.match(page, /escapeHtml\(alert\.title\)/);
  assert.match(page, /escapeHtml\(alert\.summary\)/);
  assert.match(page, /escapeHtml\(item\.title\)/);
  assert.match(page, /securityRequestSequence/);
});
