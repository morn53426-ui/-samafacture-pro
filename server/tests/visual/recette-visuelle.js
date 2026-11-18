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
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1024', width: 1024, height: 900 },
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'wide-1920', width: 1920, height: 1080 }
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
  { name: 'parametres', file: 'parametres.html', ready: '[data-template-card="classique"]' },
  { name: 'professionnel', file: 'professionnel.html', ready: '#pro-sales' },
  { name: 'nouvelle-facture', file: 'nouvelle-facture.html', ready: '#l1' },
  { name: 'crm', file: 'crm.html', ready: '#activity-form' },
  { name: 'internationalisation', file: 'internationalisation.html', ready: '#save-localization' },
  { name: 'automatisations', file: 'automatisations.html', ready: '#automation-form' },
  { name: 'abonnement', file: 'abonnement.html', ready: '#plan-cards .subscription-plan-card' },
  { name: 'groupe-entreprise', file: 'groupe-entreprise.html', ready: '#invite-company-form', plan: 'entreprise' },
  { name: 'invitation', file: 'invitation.html?type=company-group&token=' + 'a'.repeat(64), ready: '#accept-invite', public: true },
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
  '      canvas.dataset.sfChartTickColor = config.options && config.options.scales && config.options.scales.y && config.options.scales.y.ticks ? String(config.options.scales.y.ticks.color || "") : "";',
  '      canvas.dataset.sfChartGridColor = config.options && config.options.scales && config.options.scales.y && config.options.scales.y.grid ? String(config.options.scales.y.grid.color || "") : "";',
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
  '        context.strokeStyle = "#087A57"; context.lineWidth = 3; context.beginPath();',
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
  if (/^\/api\/factures\/(987|988)$/.test(pathname)) {
    const isQuote = pathname.endsWith('/988');
    const lineCount = isQuote ? 28 : 8;
    const lignes = Array.from({ length: lineCount }, (_, index) => ({
      designation: makeLong(
        (isQuote ? 'Lot de prestation et fournitures prévu au devis — ' : 'Prestation facturée — ') +
        String(index + 1).padStart(2, '0') + ' · ',
        DATASET === 'normal' ? 70 : 148
      ),
      quantite: index % 4 === 0 ? 2 : 1,
      prix_unitaire: 10000 + index * 250,
      tva: index % 5 === 0 ? 0 : 18,
      total_ligne: (index % 4 === 0 ? 2 : 1) * (10000 + index * 250) * (index % 5 === 0 ? 1 : 1.18)
    }));
    const sousTotal = lignes.reduce((sum, ligne) => sum + ligne.quantite * ligne.prix_unitaire, 0);
    const remise = 5000;
    const fraisLivraison = 2500;
    // Garder le jeu de données comptablement cohérent : la TVA est calculée sur la base
    // nette après remise, comme dans server/routes/factures.js.
    const totalTva = Number(lignes.reduce((sum, ligne) => {
      const base = ligne.quantite * ligne.prix_unitaire;
      const baseNette = sousTotal > 0 ? base - remise * (base / sousTotal) : base;
      return sum + baseNette * (Number(ligne.tva) || 0) / 100;
    }, 0).toFixed(2));
    const total = Number((sousTotal - remise + fraisLivraison + totalTva).toFixed(2));
    return {
      facture: {
        id: isQuote ? 988 : 987,
        numero: isQuote ? 'DV-2026-0988' : 'FAC-2026-0987',
        type: isQuote ? 'devis' : 'facture',
        statut: 'en_attente',
        client_nom: fixtures.clients[0]?.nom || 'Client de recette',
        client_adresse: fixtures.clients[0]?.adresse || 'Dakar, Sénégal',
        client_telephone: fixtures.clients[0]?.telephone || '+221 77 123 45 67',
        client_email: fixtures.clients[0]?.email || 'client@example.sn',
        date_emission: '2026-11-15',
        date_echeance: isQuote ? null : '2026-12-15',
        date_validite: isQuote ? '2026-12-15' : null,
        objet: isQuote ? 'Proposition commerciale détaillée et conditions de réalisation' : 'Prestation de services',
        reference_externe: isQuote ? 'BC-CLIENT-2026-0988' : 'BC-CLIENT-2026-0987',
        sous_total: sousTotal,
        total_tva: totalTva,
        remise,
        frais_livraison: fraisLivraison,
        total,
        montant_paye: isQuote ? 0 : 40000,
        commentaires: 'Document de démonstration généré uniquement pour la recette visuelle.',
        mode_paiement: isQuote ? null : 'Virement bancaire',
        conditions_reglement: isQuote ? 'Offre valable 30 jours. Acompte de 40 % après validation.' : 'Règlement sous 15 jours.'
      },
      lignes,
      qr_code: null
    };
  }
  if (pathname === '/api/depenses') return { depenses: fixtures.depenses || [] };
  if (pathname === '/api/rapports/comptabilite') {
    return {
      recettes: fixtures.dashboard.chiffre_affaires || 0,
      depenses: DATASET === 'empty' ? 0 : (DATASET === 'normal' ? 230000 : 999999999999.99),
      benefice: DATASET === 'empty' ? 0 : (DATASET === 'normal' ? 1020000 : 888888888888.88),
      tva_collectee: DATASET === 'empty' ? 0 : (DATASET === 'normal' ? 36000 : 777777777777.77)
    };
  }
  if (pathname === '/api/pro/company-group') return {
    groupe: { id: 1, nom: 'Groupe de démonstration', actif: true },
    societes: [
      { id: 1, entreprise_nom: 'SamaFacture Société principale', contact_nom: 'Compte principal', is_primary: true, pays_code: 'SN', devise: 'FCFA', email: 'direction@principal.example', entreprise_ninea: 'SN-DKR-2026-A001' },
      { id: 2, entreprise_nom: 'Filiale de démonstration', contact_nom: 'Compte filiale', is_primary: false, pays_code: 'SN', devise: 'FCFA', email: 'contact@filiale.example', entreprise_ninea: 'SN-DKR-2026-B002' }
    ],
    invitations: [
      { id: 11, invited_email: 'direction@future-filiale.example', expire_at: '2026-11-24 12:00:00', email_statut: 'queued', tentatives_email: 0 }
    ]
  };
  if (pathname === '/api/pro/company-group/dashboard') return {
    factures_par_devise: [{ devise: 'FCFA', nombre_factures: 15, total_facture: 12500000, total_encaisse: 8300000 }],
    depenses_par_devise: [{ devise: 'FCFA', nombre_depenses: 8, total_depenses: 2450000 }]
  };
  if (pathname === '/api/pro/company-group/membership') return { membre: false };
  if (pathname === '/api/pro/company-group/invitations/accept') return {
    verification_required: true,
    message: 'Un lien de confirmation a été envoyé à l’adresse email du propriétaire. Il expire après 20 minutes.'
  };
  if (pathname === '/api/abonnement/moyens-disponibles') return {
    wave: true,
    paydunya: true,
    tarifs: { starter: 5000, pro: 15000, entreprise: 35000 },
    facturation: {
      mode: 'paiement_unique',
      renouvellement_automatique: false,
      expiration_automatique: false,
      acces_jusqua_changement_manuel: true,
      activation: 'apres_confirmation'
    }
  };
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
  if (pageDefinition.plan) {
    await page.evaluate((plan) => {
      const user = JSON.parse(localStorage.getItem('sf_user') || '{}');
      user.plan = plan;
      localStorage.setItem('sf_user', JSON.stringify(user));
    }, pageDefinition.plan);
  }
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
  if (pageDefinition.name === 'groupe-entreprise') {
    const groupUi = await page.evaluate(() => {
      const links = [...document.querySelectorAll('#group-section-nav a[href^="#"]')];
      return {
        liveRegion: document.getElementById('group-status')?.getAttribute('aria-live') || null,
        companyCount: document.querySelectorAll('.group-company').length,
        invitationCount: document.querySelectorAll('.group-invite').length,
        inviteForm: Boolean(document.querySelector('#invite-company-form')),
        navigationVisible: document.getElementById('group-section-nav')?.hidden === false,
        navigationTargets: links.map(link => Boolean(document.querySelector(link.getAttribute('href')))),
        overviewKpis: document.querySelectorAll('.group-overview-kpi').length,
        primaryCurrencyCards: document.querySelectorAll('.group-metric-grid-primary').length,
        secondaryMetricDisclosure: document.querySelectorAll('.group-secondary-details').length,
        skipLink: Boolean(document.querySelector('.workspace-skip-link[href="#main-content"]')),
        mainLandmark: Boolean(document.querySelector('main#main-content'))
      };
    });
    assert.equal(groupUi.liveRegion, 'polite', 'La page Groupe doit annoncer les changements de statut aux lecteurs d’écran.');
    assert.equal(groupUi.companyCount, 2, 'La recette doit afficher la société principale et une filiale.');
    assert.equal(groupUi.invitationCount, 1, 'La recette doit afficher une invitation en attente.');
    assert.equal(groupUi.inviteForm, true, 'Le formulaire d’invitation doit être visible.');
    assert.equal(groupUi.navigationVisible, true, 'La navigation du centre de pilotage doit être visible.');
    assert.equal(groupUi.navigationTargets.length, 5, 'Les cinq sections du centre de pilotage doivent être accessibles.');
    assert.ok(groupUi.navigationTargets.every(Boolean), 'Chaque entrée de navigation doit pointer vers une section existante.');
    assert.equal(groupUi.overviewKpis, 4, 'La synthèse du groupe doit afficher quatre indicateurs de premier niveau.');
    assert.ok(groupUi.primaryCurrencyCards > 0, 'Les indicateurs principaux par devise doivent être visibles.');
    assert.equal(groupUi.secondaryMetricDisclosure, groupUi.primaryCurrencyCards, 'Les indicateurs secondaires doivent être regroupés dans des sections dépliables.');
    assert.equal(groupUi.skipLink, true, 'Un lien de saut vers le contenu principal doit être disponible.');
    assert.equal(groupUi.mainLandmark, true, 'La page doit exposer un repère de contenu principal.');
  }
  if (pageDefinition.name === 'professionnel') {
    const workspaceUi = await page.evaluate(() => {
      const links = [...document.querySelectorAll('#pro-sections a[href^="#"]')];
      return {
        linkCount: links.length,
        targets: links.map(link => Boolean(document.querySelector(link.getAttribute('href')))),
        mainLandmark: Boolean(document.querySelector('main#main-content')),
        skipLink: Boolean(document.querySelector('.workspace-skip-link[href="#main-content"]')),
        moduleRegion: Boolean(document.querySelector('#pro-modules[role="region"][aria-label]'))
      };
    });
    assert.equal(workspaceUi.linkCount, 9, 'Les neuf outils professionnels doivent être accessibles depuis la navigation rapide.');
    assert.ok(workspaceUi.targets.every(Boolean), 'Chaque accès rapide doit pointer vers un module existant.');
    assert.equal(workspaceUi.mainLandmark, true, 'L’espace professionnel doit exposer un repère de contenu principal.');
    assert.equal(workspaceUi.skipLink, true, 'L’espace professionnel doit proposer un lien de saut au contenu.');
    assert.equal(workspaceUi.moduleRegion, true, 'Les modules doivent être regroupés dans une région nommée.');
  }
  if (pageDefinition.name === 'invitation') {
    const invitationUi = await page.evaluate(() => ({
      title: document.querySelector('#invite-content h1')?.textContent.trim() || '',
      liveRegion: document.getElementById('invite-content')?.getAttribute('aria-live') || null,
      atomic: document.getElementById('invite-content')?.getAttribute('aria-atomic') || null,
      acceptButton: Boolean(document.getElementById('accept-invite')),
      tokenStored: Boolean(sessionStorage.getItem('sf_company_group_invitation_token')),
      queryCleaned: !location.search.includes('token=')
    }));
    assert.equal(invitationUi.title, 'Rejoindre un groupe de sociétés', 'La page doit montrer le parcours de confirmation d’invitation.');
    assert.equal(invitationUi.liveRegion, 'polite', 'Le contenu dynamique de l’invitation doit être annoncé.');
    assert.equal(invitationUi.atomic, 'true', 'Le lecteur d’écran doit annoncer le message complet.');
    assert.equal(invitationUi.acceptButton, true, 'Le destinataire doit pouvoir lancer la confirmation.');
    assert.equal(invitationUi.tokenStored, true, 'Le jeton doit rester dans sessionStorage pendant le parcours.');
    assert.equal(invitationUi.queryCleaned, true, 'Le jeton ne doit pas rester dans la barre d’adresse.');
  }
  if (pageDefinition.charts?.length) {
    await page.waitForFunction((chartIds) => chartIds.every((id) => {
      const canvas = document.getElementById(id);
      return canvas?.dataset.sfChartType && canvas.dataset.sfChartAnimation === 'disabled';
    }), { timeout: 15000 }, pageDefinition.charts);
  }

  if (!pageDefinition.public) {
    const accessibilityBaseline = await page.evaluate(() => {
      const visible = element => {
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' &&
          style.opacity !== '0' && element.getClientRects().length > 0 &&
          !element.closest('[aria-hidden="true"]');
      };
      const hasText = value => typeof value === 'string' && value.trim().length > 0;
      const hasName = element => {
        if (hasText(element.getAttribute('aria-label'))) return true;
        const labelledBy = (element.getAttribute('aria-labelledby') || '')
          .split(/\\s+/).filter(Boolean);
        if (labelledBy.some(id => hasText(document.getElementById(id)?.textContent))) return true;
        if (hasText(element.getAttribute('title'))) return true;
        if (element.matches('input, select, textarea')) {
          const id = element.id;
          const associated = id && document.querySelector('label[for="' + CSS.escape(id) + '"]');
          if (hasText(associated?.textContent) || hasText(element.closest('label')?.textContent)) return true;
          if (/^(button|submit|reset)$/i.test(element.type || '') && hasText(element.value)) return true;
          return false;
        }
        if (hasText(element.textContent)) return true;
        return Array.from(element.querySelectorAll('img[alt], svg[aria-label], svg title'))
          .some(child => hasText(child.getAttribute('alt')) ||
            hasText(child.getAttribute('aria-label')) || hasText(child.textContent));
      };
      const interactive = Array.from(document.querySelectorAll(
        'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"]'
      )).filter(visible);
      const imagesMissingAlt = Array.from(document.images)
        .filter(image => visible(image) && !image.hasAttribute('alt'))
        .map(image => image.currentSrc || image.src || 'image sans source')
        .slice(0, 20);
      const positiveTabIndex = Array.from(document.querySelectorAll('[tabindex]'))
        .filter(element => visible(element) && Number(element.getAttribute('tabindex')) > 0)
        .map(element => element.tagName.toLowerCase() + (element.id ? '#' + element.id : ''))
        .slice(0, 20);
      return {
        language: Boolean(document.documentElement.lang.trim()),
        visibleH1: Array.from(document.querySelectorAll('h1')).filter(visible).length,
        unlabeledControls: interactive.filter(element => !hasName(element))
          .map(element => element.tagName.toLowerCase() + (element.id ? '#' + element.id : '') +
            (element.className && typeof element.className === 'string' ? '.' + element.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''))
          .slice(0, 30),
        imagesMissingAlt,
        positiveTabIndex
      };
    });
    assert.equal(accessibilityBaseline.language, true,
      pageDefinition.name + ' doit déclarer la langue du document.');
    assert.ok(accessibilityBaseline.visibleH1 >= 1,
      pageDefinition.name + ' doit fournir un titre principal visible.');
    assert.deepEqual(accessibilityBaseline.unlabeledControls, [],
      pageDefinition.name + ' contient des contrôles interactifs sans nom accessible : ' +
      JSON.stringify(accessibilityBaseline.unlabeledControls));
    assert.deepEqual(accessibilityBaseline.imagesMissingAlt, [],
      pageDefinition.name + ' contient des images visibles sans attribut alt : ' +
      JSON.stringify(accessibilityBaseline.imagesMissingAlt));
    assert.deepEqual(accessibilityBaseline.positiveTabIndex, [],
      pageDefinition.name + ' contient des tabindex positifs qui perturbent l’ordre de tabulation : ' +
      JSON.stringify(accessibilityBaseline.positiveTabIndex));
  }
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await new Promise((resolve) => setTimeout(resolve, 120));

  if (pageDefinition.name === 'abonnement') {
    const subscriptionUi = await page.evaluate(() => ({
      planCards: document.querySelectorAll('#plan-cards .subscription-plan-card').length,
      planIcons: document.querySelectorAll('#plan-cards .plan-icon svg.icon').length,
      headerIcon: Boolean(document.querySelector('.subscription-eyebrow .ic > svg.icon')),
      currentPlanIcon: Boolean(document.querySelector('.subscription-current-icon .ic > svg.icon')),
      billingIcon: Boolean(document.querySelector('.subscription-billing-note .ic > svg.icon')),
      trustIcons: document.querySelectorAll('.subscription-trust > div > .ic > svg.icon').length,
      checkoutCloseIcon: Boolean(document.querySelector('.subscription-checkout-close .ic > svg.icon')),
      fallbackInfoIcon: Boolean(document.querySelector('.subscription-test-heading .ic > svg.icon')),
      activeMenuIcon: Boolean(document.querySelector('#app-navigation .nav-item.active[href="abonnement.html"] .ic svg.icon')),
      unhydratedIcons: document.querySelectorAll('.page-abonnement i[data-icon]').length,
      rawPlaceholders: (document.querySelector('.page-abonnement')?.innerText || '').includes('${Icon(')
    }));
    assert.equal(subscriptionUi.planCards, 4,
      'La page Abonnement doit afficher les quatre formules : ' + JSON.stringify(subscriptionUi));
    assert.equal(subscriptionUi.planIcons, 4,
      'Chaque formule doit afficher son icône SVG.');
    assert.equal(subscriptionUi.headerIcon, true,
      'Le titre Abonnement doit afficher une icône SVG.');
    assert.equal(subscriptionUi.currentPlanIcon, true,
      'La formule active doit afficher une icône SVG valide.');
    assert.equal(subscriptionUi.billingIcon, true,
      'Le mode de paiement doit afficher son icône SVG.');
    assert.equal(subscriptionUi.trustIcons, 3,
      'Les trois garanties doivent afficher leurs icônes SVG.');
    assert.equal(subscriptionUi.checkoutCloseIcon, true,
      'La fenêtre de paiement doit afficher une icône de fermeture.');
    assert.equal(subscriptionUi.fallbackInfoIcon, true,
      'Le mode sans paiement doit afficher son icône d’information.');
    assert.equal(subscriptionUi.activeMenuIcon, true,
      'L’entrée Abonnement du menu doit afficher son icône portefeuille.');
    assert.equal(subscriptionUi.unhydratedIcons, 0,
      'Toutes les icônes statiques doivent être hydratées en SVG.');
    assert.equal(subscriptionUi.rawPlaceholders, false,
      'Aucun placeholder JavaScript brut ne doit apparaître dans la page.');
  }

  if (!pageDefinition.public && viewport.width >= 901) {
    const geometry = await page.evaluate(() => ({
      sidebarRight: Math.round(document.getElementById('app-sidebar')?.getBoundingClientRect().right || 0),
      headingLeft: Math.round(document.querySelector('main.workspace-page h1')?.getBoundingClientRect().left || 0)
    }));
    assert.ok(geometry.headingLeft >= geometry.sidebarRight + 24,
      pageDefinition.name + ' : le titre ne doit pas passer sous le rail latéral. ' + JSON.stringify(geometry));
  }

  if (!pageDefinition.public) {
    const shell = await page.evaluate(() => ({
      toolbar: Boolean(document.querySelector('.app-topbar')),
      search: Boolean(document.querySelector('.app-topbar-search input#workspace-search')),
      notificationBell: Boolean(document.querySelector('#workspace-notification-toggle .ic svg')),
      notificationPanel: Boolean(document.querySelector('#workspace-notification-panel[hidden]')),
      sidebar: Boolean(document.querySelector('#app-sidebar')),
      activeNavigation: Boolean(document.querySelector('#app-navigation .nav-item.active') || document.querySelector('.app-topbar-localization[aria-current="page"]')),
      activeNavigationCurrent: !document.querySelector('#app-navigation .nav-item.active') ||
        document.querySelector('#app-navigation .nav-item.active')?.getAttribute('aria-current') === 'page',
      desktopToggleControls: Boolean(document.querySelector('#sidebar-collapse-toggle[aria-controls="app-navigation"]'))
    }));
    assert.equal(shell.toolbar, true, pageDefinition.name + ' doit afficher la barre supérieure commune.');
    assert.equal(shell.search, true, pageDefinition.name + ' doit afficher la recherche globale.');
    assert.equal(shell.notificationBell, true, pageDefinition.name + ' doit afficher la cloche de notifications.');
    assert.equal(shell.notificationPanel, true, pageDefinition.name + ' doit garder le panneau fermé au chargement.');
    assert.equal(shell.sidebar, true, pageDefinition.name + ' doit afficher la navigation latérale.');
    assert.equal(shell.activeNavigation, true, pageDefinition.name + ' doit signaler la page active.');
    assert.equal(shell.activeNavigationCurrent, true,
      pageDefinition.name + ' doit exposer aria-current="page" sur le lien actif.');
    assert.equal(shell.desktopToggleControls, true,
      pageDefinition.name + ' doit associer le bouton de menu à la navigation contrôlée.');
  }

  const layoutAudit = await page.evaluate(() => {
    const main = document.querySelector('main.workspace-page');
    const hasHeader = Boolean(main?.querySelector(':scope > .page-header, :scope > .workspace-page-header, :scope > .dashboard-welcome'));
    const hasKicker = Boolean(main?.querySelector('.workspace-page-kicker, .pro-eyebrow, .billing-eyebrow, .subscription-eyebrow'));
    const unhydratedIcons = Array.from(document.querySelectorAll('i[data-icon]'))
      .map(element => element.getAttribute('data-icon'));
    const navigationItems = Array.from(document.querySelectorAll('#app-navigation .nav-item'));
    const navigationIcons = Array.from(document.querySelectorAll('#app-navigation .nav-item > .ic > svg.icon'));
    const navigationIconsLegible = navigationIcons.length > 0 && navigationIcons.every(icon => {
      const style = getComputedStyle(icon);
      return Number.parseFloat(style.width) >= 23 &&
        Number.parseFloat(style.height) >= 23 &&
        Number.parseFloat(style.strokeWidth) >= 1.8;
    });
    const navigationLogo = document.querySelector('#app-sidebar .sidebar-brand .mark');
    const navigationLogoSize = navigationLogo
      ? Math.min(navigationLogo.getBoundingClientRect().width, navigationLogo.getBoundingClientRect().height)
      : 0;
    return {
      workspacePage: Boolean(main),
      hasHeader,
      hasKicker,
      dataHeading: Boolean(main?.querySelector('.workspace-data-heading')),
      filterPanel: Boolean(main?.querySelector('.workspace-filter-card')),
      unhydratedIcons,
      navigationItemCount: navigationItems.length,
      navigationIconCount: navigationIcons.length,
      navigationItemsWithoutIcon: navigationItems
        .filter(item => !item.querySelector(':scope > .ic > svg.icon'))
        .map(item => item.textContent.trim()),
      navigationIconsLegible,
      navigationLogoSize,
      headingFont: getComputedStyle(document.querySelector('h1')).fontFamily,
      bodyFont: getComputedStyle(document.body).fontFamily
    };
  });
  const structuredPages = ['dashboard', 'clients', 'produits', 'factures', 'factures-recurrentes', 'devis', 'depenses', 'rapports', 'finances', 'crm', 'internationalisation', 'automatisations', 'nouvelle-facture', 'abonnement'];
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
  if (!pageDefinition.public) {
    assert.ok(layoutAudit.navigationItemCount > 0,
      pageDefinition.name + ' doit présenter des entrées de navigation.');
    assert.equal(layoutAudit.navigationIconCount, layoutAudit.navigationItemCount,
      pageDefinition.name + ' : chaque entrée du menu doit avoir une icône SVG valide. ' +
      JSON.stringify(layoutAudit.navigationItemsWithoutIcon));
    assert.deepEqual(layoutAudit.navigationItemsWithoutIcon, [],
      pageDefinition.name + ' contient des entrées sans icône : ' +
      JSON.stringify(layoutAudit.navigationItemsWithoutIcon));
    assert.equal(layoutAudit.navigationIconsLegible, true,
      pageDefinition.name + ' : les icônes de navigation doivent mesurer au moins 23 px avec un trait de 1,8.');
    assert.ok(layoutAudit.navigationLogoSize >= 50,
      pageDefinition.name + ' : le logo de navigation doit mesurer au moins 50 px. Taille mesurée : ' +
      layoutAudit.navigationLogoSize); 
  }

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
      firstContentWidth: main?.querySelector('.dashboard-welcome, .page-header, .workspace-page-header')
        ? Math.round(main.querySelector('.dashboard-welcome, .page-header, .workspace-page-header').getBoundingClientRect().width)
        : null,
      contentPaddingLeft: main ? Math.round(parseFloat(getComputedStyle(main).paddingLeft) || 0) : null,
      expectedCompactWidth: getComputedStyle(document.documentElement).getPropertyValue('--sidebar-collapsed-w').trim(),
      enterpriseToolbar: (() => {
        const toolbar = document.querySelector('.enterprise-console-topbar');
        const heading = document.querySelector('.enterprise-dashboard-heading');
        if (!toolbar || !heading) return null;
        const toolbarRect = toolbar.getBoundingClientRect();
        const headingRect = heading.getBoundingClientRect();
        const directChildren = Array.from(toolbar.children).map(element => {
          const rect = element.getBoundingClientRect();
          return {
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom)
          };
        });
        return {
          height: Math.round(toolbarRect.height),
          bottom: Math.round(toolbarRect.bottom),
          headingTop: Math.round(headingRect.top),
          flexWrap: getComputedStyle(toolbar).flexWrap,
          directChildren
        };
      })()
    };
  });
  if (!pageDefinition.public && viewport.width >= 901) {
    assert.equal(navigationGeometry.sidebarCollapsed, true,
      pageDefinition.name + ' : le menu de bureau doit démarrer compact.');
    const compactWidth = Number.parseFloat(navigationGeometry.expectedCompactWidth);
    assert.equal(navigationGeometry.sidebarWidth, compactWidth,
      pageDefinition.name + ' : le rail desktop doit respecter sa largeur responsive : ' + JSON.stringify(navigationGeometry));
    assert.equal(navigationGeometry.mainMargin, compactWidth,
      pageDefinition.name + ' : la marge du contenu doit suivre exactement la largeur du rail : ' + JSON.stringify(navigationGeometry));
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


  if (pageDefinition.name === 'groupe-entreprise' && viewport.width >= 901 && viewport.width <= 1100) {
    const toolbar = navigationGeometry.enterpriseToolbar;
    assert.ok(toolbar, 'Le centre Entreprise doit exposer son bandeau supérieur.');
    assert.equal(toolbar.flexWrap, 'nowrap',
      'Le bandeau du centre Entreprise doit rester sur une seule rangée à ' + viewport.width + 'px : ' + JSON.stringify(toolbar));
    assert.ok(toolbar.height <= 56,
      'Le bandeau du centre Entreprise ne doit pas grandir sur deux rangées : ' + JSON.stringify(toolbar));
    assert.ok(toolbar.headingTop >= toolbar.bottom + 12,
      'Le titre Entreprise doit conserver un espace sous le bandeau : ' + JSON.stringify(toolbar));
    assert.ok(toolbar.directChildren.every(child =>
      child.top >= 0 && child.bottom <= toolbar.height + 1 &&
      child.left >= 0 && child.right <= viewport.width + 1
    ), 'Les commandes du bandeau doivent rester dans sa rangée visible : ' + JSON.stringify(toolbar));
  }

  if (!pageDefinition.public && viewport.width >= 1900) {
    assert.ok(navigationGeometry.firstContentWidth <= 1721,
      pageDefinition.name + ' : le contenu métier doit être borné à 1 720 px sur écran ultra-large : ' +
      JSON.stringify(navigationGeometry));
    assert.ok(navigationGeometry.firstContentLeft > navigationGeometry.mainLeft + 40,
      pageDefinition.name + ' : les blocs doivent être centrés dans la zone de travail ultra-large : ' +
      JSON.stringify(navigationGeometry));
  }

  const metrics = await page.evaluate(() => {
    const uncontainedTables = Array.from(document.querySelectorAll('table')).filter((table) => {
      if (table.getBoundingClientRect().width <= (table.parentElement?.getBoundingClientRect().width || 0) + 1) return false;
      let ancestor = table.parentElement;
      while (ancestor && ancestor !== document.body) {
        const style = getComputedStyle(ancestor);
        if (ancestor.scrollWidth > ancestor.clientWidth + 1 &&
            /^(auto|scroll|overlay)$/.test(style.overflowX)) return false;
        ancestor = ancestor.parentElement;
      }
      return true;
    }).map((table) => table.getAttribute('aria-label') || table.id || table.className || 'table')
      .slice(0, 12);
    const overflowElements = Array.from(document.body.querySelectorAll('*')).map((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const selector = element.tagName.toLowerCase() +
        (element.id ? '#' + element.id : '') +
        (typeof element.className === 'string' && element.className.trim()
          ? '.' + element.className.trim().split(/\s+/).slice(0, 3).join('.')
          : '');
      return {
        selector,
        left: Math.round(rect.left * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
        position: style.position,
        overflowX: style.overflowX
      };
    }).filter((item) => item.width > 0 &&
      (item.right > window.innerWidth + 1 || item.left < -1) &&
      item.position !== 'fixed' && item.position !== 'sticky')
      .sort((a, b) => b.right - a.right)
      .slice(0, 16);
    return {
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      page: location.pathname,
      xssMarker: window.__visualXss || false,
      paymentLabels: location.pathname.includes('dashboard') && window.innerWidth <= 640
        ? Array.from(document.querySelectorAll('#paiements-body tr:not(.row-skeleton):first-child td')).map(cell => cell.dataset.label || '')
        : null,
      proWorkspaceNavigation: location.pathname.includes('professionnel')
        ? (() => {
            const guide = document.querySelector('.pro-workspace-guide');
            const rect = guide?.getBoundingClientRect();
            const links = Array.from(document.querySelectorAll('.pro-workspace-guide a[href^="#"]'));
            return {
              found: Boolean(guide),
              left: rect ? rect.left : -1,
              right: rect ? rect.right : window.innerWidth + 1,
              width: rect ? rect.width : 0,
              linkCount: links.length,
              missingTargets: links.filter(link => !document.getElementById(link.getAttribute('href').slice(1)))
                .map(link => link.getAttribute('href')),
              groupCount: document.querySelectorAll('.pro-workspace-guide-group').length
            };
          })()
        : null,
      invoiceTemplateGallery: location.pathname.includes('parametres')
        ? (() => {
            const gallery = document.getElementById('invoice-template-gallery');
            const rect = gallery?.getBoundingClientRect();
            const cards = Array.from(document.querySelectorAll('[data-template-card]'));
            const triggers = Array.from(document.querySelectorAll('[data-open-template-preview]'));
            return {
              found: Boolean(gallery),
              count: cards.length,
              triggers: triggers.length,
              width: rect ? rect.width : 0,
              left: rect ? rect.left : -1,
              right: rect ? rect.right : window.innerWidth + 1,
              cardWidths: cards.slice(0, 3).map(card => Math.round(card.getBoundingClientRect().width))
            };
          })()
        : null,
      invoiceLineLayout: location.pathname.includes('nouvelle-facture') && window.innerWidth <= 640
        ? (() => {
            const table = document.querySelector('.invoice-lines-table');
            const wrapper = table?.closest('.invoice-lines-container');
            const row = table?.querySelector('tbody tr');
            const designation = row?.querySelector('.ligne-designation');
            const quantity = row?.querySelector('.ligne-qte');
            if (!table || !wrapper || !row || !designation || !quantity) return { found: false };
            const designationRect = designation.getBoundingClientRect();
            const quantityRect = quantity.getBoundingClientRect();
            const overlaps = !(designationRect.right <= quantityRect.left ||
              designationRect.left >= quantityRect.right ||
              designationRect.bottom <= quantityRect.top ||
              designationRect.top >= quantityRect.bottom);
            return {
              found: true,
              tableWidth: table.getBoundingClientRect().width,
              wrapperWidth: wrapper.getBoundingClientRect().width,
              scrollWidth: wrapper.scrollWidth,
              clientWidth: wrapper.clientWidth,
              overlaps,
              sameCell: designation.closest('td') === quantity.closest('td'),
              designationColumnWidth: designation.closest('td').getBoundingClientRect().width,
              quantityColumnWidth: quantity.closest('td').getBoundingClientRect().width,
              quantityLabel: quantity.closest('td').dataset.label || ''
            };
          })()
        : null,
      uncontainedTables,
      missingNavigationIcons: Array.from(document.querySelectorAll('.sidebar .nav-item')).filter((item) => {
        const svg = item.querySelector('.ic svg');
        return !svg || svg.getAttribute('viewBox') !== '0 0 24 24';
      }).map((item) => item.getAttribute('aria-label') || item.textContent.trim()).slice(0, 20),
      overflowElements
    };
  });
  if (metrics.document > metrics.viewport + 1 || metrics.body > metrics.viewport + 1) {
    await page.screenshot({
      path: path.join(screenshots, 'overflow-' + pageDefinition.name + '-' + viewport.name + '.png'),
      fullPage: true,
      captureBeyondViewport: true
    });
  }
  assert.ok(metrics.document <= metrics.viewport + 1,
    pageDefinition.name + ' déborde horizontalement à ' + viewport.width + 'px: ' + JSON.stringify(metrics));
  assert.ok(metrics.body <= metrics.viewport + 1,
    pageDefinition.name + ' élargit le body à ' + viewport.width + 'px: ' + JSON.stringify(metrics));
  assert.deepEqual(metrics.uncontainedTables, [],
    pageDefinition.name + ' : un tableau trop large doit défiler dans sa carte, sans élargir la page : ' +
    JSON.stringify(metrics.uncontainedTables));
  assert.deepEqual(metrics.missingNavigationIcons, [],
    pageDefinition.name + ' : toutes les entrées du menu doivent afficher une icône SVG reconnue : ' +
    JSON.stringify(metrics.missingNavigationIcons));
  if (pageDefinition.name === 'professionnel') {
    const nav = metrics.proWorkspaceNavigation;
    assert.equal(nav?.found, true, 'L’espace professionnel doit présenter une navigation par activité.');
    assert.equal(nav.groupCount, 4, 'Les outils professionnels doivent être rangés en quatre rubriques.');
    assert.equal(nav.linkCount, 9, 'Les neuf modules professionnels doivent être accessibles depuis la navigation.');
    assert.deepEqual(nav.missingTargets, [], 'Chaque accès rapide doit pointer vers un module existant.');
    assert.ok(nav.left >= -1 && nav.right <= metrics.viewport + 1,
      'La navigation professionnelle ne doit pas sortir de l’écran : ' + JSON.stringify(nav));
    if (viewport.width <= 560) {
      const gridColumns = await page.$eval('.pro-workspace-guide-grid', element => getComputedStyle(element).gridTemplateColumns);
      assert.equal(gridColumns.split(' ').length, 1,
        'Les rubriques professionnelles doivent s’empiler sur téléphone : ' + gridColumns);
    }
    if (viewport.width === 1440) {
      await page.click('.pro-workspace-guide a[href="#pro-integrations"]');
      assert.equal(await page.evaluate(() => location.hash), '#pro-integrations',
        'Les accès rapides doivent naviguer jusqu’au module choisi.');
    }
  }
  if (pageDefinition.name === 'parametres') {
    const gallery = metrics.invoiceTemplateGallery;
    assert.equal(gallery?.found, true, 'La galerie de modèles doit être présente dans les paramètres.');
    assert.equal(gallery.count, 31, 'Les 31 modèles de facture doivent être visibles.');
    assert.equal(gallery.triggers, 31, 'Chaque modèle doit proposer un aperçu A4 cliquable.');
    assert.ok(gallery.left >= -1 && gallery.right <= metrics.viewport + 1,
      'La galerie des modèles ne doit pas déborder de l’écran : ' + JSON.stringify(gallery));
    if (viewport.width <= 640) {
      assert.ok(gallery.cardWidths.every(width => width >= Math.min(260, metrics.viewport - 36)),
        'Les aperçus de modèles doivent rester assez larges sur mobile : ' + JSON.stringify(gallery));
    }
  }
  if (pageDefinition.name === 'nouvelle-facture' && viewport.width <= 640) {
    const layout = metrics.invoiceLineLayout;
    assert.equal(layout?.found, true,
      'La ligne d’article doit afficher ses champs à ' + viewport.width + 'px.');
    assert.equal(layout.sameCell, false,
      'La désignation et la quantité doivent rester dans deux cellules distinctes : ' + JSON.stringify(layout));
    assert.equal(layout.overlaps, false,
      'Les champs désignation et quantité ne doivent jamais se chevaucher : ' + JSON.stringify(layout));
    assert.ok(layout.designationColumnWidth >= 180 && layout.quantityColumnWidth >= 75,
      'Les champs doivent conserver une largeur utilisable dans la fiche mobile : ' + JSON.stringify(layout));
    assert.equal(layout.quantityLabel, 'Quantité',
      'Le champ quantité doit garder son libellé sur mobile : ' + JSON.stringify(layout));
    const accessibleLineFields = await page.$eval('.invoice-lines-table tbody tr', row => {
      const fields = [
        ['.ligne-designation', 'Désignation'],
        ['.ligne-qte', 'Quantité'],
        ['.ligne-pu', 'Prix unitaire en FCFA'],
        ['.ligne-tva', 'TVA en pourcentage']
      ];
      return fields.map(([selector, expected]) => {
        const input = row.querySelector(selector);
        return {
          id: input?.id || '',
          label: input?.labels ? Array.from(input.labels).map(label => label.textContent.trim()).join(' ') : '',
          expected
        };
      });
    });
    assert.ok(accessibleLineFields.every(field => field.id && field.label === field.expected),
      'Chaque champ d’article doit posséder un label HTML associé : ' + JSON.stringify(accessibleLineFields));
    assert.ok(layout.tableWidth <= layout.wrapperWidth + 1 &&
      layout.scrollWidth <= layout.clientWidth + 1,
      'La fiche article doit tenir sur la largeur du téléphone, sans défilement latéral : ' +
      JSON.stringify(layout));
  }
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

  if (pageDefinition.name === 'parametres' && [320, 1440].includes(viewport.width)) {
    await page.waitForSelector('[data-open-template-preview="nova"]', { timeout: 15000 });
    const dialogSemantics = await page.$eval('#invoice-template-preview-modal', modal => ({
      role: modal.getAttribute('role'),
      modal: modal.getAttribute('aria-modal'),
      labelledBy: modal.getAttribute('aria-labelledby'),
      describedBy: modal.getAttribute('aria-describedby'),
      heading: document.getElementById(modal.getAttribute('aria-labelledby'))?.textContent.trim(),
      description: document.getElementById(modal.getAttribute('aria-describedby'))?.textContent.trim()
    }));
    assert.deepEqual(dialogSemantics, {
      role: 'dialog',
      modal: 'true',
      labelledBy: 'invoice-template-preview-name',
      describedBy: 'invoice-template-preview-description',
      heading: 'Modèle de facture',
      description: 'Exemple avec les informations de votre entreprise.'
    }, 'La fenêtre d’aperçu doit exposer un nom et une description aux technologies d’assistance.');

    await page.click('[data-open-template-preview="nova"]');
    await page.waitForFunction(() => {
      const modal = document.getElementById('invoice-template-preview-modal');
      return modal && getComputedStyle(modal).display !== 'none';
    }, { timeout: 5000 });
    await page.waitForFunction(() =>
      document.activeElement?.id === 'invoice-template-preview-close'
    );
    const initialDialogFocus = await page.evaluate(() => document.activeElement?.id || '');
    assert.equal(initialDialogFocus, 'invoice-template-preview-close',
      'À l’ouverture, le focus clavier doit entrer dans la fenêtre d’aperçu.');

    const fittedPreview = await page.evaluate(() => {
      const modal = document.getElementById('invoice-template-preview-modal');
      const stage = document.getElementById('invoice-template-preview-stage');
      const wrapper = document.getElementById('invoice-template-preview-scaled');
      const page = document.getElementById('invoice-template-preview-document');
      const modalRect = modal.getBoundingClientRect();
      return {
        modalLeft: modalRect.left,
        modalRight: modalRect.right,
        modalTop: modalRect.top,
        modalBottom: modalRect.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        stageWidth: stage.clientWidth,
        wrapperWidth: wrapper.getBoundingClientRect().width,
        wrapperHeight: wrapper.getBoundingClientRect().height,
        pageWidth: page.offsetWidth,
        pageHeight: page.offsetHeight,
        zoom: document.getElementById('invoice-template-preview-zoom-level').textContent
      };
    });
    assert.ok(fittedPreview.modalLeft >= -1 && fittedPreview.modalRight <= fittedPreview.viewportWidth + 1 &&
      fittedPreview.modalTop >= -1 && fittedPreview.modalBottom <= fittedPreview.viewportHeight + 1,
      'La fenêtre d’aperçu A4 doit rester dans l’écran : ' + JSON.stringify(fittedPreview));
    assert.ok(fittedPreview.wrapperWidth <= fittedPreview.stageWidth + 1 &&
      fittedPreview.pageWidth === 794 && fittedPreview.pageHeight >= 1123,
      'L’aperçu doit afficher la vraie feuille A4 à une échelle adaptée : ' + JSON.stringify(fittedPreview));

    await page.click('#invoice-template-preview-quote');
    const quotePreview = await page.evaluate(() => ({
      heading: document.getElementById('invoice-template-preview-name').textContent,
      numberVisible: document.getElementById('invoice-template-preview-document').textContent.includes('DEV-APERÇU-001'),
      quoteSelected: document.getElementById('invoice-template-preview-quote').getAttribute('aria-pressed')
    }));
    assert.ok(quotePreview.heading.includes('Devis') && quotePreview.numberVisible &&
      quotePreview.quoteSelected === 'true',
      'Le bouton Devis doit afficher un vrai aperçu de devis : ' + JSON.stringify(quotePreview));

    const zoomBefore = await page.$eval('#invoice-template-preview-scaled', element => element.getBoundingClientRect().width);
    await page.click('#invoice-template-preview-zoom-in');
    const zoomAfter = await page.$eval('#invoice-template-preview-scaled', element => element.getBoundingClientRect().width);
    assert.ok(zoomAfter > zoomBefore + 20,
      'Le contrôle + doit agrandir la feuille A4 : ' + JSON.stringify({ zoomBefore, zoomAfter }));
    await page.click('#invoice-template-preview-zoom-fit');
    await page.click('#invoice-template-preview-use');
    await page.waitForFunction(() =>
      getComputedStyle(document.getElementById('invoice-template-preview-modal')).display === 'none'
    );
    const selection = await page.evaluate(() => ({
      value: document.getElementById('facture_template').value,
      selected: document.querySelector('[data-template-card="nova"]')?.classList.contains('is-selected')
    }));
    assert.deepEqual(selection, { value: 'nova', selected: true },
      'Le bouton Utiliser ce modèle doit actualiser la sélection enregistrable.');

    await page.waitForFunction(() =>
      document.activeElement?.getAttribute('data-open-template-preview') === 'nova'
    );
    const focusAfterSelection = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-open-template-preview') || ''
    );
    assert.equal(focusAfterSelection, 'nova',
      'La fermeture de l’aperçu doit rendre le focus au modèle qui l’a ouvert.');

    await page.click('[data-open-template-preview="nova"]');
    await page.waitForFunction(() =>
      getComputedStyle(document.getElementById('invoice-template-preview-modal')).display !== 'none'
    );
    await page.waitForFunction(() =>
      document.activeElement?.id === 'invoice-template-preview-close'
    );
    await page.keyboard.down('Shift');
    await page.keyboard.press('Tab');
    await page.keyboard.up('Shift');
    assert.equal(await page.evaluate(() => document.activeElement?.id || ''),
      'invoice-template-preview-use',
      'Maj+Tab depuis le premier contrôle doit rester dans la fenêtre et aller au dernier contrôle.');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.id || ''),
      'invoice-template-preview-close',
      'Tab depuis le dernier contrôle doit revenir au premier contrôle.');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() =>
      getComputedStyle(document.getElementById('invoice-template-preview-modal')).display === 'none'
    );
    await page.waitForFunction(() =>
      document.activeElement?.getAttribute('data-open-template-preview') === 'nova'
    );
    const focusAfterEscape = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-open-template-preview') || ''
    );
    assert.equal(focusAfterEscape, 'nova',
      'La touche Échap doit fermer l’aperçu et rendre le focus à son déclencheur.');
  }

  const filename = pageDefinition.name + '-' + viewport.name + '-' + DATASET + '.png';
  await page.screenshot({
    path: path.join(screenshots, filename),
    fullPage: true,
    captureBeyondViewport: true
  });
  if (pageDefinition.name === 'invitation' && viewport.name === 'mobile-320') {
    await page.focus('#accept-invite');
    assert.equal(await page.evaluate(() => document.activeElement?.id || ''), 'accept-invite',
      'Le bouton de confirmation doit être accessible au clavier.');
    await page.click('#accept-invite');
    await page.waitForFunction(() =>
      document.getElementById('invite-content')?.textContent.includes('Vérifiez votre boîte email'),
    { timeout: 15000 });
    const confirmationState = await page.evaluate(() => ({
      heading: document.querySelector('#invite-content h1')?.textContent.trim() || '',
      liveRegion: document.getElementById('invite-content')?.getAttribute('aria-live') || null,
      message: document.getElementById('invite-content')?.innerText || '',
      invitationTokenCleared: !sessionStorage.getItem('sf_company_group_invitation_token')
    }));
    assert.equal(confirmationState.heading, 'Vérifiez votre boîte email',
      'Après acceptation, la page doit annoncer l’étape de confirmation email.');
    assert.equal(confirmationState.liveRegion, 'polite', 'Le changement d’étape doit être annoncé.');
    assert.match(confirmationState.message, /expire après 20 minutes/i,
      'Le destinataire doit être informé de la durée de validité du lien.');
    assert.equal(confirmationState.invitationTokenCleared, true,
      'Le jeton initial doit être supprimé après la demande de preuve email.');
    await page.screenshot({
      path: path.join(screenshots, 'invitation-confirmation-email-mobile-320-' + DATASET + '.png'),
      fullPage: true,
      captureBeyondViewport: true
    });
  }
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
  const pressMatrix = buttonState.transform.match(/^matrix\(([^)]+)\)$/);
  const pressScale = pressMatrix ? pressMatrix[1].split(',').map(Number) : [];
  assert.ok(pressScale.length === 6 &&
    Math.abs(pressScale[0] - 0.97) < 0.002 &&
    Math.abs(pressScale[3] - 0.97) < 0.002 &&
    Math.abs(pressScale[1]) < 0.001 &&
    Math.abs(pressScale[2]) < 0.001,
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

  await reducedPage.setViewport({ width: 320, height: 812, deviceScaleFactor: 1 });
  const longToastMessage = 'Notification importante : une opération nécessite votre attention. ' +
    'Consultez les détails avant de poursuivre. '.repeat(14) +
    'REFERENCE-' + 'X'.repeat(180);
  await reducedPage.evaluate(message => showToast(message, 'info'), longToastMessage);
  await reducedPage.waitForFunction(() => document.querySelectorAll('.toast').length >= 2);
  const longToastLayout = await reducedPage.evaluate(() => {
    const container = document.querySelector('.toast-container');
    const toast = container?.lastElementChild;
    const containerRect = container?.getBoundingClientRect();
    const toastRect = toast?.getBoundingClientRect();
    return {
      viewport: window.innerWidth,
      left: containerRect?.left ?? -1,
      right: containerRect?.right ?? window.innerWidth + 1,
      toastWidth: toast?.clientWidth || 0,
      toastScrollWidth: toast?.scrollWidth || 0,
      toastHeight: toast?.getBoundingClientRect().height || 0,
      toastScrollHeight: toast?.scrollHeight || 0,
      boxRight: toastRect?.right ?? window.innerWidth + 1
    };
  });
  assert.ok(longToastLayout.left >= 0 && longToastLayout.right <= longToastLayout.viewport + 1 &&
    longToastLayout.boxRight <= longToastLayout.viewport + 1,
    'Une notification longue doit rester entièrement dans l’écran à 320 px : ' + JSON.stringify(longToastLayout));
  assert.ok(longToastLayout.toastWidth > 0 &&
    longToastLayout.toastScrollWidth <= longToastLayout.toastWidth + 1,
    'Le texte d’une notification longue doit revenir à la ligne sans être coupé : ' + JSON.stringify(longToastLayout));

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
  // Simule Safari iOS : le clavier réduit le viewport visuel sans réduire
  // window.innerHeight. Le faux VisualViewport reste un EventTarget afin de
  // vérifier aussi le repositionnement déclenché par son événement resize.
  await page.evaluateOnNewDocument(() => {
    const visualViewport = new EventTarget();
    Object.defineProperties(visualViewport, {
      width: { get: () => window.innerWidth },
      height: { get: () => Number.isFinite(window.__sfTestVisualViewportHeight)
        ? window.__sfTestVisualViewportHeight
        : window.innerHeight },
      offsetLeft: { get: () => Number(window.__sfTestVisualViewportOffsetLeft) || 0 },
      offsetTop: { get: () => Number(window.__sfTestVisualViewportOffsetTop) || 0 },
      scale: { get: () => 1 },
      pageLeft: { get: () => window.scrollX },
      pageTop: { get: () => window.scrollY }
    });
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: visualViewport
    });
  });
  const clientRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/clients')) clientRequests.push(request.url());
  });
  await page.setViewport({ width: 320, height: 844, deviceScaleFactor: 1 });
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
  const topbarControls = await page.evaluate(() => {
    const account = document.querySelector('.app-topbar-account');
    const order = Array.from(account?.children || []).map(element => {
      if (element.matches('.app-topbar-avatar')) return 'avatar';
      if (element.matches('.app-notification')) return 'notifications';
      if (element.matches('.app-topbar-quick-actions')) return 'system-and-localization';
      if (element.matches('.app-topbar-logout')) return 'logout';
      return 'identity';
    });
    return {
      order,
      themeButtonCount: document.querySelectorAll('.theme-toggle-btn').length,
      themeButtonInTopbar: Boolean(document.querySelector('.app-topbar-quick-actions .theme-toggle-btn')),
      localizationHref: document.querySelector('.app-topbar-localization')?.getAttribute('href'),
      localizationLabel: document.querySelector('.app-topbar-localization')?.getAttribute('aria-label'),
      localizationTooltip: document.querySelector('.app-topbar-localization')?.getAttribute('data-tooltip'),
      localizationTextVisuallyHidden: (() => {
        const label = document.querySelector('.app-topbar-localization-label');
        const style = label ? getComputedStyle(label) : null;
        return Boolean(style && style.position === 'absolute' && style.width === '1px' && style.height === '1px');
      })(),
      themeInSidebar: Boolean(document.querySelector('.sidebar-theme-control .theme-toggle-btn')),
      localizationInSidebar: Boolean(document.querySelector('#app-navigation a[href="internationalisation.html"]'))
    };
  });
  assert.deepEqual(topbarControls, {
    order: ['avatar', 'identity', 'notifications', 'system-and-localization', 'logout'],
    themeButtonCount: 1,
    themeButtonInTopbar: true,
    localizationHref: 'internationalisation.html',
    localizationLabel: 'Pays, langue et devise',
    localizationTooltip: 'Pays, langue et devise',
    localizationTextVisuallyHidden: true,
    themeInSidebar: false,
    localizationInSidebar: false
  }, 'Le bouton Système et l’accès Pays, langue & devise doivent être placés entre Notifications et Déconnexion dans la barre supérieure.');
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

  // Simule un clavier virtuel qui réduit le viewport visuel à 180 px alors
  // que le viewport de mise en page reste à 844 px (cas rencontré sur iOS Safari).
  await page.evaluate(() => closeWorkspaceNotifications());
  await page.setViewport({ width: 320, height: 844, deviceScaleFactor: 1 });
  await page.evaluate(() => {
    const toggle = document.getElementById('workspace-notification-toggle');
    toggle.style.position = 'fixed';
    toggle.style.top = '0px';
    toggle.style.right = '12px';
    for (let i = 0; i < 20; i++) {
      pushWorkspaceNotification('Notification de test ' + i,
        'Message long pour remplir la liste et vérifier le défilement dans un écran mobile de faible hauteur.',
        'info');
    }
  });
  await page.evaluate(() => {
    closeWorkspaceNotifications();
    toggleWorkspaceNotifications();
    window.__sfTestVisualViewportHeight = 180;
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  assert.equal(await page.$eval('#workspace-notification-panel', element => !element.hidden), true,
    'Le panneau doit être ouvert avant de vérifier ses limites.');
  const shortViewportPanel = await page.$eval('#workspace-notification-panel', element => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top, bottom: rect.bottom,
      left: rect.left, right: rect.right,
      visualViewportHeight: window.visualViewport.height,
      visualViewportWidth: window.visualViewport.width,
      layoutViewportHeight: window.innerHeight,
      height: rect.height
    };
  });
  assert.ok(shortViewportPanel.layoutViewportHeight > shortViewportPanel.visualViewportHeight,
    'Le test doit distinguer le viewport visuel du viewport de mise en page.');
  assert.ok(
    shortViewportPanel.top >= 0 &&
    shortViewportPanel.bottom <= shortViewportPanel.visualViewportHeight + 1 &&
    shortViewportPanel.left >= 0 &&
    shortViewportPanel.right <= shortViewportPanel.visualViewportWidth + 1,
    'Le panneau de notifications doit rester entièrement dans le viewport visuel réduit : ' + JSON.stringify(shortViewportPanel)
  );
  assert.ok(shortViewportPanel.height > 0,
    'Le panneau ne doit pas devenir invisible dans un viewport visuel réduit.');
  const shortViewportScroll = await page.$eval('#workspace-notification-panel', element => {
    const list = element.querySelector('.app-notification-list');
    return { clientHeight: list.clientHeight, scrollHeight: list.scrollHeight };
  });
  assert.ok(shortViewportScroll.clientHeight > 0 && shortViewportScroll.scrollHeight > shortViewportScroll.clientHeight,
    'La liste doit conserver un défilement interne lorsque le panneau est réduit : ' + JSON.stringify(shortViewportScroll));

  // Vérifie aussi les coordonnées non nulles du viewport visuel, par exemple
  // après un défilement ou un zoom pendant que le clavier reste ouvert.
  await page.evaluate(() => {
    window.__sfTestVisualViewportOffsetTop = 96;
    window.__sfTestVisualViewportOffsetLeft = 24;
    const toggle = document.getElementById('workspace-notification-toggle');
    toggle.style.top = '120px';
    window.visualViewport.dispatchEvent(new Event('scroll'));
  });
  const offsetViewportPanel = await page.$eval('#workspace-notification-panel', element => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      viewportTop: window.visualViewport.offsetTop,
      viewportLeft: window.visualViewport.offsetLeft,
      viewportBottom: window.visualViewport.offsetTop + window.visualViewport.height,
      viewportRight: window.visualViewport.offsetLeft + window.visualViewport.width
    };
  });
  assert.ok(offsetViewportPanel.top >= offsetViewportPanel.viewportTop,
    'Le panneau doit respecter le décalage vertical du viewport visuel : ' + JSON.stringify(offsetViewportPanel));
  assert.ok(offsetViewportPanel.bottom <= offsetViewportPanel.viewportBottom + 1,
    'Le panneau doit rester sous la limite basse du viewport visuel décalé : ' + JSON.stringify(offsetViewportPanel));
  assert.ok(offsetViewportPanel.left >= offsetViewportPanel.viewportLeft,
    'Le panneau doit respecter le décalage horizontal du viewport visuel : ' + JSON.stringify(offsetViewportPanel));
  assert.ok(offsetViewportPanel.right <= offsetViewportPanel.viewportRight + 1,
    'Le panneau doit rester dans la limite droite du viewport visuel décalé : ' + JSON.stringify(offsetViewportPanel));

  await page.evaluate(() => {
    window.__sfTestVisualViewportHeight = null;
    window.__sfTestVisualViewportOffsetTop = 0;
    window.__sfTestVisualViewportOffsetLeft = 0;
    window.visualViewport.dispatchEvent(new Event('resize'));
    const toggle = document.getElementById('workspace-notification-toggle');
    toggle.style.removeProperty('position');
    toggle.style.removeProperty('top');
    toggle.style.removeProperty('right');
    closeWorkspaceNotifications();
    clearWorkspaceNotifications();
  });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });

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
  await mobile.setViewport({ width: 320, height: 812, deviceScaleFactor: 1 });
  const narrowToolbar = await mobile.evaluate(() => {
    const selectors = [
      '#workspace-notification-toggle',
      '.app-topbar-quick-actions .theme-toggle-btn',
      '.app-topbar-localization',
      '.app-topbar-logout'
    ];
    const controls = selectors.map((selector) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return {
        selector,
        width: rect ? Math.round(rect.width) : 0,
        height: rect ? Math.round(rect.height) : 0,
        left: rect ? Math.round(rect.left) : -1,
        right: rect ? Math.round(rect.right) : window.innerWidth + 1
      };
    });
    const logout = document.querySelector('.app-topbar-logout');
    return {
      controls,
      logoutFontSize: logout ? getComputedStyle(logout).fontSize : null,
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth
    };
  });
  assert.equal(narrowToolbar.logoutFontSize, '0px',
    'Le libellé Déconnexion doit rester masqué sur mobile, sans réduire la cible tactile.');
  assert.ok(narrowToolbar.controls.every((control) =>
    control.width >= 42 && control.height >= 42 &&
    control.left >= 0 && control.right <= narrowToolbar.viewport + 1),
    'Les quatre commandes de la barre supérieure doivent rester visibles et tactiles à 320 px : ' +
      JSON.stringify(narrowToolbar));
  assert.ok(narrowToolbar.documentWidth <= narrowToolbar.viewport + 1,
    'La barre supérieure ne doit pas élargir le document à 320 px : ' + JSON.stringify(narrowToolbar));

  await mobile.click('#workspace-notification-toggle');
  const longNotificationTitle = 'Alerte de règlement et de validation du document pour le compte principal — '.repeat(4);
  const longNotificationBody = ('Une opération demande votre attention : vérifiez la référence, le montant, la date ' +
    'et le statut avant de confirmer cette action dans votre espace de travail. ').repeat(8);
  await mobile.evaluate(({ title, body }) => pushWorkspaceNotification(title, body, 'info'), {
    title: longNotificationTitle,
    body: longNotificationBody
  });
  const longNotificationLayout = await mobile.evaluate(() => {
    const panel = document.getElementById('workspace-notification-panel');
    const list = document.getElementById('workspace-notification-list');
    const toggle = document.getElementById('workspace-notification-toggle');
    const item = list?.querySelector('.app-notification-item');
    const title = item?.querySelector('strong');
    const message = item?.querySelector('p');
    const rect = panel?.getBoundingClientRect();
    const toggleRect = toggle?.getBoundingClientRect();
    return {
      viewport: window.innerWidth,
      left: rect?.left ?? -1,
      right: rect?.right ?? window.innerWidth + 1,
      top: rect?.top ?? -1,
      toggleBottom: toggleRect?.bottom ?? 0,
      panelWidth: panel?.clientWidth || 0,
      panelScrollWidth: panel?.scrollWidth || 0,
      listWidth: list?.clientWidth || 0,
      listScrollWidth: list?.scrollWidth || 0,
      listOverflowY: list ? getComputedStyle(list).overflowY : '',
      titleWidth: title?.clientWidth || 0,
      titleScrollWidth: title?.scrollWidth || 0,
      messageWidth: message?.clientWidth || 0,
      messageScrollWidth: message?.scrollWidth || 0,
      messageHeight: message?.getBoundingClientRect().height || 0
    };
  });
  assert.ok(longNotificationLayout.left >= 0 &&
    longNotificationLayout.right <= longNotificationLayout.viewport + 1,
    'Le panneau de notifications doit rester dans les limites de l’écran : ' + JSON.stringify(longNotificationLayout));
  assert.ok(longNotificationLayout.top >= longNotificationLayout.toggleBottom + 4,
    'Le panneau ne doit pas recouvrir la cloche qui sert à le fermer : ' + JSON.stringify(longNotificationLayout));
  assert.ok(longNotificationLayout.panelWidth > 0 &&
    longNotificationLayout.panelScrollWidth <= longNotificationLayout.panelWidth + 1 &&
    longNotificationLayout.listScrollWidth <= longNotificationLayout.listWidth + 1,
    'Les notifications longues ne doivent pas élargir le panneau : ' + JSON.stringify(longNotificationLayout));
  assert.ok(longNotificationLayout.titleWidth > 0 &&
    longNotificationLayout.titleScrollWidth <= longNotificationLayout.titleWidth + 1 &&
    longNotificationLayout.messageWidth > 0 &&
    longNotificationLayout.messageScrollWidth <= longNotificationLayout.messageWidth + 1,
    'Le titre et le message doivent se replier sans être coupés : ' + JSON.stringify(longNotificationLayout));

  await mobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
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
    labelsVisible: [...document.querySelectorAll('.nav-label')].length > 0 &&
      [...document.querySelectorAll('.nav-label')].every(element => getComputedStyle(element).display !== 'none'),
    promoRemoved: !document.querySelector('.sidebar-promo'),
    toggleExpanded: document.getElementById('sidebar-collapse-toggle')?.getAttribute('aria-expanded'),
    headingFont: getComputedStyle(document.querySelector('.page-header h1') || document.querySelector('h1')).fontFamily,
    bodyFont: getComputedStyle(document.body).fontFamily,
    iconsConsistent: [...document.querySelectorAll('.nav-item svg.icon')].length > 0 &&
      [...document.querySelectorAll('.nav-item svg.icon')].every(icon =>
        icon.getAttribute('viewBox') === '0 0 24 24' &&
        icon.getAttribute('stroke-linecap') === 'round' &&
        icon.getAttribute('stroke-linejoin') === 'round'),
    iconsLegible: [...document.querySelectorAll('.nav-item svg.icon')].every(icon => {
      const style = getComputedStyle(icon);
      return Number.parseFloat(style.width) >= 20 &&
        Number.parseFloat(style.height) >= 20 &&
        Number.parseFloat(style.strokeWidth) >= 1.8;
    }),
    topbarQuickActionsDoNotOverlap: (() => {
      const quick = document.querySelector('.app-topbar-quick-actions')?.getBoundingClientRect();
      const logout = document.querySelector('.app-topbar-logout')?.getBoundingClientRect();
      return Boolean(quick && logout && quick.right <= logout.left + 1);
    })()
  }));
  assert.deepEqual(compact, {
    collapsed: true,
    sidebarWidth: 96,
    mainMargin: 96,
    bodyState: true,
    labelsVisible: true,
    promoRemoved: true,
    toggleExpanded: 'false',
    headingFont: '"IBM Plex Sans", sans-serif',
    bodyFont: '"IBM Plex Sans", sans-serif',
    iconsConsistent: true,
    iconsLegible: true,
    topbarQuickActionsDoNotOverlap: true
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

async function verifyThemeConsistency(browser, baseUrl, fixtures) {
  const groupPage = await preparePage(browser, baseUrl, fixtures, false);
  await groupPage.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await groupPage.evaluate(() => {
    const user = JSON.parse(localStorage.getItem('sf_user') || '{}');
    user.plan = 'entreprise';
    localStorage.setItem('sf_user', JSON.stringify(user));
    localStorage.setItem('sf_theme', 'light');
  });
  await groupPage.goto(baseUrl + '/groupe-entreprise.html', { waitUntil: 'domcontentloaded' });
  await groupPage.waitForSelector('#invite-company-form', { timeout: 15000 });
  await groupPage.waitForSelector('body.enterprise-console-shell .enterprise-console-topbar', { timeout: 10000 });

  const readGroupTheme = () => groupPage.evaluate(() => {
    const color = (selector, property) => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element).getPropertyValue(property || 'background-color').trim() : null;
    };
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      page: color('.main-content.enterprise-console-main'),
      panel: color('.group-panel'),
      dashboardCard: color('.enterprise-dashboard-card'),
      sidebar: color('#app-sidebar.sidebar'),
      sidebarText: color('#app-sidebar .nav-item.active', 'color'),
      heading: color('.enterprise-dashboard-heading h1', 'color'),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
    };
  });

  await groupPage.evaluate(() => window.SamaTheme.definir('light'));
  const light = await readGroupTheme();
  assert.equal(light.theme, 'light', 'Le centre Entreprise doit respecter le thème clair explicite.');
  assert.equal(light.page, 'rgb(245, 247, 250)', 'Le fond clair Entreprise doit rester gris très léger.');
  assert.equal(light.panel, 'rgb(255, 255, 255)', 'Les panneaux Entreprise doivent rester blancs en thème clair.');
  assert.equal(light.sidebar, 'rgb(255, 255, 255)', 'Le rail Entreprise doit rester blanc en thème clair.');

  await groupPage.evaluate(() => window.SamaTheme.definir('dark'));
  await groupPage.waitForFunction(() =>
    getComputedStyle(document.querySelector('.group-panel')).backgroundColor === 'rgb(40, 39, 32)'
  );
  const dark = await readGroupTheme();
  assert.equal(dark.theme, 'dark', 'Le centre Entreprise doit appliquer le thème sombre sans rechargement.');
  assert.equal(dark.page, 'rgb(29, 28, 24)', 'Le fond du centre Entreprise doit suivre le graphite du thème sombre.');
  assert.equal(dark.panel, 'rgb(40, 39, 32)', 'Les panneaux ne doivent plus rester blancs en thème sombre.');
  assert.equal(dark.dashboardCard, 'rgb(40, 39, 32)', 'Les cartes de pilotage doivent utiliser la surface sombre.');
  assert.equal(dark.sidebar, 'rgb(23, 23, 19)', 'Le rail latéral doit devenir sombre avec le reste de l’application.');
  assert.equal(dark.horizontalOverflow, false, 'Le thème sombre ne doit pas provoquer de débordement.');
  const headingContrast = contrastRatio(dark.heading, dark.page);
  const sidebarContrast = contrastRatio(dark.sidebarText, dark.sidebar);
  assert.ok(headingContrast >= 4.5,
    'Le titre Entreprise doit garder un contraste de 4,5:1 en thème sombre. Valeur : ' + headingContrast.toFixed(2));
  assert.ok(sidebarContrast >= 4.5,
    'Le menu Entreprise doit garder un contraste de 4,5:1 en thème sombre. Valeur : ' + sidebarContrast.toFixed(2));
  await groupPage.screenshot({ path: path.join(OUTPUT_DIR, 'groupe-entreprise-theme-clair-1440.png'), fullPage: true });
  await groupPage.evaluate(() => window.SamaTheme.definir('dark'));
  await groupPage.screenshot({ path: path.join(OUTPUT_DIR, 'groupe-entreprise-theme-sombre-1440.png'), fullPage: true });
  await groupPage.close();

  async function verifyChartPage(name, file, canvasSelector) {
    const page = await preparePage(browser, baseUrl, fixtures, false);
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
    await page.evaluate(() => localStorage.setItem('sf_theme', 'light'));
    await page.goto(baseUrl + '/' + file, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction((selector) => {
      const canvas = document.querySelector(selector);
      return canvas && canvas.dataset.sfChartType === 'bar' && canvas.dataset.sfChartGridColor;
    }, { timeout: 15000 }, canvasSelector);
    const readColors = () => page.$eval(canvasSelector, canvas => ({
      tick: canvas.dataset.sfChartTickColor,
      grid: canvas.dataset.sfChartGridColor
    }));
    const lightColors = await readColors();
    await page.evaluate(() => window.SamaTheme.definir('dark'));
    await page.waitForFunction((selector, previous) => {
      const canvas = document.querySelector(selector);
      return canvas && canvas.dataset.sfChartGridColor &&
        canvas.dataset.sfChartGridColor !== previous.grid &&
        canvas.dataset.sfChartTickColor !== previous.tick;
    }, { timeout: 10000 }, canvasSelector, lightColors);
    const darkColors = await readColors();
    assert.notEqual(darkColors.grid, lightColors.grid,
      name + ' doit assombrir les lignes de grille avec le thème sombre.');
    assert.notEqual(darkColors.tick, lightColors.tick,
      name + ' doit adapter les libellés du graphique avec le thème sombre.');
    const contrast = contrastRatio(darkColors.tick, 'rgb(40, 39, 32)');
    assert.ok(contrast >= 4.5,
      name + ' : les libellés du graphique doivent rester lisibles en thème sombre. Contraste : ' + contrast.toFixed(2));
    await page.screenshot({
      path: path.join(OUTPUT_DIR, name + '-theme-sombre-1440.png'),
      fullPage: true
    });
    await page.close();
    return { light: lightColors, dark: darkColors, contrastRatio: Number(contrast.toFixed(2)) };
  }

  const finances = await verifyChartPage('finances', 'finances.html', '#chart-finances');
  const reports = await verifyChartPage('rapports', 'rapports.html', '#chart-ventes');

  const settingsPage = await preparePage(browser, baseUrl, fixtures, false);
  await settingsPage.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await settingsPage.evaluate(() => localStorage.setItem('sf_theme', 'light'));
  await settingsPage.goto(baseUrl + '/parametres.html', { waitUntil: 'domcontentloaded' });
  await settingsPage.waitForSelector('[data-open-template-preview="nova"]', { timeout: 15000 });
  await settingsPage.click('[data-open-template-preview="nova"]');
  await settingsPage.waitForFunction(() =>
    getComputedStyle(document.getElementById('invoice-template-preview-modal')).display !== 'none'
  );
  const readPreviewTheme = () => settingsPage.evaluate(() => ({
    stage: getComputedStyle(document.getElementById('invoice-template-preview-stage')).backgroundColor,
    dialog: getComputedStyle(document.querySelector('.invoice-template-preview-dialog')).backgroundColor,
    paper: getComputedStyle(document.querySelector('.invoice-template-preview-full-page')).backgroundColor
  }));
  const previewLight = await readPreviewTheme();
  await settingsPage.evaluate(() => window.SamaTheme.definir('dark'));
  const previewDark = await readPreviewTheme();
  assert.notEqual(previewDark.stage, previewLight.stage,
    'La scène de prévisualisation doit suivre le thème sombre.');
  assert.equal(previewDark.stage, 'rgb(40, 39, 32)',
    'La scène de prévisualisation doit reprendre une surface sombre cohérente.');
  assert.equal(previewDark.dialog, 'rgb(40, 39, 32)',
    'La fenêtre d’aperçu doit suivre le thème sombre.');
  assert.equal(previewDark.paper, 'rgb(255, 255, 255)',
    'La feuille A4 doit rester blanche pour refléter le rendu imprimé.');
  await settingsPage.screenshot({
    path: path.join(OUTPUT_DIR, 'parametres-apercu-mode-sombre-1440.png'),
    fullPage: true
  });
  await settingsPage.close();

  return {
    enterprise: { light, dark, headingContrast: Number(headingContrast.toFixed(2)), sidebarContrast: Number(sidebarContrast.toFixed(2)) },
    charts: { finances, reports },
    settingsPreview: { light: previewLight, dark: previewDark },
    screenshots: 5
  };
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
  assert.equal(darkMetrics.background, 'rgb(29, 28, 24)', 'Le thème sombre doit reprendre le fond graphite de la direction Unslop.');
  assert.equal(darkMetrics.card, 'rgb(40, 39, 32)', 'Les cartes sombres doivent utiliser la teinte papier profonde.');
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

  async function verifyDocumentPdf(documentId, type) {
    // Revenir au média écran avant de capturer l’aperçu de chaque document.
    await page.emulateMediaType(null);
    await page.goto(baseUrl + '/facture-detail.html?id=' + documentId, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__docReady === true, { timeout: 15000 });
    await page.waitForSelector('.invoice-doc .sf-document-table tbody tr');
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await Promise.all(Array.from(document.querySelectorAll('#doc img')).map(image =>
        typeof image.decode === 'function' ? image.decode().catch(() => {}) : Promise.resolve()
      ));
    });
    const screenMetrics = await page.evaluate(() => ({
      title: document.title,
      lineCount: document.querySelectorAll('.invoice-doc .sf-document-table tbody tr').length,
      tableWidth: Math.round(document.querySelector('.invoice-doc .sf-document-table').getBoundingClientRect().width),
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      hasMeta: Boolean(document.querySelector('.invoice-doc .sf-doc-meta')),
      hasTaxDetail: Boolean(document.querySelector('.invoice-doc .sf-doc-tax')),
      hasPaymentBalance: Boolean(document.querySelector('.invoice-doc .sf-payment-balance')),
      hasQuoteAcceptance: Boolean(document.querySelector('.invoice-doc .sf-acceptance-panel')),
      taxRowAmounts: Array.from(document.querySelectorAll('.invoice-doc .sf-doc-tax-row strong')).map(element => element.textContent),
      taxTotalAmount: document.querySelector('.invoice-doc .sf-doc-tax-total strong')?.textContent || '',
      validityLabel: (document.querySelector('.invoice-doc')?.innerText || '').includes('Validité du devis'),
      dueLabel: (document.querySelector('.invoice-doc')?.innerText || '').includes('Échéance')
    }));
    assert.ok(screenMetrics.lineCount >= (type === 'devis' ? 28 : 8),
      type + ' : toutes les lignes doivent être rendues avant l’impression : ' + JSON.stringify(screenMetrics));
    assert.ok(screenMetrics.documentWidth <= screenMetrics.viewportWidth + 1,
      type + ' : l’aperçu écran ne doit pas élargir la page : ' + JSON.stringify(screenMetrics));
    assert.equal(screenMetrics.hasMeta, true, type + ' : les références du document doivent être visibles.');
    assert.equal(screenMetrics.hasTaxDetail, true, type + ' : le détail TVA multi-taux doit être présent.');
    const parseAmount = (value) => Number(String(value || '')
      .replace(/[\s\u00a0\u202f]/g, '')
      .replace(/[^\d,.-]/g, '')
      .replace(/\./g, '')
      .replace(',', '.'));
    const taxRowsTotal = screenMetrics.taxRowAmounts.reduce((sum, value) => sum + parseAmount(value), 0);
    assert.ok(Math.abs(taxRowsTotal - parseAmount(screenMetrics.taxTotalAmount)) <= 0.011,
      type + ' : le détail TVA par taux doit correspondre au total de TVA : ' + JSON.stringify({
        rows: screenMetrics.taxRowAmounts, total: screenMetrics.taxTotalAmount
      }));
    if (type === 'facture') {
      assert.equal(screenMetrics.hasPaymentBalance, true, 'La facture doit indiquer le solde restant dû.');
      assert.equal(screenMetrics.hasQuoteAcceptance, false, 'Une facture ne doit pas afficher le bon pour accord du devis.');
    } else {
      assert.equal(screenMetrics.validityLabel, true, 'Le devis doit afficher sa date de validité.');
      assert.equal(screenMetrics.dueLabel, false, 'Le devis ne doit pas afficher une échéance de paiement.');
      assert.equal(screenMetrics.hasQuoteAcceptance, true, 'Le devis doit prévoir une zone d’acceptation.');
      assert.equal(screenMetrics.hasPaymentBalance, false, 'Le devis ne doit pas afficher un solde de paiement.');
    }

    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'document-' + type + '-apercu-' + DATASET + '.png'),
      fullPage: true
    });
    await page.emulateMediaType('print');
    const printMetrics = await page.evaluate(() => ({
      toolbarDisplay: getComputedStyle(document.querySelector('.toolbar')).display,
      themeToggleDisplay: document.querySelector('.theme-toggle-flottant')
        ? getComputedStyle(document.querySelector('.theme-toggle-flottant')).display
        : 'none',
      tableHeaderDisplay: getComputedStyle(document.querySelector('.sf-document-table thead')).display,
      pageRule: getComputedStyle(document.querySelector('.invoice-doc')).breakInside,
      overflowX: getComputedStyle(document.querySelector('.invoice-doc')).overflowX
    }));
    assert.equal(printMetrics.toolbarDisplay, 'none', type + ' : la barre d’outils ne doit jamais être imprimée.');
    assert.equal(printMetrics.themeToggleDisplay, 'none', type + ' : le sélecteur de thème ne doit jamais recouvrir le document imprimé.');
    assert.equal(printMetrics.tableHeaderDisplay, 'table-header-group',
      type + ' : l’en-tête du tableau doit être répété lorsque le document passe sur une nouvelle page.');
    assert.equal(printMetrics.overflowX, 'visible', type + ' : le document ne doit pas être coupé horizontalement à l’impression.');

    const pdf = await page.pdf({
      format: 'A4',
      preferCSSPageSize: true,
      printBackground: true,
      margin: { top: '12mm', bottom: '14mm', left: '12mm', right: '12mm' },
      scale: 1
    });
    // Puppeteer 25 peut renvoyer un Uint8Array plutôt qu'un Buffer : normaliser
    // avant les conversions texte, sans dépendre de Uint8Array.toString(encoding).
    const pdfBuffer = Buffer.from(pdf);
    assert.equal(pdfBuffer.subarray(0, 5).toString('latin1'), '%PDF-', type + ' : la sortie doit être un vrai fichier PDF.');
    assert.ok(pdfBuffer.length > 5000, type + ' : le PDF doit contenir le document complet.');
    const pdfSource = pdfBuffer.toString('latin1');
    const pages = (pdfSource.match(/\/Type\s*\/Page\b/g) || []).length;
    assert.ok(pages >= 1, type + ' : le PDF doit contenir au moins une page.');
    if (type === 'devis') {
      assert.ok(pages >= 2, 'Le devis long doit continuer proprement sur plusieurs pages A4. Pages détectées : ' + pages);
    }
    fs.writeFileSync(path.join(OUTPUT_DIR, 'document-' + type + '-' + DATASET + '.pdf'), pdfBuffer);
    return { ...screenMetrics, printMetrics, pdfBytes: pdf.length, pdfPages: pages };
  }

  const invoicePdf = await verifyDocumentPdf(987, 'facture');
  const quotePdf = await verifyDocumentPdf(988, 'devis');
  await page.close();
  return {
    invoiceCreation: 'ok',
    quoteCreation: 'ok',
    totalWithDiscountVatAndDelivery: 20380,
    invoicePrint: invoicePdf,
    quotePrint: quotePdf,
    screenshots: 2,
    pdfFiles: 2
  };
}

