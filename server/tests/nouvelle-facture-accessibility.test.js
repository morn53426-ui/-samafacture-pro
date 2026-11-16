const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(
  path.join(__dirname, '..', '..', 'public', 'nouvelle-facture.html'),
  'utf8'
);

const fields = [
  'client_id',
  'mode_paiement',
  'date_emission',
  'date_echeance',
  'objet',
  'reference_externe',
  'conditions_reglement',
  'remise',
  'frais_livraison',
  'commentaires'
];

test('les champs principaux du formulaire facture/devis ont un label HTML associé', () => {
  for (const id of fields) {
    const escapedId = id.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&');
    const labelPattern = new RegExp(
      '<label\\b[^>]*\\bfor=["\\']' + escapedId + '["\\'][^>]*>\\s*[^<\\s]',
      'i'
    );
    const controlPattern = new RegExp(
      '<(?:input|select|textarea)\\b[^>]*\\bid=["\\']' + escapedId + '["\\']',
      'i'
    );
    assert.match(html, labelPattern, 'Le champ #' + id + ' doit avoir un label explicite non vide.');
    assert.match(html, controlPattern, 'Le contrôle #' + id + ' doit exister.');
  }
});
