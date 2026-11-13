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
  { name: 'dashboard', file: 'dashboard.html', ready: '#paiements-body tr:not(.row-skeleton)', charts: ['chart-evolution', 'chart-repartition'] },
  { name: 'clients', file: 'clients.html', ready: '#clients-body tr:not(.row-skeleton)' },
  { name: 'produits', file: 'produits.html', ready: '#produits-body tr:not(.row-skeleton)' },
  { name: 'factures', file: 'factures.html', ready: '#factures-body tr:not(.row-skeleton)' },
  { name: 'factures-recurrentes', file: 'factures-recurrentes.html', ready: '#recurrentes-body tr' },
  { name: 'devis', file: 'devis.html', ready: '#devis-body tr', responsiveTable: '#devis-body' },
  { name: 'depenses', file: 'depenses.html', ready: '#depenses-body tr', responsiveTable: '#depenses-body' },
  { name: 'rapports', file: 'rapports.html', ready: '#table-body tr', charts: ['chart-ventes'], responsiveTable: '#table-body' },
  { name: 'finances', file: 'finances.html', ready: '#stat-prevision', charts: ['chart-finances'] },
  { name: 'parametres', file: 'parametres.html', ready: '#entreprise_nom' },
  { name: 'nouvelle-facture', file: 'nouvelle-facture.html', ready: '#l1' },
  { name: 'crm', file: 'crm.html', ready: '#activity-form' },
  { name: 'internationalisation', file: 'internationalisation.html', ready: '#save-localization' },
  { name: 'automatisations', file: 'automatisations.html', ready: '#automation-form' },
  { name: 'portail-client', file: 'portail-client.html#token=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', ready: '.portal-hero', public: true }
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
        tresorerie: 0,
        factures_payees: { n: 0, total: 0 },
        factures_en_attente: { n: 0, total: 0 },
        factures_en_retard: { n: 0, total: 0 },
        derniers_clients: [],
        derniers_paiements: []
      },
      ventes: [],
      clients: [],
      produits: [],
      factures: [],
      depenses: []
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
    { id: 2, nom: 'Prestation de démonstration', reference: 'PRESTA-TEST-002', prix_ht: 8500, prix_achat: 4200, tva: 18, stock: 12 },
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
      tresorerie: normal ? 475000 : 999999999999.99,
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
      nb_factures: normal ? index + 2 : 999999 + index,
      quantite: normal ? (index + 1) * 3 : 999999999 + index,
      total: normal ? (index + 1) * 85000 : (index + 1) * 71234567890.12
    })),
    clients,
    produits,
    factures,
    depenses: [
      {
        id: 1,
        libelle: normal ? 'Achat de fournitures de bureau' : makeLong('Renouvellement du parc informatique, équipements réseau et maintenance du site principal ', 188),
        categorie: 'Équipement',
        montant: normal ? 185000 : 999999999999.99,
        date_depense: '2026-11-11',
        notes: makeLong('Dépense de contrôle visuel ', 260)
      },
      {
        id: 2,
        libelle: 'Transport et livraison',
        categorie: 'Logistique',
        montant: normal ? 45000 : 888888888888.88,
        date_depense: '2026-11-10',
        notes: ''
      }
    ]
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
  '      canvas.dataset.sfChartType = config.type || "unknown";',
  '      const context = canvas.getContext("2d");',
  '      const rect = canvas.getBoundingClientRect();',
  '      const width = Math.max(1, Math.floor(rect.width));',
  '      const height = Math.max(1, Math.floor(rect.height || 180));',
  '      const ratio = window.devicePixelRatio || 1;',
  '      canvas.width = width * ratio;',
  '      canvas.height = height * ratio;',
  '      context.scale(ratio, ratio);',
  '      context.clearRect(0, 0, width, height);',
  '      if (config.type === "doughnut") {',
  '        const dataset = config.data.datasets[0] || {};',
  '        const values = (dataset.data || []).map(value => Math.max(0, Number(value) || 0));',
  '        const colors = Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor : [dataset.backgroundColor || "#1769F5"];',
  '        const total = values.reduce((sum, value) => sum + value, 0);',
  '        const radius = Math.max(12, Math.min(width, height) * 0.32);',
  '        const lineWidth = Math.max(16, Math.min(width, height) * 0.16);',
  '        let angle = -Math.PI / 2;',
  '        values.forEach((value, index) => {',
  '          if (!value || !total) return;',
  '          const nextAngle = angle + value / total * Math.PI * 2;',
  '          context.beginPath();',
  '          context.arc(width / 2, height / 2, radius, angle, nextAngle);',
  '          context.strokeStyle = colors[index % colors.length];',
  '          context.lineWidth = lineWidth;',
  '          context.lineCap = "butt";',
  '          context.stroke();',
  '          angle = nextAngle;',
  '        });',
  '      } else {',
  '        context.strokeStyle = "rgba(105,125,160,.16)"; context.lineWidth = 1;',
  '        for (let row = 1; row < 5; row++) { context.beginPath(); context.moveTo(0, row * height / 5); context.lineTo(width, row * height / 5); context.stroke(); }',
  '        context.strokeStyle = "#1769F5"; context.lineWidth = 3; context.beginPath();',
  '        const points = [0.85, 0.72, 0.77, 0.55, 0.62, 0.39, 0.48, 0.28, 0.34, 0.12];',
  '        points.forEach((point, index) => { const x = 10 + index * (width - 20) / (points.length - 1); const y = point * (height - 18) + 9; if (index === 0) context.moveTo(x, y); else context.lineTo(x, y); });',
  '        context.stroke();',
  '      }',
  '      this.destroy = function () {};',
  '    }',
  '  }',
  '  window.Chart = VisualChartStub;',
  '})();'
].join('\n');

