const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const helper = require('../utils/catalogue-type');
const route = fs.readFileSync(path.join(root, 'routes', 'produits.js'), 'utf8');
const invoices = fs.readFileSync(path.join(root, 'routes', 'factures.js'), 'utf8');
const professional = fs.readFileSync(path.join(root, 'routes', 'professionnel.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'config', 'db.js'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'database', 'schema.sql'), 'utf8');
const page = fs.readFileSync(path.join(root, '..', 'public', 'produits.html'), 'utf8');
const purchasesPage = fs.readFileSync(path.join(root, '..', 'public', 'achats.html'), 'utf8');

describe('Catalogue — distinction produit/service', () => {
  test('les types acceptés sont explicites et normalisés', () => {
    assert.equal(helper.normalizeCatalogueType('produit'), 'produit');
    assert.equal(helper.normalizeCatalogueType(' SERVICE '), 'service');
    assert.equal(helper.normalizeCatalogueType('non_classe'), 'non_classe');
    assert.equal(helper.normalizeCatalogueType(undefined), 'produit');
    assert.equal(helper.normalizeCatalogueType(undefined, 'non_classe'), 'non_classe');
    assert.equal(helper.normalizeCatalogueType('abonnement'), null);
    assert.equal(helper.normalizeCatalogueType(12), null);
  });

  test('seuls les produits et les anciennes fiches non classées sont suivis en stock', () => {
    assert.equal(helper.isStockManagedType('produit'), true);
    assert.equal(helper.isStockManagedType('non_classe'), true);
    assert.equal(helper.isStockManagedType('service'), false);
    assert.equal(helper.isStockManagedType(null), false);
  });

  test('la migration attribue non_classe aux fiches historiques sans deviner leur nature', () => {
    assert.match(migration, /column: 'type_catalogue', definition: "VARCHAR\(20\) NOT NULL DEFAULT 'non_classe' AFTER nom"/);
    assert.match(schema, /type_catalogue VARCHAR\(20\) NOT NULL DEFAULT 'non_classe'/);
    assert.match(migration, /CURRENT_SCHEMA_VERSION = 16/);
    assert.doesNotMatch(migration, /UPDATE produits SET type_catalogue/);
  });

  test('la création conserve la compatibilité API et ne crée pas de stock physique pour un service', () => {
    assert.match(route, /const catalogueType = normalizeCatalogueType\(type_catalogue\)/);
    assert.match(route, /const stockManaged = isStockManagedType\(catalogueType\)/);
    assert.match(route, /INSERT INTO produits \(user_id, nom, type_catalogue,/);
    assert.match(route, /if \(stockManaged\) \{\s*await initialiserStockEntrepotPrincipal/);
    assert.match(route, /if \(!stockManaged && \(nonNegativeQuantity\(stock\) > 0 \|\| nonNegativeQuantity\(stock_minimum\) > 0\)\)/);
    assert.match(route, /const quantity = stockManaged \? nonNegativeQuantity\(stock\) : 0/);
  });

  test('un article ne devient pas service tant qu’un stock physique résiduel existe', () => {
    assert.match(route, /SUM\(ABS\(quantite\)\)/);
    assert.match(route, /Number\(existing\.stock \|\| 0\) > 0 \|\| Number\(stockTotals\?\.total \|\| 0\) > 0/);
    assert.match(route, /Impossible de convertir cet article en service/);
    assert.match(route, /UPDATE produits SET nom=\?, type_catalogue=\?/);
  });

  test('le formulaire demande le type et masque les quantités pour les services', () => {
    assert.match(page, /<select id="type_catalogue" required>/);
    assert.match(page, /<option value="produit">/);
    assert.match(page, /<option value="service">/);
    assert.match(page, /type_catalogue: catalogueType/);
    assert.match(page, /stockFields\.hidden = isService/);
    assert.match(page, /field\.disabled = isService/);
    assert.match(page, /p\.type_catalogue === 'service' \? '—' : p\.stock/);
  });

  test('les services sont exclus de tous les flux de stock et des achats physiques', () => {
    assert.match(professional, /COALESCE\(p\.type_catalogue, 'non_classe'\) <> 'service'/);
    assert.match(professional, /ownedById\.get\(id\)\.type_catalogue === 'service'/);
    assert.match(professional, /Un service ne peut pas être réceptionné dans le stock physique/);
    assert.match(professional, /Un service ne peut pas recevoir de mouvement de stock/);
    assert.match(professional, /Un service ne peut pas être transféré entre entrepôts/);
  });

  test('la création, l’annulation et la conversion de facture ignorent le stock des services', () => {
    assert.match(invoices, /SELECT id FROM produits[\s\S]*?COALESCE\(type_catalogue, 'non_classe'\) <> 'service'/);
    assert.match(invoices, /const stockManagedIds = new Set\(stockManagedRows\.map\(row => Number\(row\.id\)\)\)/);
    assert.match(invoices, /if \(!stockManagedIds\.has\(productId\)\) continue/);
    assert.match(invoices, /appliquerAjustementsStock\(conn, req\.tenantId, computedLignes/);
    assert.match(invoices, /lignesDevis\.map\(\(l\) => \(\{ produit_id: l\.produit_id, delta: -l\.quantite \}\)\)/);
  });

  test('les services ne sont pas proposés dans les achats ou mouvements de stock physiques', () => {
    assert.match(purchasesPage, /products=\(results\[1\]\.produits\|\|\[\]\)\.filter\(p=>p\.type_catalogue !== 'service'\)/);
    assert.match(professional, /COALESCE\(p\.type_catalogue, 'non_classe'\) <> 'service'/);
  });

  test('les anciennes fiches non classées restent éditables sans conversion automatique', () => {
    assert.match(page, /p\.type_catalogue \|\| 'non_classe'/);
    assert.match(page, /value="non_classe">Non classé/);
  });
});
