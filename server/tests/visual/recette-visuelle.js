'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer');

const PUBLIC_DIR = path.resolve(__dirname, '../../../public');
const OUTPUT_DIR = path.resolve(process.env.VISUAL_ARTIFACTS_DIR || path.join(__dirname, 'artifacts'));
const DATASET = process.env.VISUAL_DATASET || 'worst';
const VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 812 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 1000 }
];
const PAGES = [
  { name: 'dashboard', file: 'dashboard.html', ready: '#paiements-body tr:not(.row-skeleton)' },
  { name: 'clients', file: 'clients.html', ready: '#clients-body tr:not(.row-skeleton)' },
  { name: 'produits', file: 'produits.html', ready: '#produits-body tr:not(.row-skeleton)' },
  { name: 'factures', file: 'factures.html', ready: '#factures-body tr:not(.row-skeleton)' }
];

function makeLong(prefix, length) {
  const filler = ' — Départements et services régionaux de gestion commerciale';
  let value = prefix;
  while (value.length < length) value += filler;
  return value.slice(0, length);
}

function makeFixtures() {
  if (DATASET === 'empty') {
    return {
      dashboard: {
        chiffre_affaires: 0,
        factures_payees: { n: 0, total: 0 },
        factures_en_attente: { n: 0, total: 0 },
        factures_en_retard: { n: 0, total: 0 },
        derniers_clients: [],
        derniers_paiements: []
      },
      ventes: [],
      clients: [],
      produits: [],
      factures: []
    };
  }

  const normal = DATASET === 'normal';
  const clientNom = normal
    ? 'Entreprise de démonstration'
    : makeLong('Société panafricaine de conseil, de logistique et de distribution ', 188);
  const email = normal
    ? 'comptabilite@exemple.sn'
    : 'direction.facturation.internationale.senegal+documents.longue-reference@entreprise-groupe-regional.example.com';
  const clients = [
    { id: 1, nom: clientNom, email, telephone: '+221 77 123 45 67', whatsapp: '+221 77 123 45 67', adresse: makeLong('Zone industrielle, route de Rufisque, bâtiment administratif ', 250), notes: makeLong('Notes de suivi client ', 800), total_du: 999999999999.99, total_facture: 999999999999.99 },
    { id: 2, nom: 'A', email: null, telephone: null, whatsapp: null, adresse: null, notes: null, total_du: 0, total_facture: 0 },
    { id: 3, nom: 'Coopérative des artisans et commerçants de la région de Thiès', email: 'contact@cooperative-thies.example', telephone: '+221 33 000 00 00', adresse: 'Thiès, Sénégal', total_du: 1200000, total_facture: 9800000 },
    { id: 4, nom: 'Cabinet Ndao & Associés — Expertise comptable', email: 'cabinet.ndao@example.sn', telephone: '+221 76 000 00 00', adresse: 'Dakar, Sénégal', total_du: 350000, total_facture: 1250000 },
    { id: 5, nom: 'Client sans téléphone ni adresse', email: 'client@example.sn', telephone: null, adresse: null, total_du: 0, total_facture: 25000 }
  ];

  const produits = [
    { id: 1, nom: makeLong('Matériel informatique professionnel — lot complet avec installation et maintenance ', 188), reference: 'REF-2026-ULTRA-LONGUE-REFERENCE-001', prix_ht: 999999999999.99, prix_achat: 600000000000, tva: 18, stock: 999999999 },
    { id: 2, nom: 'A', reference: '', prix_ht: 0, prix_achat: 0, tva: 0, stock: 0 },
    { id: 3, nom: 'Bougie parfumée ambre et bois de santal', reference: 'BOUGIE-AMB-001', prix_ht: 8500, prix_achat: 4200, tva: 18, stock: 54 },
    { id: 4, nom: 'Service de maintenance annuelle', reference: 'SERV-MAINT-2026', prix_ht: 1250000, prix_achat: 300000, tva: 18, stock: 0 },
    { id: 5, nom: 'Produit avec stock faible', reference: 'STOCK-LOW-1', prix_ht: 1000, prix_achat: 500, tva: 0, stock: 1 }
  ];

  const factures = [
    { id: 1, numero: 'FAC-' + 'X'.repeat(46), client_nom: clientNom, client_email: email, date_emission: '2026-11-10', date_echeance: '2026-11-20', total: 999999999999.99, montant_paye: 0, statut: 'en_retard' },
    { id: 2, numero: 'FAC-2026-0002', client_nom: 'A', client_email: '', date_emission: '2026-11-11', date_echeance: null, total: 0, montant_paye: 0, statut: 'payee' },
    { id: 3, numero: 'FAC-2026-0003', client_nom: 'Coopérative de Thiès', client_email: 'contact@cooperative-thies.example', date_emission: '2026-11-09', date_echeance: '2026-11-30', total: 1250000, montant_paye: 500000, statut: 'en_attente' },
    { id: 4, numero: 'FAC-2026-0004', client_nom: 'Cabinet Ndao & Associés', client_email: 'cabinet.ndao@example.sn', date_emission: '2026-11-08', date_echeance: '2026-11-18', total: 750000, montant_paye: 750000, statut: 'payee' },
    { id: 5, numero: 'FAC-2026-0005', client_nom: 'Client sans données facultatives', client_email: null, date_emission: '2026-11-07', date_echeance: null, total: 45000, montant_paye: 10000, statut: 'en_attente' }
  ];

  return {
    dashboard: {
      chiffre_affaires: normal ? 1250000 : 999999999999.99,
      factures_payees: { n: normal ? 12 : 999999, total: normal ? 850000 : 999999999999.99 },
      factures_en_attente: { n: normal ? 4 : 999999, total: normal ? 350000 : 888888888888.88 },
      factures_en_retard: { n: normal ? 1 : 999999, total: normal ? 50000 : 777777777777.77 },
      derniers_clients: clients.slice(0, 5).map((c) => ({ id: c.id, nom: c.nom, email: c.email, telephone: c.telephone })),
      derniers_paiements: factures.slice(0, 5).map((f, index) => ({
        numero: f.numero,
        client_nom: f.client_nom,
        methode: index % 2 ? 'Virement bancaire' : 'Wave',
        date_paiement: '2026-11-12 10:15:00',
        montant: f.total
      }))
    },
    ventes: Array.from({ length: 14 }, (_, index) => ({
      label: '2026-' + String(index + 1).padStart(2, '0'),
      total: normal ? (index + 1) * 85000 : (index + 1) * 71234567890.12
    })),
    clients,
    produits,
    factures
  };
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
  })[ext] || 'application/octet-stream';
}

