// Test unitaire de insererLignesFacture() (server/routes/factures.js) — voir
// AMELIORATIONS_SCALABILITE.md. Simule la connexion MySQL (conn.query mocké) plutôt que
// d'utiliser une vraie base : suffisant pour vérifier que la requête générée est correcte, sans
// dépendre de MySQL. Non exécuté dans cet environnement : charger server/routes/factures.js tire
// avec lui express/qrcode/mysql2/... (aucun n'est installé ici, voir AUDIT_PRODUCTION.md §1.1) —
// à lancer avec `npm test` une fois `npm install` fait.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-de-test-ne-jamais-utiliser-en-production';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { insererLignesFacture } = require('../routes/factures');

function connFactice() {
  const appels = [];
  return {
    appels,
    query: async (sql, params) => { appels.push({ sql, params }); return [{}]; }
  };
}

describe('insererLignesFacture — insertion groupée des lignes de facture', () => {
  test('une seule requête pour plusieurs lignes (au lieu d\'une par ligne)', async () => {
    const conn = connFactice();
    const lignes = [
      { produit_id: 5, designation: 'Ligne A', quantite: 2, prix_unitaire: 1000, tva: 18, total_ligne: 2360 },
      { produit_id: null, designation: 'Ligne B', quantite: 1, prix_unitaire: 500, tva: 0, total_ligne: 500 },
      { produit_id: 7, designation: 'Ligne C', quantite: 3, prix_unitaire: 200, tva: 18, total_ligne: 708 }
    ];
    await insererLignesFacture(conn, 42, lignes);

    assert.equal(conn.appels.length, 1, 'une seule requête, quel que soit le nombre de lignes');
    const { sql, params } = conn.appels[0];
    assert.match(sql, /VALUES \(\?, \?, \?, \?, \?, \?, \?\), \(\?, \?, \?, \?, \?, \?, \?\), \(\?, \?, \?, \?, \?, \?, \?\)/);
    // 3 lignes × 7 colonnes = 21 paramètres, dans l'ordre facture_id/produit_id/designation/...
    assert.equal(params.length, 21);
    assert.deepEqual(params.slice(0, 7), [42, 5, 'Ligne A', 2, 1000, 18, 2360]);
    assert.deepEqual(params.slice(7, 14), [42, null, 'Ligne B', 1, 500, 0, 500]);
    assert.deepEqual(params.slice(14, 21), [42, 7, 'Ligne C', 3, 200, 18, 708]);
  });

  test('aucune ligne → aucune requête envoyée (évite un INSERT ... VALUES () invalide)', async () => {
    const conn = connFactice();
    await insererLignesFacture(conn, 42, []);
    assert.equal(conn.appels.length, 0);
  });

  test('produit_id absent (undefined, pas seulement null) devient bien NULL', async () => {
    const conn = connFactice();
    await insererLignesFacture(conn, 1, [{ designation: 'Sans produit', quantite: 1, prix_unitaire: 100, tva: 0, total_ligne: 100 }]);
    assert.equal(conn.appels[0].params[1], null);
  });
});