function fixtureFor(pathname, fixtures) {
  if (pathname === '/api/factures-recurrentes') return { recurrentes: [] };
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
  if (pathname === '/api/depenses') return { depenses: fixtures.depenses || [] };
  if (pathname === '/api/rapports/comptabilite') {
    return {
      recettes: fixtures.dashboard.chiffre_affaires || 0,
      depenses: DATASET === 'empty' ? 0 : (DATASET === 'normal' ? 230000 : 999999999999.99),
      benefice: DATASET === 'empty' ? 0 : (DATASET === 'normal' ? 1020000 : 888888888888.88),
      tva_collectee: DATASET === 'empty' ? 0 : (DATASET === 'normal' ? 36000 : 777777777777.77)
    };
  }
  if (pathname === '/api/auth/me') return {
    user: {
      id: 1, nom: 'Compte de recette SamaFacture', entreprise_nom: 'SamaFacture — Société de test',
      entreprise_conditions_reglement: 'Paiement sous 30 jours', devise: 'FCFA', plan: 'pro'
    }
  };
  if (pathname === '/api/pro/crm/overview') return {
    statistiques: { total_activites: DATASET === 'empty' ? 0 : 18, taches_ouvertes: DATASET === 'empty' ? 0 : 4, taches_en_retard: DATASET === 'empty' ? 0 : 1 },
    prochaines_taches: DATASET === 'empty' ? [] : [
      { id: 1, client_id: 1, client_nom: fixtures.clients[0]?.nom || 'Client recette', type: 'appel', titre: 'Rappeler le client après le devis', due_at: '2026-11-20 10:00:00', statut: 'a_faire' }
    ]
  };
  if (pathname === '/api/pro/crm/activities') return {
    activites: DATASET === 'empty' ? [] : [
      { id: 1, client_id: 1, client_nom: fixtures.clients[0]?.nom || 'Client recette', type: 'tache', titre: makeLong('Préparer le suivi commercial du grand compte ', 185), description: 'Compte rendu de recette visuelle.', statut: 'a_faire', due_at: '2026-11-20 10:00:00', created_at: '2026-11-12 09:00:00' },
      { id: 2, client_id: 2, client_nom: 'Client secondaire', type: 'appel', titre: 'Confirmer la réception du document', description: 'Note courte.', statut: 'terminee', due_at: null, created_at: '2026-11-11 16:00:00' }
    ]
  };
  if (pathname.startsWith('/api/pro/clients/') && pathname.endsWith('/portal')) return {
    client: fixtures.clients[0] || { id: 1, nom: 'Client recette', email: 'client@example.test' },
    portail_actif: false,
    acces: null
  };
  if (pathname === '/api/pro/localization') return {
    parametres: {
      pays_code: 'SN', langue: 'fr', locale: 'fr-SN', devise: 'FCFA',
      fuseau_horaire: 'Africa/Dakar', format_date: 'dd/MM/yyyy', regime_fiscal: 'standard'
    },
    options: {
      pays: ['SN','CI','ML','BF','FR','US'],
      devises: ['FCFA','XOF','XAF','EUR','USD'],
      fuseaux: ['Africa/Dakar','Africa/Abidjan','Europe/Paris','America/New_York','UTC'],
      formats_date: ['dd/MM/yyyy','yyyy-MM-dd','MM/dd/yyyy'],
      regimes_fiscaux: ['standard','simplifie','franchise','autre']
    }
  };
  if (pathname === '/api/pro/automations') return {
    automatisations: DATASET === 'empty' ? [] : [
      { id: 1, nom: 'Relance impayés chaque semaine', type: 'relance_impayes_email', actif: true, configuration: { jours_retard: 7, frequence_jours: 7 }, derniere_execution: null, prochaine_execution: '2026-11-13 08:00:00', dernier_resultat: null },
      { id: 2, nom: 'Alertes de stock faible', type: 'alerte_stock_email', actif: false, configuration: { frequence_jours: 1 }, derniere_execution: '2026-11-11 08:00:00', prochaine_execution: null, dernier_resultat: 'smtp_non_configure' }
    ]
  };
  if (pathname === '/api/portal/') return {
    client: { nom: fixtures.clients[0]?.nom || 'Client de recette', email: fixtures.clients[0]?.email || 'client@example.test' },
    entreprise: { nom: 'SamaFacture — Société de test', logo: null, email: 'support@example.test', telephone: '+221 77 000 00 00', site_web: 'https://example.test', devise: 'FCFA', langue: 'fr', locale: 'fr-SN' },
    resume: { nb_factures: DATASET === 'empty' ? 0 : 3, nb_devis: DATASET === 'empty' ? 0 : 2, solde_du: DATASET === 'empty' ? 0 : 250000 },
    documents: DATASET === 'empty' ? [] : [
      { id: 1, numero: 'FAC-2026-0001', type: 'facture', date_emission: '2026-11-10', date_echeance: '2026-11-20', statut: 'en_attente', total: 250000, montant_paye: 50000, solde: 200000, devise: 'FCFA', lignes: [{ designation: 'Prestation de conseil', quantite: 2, prix_unitaire: 125000, tva: 18, total_ligne: 250000 }] },
      { id: 2, numero: 'DEV-2026-0002', type: 'devis', date_emission: '2026-11-11', date_validite: '2026-12-15', statut: 'en_attente', total: 180000, montant_paye: 0, solde: 180000, devise: 'FCFA', portail_decision: null, lignes: [{ designation: 'Maintenance annuelle', quantite: 1, prix_unitaire: 180000, tva: 18, total_ligne: 180000 }] }
    ]
  };
  return {};
}

