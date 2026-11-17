'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');
const { createFactureTemplates } = require('../../public/js/facture-templates');

const stylesheet = fs.readFileSync(
  path.resolve(__dirname, '../../public/css/style.css'),
  'utf8'
);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

const templates = createFactureTemplates({
  escapeHtml,
  formatMontant: value => new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value) || 0),
  formatDate: value => value ? '17/11/2026' : '—',
  statutBadge: value => '<span class="badge">' + escapeHtml(value || 'devis') + '</span>'
});

function makeDocumentHtml() {
  const user = {
    nom: 'Sama Facture Pro',
    entreprise_nom: 'Entreprise de démonstration — Dakar',
    entreprise_adresse: 'Dakar, Sénégal',
    entreprise_telephone: '+221 77 000 00 00',
    entreprise_email: 'comptabilite@example.sn',
    entreprise_banque: 'Banque de démonstration',
    entreprise_rib: 'SN00 0000 0000 0000 0000 0000 000',
    entreprise_ninea: 'NINEA 000000000',
    entreprise_rccm: 'RCCM SN-DKR-2026-B-00000',
    entreprise_site_web: 'https://example.sn',
    entreprise_mentions_legales: 'Document de démonstration.\nConditions applicables selon le contrat signé.'
  };
  const facture = {
    numero: 'DEV-2026-00042',
    client_nom: 'Client de démonstration',
    client_adresse: 'Plateau, Dakar, Sénégal',
    client_telephone: '+221 76 000 00 00',
    client_email: 'client@example.sn',
    objet: 'Prestation de services et livraison',
    date_emission: '2026-11-17',
    date_validite: '2026-12-17',
    date_echeance: null,
    statut: 'en_attente',
    conditions_reglement: [
      'Offre valable trente jours à compter de sa date d’émission.',
      'Les prestations débutent après acceptation écrite du présent devis.',
      'Un acompte de 40 % est demandé à la commande.',
      'Le solde est payable à la livraison ou à la réception des travaux.',
      'Toute modification du périmètre fera l’objet d’un devis complémentaire.'
    ].join('\n'),
    sous_total: 680000,
    total_tva: 122400,
    total: 802400,
    montant_paye: 0,
    remise: 0,
    frais_livraison: 0,
    commentaires: ''
  };
  const lignes = Array.from({ length: 48 }, (_, index) => ({
    designation: 'Prestation professionnelle ' + (index + 1) +
      ' — analyse, préparation, coordination, exécution et contrôle qualité',
    quantite: 1,
    prix_unitaire: 20000 + index * 500,
    tva: 18,
    total_ligne: 20000 + index * 500
  }));
  const rendered = templates.renderInvoiceHtml({
    user, facture, lignes, isDevis: true, qrCode: null, template: 'classique'
  });
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<style>@page{size:A4 portrait;margin:12mm 12mm 14mm}body{margin:0;background:#fff}' +
    '.invoice-doc{box-sizing:border-box;padding:40px;min-height:0}</style>' +
    '<style>' + stylesheet + '</style></head><body>' +
    '<main class="invoice-doc tpl-classique">' + rendered + '</main>' +
    '</body></html>';
}

test('un devis long garde chaque bloc complémentaire ensemble sans bloquer la pagination du conteneur', async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(makeDocumentHtml(), { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');

    const printRules = await page.evaluate(() => {
      const extras = globalThis.document.querySelector('.sf-doc-extras');
      const panels = Array.from(extras.children).filter(element =>
        element.classList.contains('sf-extra-panel') ||
        element.classList.contains('sf-doc-legal')
      );
      const acceptance = extras.querySelector('.sf-acceptance-panel');
      return {
        container: globalThis.getComputedStyle(extras).breakInside,
        panels: panels.map(element => globalThis.getComputedStyle(element).breakInside),
        acceptance: acceptance ? globalThis.getComputedStyle(acceptance).breakInside : null,
        acceptancePresent: Boolean(acceptance)
      };
    });

    assert.equal(printRules.container, 'auto',
      'le conteneur global doit pouvoir se répartir sur plusieurs pages');
    assert.ok(printRules.panels.length >= 3,
      'le devis doit contenir les conditions, les coordonnées et la zone d’acceptation');
    assert.ok(printRules.panels.every(value => value === 'avoid'),
      'chaque bloc métier doit rester entier lors d’un saut de page');
    assert.equal(printRules.acceptance, 'avoid',
      'la zone de signature doit rester groupée');
    assert.equal(printRules.acceptancePresent, true);

    const documentHeight = await page.evaluate(() =>
      Math.max(
        document.querySelector('.invoice-doc').scrollHeight,
        document.documentElement.scrollHeight
      )
    );
    assert.ok(documentHeight > 1050,
      'le document imprimé doit dépasser la hauteur utile d’une page A4 (hauteur : ' + documentHeight + ' px)');

    const pdf = await page.pdf({
      format: 'A4',
      preferCSSPageSize: true,
      printBackground: true,
      margin: { top: '12mm', bottom: '14mm', left: '12mm', right: '12mm' }
    });
    assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-',
      'Chromium doit produire un véritable PDF à partir du document multi-page');
  } finally {
    await browser.close().catch(() => {});
  }
});
