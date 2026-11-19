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
  'entrepot_id',
  'remise',
  'frais_livraison',
  'commentaires'
];

test('les champs principaux du formulaire facture/devis ont un label HTML associé', () => {
  for (const id of fields) {
    const labelStart = html.indexOf('<label for="' + id + '">');
    assert.notEqual(labelStart, -1, 'Le champ #' + id + ' doit avoir un label associé.');
    const labelEnd = html.indexOf('</label>', labelStart);
    assert.ok(labelEnd > labelStart, 'Le label du champ #' + id + ' doit être fermé.');
    assert.ok(
      html.slice(labelStart, labelEnd).replace(/<[^>]*>/g, '').trim(),
      'Le label du champ #' + id + ' doit avoir un nom non vide.'
    );
    assert.ok(html.includes('id="' + id + '"'), 'Le contrôle #' + id + ' doit exister.');
  }
});

test('la facture propose un entrepôt actif et masque ce choix pour un devis', () => {
  assert.match(html, /id="invoice-warehouse-field"/);
  assert.match(html, /Entrepôt de sortie du stock/);
  assert.match(html, /Api\.get\('\/pro\/warehouses'\)/);
  assert.match(html, /Number\(item\.actif\) === 1/);
  assert.match(html, /invoice-warehouse-field'\)\.hidden = isQuote/);
  assert.match(html, /entrepot_id: documentType === 'facture'/);
});
