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

  test('la migration garantit la colonne facture_personnalisation sur les bases existantes', () => {
    const dbSource = fs.readFileSync(path.join(__dirname, '..', 'config', 'db.js'), 'utf8');
    assert.match(dbSource, /column: 'facture_personnalisation', definition: 'TEXT'/);
  });

  test('les statuts et tendances utilisent la date civile du fuseau de l’entreprise', () => {
    assert.match(source, /localDateString\(accountRows\?\.\[0\]\?\.fuseau_horaire \|\| 'Africa\/Dakar'\)/);
    assert.match(source, /date_echeance >= \?/);
    assert.match(source, /date_echeance < \?/);
    assert.match(source, /date_emission >= DATE_SUB\(\?, INTERVAL 6 MONTH\)/);
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
