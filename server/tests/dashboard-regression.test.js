const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Dashboard — régression et scalabilité', () => {
  const file = path.join(__dirname, '..', 'routes', 'dashboard.js');
  const source = fs.readFileSync(file, 'utf8');

  test('le dashboard ne dépend plus d’une destructuration fragile de résultat SQL', () => {
    assert.match(source, /summary\?\./);
    assert.match(source, /Number\(summary\?\./);
  });

  test('les résultats de listes sont protégés contre undefined', () => {
    assert.match(source, /derniersPaiements \|\| \[\]/);
    assert.match(source, /derniersClients \|\| \[\]/);
    assert.match(source, /evolutionMensuelle \|\| \[\]/);
    assert.match(source, /topClients \|\| \[\]/);
    assert.match(source, /topProduits \|\| \[\]/);
  });

  test('les requêtes concurrentes d’un même utilisateur sont dédupliquées', () => {
    assert.match(source, /dashboardInFlight/);
    assert.match(source, /dashboardInFlight\.get\(key\)/);
    assert.match(source, /dashboardInFlight\.set\(key, pending\)/);
  });

  test('les KPI factures émises et nouveaux clients sont calculés sur le compte courant', () => {
    assert.match(source, /SUM\(CASE WHEN statut <> 'annulee' THEN 1 ELSE 0 END\) AS factures_emises/);
    assert.match(source, /SELECT COUNT\(\*\) FROM clients c WHERE c\.user_id = \? AND c\.created_at >= DATE_SUB\(\?, INTERVAL 30 DAY\)/);
    assert.match(source, /factures_emises: Number\(summary\?\.factures_emises \|\| 0\)/);
    assert.match(source, /nouveaux_clients: Number\(summary\?\.nouveaux_clients \|\| 0\)/);
    assert.match(source, /AS valeur_stock/);
    assert.match(source, /COALESCE\(stocks\.quantite, p\.stock\)/);
    assert.match(source, /FROM pro_stocks_entrepots[\s\S]*?WHERE user_id = \?[\s\S]*?GROUP BY produit_id/);
  });

  test('les dernières factures sont limitées au locataire et excluent les devis', () => {
    assert.match(source, /dernieres_factures: dernieresFactures \|\| \[\]/);
    assert.match(source, /f\.user_id = \? AND f\.type = 'facture'[\s\S]*?ORDER BY f\.date_emission DESC, f\.id DESC[\s\S]*?LIMIT 5/);
    assert.match(source, /LEFT JOIN clients c ON c\.id = f\.client_id AND c\.user_id = f\.user_id/);
  });

  test('la répartition des ventes utilise les montants TTC et respecte l’isolation entreprise', () => {
    assert.match(source, /repartition_ventes: \[\]/);
    assert.match(source, /repartition_ventes: repartitionVentes \|\| \[\]/);
    assert.match(source, /WHEN p\.id IS NULL THEN 'non_classe'[\s\S]*WHEN p\.type_catalogue = 'service' THEN 'service'[\s\S]*WHEN p\.type_catalogue = 'produit' THEN 'produit'/);
    assert.match(source, /GROUP BY CASE[\s\S]*WHEN p\.id IS NULL THEN 'non_classe'/);
    assert.match(source, /COALESCE\(SUM\(fl\.total_ligne\), 0\) AS total_ttc/);
    assert.match(source, /LEFT JOIN produits p ON p\.id = fl\.produit_id AND p\.user_id = f\.user_id/);
    assert.match(source, /WHERE f\.user_id = \? AND f\.type = 'facture' AND f\.statut <> 'annulee'/);
  });

  test('le cache est borné et temporaire', () => {
    assert.match(source, /DASHBOARD_CACHE_TTL_MS/);
    assert.match(source, /DASHBOARD_CACHE_MAX/);
    assert.match(source, /summaryRows\?\.\[0\]/);
    assert.match(source, /while \(dashboardCache\.size > DASHBOARD_CACHE_MAX\)/);
  });

  test('/api/health est une liveness sans requête SQL', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const block = appSource.slice(appSource.indexOf("app.get('/api/health'"), appSource.indexOf("app.get('/api/ready'"));
    assert.match(block, /res\.json\(\{ status: 'ok'/);
    assert.doesNotMatch(block, /pool\.query/);
  });

  test('le formulaire de facture permet de choisir un entrepôt et masque ce choix pour un devis', () => {
    const invoiceForm = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'nouvelle-facture.html'), 'utf8');
    assert.match(invoiceForm, /id="invoice-warehouse-field"/);
    assert.match(invoiceForm, /id="entrepot_id"/);
    assert.match(invoiceForm, /Api\.get\('\/pro\/warehouses'\)/);
    assert.match(invoiceForm, /par_defaut/);
    assert.match(invoiceForm, /entrepot_id: docType === 'facture'/);
    assert.match(invoiceForm, /invoice-warehouse-field'\)\.hidden = isQuote/);
  });

  test('la conversion d’un devis demande un entrepôt et transmet son identifiant à l’API', () => {
    const quotePage = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'devis.html'), 'utf8');
    assert.match(quotePage, /id="quote-warehouse-modal"/);
    assert.ok(quotePage.indexOf('<div id="quote-warehouse-modal"') < quotePage.indexOf('<script src="js/workspace-modals.js"></script>'),
      'la modale de conversion doit exister avant l’initialisation du gestionnaire de focus');
    assert.match(quotePage, /aria-labelledby="quote-warehouse-title"/);
    assert.match(quotePage, /Api\.get\('\/pro\/warehouses'\)/);
    assert.match(quotePage, /item\.par_defaut/);
    assert.match(quotePage, /transformer-en-facture`, \{ entrepot_id: entrepotId \}\)/);
    assert.match(quotePage, /Aucun entrepôt actif/);
  });

  test('les migrations 17 et 18 mémorisent l’entrepôt des factures et rendent le backfill historique idempotent', () => {
    const dbSource = fs.readFileSync(path.join(__dirname, '..', 'config', 'db.js'), 'utf8');
    const professionalSource = fs.readFileSync(path.join(__dirname, '..', 'routes', 'professionnel.js'), 'utf8');
    const schemaSource = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
    assert.match(dbSource, /CURRENT_SCHEMA_VERSION = 18/);
    assert.match(dbSource, /v17 : entrepôt de sortie mémorisé sur les factures/);
    assert.match(dbSource, /table: 'factures', column: 'entrepot_id', definition: 'INT UNSIGNED NULL AFTER client_id'/);
    assert.match(schemaSource, /entrepot_id INT UNSIGNED NULL/);
    assert.match(dbSource, /COLUMN_NAME = 'backfill_stock_termine'/);
    assert.match(dbSource, /ADD COLUMN backfill_stock_termine TINYINT\(1\) NOT NULL DEFAULT 0/);
    assert.match(professionalSource, /if \(Number\(warehouse\.backfill_stock_termine\) !== 1\)/);
    assert.match(professionalSource, /UPDATE pro_entrepots SET backfill_stock_termine = 1/);
  });

  test('la migration garantit la colonne facture_personnalisation sur les bases existantes', () => {
    const dbSource = fs.readFileSync(path.join(__dirname, '..', 'config', 'db.js'), 'utf8');
    assert.match(dbSource, /column: 'facture_personnalisation', definition: 'TEXT'/);
  });

  test('les statuts et tendances utilisent la date civile du fuseau de l’entreprise', () => {
    assert.match(source, /localDateString\(accountRows\?\.\[0\]\?\.fuseau_horaire \|\| 'Africa\/Dakar'\)/);
    assert.match(source, /date_echeance >= \?/);
    assert.match(source, /date_echeance < \?/);
    assert.match(source, /date_emission >= DATE_SUB\(DATE_FORMAT\(\?, '%Y-%m-01'\), INTERVAL 5 MONTH\)/);
    assert.match(source, /AND statut <> 'annulee'[\s\S]*?date_emission >= DATE_SUB\(DATE_FORMAT\(\?, '%Y-%m-01'\), INTERVAL 5 MONTH\)[\s\S]*?AND date_emission <= \?/);
    assert.doesNotMatch(source, /date_echeance .*CURDATE\(\)/);
    assert.doesNotMatch(source, /date_emission >= DATE_SUB\(CURDATE\(\)/);
  });

  test('un compte sans facture évite les agrégations inutiles', () => {
    assert.match(source, /invoice_count/);
    assert.match(source, /invoice_count.*=== 0/s);
    assert.match(source, /derniers_paiements: \[\]/);
    assert.match(source, /top_produits: \[\]/);
  });
});
