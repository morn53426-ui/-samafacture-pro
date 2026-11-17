const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(
  path.join(__dirname, '..', '..', 'public', 'factures-recurrentes.html'),
  'utf8'
);

const labelledFields = [
  'libelle',
  'client_id',
  'frequence',
  'prochaine_date',
  'remise',
  'frais_livraison',
  'mode_paiement',
  'commentaires',
  'envoi_auto_email'
];

test('les champs du formulaire récurrent ont des libellés explicitement associés', () => {
  for (const id of labelledFields) {
    const labelStart = html.indexOf('<label for="' + id + '"');
    assert.notEqual(labelStart, -1, 'Le champ #' + id + ' doit avoir un label associé.');
    const labelEnd = html.indexOf('</label>', labelStart);
    assert.ok(labelEnd > labelStart, 'Le label du champ #' + id + ' doit être fermé.');
    const labelText = html.slice(labelStart, labelEnd).replace(/<[^>]*>/g, '').trim();
    assert.ok(labelText, 'Le label du champ #' + id + ' doit avoir un nom non vide.');
    const controlPattern = new RegExp('<(?:input|select|textarea)\\b[^>]*\\bid="' + id + '"', 'i');
    assert.match(html, controlPattern, 'Le contrôle #' + id + ' doit exister.');
  }
});

test('les champs ajoutés dynamiquement aux lignes ont un nom accessible', () => {
  for (const label of [
    'Produit du catalogue (optionnel)',
    'Désignation de l’article',
    'Quantité',
    'Prix unitaire',
    'TVA en pourcentage'
  ]) {
    assert.ok(html.includes('aria-label="' + label + '"'), 'Le contrôle doit exposer le nom accessible : ' + label);
  }
  assert.ok(html.includes('aria-label="Supprimer la ligne ${ligneCount}"'));
});
