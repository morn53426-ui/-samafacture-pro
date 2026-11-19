const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const dashboard = fs.readFileSync(path.join(PUBLIC_DIR, 'dashboard.html'), 'utf8');
const sidebar = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'sidebar.js'), 'utf8');
const styles = fs.readFileSync(path.join(PUBLIC_DIR, 'css', 'style.css'), 'utf8');

describe('Dashboard Sunupilot — structure de référence', () => {
  test('le tableau de bord accueille le prénom sans injecter de HTML utilisateur', () => {
    assert.match(dashboard, /const greetingName = String\(user\.prenom \|\| user\.nom \|\| ''\)/);
    assert.match(dashboard, /dashboard-greeting'\)\.textContent = greetingName/);
    assert.match(dashboard, /Bienvenue sur Sunupilot/);
  });

  test('les cinq cartes de modules pointent vers les pages métier existantes', () => {
    const expected = [
      ['crm.html', 'CRM &amp; suivi client'],
      ['paiements-professionnels.html', 'Paiement en ligne'],
      ['comptabilite.html', 'Comptabilité OHADA'],
      ['achats.html', 'Achats &amp; Stocks'],
      ['automatisations.html', 'Automatisation']
    ];
    for (const [href, label] of expected) {
      assert.match(dashboard, new RegExp('href="' + href.replace(/[.*+?^\u0024{}()|[\]\\]/g, '\\$&') + '"'));
      assert.ok(dashboard.includes(label), 'Libellé absent : ' + label);
    }
    assert.equal((dashboard.match(/class="dashboard-module-card /g) || []).length, 5);
  });

  test('les cartes sont accessibles au clavier et adaptatives', () => {
    assert.match(dashboard, /<nav class="dashboard-modules" aria-label="Modules Sunupilot">/);
    assert.match(styles, /\.dashboard-module-card:focus-visible/);
    assert.match(styles, /@media \(max-width: 1200px\)[\s\S]*?\.dashboard-modules/);
    assert.match(styles, /@media \(max-width: 560px\)[\s\S]*?\.dashboard-modules/);
    assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*?\.dashboard-module-card/);
  });

  test('la sidebar du tableau de bord est développée par défaut sans écraser une préférence enregistrée', () => {
    assert.match(sidebar, /preference === null \? activePage !== 'dashboard' : preference !== 'false'/);
    assert.match(sidebar, /localStorage\.setItem\('sf-sidebar-collapsed', String\(isCollapsed\)\)/);
  });
});