async function preparePage(browser, baseUrl, fixtures, reduceMotion) {
  const page = await browser.newPage();
  page.__visualApiRequests = [];
  page.on('requestfailed', request => {
    if (request.url().includes('/api/')) page.__visualApiRequests.push({
      method: request.method(), url: request.url(), failed: request.failure()?.errorText || 'request failed'
    });
  });
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([
    { name: 'prefers-reduced-motion', value: reduceMotion ? 'reduce' : 'no-preference' }
  ]);
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/api/')) {
      page.__visualApiRequests.push({ method: request.method(), url });
      let response = {};
      try {
        const requestUrl = new URL(url);
        if (request.method() === 'POST' && requestUrl.pathname === '/api/factures') {
          response = { facture: { id: 987, numero: 'FAC-VISUAL-0987' } };
        } else {
          response = fixtureFor(requestUrl.pathname, fixtures);
        }
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
  });
  // Le global est réinitialisé lorsque Puppeteer navigue vers chaque page métier.
  // Le réinjecter sur chaque nouveau document évite une API cross-origin et son préflight CORS.
  await page.evaluateOnNewDocument(() => {
    window.SAMAFACTURE_API_URL = location.origin + '/api';
  });
  return page;
}

async function verifyPage(page, baseUrl, pageDefinition, viewport, screenshots) {
  const pageErrors = [];
  const onPageError = (error) => pageErrors.push(error.message);
  page.on('pageerror', onPageError);

  await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
  await page.goto(baseUrl + '/' + pageDefinition.file, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForSelector(pageDefinition.ready, { timeout: 15000 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      title: document.title,
      url: location.href,
      apiBase: window.SAMAFACTURE_API_URL || null,
      hasToken: Boolean(localStorage.getItem('sf_token')),
      bodyText: (document.body?.innerText || '').slice(0, 900),
      loadingRows: document.querySelectorAll('.row-skeleton').length
    })).catch(e => ({ evaluateError: e.message }));
    throw new Error(pageDefinition.name + ' indisponible; diagnostic=' +
      JSON.stringify({ ...diagnostic, apiRequests: page.__visualApiRequests, pageErrors }) +
      '; cause=' + error.message);
  }
  if (pageDefinition.charts?.length) {
    await page.waitForFunction((chartIds) => chartIds.every((id) => {
      const canvas = document.getElementById(id);
      return canvas?.dataset.sfChartType && canvas.dataset.sfChartAnimation === 'disabled';
    }), { timeout: 15000 }, pageDefinition.charts);
  }
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await new Promise((resolve) => setTimeout(resolve, 120));

  if (!pageDefinition.public) {
    const shell = await page.evaluate(() => ({
      toolbar: Boolean(document.querySelector('.app-topbar')),
      search: Boolean(document.querySelector('.app-topbar-search input#workspace-search')),
      notificationBell: Boolean(document.querySelector('#workspace-notification-toggle .ic svg')),
      notificationPanel: Boolean(document.querySelector('#workspace-notification-panel[hidden]')),
      sidebar: Boolean(document.querySelector('#app-sidebar')),
      activeNavigation: Boolean(document.querySelector('#app-navigation .nav-item.active'))
    }));
    assert.equal(shell.toolbar, true, pageDefinition.name + ' doit afficher la barre supérieure commune.');
    assert.equal(shell.search, true, pageDefinition.name + ' doit afficher la recherche globale.');
    assert.equal(shell.notificationBell, true, pageDefinition.name + ' doit afficher la cloche de notifications.');
    assert.equal(shell.notificationPanel, true, pageDefinition.name + ' doit garder le panneau fermé au chargement.');
    assert.equal(shell.sidebar, true, pageDefinition.name + ' doit afficher la navigation latérale.');
    assert.equal(shell.activeNavigation, true, pageDefinition.name + ' doit signaler la page active.');
  }

  const layoutAudit = await page.evaluate(() => {
    const main = document.querySelector('main.workspace-page');
    const hasHeader = Boolean(main?.querySelector(':scope > .page-header, :scope > .workspace-page-header, :scope > .dashboard-welcome'));
    const hasKicker = Boolean(main?.querySelector('.workspace-page-kicker, .pro-eyebrow, .billing-eyebrow, .subscription-eyebrow'));
    const unhydratedIcons = Array.from(document.querySelectorAll('i[data-icon]'))
      .map(element => element.getAttribute('data-icon'));
    return {
      workspacePage: Boolean(main),
      hasHeader,
      hasKicker,
      dataHeading: Boolean(main?.querySelector('.workspace-data-heading')),
      filterPanel: Boolean(main?.querySelector('.workspace-filter-card')),
      unhydratedIcons,
      headingFont: getComputedStyle(document.querySelector('h1')).fontFamily,
      bodyFont: getComputedStyle(document.body).fontFamily
    };
  });
  const structuredPages = ['dashboard', 'clients', 'produits', 'factures', 'factures-recurrentes', 'devis', 'depenses', 'rapports', 'finances', 'crm', 'internationalisation', 'automatisations', 'nouvelle-facture'];
  if (structuredPages.includes(pageDefinition.name)) {
    assert.equal(layoutAudit.workspacePage, true, pageDefinition.name + ' doit utiliser le cadre de page commun.');
    assert.equal(layoutAudit.hasHeader, true, pageDefinition.name + ' doit présenter un en-tête de page clair.');
    assert.equal(layoutAudit.hasKicker, true, pageDefinition.name + ' doit identifier clairement la section métier.');
  }
  const tableHeadingPages = ['clients', 'produits', 'factures-recurrentes', 'devis', 'depenses', 'rapports'];
  if (tableHeadingPages.includes(pageDefinition.name)) {
    assert.equal(layoutAudit.dataHeading, true, pageDefinition.name + ' doit titrer sa zone de données.');
  }
  assert.ok(layoutAudit.headingFont.toLowerCase().includes('ibm plex sans'),
    pageDefinition.name + ' doit utiliser IBM Plex Sans pour les titres.');
  assert.ok(layoutAudit.bodyFont.toLowerCase().includes('ibm plex sans'),
    pageDefinition.name + ' doit utiliser IBM Plex Sans pour les textes.');
  if (['clients', 'rapports'].includes(pageDefinition.name)) {
    assert.equal(layoutAudit.filterPanel, true, pageDefinition.name + ' doit séparer les filtres du contenu métier.');
  }
  assert.deepEqual(layoutAudit.unhydratedIcons, [],
    pageDefinition.name + ' contient des icônes statiques non reconnues : ' + JSON.stringify(layoutAudit.unhydratedIcons));

  const navigationGeometry = await page.evaluate(() => {
    const sidebar = document.getElementById('app-sidebar');
    const main = document.querySelector('.main-content');
    return {
      viewport: window.innerWidth,
      sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null,
      sidebarCollapsed: Boolean(sidebar?.classList.contains('is-collapsed')),
      sidebarOpen: Boolean(sidebar?.classList.contains('open')),
      overlayVisible: document.getElementById('sidebar-overlay')?.classList.contains('show') || false,
      mainLeft: main ? Math.round(main.getBoundingClientRect().left) : null,
      mainMargin: main ? Math.round(parseFloat(getComputedStyle(main).marginLeft) || 0) : null,
      firstContentLeft: main?.querySelector('.dashboard-welcome, .page-header, .workspace-page-header')
        ? Math.round(main.querySelector('.dashboard-welcome, .page-header, .workspace-page-header').getBoundingClientRect().left)
        : null,
      contentPaddingLeft: main ? Math.round(parseFloat(getComputedStyle(main).paddingLeft) || 0) : null,
      expectedCompactWidth: getComputedStyle(document.documentElement).getPropertyValue('--sidebar-collapsed-w').trim()
    };
  });
  if (!pageDefinition.public && viewport.width >= 901) {
    assert.equal(navigationGeometry.sidebarCollapsed, true,
      pageDefinition.name + ' : le menu de bureau doit démarrer compact.');
    assert.equal(navigationGeometry.sidebarWidth, 76,
      pageDefinition.name + ' : la largeur réelle du rail desktop doit rester à 76 px : ' + JSON.stringify(navigationGeometry));
    assert.ok(navigationGeometry.mainMargin >= 76 && navigationGeometry.mainMargin <= 92,
      pageDefinition.name + ' : la marge CSS du contenu doit réserver la largeur du rail compact sans espace excessif : ' + JSON.stringify(navigationGeometry));
    assert.ok(navigationGeometry.mainLeft >= navigationGeometry.sidebarWidth &&
      navigationGeometry.mainLeft <= navigationGeometry.sidebarWidth + 16,
      pageDefinition.name + ' : le conteneur principal ne doit pas chevaucher le rail : ' + JSON.stringify(navigationGeometry));
    assert.ok(navigationGeometry.contentPaddingLeft >= 24,
      pageDefinition.name + ' : la zone de travail doit conserver au moins 24 px de marge intérieure après la navigation : ' + JSON.stringify(navigationGeometry));
    assert.ok(navigationGeometry.firstContentLeft >= navigationGeometry.sidebarWidth + 24,
      pageDefinition.name + ' : le premier contenu doit être visuellement séparé du rail : ' + JSON.stringify(navigationGeometry));
    assert.equal(navigationGeometry.sidebarOpen, false,
      pageDefinition.name + ' : le tiroir mobile ne doit pas s’ouvrir sur ordinateur.');
    assert.equal(navigationGeometry.overlayVisible, false,
      pageDefinition.name + ' : aucun voile de navigation ne doit masquer le contenu desktop.');
  }

  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    page: location.pathname,
    xssMarker: window.__visualXss || false,
    paymentLabels: location.pathname.includes('dashboard') && window.innerWidth <= 640
      ? Array.from(document.querySelectorAll('#paiements-body tr:not(.row-skeleton):first-child td')).map(cell => cell.dataset.label || '')
      : null
  }));
  assert.ok(metrics.document <= metrics.viewport + 1,
    pageDefinition.name + ' déborde horizontalement à ' + viewport.width + 'px: ' + JSON.stringify(metrics));
  assert.ok(metrics.body <= metrics.viewport + 1,
    pageDefinition.name + ' élargit le body à ' + viewport.width + 'px: ' + JSON.stringify(metrics));
  assert.equal(metrics.xssMarker, false, 'Une donnée de test ne doit pas exécuter de script.');
  if (pageDefinition.name === 'dashboard' && viewport.width <= 640 && DATASET !== 'empty') {
    assert.deepEqual(metrics.paymentLabels, ['Référence', 'Client', 'Méthode', 'Date', 'Montant'],
      'Chaque information d’un encaissement doit rester nommée et visible sur mobile.');
  }
  assert.deepEqual(pageErrors, [],
    pageDefinition.name + ' a généré des erreurs JavaScript: ' + pageErrors.join(' | '));

  let responsiveContent = null;
  if (viewport.width <= 640 && DATASET !== 'empty' &&
      (pageDefinition.name === 'clients' || pageDefinition.name === 'produits')) {
    responsiveContent = await page.evaluate((pageName) => {
      const isClients = pageName === 'clients';
      const row = document.querySelector(isClients
        ? '#clients-body tr:not(.row-skeleton)'
        : '#produits-body tr:not(.row-skeleton)');
      if (!row) return { found: false };
      const name = row.querySelector(isClients ? '.client-name' : '.product-name');
      const style = name ? getComputedStyle(name) : null;
      return {
        found: Boolean(name),
        clientWidth: name ? name.clientWidth : 0,
        scrollWidth: name ? name.scrollWidth : 0,
        height: name ? name.getBoundingClientRect().height : 0,
        lineHeight: style ? parseFloat(style.lineHeight) : 0,
        labels: Array.from(row.querySelectorAll(':scope > td')).map((cell) => cell.dataset.label || '')
      };
    }, pageDefinition.name);
    assert.equal(responsiveContent.found, true,
      pageDefinition.name + ' doit exposer le libellé principal dans la vue mobile.');
    assert.ok(responsiveContent.clientWidth > 0 &&
      responsiveContent.scrollWidth <= responsiveContent.clientWidth + 1,
      pageDefinition.name + ' : le libellé long est coupé à ' + viewport.width + 'px : ' +
      JSON.stringify(responsiveContent));
    assert.ok(responsiveContent.labels.every(Boolean),
      pageDefinition.name + ' : chaque cellule de la carte mobile doit avoir son libellé : ' +
      JSON.stringify(responsiveContent.labels));
    if (DATASET === 'worst') {
      assert.ok(responsiveContent.height > responsiveContent.lineHeight * 1.4,
        pageDefinition.name + ' : le texte extrême doit passer sur plusieurs lignes : ' +
        JSON.stringify(responsiveContent));
    }
  }

  if (viewport.width <= 640 && pageDefinition.responsiveTable && DATASET !== 'empty') {
    const labels = await page.evaluate((selector) => Array.from(
      document.querySelectorAll(selector + ' tr:not(.row-skeleton) td:not([colspan])')
    ).map(cell => cell.dataset.label || ''), pageDefinition.responsiveTable);
    assert.ok(labels.length > 0 && labels.every(Boolean),
      pageDefinition.name + ' : toutes les cellules du tableau mobile doivent avoir un libellé. Labels : ' +
      JSON.stringify(labels));
  }

  const filename = pageDefinition.name + '-' + viewport.name + '-' + DATASET + '.png';
  await page.screenshot({
    path: path.join(screenshots, filename),
    fullPage: true,
    captureBeyondViewport: true
  });
  page.off('pageerror', onPageError);
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
  // Laisser la transition de 130 ms atteindre son état final avant de lire la matrice.
  await new Promise((resolve) => setTimeout(resolve, 180));
  const buttonState = await button.evaluate((element) => ({
    active: element.matches(':active'),
    transform: getComputedStyle(element).transform
  }));
  await normalPage.mouse.up();
  assert.equal(buttonState.active, true, 'Le pointeur doit maintenir le bouton pressé pendant la mesure.');
  assert.match(buttonState.transform, /matrix\(0\.97,\s*0,\s*0,\s*0\.97/,
    'Le bouton doit fournir un retour press scale(0.97). Valeur observée : ' + buttonState.transform);
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

  return { chartAnimation, buttonTransform: buttonState.transform, reducedMotionToast: reduced, reducedMotionTooltip: tooltipMetrics };
}

