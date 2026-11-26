'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { describe, test } = require('node:test');

const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const read = file => fs.readFileSync(path.join(PUBLIC_DIR, file), 'utf8');
const workspaceCss = read('css/workspace-polish.css');
const globalCss = read('css/style.css');
const navigationScript = read('js/info-page-navigation.js');

describe('Actions de création et navigation de retour sur mobile', () => {
  const createPages = [
    { file: 'clients.html', label: 'Nouveau client' },
    { file: 'produits.html', label: 'Nouvelle fiche du catalogue' }
  ];

  for (const page of createPages) {
    test(page.file + ' expose une action de création mobile visible et reliée à sa modale', () => {
      const html = read(page.file);
      assert.match(html, /workspace-desktop-create-action/,
        'Le bouton desktop existant doit être conservé.');
      assert.match(html, /workspace-mobile-create-actions/,
        'Une rangée d’action mobile dédiée doit être présente.');
      assert.match(html, new RegExp(page.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        'Le libellé de création doit rester explicite.');
      assert.match(html, /aria-haspopup="dialog" aria-controls="modal"/,
        'L’action doit annoncer la fenêtre qu’elle ouvre.');
      assert.match(html, /id="modal" class="workspace-create-modal" data-workspace-modal/,
        'La modale doit utiliser le comportement mobile commun.');
      assert.match(html, /data-modal-close/,
        'Un bouton d’annulation/fermeture doit rester disponible.');
    });
  }

  test('les actions mobiles sont placées après la barre d’outils et occupent toute la largeur', () => {
    assert.match(globalCss, /\.main-content\.workspace-page\.workspace-page-has-heading\s*> #topbar-root,[\s\S]*?grid-row:\s*2/);
    assert.match(workspaceCss, /\.workspace-mobile-create-actions\{display:none/);
    assert.match(workspaceCss, /@media\(max-width:640px\)[\s\S]*?\.workspace-desktop-create-action\{display:none!important\}[\s\S]*?\.workspace-mobile-create-actions\{display:flex/);
    assert.match(workspaceCss, /\.workspace-mobile-create-actions>\.btn\{width:100%;min-height:48px/);
  });

  test('la modale client/catalogue défile sans couper les actions et évite le zoom iOS sur les champs', () => {
    assert.match(workspaceCss, /\.workspace-create-modal\{overflow-y:auto/);
    assert.match(workspaceCss, /max-height:calc\(100dvh - env\(safe-area-inset-top,0px\) - env\(safe-area-inset-bottom,0px\) - 20px\)/);
    assert.match(workspaceCss, /overflow-y:auto;overscroll-behavior:contain;[\s\S]*?-webkit-overflow-scrolling:touch/);
    assert.match(workspaceCss, /\.workspace-create-modal \.workspace-modal-actions\{[\s\S]*?position:sticky;bottom:-16px/);
    assert.match(workspaceCss, /\.workspace-create-modal \.workspace-modal-panel :is\(input,select,textarea\)\{min-height:44px;font-size:16px\}/);
  });

  const infoPages = [
    'confidentialite.html',
    'support.html',
    'conditions.html',
    'aide.html'
  ];

  for (const file of infoPages) {
    test(file + ' présente un retour persistant compatible avec un usage depuis l’espace', () => {
      const html = read(file);
      assert.match(html, /<body class="info-page">/);
      assert.match(html, /name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/);
      assert.match(html, /class="lp-back-link" href="index\.html" data-smart-back/);
      assert.match(html, /js\/info-page-navigation\.js/);
    });
  }

  test('les liens du menu métier conservent le contexte pour un retour vers le tableau de bord', () => {
    const sidebar = read('js/sidebar.js');
    for (const destination of ['aide.html', 'support.html', 'confidentialite.html', 'conditions.html']) {
      assert.ok(sidebar.includes(destination + '?from=workspace'),
        destination + ' doit transmettre le contexte de l’espace de travail.');
    }
  });

  function runNavigation({ href, referrer = '', historyLength = 1 }) {
    const listeners = {};
    let wentBack = false;
    let prevented = false;
    const link = {
      href: 'index.html',
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; if (name === 'href') this.href = value; },
      addEventListener(name, handler) { listeners[name] = handler; }
    };
    const document = {
      referrer,
      querySelector(selector) { return selector === '[data-smart-back]' ? link : null; }
    };
    const window = {
      location: new URL(href),
      history: { length: historyLength, back() { wentBack = true; } }
    };
    vm.runInNewContext(navigationScript, { document, window, URL, URLSearchParams });
    return {
      link,
      click() {
        listeners.click?.({ preventDefault() { prevented = true; } });
        return { wentBack, prevented };
      }
    };
  }

  test('la navigation revient dans l’historique lorsqu’il est interne et disponible', () => {
    const nav = runNavigation({
      href: 'https://app.example/support.html?from=workspace',
      referrer: 'https://app.example/clients.html',
      historyLength: 2
    });
    assert.equal(nav.link.href, 'dashboard.html');
    assert.deepEqual(nav.click(), { wentBack: true, prevented: true });
  });

  test('une arrivée directe depuis le menu métier revient au tableau de bord en secours', () => {
    const nav = runNavigation({
      href: 'https://app.example/confidentialite.html?from=workspace',
      historyLength: 1
    });
    assert.equal(nav.link.href, 'dashboard.html');
    assert.deepEqual(nav.click(), { wentBack: false, prevented: false });
  });

  test('une arrivée publique directe revient vers l’accueil, sans renvoyer vers un site externe', () => {
    const nav = runNavigation({
      href: 'https://app.example/conditions.html',
      referrer: 'https://external.example/article',
      historyLength: 1
    });
    assert.equal(nav.link.href, 'index.html');
    assert.deepEqual(nav.click(), { wentBack: false, prevented: false });
  });
});
