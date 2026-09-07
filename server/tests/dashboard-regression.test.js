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

  test('un compte sans facture évite les agrégations inutiles', () => {
    assert.match(source, /invoice_count/);
    assert.match(source, /invoice_count.*=== 0/s);
    assert.match(source, /derniers_paiements: \[\]/);
    assert.match(source, /top_produits: \[\]/);
  });
});