async function verifyWorkspaceShell(browser, baseUrl, fixtures) {
  const page = await preparePage(browser, baseUrl, fixtures, false);
  const clientRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/clients')) clientRequests.push(request.url());
  });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.goto(baseUrl + '/dashboard.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#paiements-body tr:not(.row-skeleton)', { timeout: 15000 });
  const initialNotifications = await page.evaluate(() => ({
    badgeHidden: document.getElementById('workspace-notification-badge')?.hidden,
    expanded: document.getElementById('workspace-notification-toggle')?.getAttribute('aria-expanded'),
    emptyMessage: document.getElementById('workspace-notification-list')?.textContent.trim()
  }));
  assert.deepEqual(initialNotifications, {
    badgeHidden: true,
    expanded: 'false',
    emptyMessage: 'Aucune notification reçue pendant cette session.'
  }, 'Aucun compteur fictif ne doit apparaître sans événement reçu.');
  await page.click('#workspace-notification-toggle');
  assert.equal(await page.$eval('#workspace-notification-panel', element => !element.hidden), true,
    'La cloche doit ouvrir le panneau de notifications.');
  await page.evaluate(() => pushWorkspaceNotification('Test de notification', 'Un nouvel événement a été reçu.', 'info'));
  const unread = await page.evaluate(() => ({
    badgeHidden: document.getElementById('workspace-notification-badge').hidden,
    badge: document.getElementById('workspace-notification-badge').textContent,
    message: document.getElementById('workspace-notification-list').textContent.includes('Un nouvel événement a été reçu.')
  }));
  assert.deepEqual(unread, { badgeHidden: false, badge: '1', message: true },
    'Un événement reçu doit alimenter la liste et le compteur non lu.');
  await page.click('#workspace-notification-toggle'); // fermer le panneau après réception
  await page.click('#workspace-notification-toggle'); // le rouvrir pour consulter l’événement
  assert.equal(await page.$eval('#workspace-notification-badge', element => element.hidden), true,
    'La réouverture du panneau doit marquer les notifications consultées comme lues.');
  await page.click('.app-notification-clear');
  assert.equal(await page.$eval('#workspace-notification-list', element => element.textContent.trim()),
    'Aucune notification reçue pendant cette session.', 'Le bouton Effacer doit vider la liste.');
  await page.type('#workspace-search', 'Coopérative Thiès');
  await page.click('.app-topbar-search button');
  await page.waitForFunction(() => location.pathname.endsWith('/clients.html'), { timeout: 15000 });
  await page.waitForSelector('#clients-body tr:not(.row-skeleton)', { timeout: 15000 });
  const query = await page.$eval('#search', element => element.value);
  assert.equal(query, 'Coopérative Thiès', 'La recherche globale doit transmettre le texte à la page Clients.');
  assert.ok(clientRequests.some(url => new URL(url).searchParams.get('q') === 'Coopérative Thiès'),
    'La page Clients doit lancer la requête API avec le terme reçu depuis la barre supérieure.');
  await page.close();

  const mobile = await preparePage(browser, baseUrl, fixtures, false);
  await mobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await mobile.goto(baseUrl + '/dashboard.html', { waitUntil: 'domcontentloaded' });
  await mobile.waitForSelector('#paiements-body tr:not(.row-skeleton)', { timeout: 15000 });
  await mobile.click('#mobile-toggle-btn');
  const opened = await mobile.evaluate(() => ({
    expanded: document.getElementById('mobile-toggle-btn')?.getAttribute('aria-expanded'),
    sidebarOpen: document.getElementById('app-sidebar')?.classList.contains('open'),
    overlayVisible: document.getElementById('sidebar-overlay')?.classList.contains('show')
  }));
  assert.deepEqual(opened, { expanded: 'true', sidebarOpen: true, overlayVisible: true },
    'Le menu mobile doit s’ouvrir, afficher son voile et mettre à jour ARIA.');
  await mobile.click('#mobile-toggle-btn');
  const closed = await mobile.evaluate(() => ({
    expanded: document.getElementById('mobile-toggle-btn')?.getAttribute('aria-expanded'),
    sidebarOpen: document.getElementById('app-sidebar')?.classList.contains('open'),
    overlayVisible: document.getElementById('sidebar-overlay')?.classList.contains('show')
  }));
  assert.deepEqual(closed, { expanded: 'false', sidebarOpen: false, overlayVisible: false },
    'Le bouton du menu doit refermer le panneau mobile et son voile.');
  await mobile.close();

  return { globalSearch: 'ok', mobileNavigation: 'ok', notifications: 'ok' };
}

