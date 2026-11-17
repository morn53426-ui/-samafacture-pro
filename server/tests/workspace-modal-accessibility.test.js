'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, test: it } = require('node:test');

const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const pages = [
  { file: 'clients.html', ids: ['modal'], labels: ['nom', 'telephone', 'whatsapp', 'email', 'adresse', 'notes'] },
  { file: 'produits.html', ids: ['modal'], labels: ['nom', 'reference', 'prix_ht', 'tva', 'prix_achat', 'stock', 'stock_minimum', 'categorie', 'description'] },
  { file: 'devis.html', ids: ['send-modal'], labels: ['send-email'] },
  { file: 'factures.html', ids: ['pay-modal', 'send-modal'], labels: ['pay-methode', 'pay-reference', 'send-email'] }
];

function readPublic(file) {
  return fs.readFileSync(path.join(PUBLIC_DIR, file), 'utf8');
}

describe('Accessibilité des fenêtres de gestion', () => {
  for (const page of pages) {
    it(page.file + ' charge le comportement commun des fenêtres', () => {
      const html = readPublic(page.file);
      assert.match(html, /js\/workspace-modals\.js/,
        'Le script de gestion clavier doit être chargé.');
      for (const id of page.ids) {
        const modal = html.match(new RegExp('<div id="' + id + '"[^>]*data-workspace-modal[^>]*>'));
        assert.ok(modal, 'La fenêtre #' + id + ' doit être identifiée comme une boîte de dialogue.');
        assert.match(modal[0], /role="dialog"/);
        assert.match(modal[0], /aria-modal="true"/);
        assert.match(modal[0], /aria-labelledby="[^"]+"/);
      }
      for (const id of page.labels) {
        assert.match(html, new RegExp('<label for="' + id + '">'),
          'Le champ #' + id + ' doit avoir un libellé associé.');
      }
      assert.match(html, /role="alert" aria-live="assertive"/,
        'Les erreurs doivent être annoncées par les lecteurs d’écran.');
    });
  }

  it('le gestionnaire enferme le focus et prend en charge Échap', () => {
    const script = readPublic('js/workspace-modals.js');
    assert.match(script, /new MutationObserver/);
    assert.match(script, /event\.key === 'Escape'/);
    assert.match(script, /event\.key !== 'Tab'/);
    assert.match(script, /returnFocus/);
    assert.match(script, /focusInside/);
  });

  it('les fenêtres peuvent défiler sans déborder sur mobile', () => {
    const css = readPublic('css/workspace-polish.css');
    assert.match(css, /max-height:calc\(100dvh - 20px\)/);
    assert.match(css, /overflow-y:auto/);
    assert.match(css, /workspace-modal-actions/);
  });
});