function createStaticServer() {
  return http.createServer((req, res) => {
    const requestUrl = new URL(req.url, 'http://127.0.0.1');
    let pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === '/__visual_bootstrap.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>');
      return;
    }
    if (pathname === '/') pathname = '/index.html';
    const file = path.resolve(PUBLIC_DIR, '.' + pathname);
    if (!file.startsWith(PUBLIC_DIR + path.sep) && file !== PUBLIC_DIR) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    fs.readFile(file, (error, body) => {
      if (error) {
        res.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType(file),
        'Cache-Control': 'no-store'
      });
      res.end(body);
    });
  });
}

const CHART_STUB = [
  '(function () {',
  '  class VisualChartStub {',
  '    constructor(canvas, config) {',
  '      canvas.dataset.sfChartAnimation = config.options && config.options.animation === false ? "disabled" : "enabled";',
  '      canvas.dataset.sfChartResponsive = String(config.options && config.options.responsive === true);',
  '      const context = canvas.getContext("2d");',
  '      const rect = canvas.getBoundingClientRect();',
  '      const width = Math.max(1, Math.floor(rect.width));',
  '      const height = Math.max(1, Math.floor(rect.height || 130));',
  '      canvas.width = width * (window.devicePixelRatio || 1);',
  '      canvas.height = height * (window.devicePixelRatio || 1);',
  '      context.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);',
  '      context.clearRect(0, 0, width, height);',
  '      context.strokeStyle = "#E6EAF2"; context.lineWidth = 1;',
  '      for (let row = 1; row < 5; row++) { context.beginPath(); context.moveTo(0, row * height / 5); context.lineTo(width, row * height / 5); context.stroke(); }',
  '      context.strokeStyle = "#0EA980"; context.lineWidth = 3; context.beginPath();',
  '      const points = [0.85, 0.72, 0.77, 0.55, 0.62, 0.39, 0.48, 0.28, 0.34, 0.12];',
  '      points.forEach((point, index) => { const x = 10 + index * (width - 20) / (points.length - 1); const y = point * (height - 18) + 9; if (index === 0) context.moveTo(x, y); else context.lineTo(x, y); });',
  '      context.stroke();',
  '      this.destroy = function () {};',
  '    }',
  '  }',
  '  window.Chart = VisualChartStub;',
  '})();'
].join('\n');