async function verifyCompactSidebar(browser, baseUrl, fixtures) {
  const page = await preparePage(browser, baseUrl, fixtures, false);
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto(baseUrl + '/dashboard.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#paiements-body tr:not(.row-skeleton)', { timeout: 15000 });

  const compact = await page.evaluate(() => ({
    collapsed: document.getElementById('app-sidebar')?.classList.contains('is-collapsed'),
    sidebarWidth: Math.round(document.getElementById('app-sidebar')?.getBoundingClientRect().width || 0),
    mainMargin: Math.round(parseFloat(getComputedStyle(document.querySelector('.main-content')).marginLeft) || 0),
    bodyState: document.body.classList.contains('sidebar-collapsed'),
    labelsHidden: [...document.querySelectorAll('.nav-label')].every(element => getComputedStyle(element).display === 'none'),
    promoRemoved: !document.querySelector('.sidebar-promo'),
    toggleExpanded: document.getElementById('sidebar-collapse-toggle')?.getAttribute('aria-expanded'),
    headingFont: getComputedStyle(document.querySelector('.page-header h1') || document.querySelector('h1')).fontFamily,
    bodyFont: getComputedStyle(document.body).fontFamily,
    iconsConsistent: [...document.querySelectorAll('.nav-item svg.icon')].length > 0 &&
      [...document.querySelectorAll('.nav-item svg.icon')].every(icon =>
        icon.getAttribute('viewBox') === '0 0 24 24' &&
        icon.getAttribute('stroke-linecap') === 'round' &&
        icon.getAttribute('stroke-linejoin') === 'round')
  }));
  assert.deepEqual(compact, {
    collapsed: true,
    sidebarWidth: 76,
    mainMargin: 76,
    bodyState: true,
    labelsHidden: true,
    promoRemoved: true,
    toggleExpanded: 'false',
    headingFont: 'IBM Plex Sans, sans-serif',
    bodyFont: 'IBM Plex Sans, sans-serif',
    iconsConsistent: true
  }, 'La navigation de bureau, la typographie et les icônes doivent rester compactes et cohérentes.');

  await page.click('#sidebar-collapse-toggle');
  await new Promise(resolve => setTimeout(resolve, 240));
  const expanded = await page.evaluate(() => ({
    collapsed: document.getElementById('app-sidebar')?.classList.contains('is-collapsed'),
    sidebarWidth: Math.round(document.getElementById('app-sidebar')?.getBoundingClientRect().width || 0),
    mainMargin: Math.round(parseFloat(getComputedStyle(document.querySelector('.main-content')).marginLeft) || 0),
    toggleExpanded: document.getElementById('sidebar-collapse-toggle')?.getAttribute('aria-expanded')
  }));
  assert.deepEqual(expanded, {
    collapsed: false,
    sidebarWidth: 248,
    mainMargin: 248,
    toggleExpanded: 'true'
  }, 'Le bouton doit élargir la navigation et réaligner la zone de travail.');

  await page.click('#sidebar-collapse-toggle');
  await new Promise(resolve => setTimeout(resolve, 240));
  assert.equal(await page.evaluate(() => localStorage.getItem('sf-sidebar-collapsed')), 'true',
    'La préférence compacte doit être mémorisée.');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#paiements-body tr:not(.row-skeleton)', { timeout: 15000 });
  assert.equal(await page.$eval('#app-sidebar', element => element.classList.contains('is-collapsed')), true,
    'La navigation doit conserver le mode compact après un changement de page.');

  await page.setViewport({ width: 768, height: 1024, deviceScaleFactor: 1 });
  const tablet = await page.evaluate(() => ({
    mobileToggleVisible: getComputedStyle(document.getElementById('mobile-toggle-btn')).display !== 'none',
    desktopToggleHidden: getComputedStyle(document.getElementById('sidebar-collapse-toggle')).display === 'none',
    mainMargin: Math.round(parseFloat(getComputedStyle(document.querySelector('.main-content')).marginLeft) || 0)
  }));
  assert.deepEqual(tablet, {
    mobileToggleVisible: true,
    desktopToggleHidden: true,
    mainMargin: 0
  }, 'À la largeur tablette, le menu mobile doit prendre le relais sans marge latérale.');

  await page.close();
  return { desktopCompact: 'ok', desktopExpandCollapse: 'ok', preferencePersistence: 'ok', tabletNavigation: 'ok' };
}

