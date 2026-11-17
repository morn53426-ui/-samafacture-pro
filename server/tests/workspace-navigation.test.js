'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, test } = require('node:test');

const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const pages = [
  'factures.html',
  'devis.html',
  'clients.html',
  'produits.html',
  'achats.html',
  'comptabilite.html',
  'depenses.html',
  'rapports.html',
  'crm.html',
  'automatisations.html',
  'paiements-professionnels.html',
  'parametres.html',
  'factures-recurrentes.html',
  'assistant-ia.html',
  'internationalisation.html',
  'finances.html'
];

const sidebarScript = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'sidebar.js'), 'utf8');
const sidebarStyles = fs.readFileSync(path.join(PUBLIC_DIR, 'css', 'style.css'), 'utf8');
const iconCatalogue = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'icons.js'), 'utf8');

function readPage(file) {
  return fs.readFileSync(path.join(PUBLIC_DIR, file), 'utf8');
}

describe('Navigation et structure des pages métier', () => {
  for (const file of pages) {
    test(file + ' expose le même point d’accès au contenu principal', () => {
      const html = readPage(file);
      assert.match(html, /css\/workspace-polish\.css/,
        'La feuille de style commune doit être chargée.');
      assert.match(html, /class="workspace-skip-link" href="#main-content"/,
        'Un lien clavier doit permettre de passer directement au contenu.');
      assert.match(html, /<main\b[^>]*id="main-content"[^>]*tabindex="-1"/,
        'Le contenu principal doit être un repère focusable.');
    });
  }


  test('le rail desktop affiche les icônes et les libellés avec un état actif contrasté', () => {
    assert.match(sidebarScript, /class="nav-label"/);
    assert.match(sidebarScript, /aria-current="page"/);
    assert.match(sidebarStyles, /--sidebar-collapsed-w:\s*76px/);
    assert.match(sidebarStyles, /\.sidebar-brand \.mark\s*\{[\s\S]*?width:\s*52px/);
    assert.match(sidebarStyles, /\.nav-item \.ic \.icon\s*\{[\s\S]*?width:\s*24px/);
    assert.match(sidebarStyles, /\.sidebar\.is-collapsed \.nav-item\s*\{[\s\S]*?flex-direction:\s*column/);
    assert.match(sidebarStyles, /\.sidebar\.is-collapsed \.nav-item \.nav-label\s*\{[\s\S]*?display:\s*block !important/);
    assert.match(sidebarStyles, /\.sidebar\.is-collapsed \.nav-item\.active \.ic\s*\{[\s\S]*?background:\s*#172a4b/);
    assert.match(sidebarStyles, /@media \(max-width:\s*900px\)/);
  });


  test('toutes les icônes appelées par la navigation existent dans le catalogue SVG', () => {
    const definitions = new Set(
      [...iconCatalogue.matchAll(/^\\s*(?:['"]([^'"]+)['"]|([A-Za-z][\\w-]*))\\s*:/gm)]
        .map(match => match[1] || match[2])
    );
    const used = new Set([
      ...[...sidebarScript.matchAll(/\\bIcon\\(([^)]*)\\)/g)]
        .flatMap(([, args]) => [...args.matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1])),
      ...[...sidebarScript.matchAll(/\\bicon:\\s*['"]([^'"]+)['"]/g)].map(match => match[1])
    ]);
    for (const name of used) {
      assert.ok(definitions.has(name), 'Icône manquante dans icons.js : ' + name);
    }
  });

  test('la navigation ne plante pas quand le stockage local ou le point de montage manque', () => {
    assert.match(sidebarScript, /try\s*\{\s*return localStorage\.getItem\('sf_company_group_member'\) === 'true';\s*\}\s*catch\s*\{\s*return false;/);
    assert.match(sidebarScript, /const sidebarRoot = document\.getElementById\('sidebar-root'\);\s*if \(sidebarRoot\) sidebarRoot\.outerHTML = html;/);
  });

  test('Achats & stocks permet de rejoindre directement chacune des opérations', () => {
    const html = readPage('achats.html');
    const nav = html.match(/<nav class="workspace-section-nav"[^>]*>([\s\S]*?)<\/nav>/);
    assert.ok(nav, 'La navigation rapide des opérations doit être présente.');
    const links = [...nav[1].matchAll(/href="#([^"]+)"/g)].map(match => match[1]);
    assert.equal(links.length, 7, 'Les sept opérations doivent être accessibles.');
    for (const id of links) {
      assert.match(html, new RegExp('\\bid="' + id + '"'),
        'Le raccourci #' + id + ' doit cibler une section existante.');
    }
  });

  test('Comptabilité OHADA permet de rejoindre chaque zone comptable', () => {
    const html = readPage('comptabilite.html');
    const nav = html.match(/<nav class="workspace-section-nav"[^>]*>([\s\S]*?)<\/nav>/);
    assert.ok(nav, 'La navigation rapide OHADA doit être présente.');
    const links = [...nav[1].matchAll(/href="#([^"]+)"/g)].map(match => match[1]);
    assert.equal(links.length, 4, 'Les quatre zones comptables doivent être accessibles.');
    for (const id of links) {
      assert.match(html, new RegExp('\\bid="' + id + '"'),
        'Le raccourci #' + id + ' doit cibler une section existante.');
    }
  });
});
