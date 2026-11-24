const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(
  path.join(__dirname, '..', '..', 'public', 'parametres.html'),
  'utf8'
);

const labelledControlIds = [
  'entreprise_nom',
  'entreprise_adresse',
  'entreprise_telephone',
  'entreprise_email',
  'entreprise_ninea',
  'entreprise_rccm',
  'entreprise_site_web',
  'entreprise_banque',
  'entreprise_rib',
  'entreprise_conditions_reglement',
  'entreprise_mentions_legales',
  'devise',
  'perso_logo_taille',
  'perso_police',
  'perso_taille_texte',
  'perso_epaisseur_texte'
];

const ariaLabelledControlIds = [
  'perso_couleur_principale',
  'perso_couleur_secondaire',
  'perso_couleur_texte'
];

test('les paramètres proposent cinq accès rapides sans casser le formulaire unique', () => {
  const nav = html.match(/<nav class="workspace-section-nav settings-section-nav"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(nav, 'La navigation des paramètres doit être présente.');
  const links = [...nav[1].matchAll(/href="#([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(links, [
    'settings-company',
    'settings-invoicing',
    'settings-appearance',
    'settings-subscription',
    'settings-reset'
  ]);
  for (const id of links) assert.match(html, new RegExp('\\bid="' + id + '"'));
  assert.equal((html.match(/<form\b/g) || []).length, 1,
    'Les réglages doivent rester dans le formulaire d’enregistrement existant.');
  assert.ok(html.includes('<form id="entreprise-form">'));
});

test('les champs de paramètres ont un label HTML explicitement associé', () => {
  for (const id of labelledControlIds) {
    const labelStart = html.indexOf('<label for="' + id + '">');
    assert.notEqual(labelStart, -1, 'Le champ #' + id + ' doit avoir un label associé.');
    const labelEnd = html.indexOf('</label>', labelStart);
    assert.ok(labelEnd > labelStart, 'Le label du champ #' + id + ' doit être fermé.');
    assert.ok(html.slice(labelStart, labelEnd).replace(/<[^>]*>/g, '').trim(),
      'Le label du champ #' + id + ' doit contenir un nom non vide.');
    assert.ok(html.includes('id="' + id + '"'), 'Le contrôle #' + id + ' doit exister.');
  }
});

test('les sélecteurs de couleur ont chacun un nom accessible', () => {
  for (const id of ariaLabelledControlIds) {
    const inputStart = html.indexOf('<input type="color" id="' + id + '"');
    assert.notEqual(inputStart, -1, 'Le sélecteur de couleur #' + id + ' doit exister.');
    const inputEnd = html.indexOf('>', inputStart);
    const inputTag = html.slice(inputStart, inputEnd + 1);
    assert.match(inputTag, /aria-label="[^"]+"/,
      'Le sélecteur de couleur #' + id + ' doit avoir un aria-label non vide.');
  }
});


test('les coordonnées de l’entreprise sont dans une grille responsive fermée avant les champs légaux', () => {
  const start = html.indexOf('<div class="settings-company-fields-grid">');
  assert.notEqual(start, -1, 'Les coordonnées entreprise doivent partager un conteneur de grille.');

  const ribStart = html.indexOf('<div class="field settings-field-wide"><label for="entreprise_rib">', start);
  assert.ok(ribStart > start, 'Le RIB doit rester dans la grille.');
  const ribFieldClose = html.indexOf('</div>', ribStart);
  assert.ok(ribFieldClose > ribStart, 'Le champ RIB doit se fermer.');
  const gridClose = html.indexOf('</div>', ribFieldClose + '</div>'.length);
  assert.ok(gridClose > ribFieldClose, 'Le conteneur de grille doit se fermer après le champ RIB.');

  const conditionsStart = html.indexOf('<div class="field"><label for="entreprise_conditions_reglement">', start);
  assert.ok(conditionsStart > gridClose, 'Les conditions de règlement doivent rester hors de la grille.');
  const legalMentionsStart = html.indexOf('<div class="field"><label for="entreprise_mentions_legales">', conditionsStart);
  assert.ok(legalMentionsStart > conditionsStart, 'Les mentions légales doivent rester après la grille.');

  const grid = html.slice(start, gridClose);
  for (const id of [
    'entreprise_nom',
    'entreprise_adresse',
    'entreprise_telephone',
    'entreprise_email',
    'entreprise_ninea',
    'entreprise_rccm',
    'entreprise_site_web',
    'entreprise_banque',
    'entreprise_rib'
  ]) {
    assert.ok(grid.includes('id="' + id + '"'), 'Le champ #' + id + ' doit rester dans la grille.');
  }
  assert.match(grid, /<div class="field settings-field-wide"><label for="entreprise_rib">/,
    'Le RIB doit utiliser toute la largeur sur grand écran.');
  assert.match(html, /\.settings-company-fields-grid\s*\{[^}]*display:\s*grid/s);
  assert.match(html, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(html, /@media\s*\(max-width:\s*700px\)[\s\S]*?\.settings-company-fields-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.equal((html.match(/<form\b/g) || []).length, 1,
    'Le formulaire d’enregistrement unique ne doit pas être fragmenté.');
});