function contrastRatio(foreground, background) {
  function luminance(color) {
    let channels;
    const rgb = color.match(/[\d.]+/g);
    if (rgb && rgb.length >= 3) {
      channels = rgb.slice(0, 3).map(Number);
    } else {
      const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (!hex) throw new Error('Format de couleur non pris en charge pour le contraste : ' + color);
      const value = hex[1].length === 3
        ? hex[1].split('').map(character => parseInt(character + character, 16))
        : hex[1].match(/.{2}/g).map(channel => parseInt(channel, 16));
      channels = value;
    }
    const linear = channels.map(value => {
      const normalized = value / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

async function verifyThemeAndZoom(browser, baseUrl, fixtures) {
  const darkPage = await preparePage(browser, baseUrl, fixtures, false);
  await darkPage.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await darkPage.evaluate(() => localStorage.setItem('sf_theme', 'dark'));
  await darkPage.goto(baseUrl + '/dashboard.html', { waitUntil: 'domcontentloaded' });
  await darkPage.waitForSelector('#paiements-body tr:not(.row-skeleton)', { timeout: 15000 });
  await darkPage.waitForFunction(() =>
    document.getElementById('chart-repartition')?.dataset.sfChartType === 'doughnut'
  );
  const darkMetrics = await darkPage.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    background: getComputedStyle(document.querySelector('.main-content')).backgroundColor,
    card: getComputedStyle(document.querySelector('.dashboard-panel')).backgroundColor,
    text: getComputedStyle(document.querySelector('.dashboard-welcome h1')).color,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
  }));
  assert.equal(darkMetrics.theme, 'dark', 'Le thème sombre doit être appliqué avant le rendu du tableau de bord.');
  assert.notEqual(darkMetrics.card, 'rgb(255, 255, 255)', 'Les cartes ne doivent pas rester blanches en thème sombre.');
  assert.equal(darkMetrics.horizontalOverflow, false, 'Le thème sombre ne doit pas créer de débordement.');
  const darkContrast = contrastRatio(darkMetrics.text, darkMetrics.background);
  assert.ok(darkContrast >= 4.5, 'Le contraste du titre doit atteindre 4,5:1 en thème sombre. Valeur : ' + darkContrast.toFixed(2));
  await darkPage.screenshot({ path: path.join(OUTPUT_DIR, 'dashboard-theme-sombre-1440.png'), fullPage: true });
  await darkPage.close();

  // 200 % est simulé par la largeur CSS effective d'un écran 1440 px avec un zoom navigateur
  // à 200 % : la page ne dispose alors que d'environ 720 pixels CSS.
  const zoomPage = await preparePage(browser, baseUrl, fixtures, false);
  await zoomPage.setViewport({ width: 720, height: 900, deviceScaleFactor: 1 });
  await zoomPage.goto(baseUrl + '/dashboard.html', { waitUntil: 'domcontentloaded' });
  await zoomPage.waitForSelector('#paiements-body tr:not(.row-skeleton)', { timeout: 15000 });
  const zoomMetrics = await zoomPage.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    kpis: document.querySelectorAll('.dashboard-kpi').length,
    menuToggleVisible: getComputedStyle(document.getElementById('mobile-toggle-btn')).display !== 'none'
  }));
  assert.equal(zoomMetrics.viewport, 720, 'La largeur CSS simulée pour le zoom 200 % doit être de 720 px.');
  assert.ok(zoomMetrics.document <= zoomMetrics.viewport + 1 && zoomMetrics.body <= zoomMetrics.viewport + 1,
    'Le tableau de bord doit rester dans la largeur utile au zoom 200 % : ' + JSON.stringify(zoomMetrics));
  assert.equal(zoomMetrics.kpis, 4, 'Les quatre indicateurs doivent rester présents au zoom 200 %.');
  assert.equal(zoomMetrics.menuToggleVisible, true, 'La navigation mobile doit rester accessible au zoom 200 %.');
  await zoomPage.screenshot({ path: path.join(OUTPUT_DIR, 'dashboard-zoom-200-effectif-720.png'), fullPage: true });
  await zoomPage.close();

  return { darkTheme: { ...darkMetrics, contrastRatio: Number(darkContrast.toFixed(2)) }, zoom200EffectiveViewport: zoomMetrics };
}