function fixtureFor(pathname, fixtures) {
  if (pathname === '/api/dashboard') return fixtures.dashboard;
  if (pathname === '/api/rapports/ventes') return { rows: fixtures.ventes };
  if (pathname === '/api/clients') return {
    clients: fixtures.clients,
    pagination: { page: 1, limite: 20, total: fixtures.clients.length, total_pages: fixtures.clients.length ? 1 : 0 }
  };
  if (pathname === '/api/produits') return {
    produits: fixtures.produits,
    pagination: { page: 1, limite: 20, total: fixtures.produits.length, total_pages: fixtures.produits.length ? 1 : 0 }
  };
  if (pathname === '/api/factures') return {
    factures: fixtures.factures,
    pagination: { page: 1, limite: 20, total: fixtures.factures.length, total_pages: fixtures.factures.length ? 1 : 0 }
  };
  return {};
}

async function preparePage(browser, baseUrl, fixtures, reduceMotion) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([
    { name: 'prefers-reduced-motion', value: reduceMotion ? 'reduce' : 'no-preference' }
  ]);
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/api/')) {
      let response = {};
      try {
        response = fixtureFor(new URL(url).pathname, fixtures);
      } catch (error) {
        response = {};
      }
      request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      }).catch(() => {});
      return;
    }
    if (url.includes('chart.umd.min.js')) {
      request.respond({ status: 200, contentType: 'text/javascript', body: CHART_STUB }).catch(() => {});
      return;
    }
    if (url.includes('socket.io.min.js') ||
        url.includes('fonts.googleapis.com') ||
        url.includes('fonts.gstatic.com')) {
      request.abort('blockedbyclient').catch(() => {});
      return;
    }
    request.continue().catch(() => {});
  });
  // Poser les valeurs de session depuis une origine déjà chargée est plus fiable que
  // les init scripts sur certains builds de Chromium ; l'application métier n'est chargée
  // qu'après la création de cette session fictive.
  await page.goto(baseUrl + '/__visual_bootstrap.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('sf_token', 'visual-recette-token');
    localStorage.setItem('sf_user', JSON.stringify({
      id: 1,
      nom: 'SamaFacture — Compte de recette',
      entreprise_nom: 'SamaFacture — Société de test',
      devise: 'FCFA',
      plan: 'pro'
    }));
    localStorage.setItem('sf_theme', 'light');
    // Garder les appels API sur l'origine du serveur de test : pas de préflight CORS,
    // puisque le test remplace le backend en interceptant les requêtes navigateur.
    window.SAMAFACTURE_API_URL = location.origin + '/api';
  });
  return page;
}

async function verifyPage(browser, baseUrl, pageDefinition, viewport, fixtures, screenshots) {
  const page = await preparePage(browser, baseUrl, fixtures, false);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
  await page.goto(baseUrl + '/' + pageDefinition.file, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(pageDefinition.ready, { timeout: 15000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(120);

  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    page: location.pathname,
    xssMarker: window.__visualXss || false
  }));
  assert.ok(metrics.document <= metrics.viewport + 1,
    pageDefinition.name + ' déborde horizontalement à ' + viewport.width + 'px: ' + JSON.stringify(metrics));
  assert.ok(metrics.body <= metrics.viewport + 1,
    pageDefinition.name + ' élargit le body à ' + viewport.width + 'px: ' + JSON.stringify(metrics));
  assert.equal(metrics.xssMarker, false, 'Une donnée de test ne doit pas exécuter de script.');
  assert.deepEqual(pageErrors, [],
    pageDefinition.name + ' a généré des erreurs JavaScript: ' + pageErrors.join(' | '));

  const filename = pageDefinition.name + '-' + viewport.name + '-' + DATASET + '.png';
  await page.screenshot({
    path: path.join(screenshots, filename),
    fullPage: true,
    captureBeyondViewport: true
  });
  await page.close();
  return { page: pageDefinition.name, viewport: viewport.name, width: viewport.width, horizontalOverflow: false };
}

