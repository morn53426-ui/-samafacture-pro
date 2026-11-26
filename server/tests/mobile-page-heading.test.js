'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const styles = fs.readFileSync(path.join(PUBLIC_DIR, 'css', 'style.css'), 'utf8');

const formPages = [
  'nouvelle-facture.html',
  'parametres.html',
  'achats.html',
  'automatisations.html',
  'internationalisation.html',
  'crm.html',
  'clients.html',
  'depenses.html',
  'comptabilite.html',
  'paiements-professionnels.html',
  'groupe-entreprise.html'
];

describe('Titres des pages métier sur petit écran', () => {
  for (const file of formPages) {
    test(file + ' conserve un titre principal dans l’en-tête de page', () => {
      const html = fs.readFileSync(path.join(PUBLIC_DIR, file), 'utf8');
      assert.match(html, /class="[^"]*workspace-page[^"]*"/,
        'La page doit utiliser le shell métier commun.');
      const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || '';
      assert.match(main, /<(?:div|header)\b[^>]*class="[^"]*(?:page-header|workspace-page-header)[^"]*"/,
        'La page doit déclarer un en-tête principal direct.');
      assert.match(main, /<h1\b[^>]*>/,
        'Le titre principal doit rester un véritable titre H1.');
    });
  }

  test('le shell identifie les pages ayant un en-tête avant de rendre la barre d’outils', () => {
    const sidebar = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'sidebar.js'), 'utf8');
    assert.match(sidebar, /const hasPageHeading = Array\.from\(main\.children\)\.some\(child =>/);
    assert.match(sidebar, /main\.classList\.toggle\('workspace-page-has-heading', hasPageHeading\)/);
  });

  test('à 900 px ou moins, le titre principal passe avant la barre d’outils globale', () => {
    assert.match(styles, /@media \(max-width: 900px\)[\s\S]*?\.main-content\.workspace-page\.workspace-page-has-heading\s*\{[\s\S]*?display:\s*grid/);
    assert.match(styles, /\.main-content\.workspace-page\.workspace-page-has-heading\s*> \.page-header,[\s\S]*?\.main-content\.workspace-page\.workspace-page-has-heading\s*> \.workspace-page-header\s*\{[\s\S]*?grid-row:\s*1/);
    assert.match(styles, /\.main-content\.workspace-page\.workspace-page-has-heading\s*> #topbar-root,[\s\S]*?\.app-topbar\s*\{[\s\S]*?grid-row:\s*2/);
  });

  test('le titre garde une taille lisible et ne peut pas être masqué sur téléphone', () => {
    assert.match(styles, /body \.main-content\.workspace-page > \.page-header h1,\s*body \.main-content\.workspace-page > \.workspace-page-header h1\s*\{[\s\S]*?display:\s*block[\s\S]*?visibility:\s*visible[\s\S]*?font-size:\s*clamp\(1\.55rem, 6\.5vw, 1\.9rem\)/);
    assert.match(styles, /@media \(max-width: 380px\)[\s\S]*?font-size:\s*1\.5rem/);
  });

  test('la zone de contenu commence après la hauteur du menu mobile et ses encoches', () => {
    assert.match(styles, /padding: calc\(116px \+ env\(safe-area-inset-top\)\) 18px 48px !important/);
    assert.match(styles, /padding: calc\(108px \+ env\(safe-area-inset-top\)\) 12px calc\(36px \+ env\(safe-area-inset-bottom\)\) !important/);
  });
});
