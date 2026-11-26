/**
 * Services SUNUPILOT — extractions de `routes/factures.js` (décision de refactoring).
 *
 * Fonctions actives sur la connexion BDD (pool) — numérotation, insertions
 * multi-lignes, gestion du stock des entrepôts. Format : préfixe en UPPERCASE
 * anglais pour les noms d'entrepôt et SQL paramétrées avec `?` (mysql2).
 */
const { pool } = require('../config/db');

/**
 * Numérotation des documents (DEV-xxx / FAC-xxx) : ligne (user_id, type, année)
 * verrouillée (LAST_INSERT_ID) dans la transaction → aucun doublon en concurrence.
 */
async function nextNumero(conn, userId, type, year = new Date().getFullYear()) {
  const prefix = type === 'devis' ? 'DEV' : 'FAC';
  const numeroYear = Number(year);

  await conn.query(
    `INSERT INTO compteurs_numerotation (user_id, type, annee, dernier_numero)
     VALUES (?, ?, ?, LAST_INSERT_ID(1))
     ON DUPLICATE KEY UPDATE dernier_numero = LAST_INSERT_ID(dernier_numero + 1)`,
    [userId, type, numeroYear]
  );
  const [[{ n }]] = await conn.query('SELECT LAST_INSERT_ID() as n');
  const next = String(n).padStart(4, '0');
  return `${prefix}-${numeroYear}-${next}`;
}

/**
 * Insère toutes les lignes d'une facture/devis en UNE seule requête (multi-row INSERT)
 * plutôt qu'une requête par ligne — 1 aller-retour MySQL au lieu de N sur grandes factures.
 */
async function insererLignesFacture(conn, factureId, lignes) {
  if (!lignes.length) return;
  const placeholders = lignes.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
  const params = lignes.flatMap((l) => [
    factureId, l.produit_id || null, l.designation, l.quantite, l.prix_unitaire, l.tva, l.total_ligne
  ]);
  await conn.query(
    `INSERT INTO facture_lignes (facture_id, produit_id, designation, quantite, prix_unitaire, tva, total_ligne)
     VALUES ${placeholders}`,
    params
  );
}

/**
 * Résout l'entrepôt de sortie d'une facture (dépôt demandé ou "PRINCIPAL").
 * Retourne null si l'id demandé n'est pas un entrepôt actif de l'utilisateur.
 */
async function resoudreEntrepotFacture(conn, userId, requestedWarehouseId = null) {
  await conn.query(
    "INSERT IGNORE INTO pro_entrepots (user_id, code, nom, par_defaut) VALUES (?, 'PRINCIPAL', 'Magasin principal', 1)",
    [userId]
  );
  const requestedId = requestedWarehouseId === null || requestedWarehouseId === undefined || requestedWarehouseId === ''
    ? null
    : Number(requestedWarehouseId);
  if (requestedId !== null && (!Number.isSafeInteger(requestedId) || requestedId <= 0)) return null;
  const [rows] = requestedId === null
    ? await conn.query(
      "SELECT id, nom, code FROM pro_entrepots WHERE user_id = ? AND code = 'PRINCIPAL' AND actif = 1 LIMIT 1",
      [userId]
    )
    : await conn.query(
      'SELECT id, nom, code FROM pro_entrepots WHERE id = ? AND user_id = ? AND actif = 1 LIMIT 1',
      [requestedId, userId]
    );
  return rows[0] || null;
}

/**
 * Applique plusieurs variations de stock en UNE requête (UPDATE ... CASE).
 * `ajustements` : tableau de { produit_id, delta }. Ne fait rien si vide.
 */
