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
    assert.ok(html.includes('<label for="' + id + '"'), 'Le champ #' + id + ' doit avoir un label associé.');
    assert.ok(html.includes('id="' + id + '"'), 'Le contrôle #' + id + ' doit exister.');
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
