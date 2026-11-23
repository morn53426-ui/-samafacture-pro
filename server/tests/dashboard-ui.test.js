const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const dashboard = fs.readFileSync(path.join(PUBLIC_DIR, 'dashboard.html'), 'utf8');
const sidebar = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'sidebar.js'), 'utf8');
const styles = fs.readFileSync(path.join(PUBLIC_DIR, 'css', 'style.css'), 'utf8');

describe('Dashboard Sunupilot — structure de référence', () => {
  test('un lien d’évitement clavier atteint le contenu principal et devient visible au focus', () => {
    assert.match(dashboard, /<a class="workspace-skip-link" href="#main-content">Aller au contenu principal<\/a>/);
    assert.match(dashboard, /<main class="main-content workspace-page page-dashboard" id="main-content" tabindex="-1">/);
    assert.match(styles, /\.workspace-skip-link\s*\{[^}]*transform:\s*translateY\(-160%\)/);
    assert.match(styles, /\.workspace-skip-link:focus\s*\{[^}]*transform:\s*translateY\(0\)/);
    assert.match(styles, /\.workspace-skip-link\s*\{[^}]*z-index:\s*1200/);
  });

  test('le tableau de bord accueille le prénom sans injecter de HTML utilisateur', () => {
    assert.match(dashboard, /const greetingName = String\(user\.prenom \|\| user\.nom \|\| ''\)/);
    assert.match(dashboard, /dashboard-greeting'\)\.textContent = greetingName/);
    assert.match(dashboard, /Bienvenue sur Sunupilot/);
  });

  test('le graphique des ventes facturées couvre six ou douze mois et conserve les mois sans vente', () => {
    assert.match(dashboard, /<h2>Évolution des ventes facturées<\/h2>/);
    assert.match(dashboard, /id="dashboard-period-select"/);
    assert.match(dashboard, /<option value="6m">6 derniers mois<\/option>/);
    assert.match(dashboard, /<option value="12m">12 derniers mois<\/option>/);
    assert.match(dashboard, /function dashboardMonthRange\(period\)/);
    assert.match(dashboard, /function buildDashboardMonthSeries\(rows, period\)/);
    assert.match(dashboard, /totalsByMonth\.get\(key\) \?\? 0/);
    assert.match(dashboard, /group_by: 'month'/);
    assert.match(dashboard, /exclude_cancelled: 'true'/);
    assert.match(dashboard, /to: today\.year \+ '-' \+ pad\(today\.month\) \+ '-' \+ pad\(today\.day\),/);
    assert.match(dashboard, /canvas\.dataset\.dashboardMonthCount = String\(series\.monthCount\)/);
  });

  test('les quatre KPI utilisent les bons indicateurs et la valorisation de stock reste explicite si indisponible', () => {
    assert.match(dashboard, /Encaissements cumulés/);
    assert.match(dashboard, /Encaissements cumulés enregistrés/);
    assert.match(dashboard, /amount\(stats\.chiffre_affaires\)/);
    assert.doesNotMatch(dashboard, /Chiffre d'affaires/);
    assert.match(dashboard, /Factures émises/);
    assert.match(dashboard, /Nouveaux clients/);
    assert.match(dashboard, /Valeur du stock/);
    assert.match(dashboard, /Ajoutés sur les 30 derniers jours/);
    assert.match(dashboard, /amount\(stats\.valeur_stock\)/);
    assert.doesNotMatch(dashboard, /Api\.get\('\/pro\/inventory\/valuation'/);
  });

  test('la légende des ventes passe en colonne unique sur mobile', () => {
    assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.dashboard-legend\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\)/);
    assert.match(styles, /\.dashboard-legend-item strong\s*\{[^}]*white-space:\s*nowrap/);
  });

  test('le tableau de bord affiche les dernières factures avec statut et total TTC', () => {
    assert.match(dashboard, /Dernières factures/);
    assert.match(dashboard, /N° facture/);
    assert.match(dashboard, /Émission/);
    assert.match(dashboard, /Statut/);
    assert.match(dashboard, /Total TTC/);
    assert.match(dashboard, /renderRecentInvoices\(stats\.dernieres_factures \|\| \[\]\)/);
  });

  test('les actions rapides correspondent aux quatre parcours de la référence', () => {
    const start = dashboard.indexOf('<div class="dashboard-actions">');
    const end = dashboard.indexOf('</div>', start);
    assert.ok(start >= 0 && end > start, 'Le bloc des actions rapides doit exister.');
    const actions = dashboard.slice(start, end);
    const expected = [
      ['nouvelle-facture.html', 'Nouvelle facture'],
      ['devis.html', 'Nouveau devis'],
      ['clients.html', 'Ajouter un client'],
      ['achats.html#buying-orders', 'Enregistrer un achat']
    ];
    for (const [href, label] of expected) {
      assert.ok(actions.includes('href="' + href + '"'), 'Destination absente : ' + href);
      assert.ok(actions.includes(label), 'Action absente : ' + label);
    }
    assert.equal((actions.match(/class="dashboard-action /g) || []).length, 4);
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

  test('le libellé accessible du graphique précise le montant total TTC et les trois catégories', () => {
    assert.match(dashboard, /Montant total TTC :/);
    assert.match(dashboard, /Répartition des ventes : montants TTC facturés par type de catalogue, hors factures annulées/);
    assert.match(dashboard, /row\.label \+ ' : ' \+ formatMontant\(row\.value\)/);
  });

  test('la répartition des ventes affiche les montants TTC par type de catalogue', () => {
    assert.match(dashboard, /Répartition des ventes/);
    assert.match(dashboard, /Montants TTC facturés par type, hors annulations/);
    assert.match(dashboard, /TTC facturé/);
    assert.match(dashboard, /Ventes TTC facturées sur/);
    assert.match(dashboard, /id="sales-total"/);
    assert.match(dashboard, /id="sales-legend"/);
    assert.match(dashboard, /stats\.repartition_ventes/);
    assert.match(dashboard, /formatMontant\(row\.value\)/);
  });

  test('les cartes sont accessibles au clavier et adaptatives', () => {
    assert.match(dashboard, /<nav class="dashboard-modules" aria-label="Modules Sunupilot" tabindex="0">/,
      'Le rail des modules doit rester focusable au clavier.');
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