async function verifyMotion(browser, baseUrl, fixtures) {
  const normalPage = await preparePage(browser, baseUrl, fixtures, false);
  await normalPage.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await normalPage.goto(baseUrl + '/dashboard.html', { waitUntil: 'domcontentloaded' });
  await normalPage.waitForSelector('#paiements-body tr:not(.row-skeleton)', { timeout: 15000 });
  await normalPage.waitForFunction(() => document.getElementById('chart-evolution')?.dataset.sfChartAnimation);
  const chartAnimation = await normalPage.$eval('#chart-evolution', (canvas) => canvas.dataset.sfChartAnimation);
  assert.equal(chartAnimation, 'disabled', 'Le graphique fonctionnel doit rester sans animation.');

  const button = await normalPage.$('[data-periode="week"]');
  const bounds = await button.boundingBox();
  await normalPage.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await normalPage.mouse.down();
  const buttonTransform = await button.evaluate((element) => getComputedStyle(element).transform);
  await normalPage.mouse.up();
  assert.match(buttonTransform, /matrix\(0\.97,\s*0,\s*0,\s*0\.97/,
    'Le bouton doit fournir un retour press scale(0.97).');
  await normalPage.close();

  const reducedPage = await preparePage(browser, baseUrl, fixtures, true);
  await reducedPage.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await reducedPage.goto(baseUrl + '/dashboard.html', { waitUntil: 'domcontentloaded' });
  await reducedPage.waitForSelector('#paiements-body tr:not(.row-skeleton)', { timeout: 15000 });
  await reducedPage.evaluate(() => showToast('Notification de vérification', 'info'));
  await reducedPage.waitForSelector('.toast');
  const reduced = await reducedPage.$eval('.toast', (element) => {
    const style = getComputedStyle(element);
    return {
      transform: style.transform,
      transitionDuration: style.transitionDuration,
      mediaMatches: matchMedia('(prefers-reduced-motion: reduce)').matches
    };
  });
  assert.equal(reduced.mediaMatches, true, 'Le navigateur doit bien simuler prefers-reduced-motion.');
  assert.equal(reduced.transform, 'none', 'Le toast ne doit pas se déplacer en mode mouvement réduit.');
  assert.ok(parseFloat(reduced.transitionDuration) <= 0.001,
    'La transition du toast doit être quasiment instantanée en mouvement réduit.');
  const tooltipMetrics = await reducedPage.evaluate(() => {
    const element = document.createElement('button');
    element.setAttribute('data-tooltip', 'Aide');
    document.body.appendChild(element);
    const style = getComputedStyle(element, '::after');
    return { duration: style.transitionDuration, origin: style.transformOrigin };
  });
  assert.ok(tooltipMetrics.duration !== '', 'La feuille de style des info-bulles doit être chargée.');
  await reducedPage.close();

  return { chartAnimation, buttonTransform, reducedMotionToast: reduced, reducedMotionTooltip: tooltipMetrics };
}

async function main() {
  if (!['worst', 'normal', 'empty'].includes(DATASET)) {
    throw new Error('VISUAL_DATASET doit valoir worst, normal ou empty.');
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const fixtures = makeFixtures();
  const server = createStaticServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const results = [];
    for (const pageDefinition of PAGES) {
      for (const viewport of VIEWPORTS) {
        results.push(await verifyPage(browser, baseUrl, pageDefinition, viewport, fixtures, OUTPUT_DIR));
      }
    }
    const motion = await verifyMotion(browser, baseUrl, fixtures);
    const report = {
      dataset: DATASET,
      generatedAt: new Date().toISOString(),
      pages: results,
      motion,
      screenshots: results.length,
      note: 'Captures du navigateur avec réponses API fictives injectées ; aucune donnée réelle n’est utilisée.'
    };
    fs.writeFileSync(path.join(OUTPUT_DIR, 'rapport-recette-visuelle.json'), JSON.stringify(report, null, 2));
    process.stdout.write('Recette visuelle réussie : ' + results.length +
      ' captures, ' + VIEWPORTS.length + ' largeurs, dataset=' + DATASET + '.\n');
    process.stdout.write('Rapport : ' + path.join(OUTPUT_DIR, 'rapport-recette-visuelle.json') + '\n');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  process.stderr.write((error && error.stack) || String(error));
  process.exitCode = 1;
});