async function appliquerAjustementsStock(conn, userId, entrepotId, ajustements) {
  if (!ajustements.length) return;

  // Une ligne liée à un service n'est jamais un article physique — on revalide le type.
  const requestedIds = [...new Set(ajustements
    .map(({ produit_id }) => Number(produit_id))
    .filter(id => Number.isSafeInteger(id) && id > 0)
  )].sort((a, b) => a - b);
  if (!requestedIds.length) return;

  const [stockManagedRows] = await conn.query(
    `SELECT id FROM produits
     WHERE user_id = ? AND id IN (${requestedIds.map(() => '?').join(',')})
       AND COALESCE(type_catalogue, 'non_classe') <> 'service'
     ORDER BY id FOR UPDATE`,
    [userId, ...requestedIds]
  );
  const stockManagedIds = new Set(stockManagedRows.map(row => Number(row.id)));
  const parProduit = new Map();
  for (const { produit_id, delta } of ajustements) {
    const productId = Number(produit_id);
    if (!stockManagedIds.has(productId)) continue;
    parProduit.set(productId, (parProduit.get(productId) || 0) + Number(delta));
  }
  const ids = [...parProduit.keys()];
  if (!ids.length) return;

  // Reconstituer d'abord dans PRINCIPAL le reliquat des fiches historiques.
  await conn.query(
    "INSERT IGNORE INTO pro_entrepots (user_id, code, nom, par_defaut) VALUES (?, 'PRINCIPAL', 'Magasin principal', 1)",
    [userId]
  );
  const [[principal]] = await conn.query(
    "SELECT id FROM pro_entrepots WHERE user_id = ? AND code = 'PRINCIPAL' LIMIT 1",
    [userId]
  );
  if (!principal) throw new Error('Le magasin principal est introuvable pour cette entreprise.');
  await conn.query(
    'INSERT IGNORE INTO pro_stocks_entrepots (user_id, entrepot_id, produit_id, quantite) SELECT p.user_id, ?, p.id, GREATEST(0, p.stock - COALESCE(existing.total, 0)) FROM produits p LEFT JOIN (SELECT produit_id, SUM(quantite) AS total FROM pro_stocks_entrepots WHERE user_id = ? AND produit_id IN (' + ids.map(() => '?').join(',') + ') GROUP BY produit_id) existing ON existing.produit_id = p.id WHERE p.user_id = ? AND p.id IN (' + ids.map(() => '?').join(',') + ')',
    [principal.id, userId, ...ids, userId, ...ids]
  );

  const selectedWarehouseId = entrepotId === null || entrepotId === undefined || entrepotId === '' ? Number(principal.id) : Number(entrepotId);
  const [warehouseRows] = await conn.query(
    'SELECT id, nom, code FROM pro_entrepots WHERE id = ? AND user_id = ? LIMIT 1',
    [selectedWarehouseId, userId]
  );
  const warehouse = warehouseRows[0];
  if (!warehouse) throw new Error('Entrepôt associé à la facture introuvable pour cette entreprise.');
  // Un entrepôt secondaire sans stock enregistré démarre à zéro.
  await conn.query(
    'INSERT IGNORE INTO pro_stocks_entrepots (user_id, entrepot_id, produit_id, quantite) SELECT p.user_id, ?, p.id, 0 FROM produits p WHERE p.user_id = ? AND p.id IN (' + ids.map(() => '?').join(',') + ')',
    [warehouse.id, userId, ...ids]
  );

  for (const [productId, delta] of parProduit) {
    const [rows] = await conn.query(
      'SELECT quantite FROM pro_stocks_entrepots WHERE user_id = ? AND entrepot_id = ? AND produit_id = ? FOR UPDATE',
      [userId, warehouse.id, productId]
    );
    if (!rows.length) continue;
    await conn.query(
      'UPDATE pro_stocks_entrepots SET quantite = quantite + ? WHERE user_id = ? AND entrepot_id = ? AND produit_id = ?',
      [delta, userId, warehouse.id, productId]
    );
    await conn.query(
      'UPDATE produits p SET p.stock = (SELECT COALESCE(SUM(s.quantite),0) FROM pro_stocks_entrepots s WHERE s.user_id = p.user_id AND s.produit_id = p.id) WHERE p.id = ? AND p.user_id = ?',
      [productId, userId]
    );
    await conn.query(
      "INSERT INTO pro_mouvements_stock (user_id, produit_id, produit_nom, entrepot_id, entrepot_nom, type, quantite, cout_unitaire, reference, motif) SELECT ?, p.id, p.nom, ?, ?, ?, ?, p.prix_achat, CONCAT('PROD-', ?), ? FROM produits p WHERE p.id = ? AND p.user_id = ?",
      [userId, warehouse.id, warehouse.nom, delta < 0 ? 'vente' : 'annulation_vente', delta, productId, delta < 0 ? 'Sortie liée à une facture client' : 'Restitution liée à une annulation de facture', productId, userId]
    );
  }

  // Rattrapage du total en cas de produit sans ligne d'entrepôt (stock nul ou ancienne donnée).
}

/**
 * Ajuste le stock des produits liés aux lignes d'une facture.
 * Inverse parfaitement avec ajouterLignesFacture via `sens` :
 *   +1 (annulation, restitue) / -1 (suppression, redécompte).
 */
async function ajusterStockFacture(conn, factureId, userId, sens, entrepotId = null) {
  const [lignes] = await conn.query(
    'SELECT produit_id, quantite FROM facture_lignes WHERE facture_id = ? AND produit_id IS NOT NULL',
    [factureId]
  );
  await appliquerAjustementsStock(conn, userId, entrepotId, lignes.map((l) => ({ produit_id: l.produit_id, delta: sens * l.quantite })));
}

module.exports = {
  nextNumero,
  insererLignesFacture,
  resoudreEntrepotFacture,
  appliquerAjustementsStock,
  ajusterStockFacture
};