async function capturePublicPages(browser, baseUrl, fixtures, screenshotsDir) {
  const captures = [];
  const viewports = VIEWPORTS;
  for (const file of ['index.html', 'login.html']) {
    const name = file === 'index.html' ? 'accueil' : 'connexion';
    for (const viewport of viewports) {
      const page = await preparePage(browser, baseUrl, fixtures, true);
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      try {
        await page.evaluate(() => {
          localStorage.removeItem('sf_token');
          localStorage.removeItem('sf_user');
        });
        await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
        await page.goto(baseUrl + '/' + file, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector(file === 'index.html' ? '.lp-hero' : '#login-form', { timeout: 15000 });
        await page.evaluate(() => document.fonts && document.fonts.ready);
        await new Promise(resolve => setTimeout(resolve, 120));
        const metrics = await page.evaluate(() => ({
          viewport: window.innerWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
          title: document.title
        }));
        assert.ok(metrics.document <= metrics.viewport + 1,
          name + ' déborde horizontalement à ' + viewport.width + 'px : ' + JSON.stringify(metrics));
        assert.ok(metrics.body <= metrics.viewport + 1,
          name + ' élargit le body à ' + viewport.width + 'px : ' + JSON.stringify(metrics));
        assert.deepEqual(pageErrors, [], name + ' a généré des erreurs JavaScript : ' + pageErrors.join(' | '));
        const filename = name + '-' + viewport.name + '-' + DATASET + '.png';
        await page.screenshot({ path: path.join(screenshotsDir, filename), fullPage: true, captureBeyondViewport: true });
        captures.push({ page: name, viewport: viewport.name, width: viewport.width, horizontalOverflow: false });
      } finally {
        await page.close();
      }
    }
  }
  return captures;
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
    const publicPages = await capturePublicPages(browser, baseUrl, fixtures, OUTPUT_DIR);
    const compactSidebar = await verifyCompactSidebar(browser, baseUrl, fixtures);
    const shell = await verifyWorkspaceShell(browser, baseUrl, fixtures);
    const motion = await verifyMotion(browser, baseUrl, fixtures);
    const themeConsistency = await verifyThemeConsistency(browser, baseUrl, fixtures);
    const themeAndZoom = await verifyThemeAndZoom(browser, baseUrl, fixtures);
    const documentFlows = await verifyInvoiceAndQuoteFlows(browser, baseUrl, fixtures);
    const report = {
      dataset: DATASET,
      generatedAt: new Date().toISOString(),
      pages: results,
      publicPages,
      motion,
      compactSidebar,
      workspaceShell: shell,
      themeConsistency,
      themeAndZoom,
      documentFlows,
      screenshots: results.length + 2 + publicPages.length + themeConsistency.screenshots + (documentFlows.screenshots || 0),
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
