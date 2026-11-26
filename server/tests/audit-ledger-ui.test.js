'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(
  path.join(__dirname, '..', '..', 'public', 'professionnel.html'),
  'utf8'
);

test('l’espace professionnel utilise le nouveau registre d’audit avec filtres et pagination', () => {
  for (const id of [
    'audit-section',
    'audit-filters',
    'audit-search',
    'audit-category',
    'audit-severity',
    'audit-from',
    'audit-to',
    'audit-event-type',
    'audit-list',
    'audit-pagination-info',
    'audit-prev',
    'audit-next'
  ]) {
    assert.match(page, new RegExp('id="' + id + '"'), 'contrôle UI absent : ' + id);
  }
  assert.ok(page.includes("Api.get('/pro/audit-events?' + params.toString())"));
  assert.ok(page.includes("Api.get('/pro/audit-events/integrity')"));
  assert.match(page, /setHidden\('audit-section', !can\('audit\.read'\)\)/);
  assert.equal(page.includes("optionalApiGet('/pro/audit')"), false,
    'la page ne doit plus consommer l’ancien endpoint limité de l’audit');
});

test('les événements du registre sont échappés avant insertion dans le DOM', () => {
  assert.match(page, /escapeHtml\(event\.event_type\)/);
  assert.match(page, /escapeHtml\(event\.entity_type/);
  assert.match(page, /escapeHtml\(metadata\)/);
  assert.match(page, /escapeHtml\(event\.ip_address\)/);
});