async function verifyInvoiceAndQuoteFlows(browser, baseUrl, fixtures) {
  if (DATASET === 'empty') return { skipped: 'jeu de données vide' };
  const page = await preparePage(browser, baseUrl, fixtures, false);
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  const submitted = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/factures') && request.method() === 'POST') {
      try { submitted.push(JSON.parse(request.postData() || '{}')); } catch (error) { submitted.push(null); }
    }
  });

  async function prepareDocument(type) {
    await page.goto(baseUrl + '/nouvelle-facture.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#l1 .ligne-produit', { timeout: 15000 });
    await page.select('#client_id', '1');
    if (type === 'devis') {
      await page.$eval('input[name="doc_type"][value="devis"]', element => {
        element.checked = true;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    await page.select('#l1 .ligne-produit', '2');
    await page.$eval('#l1 .ligne-qte', element => {
      element.value = '2';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.$eval('#remise', element => {
      element.value = '1000';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.$eval('#frais_livraison', element => {
      element.value = '1500';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const total = await page.$eval('#rec-total', element => element.textContent.replace(/\s+/g, ' ').trim());
    assert.equal(total, '20 380 FCFA', 'Le total doit inclure la remise, la TVA sur le net et les frais de livraison.');
    if (type === 'devis') {
      const fields = await page.evaluate(() => ({
        dueHidden: document.getElementById('invoice-due-field').hidden,
        validityHidden: document.getElementById('quote-validity-field').hidden,
        title: document.getElementById('page-title').textContent
      }));
      assert.deepEqual(fields, { dueHidden: true, validityHidden: false, title: 'Nouveau devis' },
        'Le mode devis doit masquer l’échéance et afficher la validité.');
      await page.$eval('#date_validite', element => { element.value = '2026-12-15'; });
    }
    await page.click('#submit-facture-btn');
    await page.waitForFunction(() =>
      location.pathname.endsWith('/factures.html') && location.search.includes('highlight=987'),
      { timeout: 15000 }
    );
    const payload = submitted[submitted.length - 1];
    assert.ok(payload, 'La création doit envoyer un payload JSON au serveur.');
    assert.equal(payload.type, type, 'Le type de document envoyé au serveur doit correspondre au formulaire.');
    assert.equal(String(payload.client_id), '1', 'Le client sélectionné doit figurer dans le payload.');
    assert.equal(payload.lignes.length, 1, 'Une ligne produit doit figurer dans le document.');
    assert.equal(payload.lignes[0].designation, 'Prestation de démonstration');
    assert.equal(payload.lignes[0].quantite, 2);
    assert.equal(payload.remise, 1000);
    assert.equal(payload.frais_livraison, 1500);
    if (type === 'devis') {
      assert.equal(payload.date_validite, '2026-12-15');
      assert.equal(payload.date_echeance, null);
    } else {
      assert.equal(payload.date_validite, null);
    }
  }

  await prepareDocument('facture');
  await prepareDocument('devis');
  await page.close();
  return { invoiceCreation: 'ok', quoteCreation: 'ok', totalWithDiscountVatAndDelivery: 20380 };
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
    // Réutiliser un onglet métier pour tous les écrans d'une même largeur réduit
    // fortement le nombre de sessions CDP créées pendant la recette, tout en rechargeant
    // chaque vrai document HTML avec ses propres scripts et son état initial.
    for (const viewport of VIEWPORTS) {
      const page = await preparePage(browser, baseUrl, fixtures, false);
      try {
        for (const pageDefinition of PAGES) {
          results.push(await verifyPage(page, baseUrl, pageDefinition, viewport, OUTPUT_DIR));
        }
      } finally {
        await page.close();
      }
    }
    const compactSidebar = await verifyCompactSidebar(browser, baseUrl, fixtures);
    const shell = await verifyWorkspaceShell(browser, baseUrl, fixtures);
    const motion = await verifyMotion(browser, baseUrl, fixtures);
    const themeAndZoom = await verifyThemeAndZoom(browser, baseUrl, fixtures);
    const documentFlows = await verifyInvoiceAndQuoteFlows(browser, baseUrl, fixtures);
    const report = {
      dataset: DATASET,
      generatedAt: new Date().toISOString(),
      pages: results,
      motion,
      compactSidebar,
      workspaceShell: shell,
      themeAndZoom,
      documentFlows,
      screenshots: results.length + 2,
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
