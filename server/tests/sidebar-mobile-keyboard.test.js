'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sidebar = fs.readFileSync(
  path.join(__dirname, '..', '..', 'public', 'js', 'sidebar.js'),
  'utf8'
);

function readEscapeHandler() {
  const start = sidebar.indexOf("document.addEventListener('keydown', event => {");
  assert.notEqual(start, -1, 'Le gestionnaire clavier partagé doit exister.');
  const end = sidebar.indexOf('\n  });', start);
  assert.ok(end > start, 'Le gestionnaire clavier doit être fermé.');
  return sidebar.slice(start, end);
}

describe('Navigation mobile — clavier et restauration du focus', () => {
  test('Échap ferme le menu ouvert et restaure le focus au bouton déclencheur', () => {
    const handler = readEscapeHandler();
    assert.match(handler, /if \(event\.key !== 'Escape'\) return/);
    assert.match(handler, /const sidebar = document\.getElementById\('app-sidebar'\)/);
    assert.match(handler, /sidebar\?\.classList\.contains\('open'\)/);
    assert.match(handler, /event\.preventDefault\(\)/);
    assert.match(handler, /closeSidebar\(\)/);
    assert.match(handler, /document\\.querySelector\\('\\.enterprise-console-menu-toggle'\\)/);
    assert.match(handler, /document\\.getElementById\\('mobile-toggle-btn'\\)/);
    assert.match(handler, /toggle\\?\\.isConnected && toggle\\.getClientRects\\(\\)\\.length/);
    assert.match(handler, /toggle\\.focus\\(\\{ preventScroll: true \\}\\)/);
    assert.ok(
      handler.indexOf("document.querySelector('.enterprise-console-menu-toggle')") <
      handler.indexOf("document.getElementById('mobile-toggle-btn')"),
      'Le déclencheur du centre Groupe doit être prioritaire lorsqu’il est présent.'
    );
  });

  test('un dialogue visible conserve la priorité sur la fermeture du menu', () => {
    const handler = readEscapeHandler();
    const dialogGuard = handler.indexOf('if (anotherDialogIsOpen) return;');
    const sidebarClose = handler.indexOf('closeSidebar()');
    assert.ok(dialogGuard >= 0, 'Le garde-fou des dialogues doit exister.');
    assert.ok(sidebarClose > dialogGuard,
      'Échap ne doit pas fermer la navigation derrière une modale.');
    assert.match(handler, /document\.querySelectorAll\('\[role="dialog"\], \[id\$="modal"\]'\)/);
  });

  test('la fermeture remet le déclencheur mobile dans son état non ouvert', () => {
    const start = sidebar.indexOf('function closeSidebar() {');
    const end = sidebar.indexOf('\nfunction ensureWorkspaceTopbar()', start);
    assert.ok(start >= 0 && end > start, 'La fonction closeSidebar doit exister.');
    const close = sidebar.slice(start, end);
    assert.match(close, /btn\.setAttribute\('aria-expanded', 'false'\)/);
    assert.match(close, /btn\.setAttribute\('aria-label', 'Ouvrir le menu'\)/);
    assert.match(close, /enterpriseToggle\.setAttribute\('aria-expanded', 'false'\)/);
  });
});
