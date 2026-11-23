const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { resolveTenant, requirePermission } = require('../middleware/tenant');
const { reserveMonthlyInvoiceQuota } = require('../utils/invoice-quota');
const { localDateString } = require('../utils/local-date');
const { SUPPORTED_CURRENCIES } = require('../config/localization');
const { sendMail, isSmtpConfigured } = require('../config/mailer');
const { escapeHtmlEmail, sanitizeEmailHeader } = require('../utils/email-escape');
const { formatAmountWithCurrency } = require('../utils/money-format');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { genererPdfFacture } = require('../utils/pdf');
const { notifierUtilisateur } = require('../realtime');
const { enqueuePdfJob, getPdfJob, getPdfPath } = require('../pdf-queue');
const { queueWebhookEvent } = require('../utils/pro-webhooks');
const { recordInvoiceAccountingTransition } = require('../services/accounting-invoice-lifecycle');

const router = express.Router();
router.use(requireAuth, resolveTenant, requirePermission);

async function nextNumero(conn, userId, type, year = new Date().getFullYear()) {
  const prefix = type === 'devis' ? 'DEV' : 'FAC';
  const numeroYear = Number(year);

  // Incrément atomique via la table compteurs_numerotation : la ligne (user_id, type, année)
  // est verrouillée le temps de l'opération (dans la transaction en cours), ce qui élimine
  // tout risque de doublon même si deux factures sont créées en même temps.
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

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function optionalText(value, maxLength) {
  if (value === undefined || value === null) return null;
  return String(value).trim().slice(0, maxLength) || null;
}

function optionalIsoDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const date = new Date(text + 'T00:00:00.000Z');
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? undefined : text;
}

/**
 * Insère toutes les lignes d'une facture/devis en UNE seule requête (multi-row INSERT) plutôt
 * qu'une requête par ligne — voir AMELIORATIONS_SCALABILITE.md. Sur une facture de 20 lignes,
 * c'est 1 aller-retour MySQL au lieu de 20 : à volume élevé (beaucoup de créations/duplications
 * de factures en parallèle), ça réduit d'autant le temps de connexion tenue sur le pool et la
 * latence perçue par l'utilisateur. Ne fait rien si `lignes` est vide (une facture sans lignes
 * n'a rien à insérer ici — évite un INSERT ... VALUES () invalide).
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

const MAX_MONEY_CENTS = 99999999999999n;

function parseDecimalInput(value, { field, scale, optional = false, maxScaled }) {
  if ((value === undefined || value === null || value === '') && optional) {
    return { value: 0, scaled: 0n };
  }
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new Error(`${field} doit être un nombre positif valide.`);
  }

  const raw = String(value).trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(raw);
  if (!match) throw new Error(`${field} doit être un nombre décimal positif valide.`);
  const decimals = match[2] || '';
  if (decimals.length > scale) {
    throw new Error(`${field} accepte au maximum ${scale} décimale(s).`);
  }
  const factor = 10n ** BigInt(scale);
  const scaled = BigInt(match[1]) * factor + BigInt(decimals.padEnd(scale, '0') || '0');
  if (scaled > maxScaled) throw new Error(`${field} dépasse la limite autorisée.`);
  return { value: Number(scaled) / Number(factor), scaled };
}

function roundBigIntDivision(numerator, denominator) {
  if (denominator <= 0n) return 0n;
  return (numerator + denominator / 2n) / denominator;
}

function centsToAmount(cents, field = 'Montant') {
  if (cents < 0n || cents > MAX_MONEY_CENTS) {
    throw new Error(`${field} dépasse la limite de précision autorisée.`);
  }
  return Number(cents) / 100;
}

/** Calcule la facture en centimes entiers. Les entrées ont déjà été validées à l'API. */
function computeTotals(lignes, remise, frais_livraison) {
  const quantityScale = 100n; // facture_lignes.quantite est stockée en DECIMAL(14,2)
  const taxScale = 10000n; // taux exprimé en centièmes de pourcentage
  const brutLignes = lignes.map((ligne) => {
    const quantite = parseDecimalInput(ligne.quantite, {
      field: 'Quantité', scale: 2, maxScaled: 99999999999999n
    });
    if (quantite.scaled <= 0n) throw new Error('La quantité doit être supérieure à zéro.');
    const prix = parseDecimalInput(ligne.prix_unitaire, {
      field: 'Prix unitaire', scale: 2, maxScaled: MAX_MONEY_CENTS
    });
    const tva = parseDecimalInput(ligne.tva, {
      field: 'TVA', scale: 2, optional: true, maxScaled: 10000n
    });
    const ligneHTCents = roundBigIntDivision(quantite.scaled * prix.scaled, quantityScale);
    if (ligneHTCents > MAX_MONEY_CENTS) throw new Error('Le montant de cette ligne dépasse la limite autorisée.');
    return {
      ...ligne,
      quantite: quantite.value,
      prix_unitaire: prix.value,
      tva: tva.value,
      ligneHTCents,
      tvaHundredths: tva.scaled
    };
  });

  const sousTotalCents = brutLignes.reduce((sum, ligne) => sum + ligne.ligneHTCents, 0n);
  if (sousTotalCents > MAX_MONEY_CENTS) throw new Error('Le sous-total dépasse la limite autorisée.');
  const frais = parseDecimalInput(frais_livraison, {
    field: 'Frais de livraison', scale: 2, optional: true, maxScaled: MAX_MONEY_CENTS
  });
  const remiseValidee = parseDecimalInput(remiseInputValue(remise), {
    field: 'Remise', scale: 2, optional: true, maxScaled: MAX_MONEY_CENTS
  });
  const remiseCents = remiseValidee.scaled > sousTotalCents ? sousTotalCents : remiseValidee.scaled;

  // Répartir la remise proportionnellement en centimes entiers. On prend d'abord
  // la partie entière de chaque quote-part, puis on distribue les centimes restants
  // aux plus grands restes décimaux. Aucune ligne ne reçoit ainsi une remise négative
  // ou supérieure à son propre montant, même avec beaucoup de lignes à faible valeur.
  const allocationsRemise = brutLignes.map((ligne, index) => {
    const numerateur = remiseCents * ligne.ligneHTCents;
    return {
      index,
      part: sousTotalCents > 0n ? numerateur / sousTotalCents : 0n,
      reste: sousTotalCents > 0n ? numerateur % sousTotalCents : 0n
    };
  });
  let centimesRestants = remiseCents -
    allocationsRemise.reduce((sum, allocation) => sum + allocation.part, 0n);
  const ordreAllocation = [...allocationsRemise]
    .filter(allocation => allocation.part < brutLignes[allocation.index].ligneHTCents)
    .sort((a, b) => {
      if (a.reste === b.reste) return a.index - b.index;
      return a.reste > b.reste ? -1 : 1;
    });
  for (const allocation of ordreAllocation) {
    if (centimesRestants <= 0n) break;
    allocation.part += 1n;
    centimesRestants -= 1n;
  }
  if (centimesRestants !== 0n) {
    throw new Error('Impossible de répartir la remise au centime près.');
  }

  const lignesAvecRemise = brutLignes.map((ligne, index) => ({
    ...ligne,
    ligneHTNetteCents: ligne.ligneHTCents - allocationsRemise[index].part
  }));

  // La TVA est arrondie une seule fois au niveau du document (comme dans le calcul
  // comptable précédent), plutôt que d'arrondir chaque ligne indépendamment.
  let totalTVANumerateur = 0n;
  const computedLignes = lignesAvecRemise.map((ligne) => {
    totalTVANumerateur += ligne.ligneHTNetteCents * ligne.tvaHundredths;
    const totalLigneTVACents = roundBigIntDivision(
      ligne.ligneHTCents * ligne.tvaHundredths,
      taxScale
    );
    const {
      ligneHTCents, tvaHundredths, ligneHTNetteCents, ...lignePublique
    } = ligne;
    return {
      ...lignePublique,
      total_ligne: centsToAmount(ligneHTCents + totalLigneTVACents, 'Total de ligne')
    };
  });

  const totalTVACents = roundBigIntDivision(totalTVANumerateur, taxScale);
  const totalCents = sousTotalCents - remiseCents + totalTVACents + frais.scaled;
  return {
    computedLignes,
    sous_total: centsToAmount(sousTotalCents, 'Sous-total'),
    total_tva: centsToAmount(totalTVACents, 'TVA'),
    total: centsToAmount(totalCents, 'Total'),
    remise: centsToAmount(remiseCents, 'Remise appliquée'),
    frais_livraison: frais.value
  };
}

function remiseInputValue(value) {
  return value === undefined || value === null || value === '' ? 0 : value;
}


/**
 * Applique plusieurs variations de stock en UNE seule requête (UPDATE ... CASE) plutôt qu'une
 * requête par produit — même logique que insererLignesFacture ci-dessus (voir
 * AMELIORATIONS_SCALABILITE.md) : une facture de 20 lignes ne tenait auparavant la connexion
 * transactionnelle que le temps de 20 allers-retours MySQL séquentiels (décompte à la création,
 * restitution à l'annulation/suppression, transformation devis→facture). Audit final : ce point
 * avait été traité pour l'insertion des lignes mais pas pour l'ajustement du stock — corrigé ici
 * pour les trois appelants (POST /, PUT /:id/statut via ajusterStockFacture, DELETE /:id via
 * ajusterStockFacture, POST /:id/transformer-en-facture).
 * Les lignes référençant un même produit sont regroupées (somme des deltas) pour n'écrire
 * qu'une seule fois par produit, même si un produit apparaît sur plusieurs lignes.
 * `ajustements` : tableau de { produit_id, delta }. Ne fait rien si vide.
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

async function appliquerAjustementsStock(conn, userId, entrepotId, ajustements) {
  if (!ajustements.length) return;

  // Une ligne liée à un service peut figurer sur une facture, mais ne représente
  // jamais un article physique. Revalider le type dans la transaction évite qu'une
  // vente, une annulation ou une transformation de devis ne modifie son stock.
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

  // Reconstituer d'abord dans PRINCIPAL le reliquat des fiches historiques dont le
  // stock n'a pas encore été ventilé. Cela doit être fait même si la vente part d'un
  // dépôt secondaire ; sinon la première vente ferait disparaître le stock historique.
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
  // Un entrepôt secondaire sans stock enregistré démarre à zéro ; il ne reçoit jamais
  // une copie du total agrégé qui reste déjà ventilé dans les autres dépôts.
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

  // Rattrapage du total en cas de produit sans ligne d'entrepôt (ex. stock nul ou
  // ancienne donnée importée) — les ajustements non représentés restent sans effet.
}

/**
 * Ajuste le stock des produits liés aux lignes d'une facture, dans un sens (+1 restitue,
 * -1 redécompte). Utilisée pour garder le stock cohérent quand une facture change de statut
 * (annulation/réactivation) ou est supprimée — symétrique au décompte fait à la création
 * (voir POST / et /transformer-en-facture). N'affecte jamais les lignes sans produit_id
 * (saisie libre, jamais liée à l'inventaire).
 */
async function ajusterStockFacture(conn, factureId, userId, sens, entrepotId = null) {
  const [lignes] = await conn.query(
    'SELECT produit_id, quantite FROM facture_lignes WHERE facture_id = ? AND produit_id IS NOT NULL',
    [factureId]
  );
  await appliquerAjustementsStock(conn, userId, entrepotId, lignes.map((l) => ({ produit_id: l.produit_id, delta: sens * l.quantite })));
}

/**
 * @openapi
 * /factures:
 *   get:
 *     summary: Liste les factures ou devis de l'utilisateur connecté (paginé, filtrable)
 *     tags: [Factures]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [facture, devis] }
 *       - in: query
 *         name: statut
 *         schema: { type: string, enum: [en_attente, payee, en_retard, annulee] }
 *       - in: query
 *         name: client_id
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limite
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Liste paginée.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 factures: { type: array, items: { $ref: '#/components/schemas/Facture' } }
 */
router.get('/', async (req, res, next) => {
  try {
    const { type, statut, client_id } = req.query;
    const { page, limite, offset } = getPagination(req.query);

    let whereSql = ' WHERE f.user_id = ?';
    const params = [req.tenantId];
    if (type) { whereSql += ' AND f.type = ?'; params.push(type); }
    if (statut) { whereSql += ' AND f.statut = ?'; params.push(statut); }
    if (client_id) { whereSql += ' AND f.client_id = ?'; params.push(client_id); }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM factures f JOIN clients c ON c.id = f.client_id AND c.user_id = f.user_id${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT f.*, c.nom as client_nom, c.email as client_email, c.telephone as client_telephone,
              c.whatsapp as client_whatsapp, NULL as client_pays_code
       FROM factures f JOIN clients c ON c.id = f.client_id AND c.user_id = f.user_id JOIN users u ON u.id = f.user_id${whereSql}
       ORDER BY f.date_emission DESC, f.id DESC LIMIT ? OFFSET ?`,
      [...params, limite, offset]
    );
    res.json({ factures: rows, pagination: buildPaginationMeta(page, limite, total) });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /factures/{id}:
 *   get:
 *     summary: Détail d'une facture/devis, avec ses lignes, ses paiements et son QR code de vérification
 *     tags: [Factures]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Détail complet.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 facture: { $ref: '#/components/schemas/Facture' }
 *                 lignes: { type: array, items: { $ref: '#/components/schemas/LigneFacture' } }
 *                 paiements: { type: array, items: { type: object } }
 *                 qr_code: { type: string, nullable: true, description: "Image QR encodée en base64 (data URL)." }
 *                 verify_url: { type: string }
 *       404: { description: "Facture introuvable.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT f.*, c.nom as client_nom, c.email as client_email, c.telephone as client_telephone,
              c.whatsapp as client_whatsapp, c.adresse as client_adresse, NULL as client_pays_code
       FROM factures f JOIN clients c ON c.id = f.client_id AND c.user_id = f.user_id JOIN users u ON u.id = f.user_id
       WHERE f.id = ? AND f.user_id = ?`,
      [req.params.id, req.tenantId]
    );
    const facture = rows[0];
    if (!facture) return res.status(404).json({ error: 'Facture introuvable.' });

    // Les factures créées avant l'ajout de cette fonctionnalité n'ont pas encore de code —
    // on le génère à la volée au premier affichage plutôt que de migrer toute la table.
    if (!facture.verification_code) {
      facture.verification_code = crypto.randomBytes(5).toString('hex');
      await pool.query('UPDATE factures SET verification_code = ? WHERE id = ? AND user_id = ?', [facture.verification_code, facture.id, req.tenantId]);
    }

    const [[lignes], [paiements]] = await Promise.all([
      pool.query('SELECT * FROM facture_lignes WHERE facture_id = ?', [facture.id]),
      pool.query('SELECT * FROM paiements WHERE facture_id = ? AND user_id = ? ORDER BY date_paiement DESC', [facture.id, req.tenantId])
    ]);

    const verifyUrl = `${(process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '')}/verifier.html?id=${facture.id}&code=${facture.verification_code}`;
    let qrCode = null;
    try {
      qrCode = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 180, color: { dark: '#0F1B33' } });
    } catch (qrErr) {
      console.error('Génération du QR code échouée :', qrErr.message);
    }

    res.json({ facture, lignes, paiements, qr_code: qrCode, verify_url: verifyUrl });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /factures:
 *   post:
 *     summary: Crée une facture ou un devis (calcule automatiquement sous-total, TVA et total à partir des lignes)
 *     description: "Le plan Gratuit est limité à 10 factures par mois (les devis restent illimités sur tous les plans)."
 *     tags: [Factures]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [client_id, lignes]
 *             properties:
 *               client_id: { type: integer }
 *               type: { type: string, enum: [facture, devis], default: facture }
 *               entrepot_id: { type: integer, nullable: true, description: 'Entrepôt de sortie du stock pour une facture ; le dépôt principal est utilisé par défaut. Ignoré pour un devis.' }
 *               date_emission: { type: string, format: date }
 *               date_echeance: { type: string, format: date, nullable: true }
 *               date_validite: { type: string, format: date, nullable: true, description: 'Date limite de validité, uniquement pour un devis.' }
 *               objet: { type: string, maxLength: 190, description: 'Objet ou prestation.' }
 *               reference_externe: { type: string, maxLength: 100, description: 'Référence client ou bon de commande.' }
 *               conditions_reglement: { type: string, maxLength: 5000, description: 'Conditions spécifiques à ce document.' }
 *               remise: { type: number, default: 0 }
 *               frais_livraison: { type: number, default: 0 }
 *               mode_paiement: { type: string, nullable: true }
 *               commentaires: { type: string, nullable: true }
 *               lignes: { type: array, items: { $ref: '#/components/schemas/LigneFacture' } }
 *     responses:
 *       201:
 *         description: Document créé.
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { facture: { $ref: '#/components/schemas/Facture' } } }
 *       403: { description: "Quota du plan Gratuit atteint (code QUOTA_DEPASSE).", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/', async (req, res, next) => {
  let conn;
  try {
    const idempotencyKey = req.get('Idempotency-Key')?.trim() || null;
    if (idempotencyKey && (idempotencyKey.length < 8 || idempotencyKey.length > 100)) {
      return res.status(400).json({ error: 'Idempotency-Key invalide (8 à 100 caractères).' });
    }
    const { client_id, type, date_emission, date_echeance, date_validite, objet, reference_externe, conditions_reglement, devise, remise, frais_livraison, mode_paiement, commentaires, lignes, entrepot_id } = req.body;

    // Une nouvelle tentative avec la même clé doit retourner le document déjà créé plutôt
    // que créer une seconde facture. La clé est facultative afin de préserver exactement le
    // comportement historique des clients qui ne l'envoient pas.
    if (idempotencyKey) {
      const [existing] = await pool.query(
        'SELECT * FROM factures WHERE user_id = ? AND idempotency_key = ?',
        [req.tenantId, idempotencyKey]
      );
      if (existing.length) return res.status(200).json({ facture: existing[0], idempotent_replay: true });
    }

    if (!client_id || !Array.isArray(lignes) || lignes.length === 0) {
      return res.status(400).json({ error: 'Un client et au moins une ligne de produit sont requis.' });
    }
    const [clientRows] = await pool.query('SELECT id FROM clients WHERE id = ? AND user_id = ?', [client_id, req.tenantId]);
    if (!clientRows.length) {
      return res.status(400).json({ error: 'Client invalide.' });
    }

    if (lignes.some((ligne) => !ligne || typeof ligne !== 'object' || Array.isArray(ligne))) {
      return res.status(400).json({ error: 'Chaque ligne doit être un objet de facture valide.' });
    }

    let lignesValidees;
    try {
      lignesValidees = lignes.map((ligne) => ({
        ...ligne,
        quantite: parseDecimalInput(ligne.quantite, { field: 'Quantité', scale: 2, maxScaled: 99999999999999n }).value,
        prix_unitaire: parseDecimalInput(ligne.prix_unitaire, { field: 'Prix unitaire', scale: 2, maxScaled: MAX_MONEY_CENTS }).value,
        tva: parseDecimalInput(ligne.tva, { field: 'TVA', scale: 2, optional: true, maxScaled: 10000n }).value
      }));
      if (lignesValidees.some((ligne) => ligne.quantite <= 0)) {
        return res.status(400).json({ error: 'Chaque quantité doit être supérieure à zéro.' });
      }
      parseDecimalInput(remise, { field: 'Remise', scale: 2, optional: true, maxScaled: MAX_MONEY_CENTS });
      parseDecimalInput(frais_livraison, { field: 'Frais de livraison', scale: 2, optional: true, maxScaled: MAX_MONEY_CENTS });
    } catch (validationErr) {
      return res.status(400).json({ error: validationErr.message });
    }

    // Isolation des données : un produit référencé sur une ligne doit appartenir à
    // l'utilisateur courant (sinon on ignore le lien, la ligne reste valable en saisie libre).
    const produitIds = [...new Set(lignes.map(l => l.produit_id).filter(Boolean))];
    if (produitIds.length) {
      const [ownedRows] = await pool.query(
        `SELECT id FROM produits WHERE user_id = ? AND id IN (${produitIds.map(() => '?').join(',')})`,
        [req.tenantId, ...produitIds]
      );
      const ownedIds = new Set(ownedRows.map(r => r.id));
      for (const l of lignesValidees) {
        const productId = Number(l.produit_id);
        if (l.produit_id && (!Number.isSafeInteger(productId) || !ownedIds.has(productId))) {
          l.produit_id = null;
        } else if (l.produit_id) {
          l.produit_id = productId;
        }
      }
    }

    const [companyRows] = await pool.query('SELECT devise, fuseau_horaire FROM users WHERE id = ?', [req.tenantId]);
    const companyCurrency = String(companyRows[0]?.devise || 'FCFA').toUpperCase();
    const companyLocalDate = localDateString(companyRows[0]?.fuseau_horaire || 'Africa/Dakar');
    const documentCurrency = String(devise || companyCurrency).toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(documentCurrency)) return res.status(400).json({ error: 'Devise de document non prise en charge.' });
    if (documentCurrency !== companyCurrency) {
      return res.status(409).json({ error: 'La devise du document doit correspondre à la devise de base de l’entreprise. Les conversions multi-devises ne sont pas encore activées.' });
    }
    const docType = type === 'devis' ? 'devis' : 'facture';
    const dateValidite = docType === 'devis' ? optionalIsoDate(date_validite) : null;
    if (dateValidite === undefined) {
      return res.status(400).json({ error: 'La date de validité du devis est invalide.' });
    }
    const objetDocument = optionalText(objet, 190);
    const referenceDocument = optionalText(reference_externe, 100);
    const conditionsDocument = optionalText(conditions_reglement, 5000);

    let calculFacture;
    try {
      calculFacture = computeTotals(lignesValidees, remise, frais_livraison);
    } catch (calculationError) {
      return res.status(400).json({ error: calculationError.message || 'Les montants de la facture sont invalides.' });
    }
    const {
      computedLignes, sous_total, total_tva, total,
      remise: remiseAppliquee, frais_livraison: fraisLivraisonValides
    } = calculFacture;
    // Code court utilisé pour la vérification publique de la facture (via QR code) : évite
    // qu'un tiers puisse deviner l'URL de vérification d'une autre facture en changeant l'id.
    const verificationCode = crypto.randomBytes(5).toString('hex');

    conn = await pool.getConnection();
    await conn.beginTransaction();
    let invoiceWarehouseId = null;
    if (docType === 'facture') {
      // Toutes les créations verrouillent d'abord le compte via le registre de quota.
      // Résoudre/initialiser l'entrepôt avant ce verrou inversait l'ordre des verrous
      // avec d'autres opérations métier et provoquait des deadlocks sous concurrence.
      const quota = await reserveMonthlyInvoiceQuota(conn, req.tenantId);
      if (!quota.allowed) {
        // Préserver le registre reconstitué malgré le refus de la facture.
        await conn.commit();
        notifierUtilisateur(req.tenantId, 'alerte_quota', {
          message: `Vous avez atteint la limite de ${quota.limit} factures du plan Gratuit ce mois-ci.`
        });
        return res.status(403).json({
          error: `Le plan Gratuit est limité à ${quota.limit} factures par mois. Passez à un plan payant dans Paramètres pour continuer.`,
          code: 'QUOTA_DEPASSE'
        });
      }
      const warehouse = await resoudreEntrepotFacture(conn, req.tenantId, entrepot_id);
      if (!warehouse) {
        await conn.rollback();
        return res.status(400).json({ error: 'Entrepôt de sortie invalide ou inactif pour cette entreprise.' });
      }
      invoiceWarehouseId = Number(warehouse.id);
    }
    const numero = await nextNumero(conn, req.tenantId, docType, Number(companyLocalDate.slice(0, 4)));
    const [result] = await conn.query(
      `INSERT INTO factures (user_id, client_id, entrepot_id, numero, type, date_emission, date_echeance, date_validite, objet, reference_externe, conditions_reglement, devise, statut, remise, frais_livraison, mode_paiement, commentaires, sous_total, total_tva, total, verification_code, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en_attente', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.tenantId, client_id, invoiceWarehouseId, numero, docType, date_emission || companyLocalDate,
        date_echeance || null, dateValidite, objetDocument, referenceDocument, conditionsDocument,
        documentCurrency, remiseAppliquee, fraisLivraisonValides, mode_paiement || null,
        commentaires || null, sous_total, total_tva, total, verificationCode, idempotencyKey
      ]
    );
    const factureId = result.insertId;

    await insererLignesFacture(conn, factureId, computedLignes);

    // Décompte automatique du stock : uniquement pour une vraie facture (une vente
    // effective), jamais pour un devis (simple proposition, pas encore de vente). Ne
    // bloque jamais la création si le stock devient négatif — beaucoup de commerçants
    // vendent volontairement en rupture temporaire (réassort à venir) ; c'est une
    // indication, pas une contrainte dure. Restauré symétriquement si la facture est
    // supprimée ou annulée (voir DELETE /:id et PUT /:id/statut plus bas).
    if (docType === 'facture') {
      await appliquerAjustementsStock(conn, req.tenantId, invoiceWarehouseId, computedLignes.map((l) => ({ produit_id: l.produit_id, delta: -l.quantite })));
    }

    await conn.commit();
    // Réutiliser la connexion déjà acquise jusqu'au finally : si 10 requêtes concurrentes
    // gardent chacune une connexion du pool puis en redemandent une pour ce SELECT, le pool
    // (10 connexions par défaut) est entièrement occupé et toutes les réponses se bloquent.
    const [factureRows] = await conn.query('SELECT * FROM factures WHERE id = ?', [factureId]);
    res.status(201).json({ facture: factureRows[0] });
    if (docType === 'facture') {
      queueWebhookEvent(req.tenantId, 'invoice.created', { invoice_id: factureId, numero, total }).catch(err => console.warn('Webhook invoice.created ignoré :', err.message));
    }
  } catch (err) {
    if (conn) await conn.rollback();
    if (err?.code === 'ER_DUP_ENTRY' && req.get('Idempotency-Key')) {
      try {
        const [existing] = await conn.query(
          'SELECT * FROM factures WHERE user_id = ? AND idempotency_key = ?',
          [req.tenantId, req.get('Idempotency-Key').trim()]
        );
        if (existing.length) return res.status(200).json({ facture: existing[0], idempotent_replay: true });
      } catch (replayErr) { return next(replayErr); }
    }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

/**
 * @openapi
 * /factures/{id}/statut:
 *   put:
 *     summary: Change manuellement le statut d'une facture (ex. annuler, remettre en attente)
 *     tags: [Factures]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [statut]
 *             properties: { statut: { type: string, enum: [en_attente, payee, en_retard, annulee] } }
 *     responses:
 *       200: { description: "Statut mis à jour.", content: { application/json: { schema: { type: object, properties: { facture: { $ref: '#/components/schemas/Facture' } } } } } }
 *       404: { description: "Facture introuvable.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.put('/:id/statut', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existingRows] = await conn.query(
      'SELECT * FROM factures WHERE id = ? AND user_id = ? FOR UPDATE',
      [req.params.id, req.tenantId]
    );
    const existing = existingRows[0];
    if (!existing) {
      await conn.rollback();
      return res.status(404).json({ error: 'Facture introuvable.' });
    }

    const { statut } = req.body;
    const valides = ['en_attente', 'payee', 'en_retard', 'annulee'];
    if (!valides.includes(statut)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Statut invalide.' });
    }

    if (statut === 'payee' &&
        (existing.type !== 'facture' ||
         round2(Number(existing.montant_paye)) < round2(Number(existing.total)))) {
      await conn.rollback();
      return res.status(409).json({
        error: 'Impossible de marquer cette facture comme payée tant que son montant total n’a pas été encaissé et enregistré.',
        code: 'PAIEMENT_INCOMPLET'
      });
    }

    await conn.query(
      'UPDATE factures SET statut = ? WHERE id = ? AND user_id = ?',
      [statut, existing.id, req.tenantId]
    );

    let accountingTransition = null;
    if (existing.type === 'facture' && existing.statut !== 'annulee' && statut === 'annulee') {
      await ajusterStockFacture(conn, existing.id, req.tenantId, +1, existing.entrepot_id);
      accountingTransition = 'annulation';
    } else if (existing.type === 'facture' && existing.statut === 'annulee' && statut !== 'annulee') {
      await ajusterStockFacture(conn, existing.id, req.tenantId, -1, existing.entrepot_id);
      accountingTransition = 'reactivation';
    }

    // Une facture déjà comptabilisée est contre-passée dans la même transaction que
    // son changement de statut et la restitution/redéduction du stock. Les devis et les
    // factures jamais comptabilisées ne créent aucune écriture comptable automatique.
    if (accountingTransition) {
      await recordInvoiceAccountingTransition(conn, {
        userId: req.tenantId,
        actorUserId: req.actorId || req.user?.id || req.tenantId,
        invoice: existing,
        transition: accountingTransition
      });
    }

    await conn.commit();
    const [rows] = await pool.query(
      'SELECT * FROM factures WHERE id = ? AND user_id = ?',
      [existing.id, req.tenantId]
    );
    return res.json({ facture: rows[0] });
  } catch (err) {
    await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn.release();
  }
});

/**
 * @openapi
 * /factures/{id}/transformer-en-facture:
 *   post:
 *     summary: Convertit un devis accepté en facture (nouvelle numérotation FAC-, le devis d'origine reste consultable)
 *     tags: [Factures]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               entrepot_id: { type: integer, nullable: true, description: 'Entrepôt de sortie de la facture ; le principal est utilisé par défaut.' }
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       201: { description: "Facture créée à partir du devis.", content: { application/json: { schema: { type: object, properties: { facture: { $ref: '#/components/schemas/Facture' } } } } } }
 *       404: { description: "Devis introuvable.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/:id/transformer-en-facture', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Ordre commun de verrouillage : compte, puis document métier.
    const [[account]] = await conn.query('SELECT fuseau_horaire FROM users WHERE id = ? FOR UPDATE', [req.tenantId]);
    const accountLocalDate = localDateString(account?.fuseau_horaire || 'Africa/Dakar');
    const [devisRows] = await conn.query(
      `SELECT * FROM factures WHERE id = ? AND user_id = ? AND type = 'devis' FOR UPDATE`,
      [req.params.id, req.tenantId]
    );
    const devis = devisRows[0];
    if (!devis) {
      await conn.rollback();
      return res.status(404).json({ error: 'Devis introuvable.' });
    }

    // Une conversion crée une facture ce mois-ci, même si le devis est ancien.
    const warehouse = await resoudreEntrepotFacture(conn, req.tenantId, req.body?.entrepot_id);
    if (!warehouse) {
      await conn.rollback();
      return res.status(400).json({ error: 'Entrepôt de sortie invalide ou inactif pour cette entreprise.' });
    }
    const invoiceWarehouseId = Number(warehouse.id);
    const quota = await reserveMonthlyInvoiceQuota(conn, req.tenantId);
    if (!quota.allowed) {
      // Préserver le registre reconstitué malgré le refus de la facture.
      await conn.commit();
      notifierUtilisateur(req.tenantId, 'alerte_quota', {
        message: `Vous avez atteint la limite de ${quota.limit} factures du plan Gratuit ce mois-ci.`
      });
      return res.status(403).json({
        error: `Le plan Gratuit est limité à ${quota.limit} factures par mois. Passez à un plan payant dans Paramètres pour continuer.`,
        code: 'QUOTA_DEPASSE'
      });
    }

    const numero = await nextNumero(conn, req.tenantId, 'facture', Number(accountLocalDate.slice(0, 4)));
    await conn.query(
      `UPDATE factures SET type = 'facture', entrepot_id = ?, numero = ?, date_emission = ?, statut = 'en_attente', date_validite = NULL WHERE id = ? AND user_id = ? AND type = 'devis'`,
      [invoiceWarehouseId, numero, accountLocalDate, devis.id, req.tenantId]
    );
    const [lignesDevis] = await conn.query(
      'SELECT produit_id, quantite FROM facture_lignes WHERE facture_id = ? AND produit_id IS NOT NULL',
      [devis.id]
    );
    await appliquerAjustementsStock(
      conn, req.tenantId, invoiceWarehouseId,
      lignesDevis.map((l) => ({ produit_id: l.produit_id, delta: -l.quantite }))
    );

    await conn.commit();
    const [rows] = await pool.query(
      'SELECT * FROM factures WHERE id = ? AND user_id = ?',
      [devis.id, req.tenantId]
    );
    return res.json({ facture: rows[0] });
  } catch (err) {
    await conn.rollback().catch(() => {});
    return next(err);
  } finally {
    conn.release();
  }
});
// Duplique une facture ou un devis existant (même client, mêmes lignes) avec un nouveau
// numéro, une nouvelle date d'émission et un statut remis à zéro.
/**
 * @openapi
 * /factures/{id}/dupliquer:
 *   post:
 *     summary: Duplique une facture/devis existant en nouveau brouillon (nouveau numéro, statut réinitialisé)
 *     tags: [Factures]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       201: { description: "Copie créée.", content: { application/json: { schema: { type: object, properties: { facture: { $ref: '#/components/schemas/Facture' } } } } } }
 *       404: { description: "Document introuvable.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/:id/dupliquer', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Toutes les créations de factures verrouillent d'abord le compte pour sérialiser le quota.
    const [[account]] = await conn.query('SELECT fuseau_horaire FROM users WHERE id = ? FOR UPDATE', [req.tenantId]);
    const accountLocalDate = localDateString(account?.fuseau_horaire || 'Africa/Dakar');
    const [sourceRows] = await conn.query(
      'SELECT * FROM factures WHERE id = ? AND user_id = ? FOR UPDATE',
      [req.params.id, req.tenantId]
    );
    const source = sourceRows[0];
    if (!source) {
      await conn.rollback();
      return res.status(404).json({ error: 'Document introuvable.' });
    }

    if (source.type === 'facture') {
      const quota = await reserveMonthlyInvoiceQuota(conn, req.tenantId);
      if (!quota.allowed) {
        // Préserver le registre reconstitué malgré le refus de la facture.
        await conn.commit();
        notifierUtilisateur(req.tenantId, 'alerte_quota', {
          message: `Vous avez atteint la limite de ${quota.limit} factures du plan Gratuit ce mois-ci.`
        });
        return res.status(403).json({
          error: `Le plan Gratuit est limité à ${quota.limit} factures par mois. Passez à un plan payant dans Paramètres pour continuer.`,
          code: 'QUOTA_DEPASSE'
        });
      }
    }

    const [lignesSource] = await conn.query(
      'SELECT * FROM facture_lignes WHERE facture_id = ?',
      [source.id]
    );
    let duplicatedWarehouseId = null;
    if (source.type === 'facture') {
      const warehouse = await resoudreEntrepotFacture(conn, req.tenantId, source.entrepot_id);
      if (!warehouse) {
        await conn.rollback();
        return res.status(409).json({ error: 'L’entrepôt de sortie de la facture source est indisponible.' });
      }
      duplicatedWarehouseId = Number(warehouse.id);
    }
    const numero = await nextNumero(conn, req.tenantId, source.type, Number(accountLocalDate.slice(0, 4)));
    const [result] = await conn.query(
      `INSERT INTO factures (user_id, client_id, entrepot_id, numero, type, date_emission, date_echeance, date_validite, objet, reference_externe, conditions_reglement, devise, statut, remise, frais_livraison, mode_paiement, commentaires, sous_total, total_tva, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en_attente', ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.tenantId, source.client_id, duplicatedWarehouseId, numero, source.type, accountLocalDate, source.date_echeance || null,
        source.date_validite || null, source.objet || null, source.reference_externe || null,
        source.conditions_reglement || null, source.devise || 'FCFA', source.remise,
        source.frais_livraison, source.mode_paiement, source.commentaires,
        source.sous_total, source.total_tva, source.total
      ]
    );
    const nouvelId = result.insertId;
    await insererLignesFacture(conn, nouvelId, lignesSource);
    if (source.type === 'facture') {
      await appliquerAjustementsStock(conn, req.tenantId, duplicatedWarehouseId,
        lignesSource.map(ligne => ({ produit_id: ligne.produit_id, delta: -Number(ligne.quantite) })));
    }
    await conn.commit();

    const [rows] = await pool.query(
      'SELECT * FROM factures WHERE id = ? AND user_id = ?',
      [nouvelId, req.tenantId]
    );
    return res.status(201).json({ facture: rows[0] });
  } catch (err) {
    await conn.rollback().catch(() => {});
    return next(err);
  } finally {
    conn.release();
  }
});
// Génère et renvoie un vrai fichier PDF de la facture/du devis (téléchargement direct,
// sans passer par la boîte de dialogue d'impression du navigateur).
/**
 * @openapi
 * /factures/{id}/pdf:
 *   get:
 *     summary: "Télécharge la facture/le devis en PDF (rendu identique à l'écran : logo, QR code, signature, modèle choisi)"
 *     tags: [Factures]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Fichier PDF.
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       404: { description: "Document introuvable.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 *       502: { description: "Génération du PDF échouée (réessayer).", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/:id/pdf/async', async (req, res, next) => {
  try {
    if (!process.env.REDIS_URL) return res.status(503).json({ error: "La génération PDF asynchrone n'est pas configurée." });
    const [rows] = await pool.query('SELECT id FROM factures WHERE id = ? AND user_id = ?', [req.params.id, req.tenantId]);
    if (!rows.length) return res.status(404).json({ error: 'Document introuvable.' });
    const jobId = await enqueuePdfJob({ factureId: req.params.id, user: { ...req.user, id: req.tenantId } });
    res.status(202).json({ job_id: jobId, status: 'queued' });
  } catch (err) { next(err); }
});

router.get('/:id/pdf/jobs/:jobId', async (req, res, next) => {
  try {
    const job = await getPdfJob(req.params.jobId, req.tenantId);
    if (!job) return res.status(404).json({ error: 'Job PDF introuvable.' });
    if (String(job.factureId) !== String(req.params.id)) return res.status(404).json({ error: 'Job PDF introuvable.' });
    if (job.status === 'completed') {
      return res.json({ status: job.status, download_url: `/api/factures/${req.params.id}/pdf/jobs/${req.params.jobId}/download` });
    }
    res.json({ status: job.status, error: job.error || null });
  } catch (err) { next(err); }
});

router.get('/:id/pdf/jobs/:jobId/download', async (req, res, next) => {
  try {
    const job = await getPdfJob(req.params.jobId, req.tenantId);
    if (!job || String(job.factureId) !== String(req.params.id) || job.status !== 'completed') {
      return res.status(404).json({ error: 'PDF non disponible.' });
    }
    const file = await getPdfPath(req.params.jobId);
    const [rows] = await pool.query('SELECT numero, type FROM factures WHERE id = ? AND user_id = ?', [req.params.id, req.tenantId]);
    if (!rows.length) return res.status(404).json({ error: 'Document introuvable.' });
    const prefixe = rows[0].type === 'devis' ? 'devis' : 'facture';
    res.download(file, `${prefixe}-${rows[0].numero}.pdf`, err => { if (err && !res.headersSent) next(err); });
  } catch (err) { next(err); }
});

router.get('/:id/pdf', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, numero, type FROM factures WHERE id = ? AND user_id = ?', [req.params.id, req.tenantId]);
    const facture = rows[0];
    if (!facture) return res.status(404).json({ error: 'Document introuvable.' });

    const pdfBuffer = await genererPdfFacture(facture.id, { ...req.user, id: req.tenantId });
    const prefixe = facture.type === 'devis' ? 'devis' : 'facture';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${prefixe}-${facture.numero}.pdf"`,
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Génération PDF échouée :', err.message);
    res.status(502).json({ error: "Impossible de générer le PDF pour le moment. Réessayez dans un instant." });
  }
});

// Envoie la facture/le devis par email au client, avec un lien de consultation en ligne
// (lecture seule, sans compte requis) réutilisant le code de vérification du QR code.
/**
 * @openapi
 * /factures/{id}/envoyer:
 *   post:
 *     summary: Envoie la facture/le devis par email au client (lien de consultation en ligne + PDF en pièce jointe)
 *     tags: [Factures]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { email: { type: string, description: "Remplace l'email du client par défaut." } }
 *     responses:
 *       200: { description: "Email envoyé.", content: { application/json: { schema: { type: object, properties: { success: { type: boolean }, sent_to: { type: string } } } } } }
 *       400: { description: "Aucune adresse email disponible.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 *       404: { description: "Document introuvable.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
/**
 * Envoie une facture/devis par email au client, avec PDF en pièce jointe si la génération
 * réussit (sinon l'email part quand même, sans bloquer sur un souci de rendu PDF). Extraite
 * en fonction réutilisable pour que la route manuelle ci-dessous ET l'envoi automatique des
 * factures récurrentes (voir config/scheduler.js) partagent exactement la même logique —
 * un seul endroit de vérité, pas de comportement divergent entre les deux déclencheurs.
 * @param {string|undefined} destinataireForce email explicite (sinon celui du client)
 */
async function envoyerFactureParEmail(factureId, userId, baseUrl, destinataireForce) {
  const [rows] = await pool.query(
    `SELECT f.*, c.nom as client_nom, c.email as client_email,
            u.entreprise_nom, u.nom as user_nom, u.email as user_email, u.role as user_role
     FROM factures f JOIN clients c ON c.id = f.client_id AND c.user_id = f.user_id JOIN users u ON u.id = f.user_id
     WHERE f.id = ? AND f.user_id = ?`,
    [factureId, userId]
  );
  const facture = rows[0];
  if (!facture) throw new Error('Document introuvable.');

  const destinataire = destinataireForce || facture.client_email;
  if (!destinataire) throw new Error("Aucune adresse email pour ce client.");

  if (!facture.verification_code) {
    facture.verification_code = crypto.randomBytes(5).toString('hex');
    await pool.query('UPDATE factures SET verification_code = ? WHERE id = ? AND user_id = ?', [facture.verification_code, facture.id, userId]);
  }

  const consultUrl = `${baseUrl}/consulter.html?id=${facture.id}&code=${facture.verification_code}`;
  const emetteur = facture.entreprise_nom || facture.user_nom;
  const isDevis = facture.type === 'devis';
  const label = isDevis ? 'devis' : 'facture';
  if (!isSmtpConfigured()) {
    const error = new Error('SMTP non configuré : email non envoyé.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }
  const safeClientNom = escapeHtmlEmail(facture.client_nom);
  const safeEmetteur = escapeHtmlEmail(emetteur);
  const safeNumero = escapeHtmlEmail(facture.numero);
  const safeConsultUrl = escapeHtmlEmail(consultUrl);
  const montantFormate = formatAmountWithCurrency(facture.total, facture.devise);
  const safeMontantFormate = escapeHtmlEmail(montantFormate);

  let attachments;
  try {
    // genererPdfFacture signe un token temporaire avec id/email/role/nom (voir
    // utils/pdf.js) : on reconstruit ici le même objet "utilisateur" que req.user
    // fournirait normalement, à partir des colonnes déjà jointes ci-dessus — pour que
    // l'envoi automatique (sans req, déclenché par le planificateur) se comporte
    // exactement comme l'envoi manuel depuis la route.
    const pdfBuffer = await genererPdfFacture(facture.id, { id: userId, email: facture.user_email, role: facture.user_role, nom: facture.user_nom });
    attachments = [{ filename: `${label}-${facture.numero}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }];
  } catch (pdfErr) {
    console.error('PDF joint à l\'email échoué (email envoyé sans pièce jointe) :', pdfErr.message);
  }

  const mailResult = await sendMail({
    to: destinataire,
    subject: sanitizeEmailHeader(`${emetteur} vous a envoyé un ${label} — ${facture.numero}`),
    text: `Bonjour ${facture.client_nom},\n\n${emetteur} vous a envoyé un ${label} d'un montant de ${montantFormate}.\n\nConsultez-le en ligne : ${consultUrl}\n\nMerci de votre confiance.`,
    html: `<p>Bonjour ${safeClientNom},</p><p><strong>${safeEmetteur}</strong> vous a envoyé un ${label} (${safeNumero}) d'un montant de <strong>${safeMontantFormate}</strong>.</p><p><a href="${safeConsultUrl}" style="display:inline-block;padding:10px 18px;background:#0FA980;color:#fff;border-radius:8px;text-decoration:none;">Consulter le ${label}</a></p><p>Ou copiez ce lien : ${safeConsultUrl}</p>`,
    attachments
  });
  if (!mailResult?.sent) {
    const error = new Error('SMTP non configuré : email non envoyé.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  return { success: true, sent_to: destinataire };
}

router.post('/:id/envoyer', async (req, res, next) => {
  try {
    const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const resultat = await envoyerFactureParEmail(req.params.id, req.tenantId, baseUrl, req.body && req.body.email);
    res.json(resultat);
  } catch (err) {
    if (err.message === 'Document introuvable.') return res.status(404).json({ error: err.message });
    if (err.message === "Aucune adresse email pour ce client.") {
      return res.status(400).json({ error: "Aucune adresse email pour ce client. Ajoutez-en une dans sa fiche, ou précisez-en une." });
    }
    if (err.code === 'SMTP_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
    next(err);
  }
});

// Envoie une relance pour une facture en attente ou en retard, même mécanisme avec un ton
// plus pressant — réduit les impayés.
/**
 * @openapi
 * /factures/{id}/relancer:
 *   post:
 *     summary: Envoie une relance par email pour une facture en attente/en retard (PDF joint)
 *     tags: [Factures]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { email: { type: string, description: "Remplace l'email du client par défaut." } }
 *     responses:
 *       200: { description: "Relance envoyée.", content: { application/json: { schema: { type: object, properties: { success: { type: boolean }, sent_to: { type: string } } } } } }
 *       400: { description: "Facture déjà payée, ou aucune adresse email disponible.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 *       404: { description: "Facture introuvable.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/:id/relancer', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT f.*, c.nom as client_nom, c.email as client_email, u.entreprise_nom, u.nom as user_nom
       FROM factures f JOIN clients c ON c.id = f.client_id AND c.user_id = f.user_id JOIN users u ON u.id = f.user_id
       WHERE f.id = ? AND f.user_id = ? AND f.type = 'facture'`,
      [req.params.id, req.tenantId]
    );
    const facture = rows[0];
    if (!facture) return res.status(404).json({ error: 'Facture introuvable.' });
    if (facture.statut === 'payee') return res.status(400).json({ error: 'Cette facture est déjà payée.' });

    const destinataire = (req.body && req.body.email) || facture.client_email;
    if (!destinataire) return res.status(400).json({ error: "Aucune adresse email pour ce client." });
    if (!isSmtpConfigured()) return res.status(503).json({ error: 'SMTP non configuré : email non envoyé.' });

    if (!facture.verification_code) {
      facture.verification_code = crypto.randomBytes(5).toString('hex');
      await pool.query('UPDATE factures SET verification_code = ? WHERE id = ? AND user_id = ?', [facture.verification_code, facture.id, req.tenantId]);
    }

    const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const consultUrl = `${baseUrl}/consulter.html?id=${facture.id}&code=${facture.verification_code}`;
    const emetteur = facture.entreprise_nom || facture.user_nom;
    const resteAPayer = Number(facture.total) - Number(facture.montant_paye);
    const resteAPayerFormate = formatAmountWithCurrency(resteAPayer, facture.devise);
    const safeResteAPayer = escapeHtmlEmail(resteAPayerFormate);

    const safeClientNom = escapeHtmlEmail(facture.client_nom);
    const safeEmetteur = escapeHtmlEmail(emetteur);
    const safeNumero = escapeHtmlEmail(facture.numero);
    const safeConsultUrl = escapeHtmlEmail(consultUrl);
    let attachments;
    try {
      const pdfBuffer = await genererPdfFacture(facture.id, { ...req.user, id: req.tenantId });
      attachments = [{ filename: `facture-${facture.numero}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }];
    } catch (pdfErr) {
      console.error('PDF joint à la relance échoué (email envoyé sans pièce jointe) :', pdfErr.message);
    }

    const mailResult = await sendMail({
      to: destinataire,
      subject: sanitizeEmailHeader(`Rappel : facture ${facture.numero} en attente de paiement`),
      text: `Bonjour ${facture.client_nom},\n\nNous vous rappelons que la facture ${facture.numero} d'un montant de ${resteAPayerFormate} est toujours en attente de règlement.\n\nConsultez-la ici : ${consultUrl}\n\nMerci de régulariser dans les meilleurs délais.`,
      html: `<p>Bonjour ${safeClientNom},</p><p>Nous vous rappelons que la facture <strong>${safeNumero}</strong> d'un montant restant dû de <strong>${safeResteAPayer}</strong> est toujours en attente de règlement par ${safeEmetteur}.</p><p><a href="${safeConsultUrl}" style="display:inline-block;padding:10px 18px;background:#E8A33D;color:#0F1B33;border-radius:8px;text-decoration:none;font-weight:600;">Consulter la facture</a></p><p>Merci de régulariser dans les meilleurs délais.</p>`,
      attachments
    });
    if (!mailResult?.sent) return res.status(503).json({ error: 'SMTP non configuré : email non envoyé.' });

    res.json({ success: true, sent_to: destinataire });
  } catch (err) {
    if (err.code === 'SMTP_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
    next(err);
  }
});

/**
 * @openapi
 * /factures/{id}:
 *   delete:
 *     summary: Supprime uniquement un devis sans historique (les factures émises sont conservées)
 *     tags: [Factures]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: "Devis supprimé." }
 *       404: { description: "Document introuvable.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 *       409: { description: "Document émis ou avec historique protégé.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.delete('/:id', async (req, res, next) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    // Sérialiser la suppression avec les annulations, réactivations et postings comptables.
    const [existingRows] = await conn.query(
      'SELECT * FROM factures WHERE id = ? AND user_id = ? FOR UPDATE',
      [req.params.id, req.tenantId]
    );
    const existing = existingRows[0];
    if (!existing) {
      await conn.rollback();
      return res.status(404).json({ error: 'Facture introuvable.' });
    }

    // Une facture émise est un document final et ne se supprime jamais, même avant paiement
    // ou comptabilisation. Utiliser l'annulation et les contrepassations pour garder la piste
    // d'audit, les mouvements de stock et les liens aux règlements.
    if (existing.type === 'facture') {
      await conn.rollback();
      return res.status(409).json({
        error: 'Une facture émise ne peut pas être supprimée. Utilisez son annulation ou une contrepassation pour conserver la traçabilité.',
        code: 'DOCUMENT_HISTORIQUE_PROTEGE'
      });
    }

    // Un devis ne peut être supprimé que s'il est réellement sans historique lié.
    const historySql = "SELECT\n"+
      "(SELECT COUNT(*) FROM paiements WHERE user_id = ? AND facture_id = ?) AS paiements,\n"+
      "(SELECT COUNT(*) FROM pro_refund_requests r JOIN paiements p ON p.id = r.paiement_id AND p.user_id = r.user_id WHERE r.user_id = ? AND p.facture_id = ?) AS remboursements,\n"+
      "(SELECT COUNT(*) FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'facture' AND source_id = ?) AS ecritures_facture,\n"+
      "(SELECT COUNT(*) FROM pro_compta_lignes WHERE user_id = ? AND facture_id = ?) AS lignes_comptables,\n"+
      "(SELECT COUNT(*) FROM pro_avoirs WHERE user_id = ? AND facture_id = ?) AS avoirs,\n"+
      "(SELECT COUNT(*) FROM pro_acomptes WHERE user_id = ? AND facture_id = ?) AS acomptes,\n"+
      "(SELECT COUNT(*) FROM pro_payment_links WHERE user_id = ? AND facture_id = ?) AS liens_paiement,\n"+
      "(SELECT COUNT(*) FROM pro_invoice_checkouts WHERE user_id = ? AND facture_id = ?) AS checkouts,\n"+
      "(SELECT COUNT(*) FROM pro_bons_livraison WHERE user_id = ? AND facture_id = ?) AS bons_livraison,\n"+
      "(SELECT COUNT(*) FROM pro_documents WHERE user_id = ? AND facture_id = ?) AS documents,\n"+
      "(SELECT COUNT(*) FROM pro_portal_quote_decisions WHERE user_id = ? AND facture_id = ?) AS decisions_portail";
    const [historyRows] = await conn.query(historySql, [
      req.tenantId, existing.id,
      req.tenantId, existing.id,
      req.tenantId, existing.id,
      req.tenantId, existing.id,
      req.tenantId, existing.id,
      req.tenantId, existing.id,
      req.tenantId, existing.id,
      req.tenantId, existing.id,
      req.tenantId, existing.id,
      req.tenantId, existing.id,
      req.tenantId, existing.id
    ]);
    if (Object.values(historyRows[0] || {}).some(count => Number(count) > 0)) {
      await conn.rollback();
      return res.status(409).json({
        error: 'Ce document possède un historique financier, comptable, commercial ou documentaire et ne peut pas être supprimé.',
        code: 'DOCUMENT_HISTORIQUE_PROTEGE'
      });
    }

    await conn.query('DELETE FROM factures WHERE id = ? AND user_id = ?', [existing.id, req.tenantId]);
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

// --- Paiements liés à une facture ---
/**
 * @openapi
 * /factures/{id}/paiements:
 *   post:
 *     summary: Enregistre un paiement (partiel ou total) sur une facture — la marque "payée" automatiquement si le montant total est atteint
 *     tags: [Factures]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [montant, methode]
 *             properties:
 *               montant: { type: number, example: 15000 }
 *               methode: { type: string, example: 'Wave' }
 *               reference: { type: string, nullable: true }
 *     responses:
 *       201: { description: "Paiement enregistré.", content: { application/json: { schema: { type: object, properties: { facture: { $ref: '#/components/schemas/Facture' } } } } } }
 *       400: { description: "Montant ou méthode invalide.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 *       404: { description: "Facture introuvable.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/:id/paiements', async (req, res, next) => {
  let conn;
  let idempotencyKey = null;
  try {
    idempotencyKey = req.get('Idempotency-Key')?.trim() || null;
    if (idempotencyKey && (idempotencyKey.length < 8 || idempotencyKey.length > 100)) {
      return res.status(400).json({ error: 'Idempotency-Key invalide (8 à 100 caractères).' });
    }

    const { montant, methode, reference } = req.body;
    const montantNum = round2(Number(montant));
    const methodeValidee = typeof methode === 'string' ? methode.trim().slice(0, 50) : '';
    const referenceValidee = optionalText(reference, 100);
    if (!Number.isFinite(montantNum) || montantNum <= 0 ||
        montantNum > 999999999999.99 || !methodeValidee) {
      return res.status(400).json({ error: 'Montant positif (au centime) et méthode de paiement valides requis.' });
    }

    // Rejeu optimiste : la connexion transactionnelle n'existe pas encore, utiliser le pool.
    if (idempotencyKey) {
      const [existingPayments] = await pool.query(
        'SELECT facture_id FROM paiements WHERE user_id = ? AND idempotency_key = ? LIMIT 1',
        [req.tenantId, idempotencyKey]
      );
      if (existingPayments.length) {
        if (Number(existingPayments[0].facture_id) !== Number(req.params.id)) {
          return res.status(409).json({
            error: 'Cette Idempotency-Key est déjà utilisée pour une autre facture.',
            code: 'IDEMPOTENCY_KEY_REUTILISEE'
          });
        }
        const [existingFacture] = await pool.query(
          'SELECT * FROM factures WHERE id = ? AND user_id = ?',
          [existingPayments[0].facture_id, req.tenantId]
        );
        if (!existingFacture.length) return res.status(404).json({ error: 'Facture introuvable.' });
        return res.status(200).json({ facture: existingFacture[0], idempotent_replay: true });
      }
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [factureRows] = await conn.query(
      'SELECT * FROM factures WHERE id = ? AND user_id = ? FOR UPDATE',
      [req.params.id, req.tenantId]
    );
    const facture = factureRows[0];
    if (!facture) {
      await conn.rollback();
      return res.status(404).json({ error: 'Facture introuvable.' });
    }

    // Second contrôle dans la transaction : deux appels concurrents peuvent avoir franchi
    // le contrôle optimiste avant l'insertion du premier règlement.
    if (idempotencyKey) {
      const [paymentRows] = await conn.query(
        'SELECT facture_id FROM paiements WHERE user_id = ? AND idempotency_key = ? LIMIT 1',
        [req.tenantId, idempotencyKey]
      );
      if (paymentRows.length) {
        await conn.rollback();
        if (Number(paymentRows[0].facture_id) !== Number(req.params.id)) {
          return res.status(409).json({
            error: 'Cette Idempotency-Key est déjà utilisée pour une autre facture.',
            code: 'IDEMPOTENCY_KEY_REUTILISEE'
          });
        }
        const [existingFacture] = await pool.query(
          'SELECT * FROM factures WHERE id = ? AND user_id = ?',
          [paymentRows[0].facture_id, req.tenantId]
        );
        if (!existingFacture.length) return res.status(404).json({ error: 'Facture introuvable.' });
        return res.status(200).json({ facture: existingFacture[0], idempotent_replay: true });
      }
    }

    if (facture.type !== 'facture' || facture.statut === 'annulee') {
      await conn.rollback();
      return res.status(409).json({
        error: 'Seule une facture active peut recevoir un règlement.',
        code: 'FACTURE_NON_ENCAISSABLE'
      });
    }

    const resteAPayerAvant = round2(Number(facture.total) - Number(facture.montant_paye));
    if (montantNum > resteAPayerAvant) {
      await conn.rollback();
      return res.status(400).json({
        error: `Le montant dépasse le solde restant dû (${formatAmountWithCurrency(resteAPayerAvant, facture.devise)}).`
      });
    }

    await conn.query(
      'INSERT INTO paiements (user_id, facture_id, montant, methode, reference, idempotency_key) VALUES (?, ?, ?, ?, ?, ?)',
      [req.tenantId, facture.id, montantNum, methodeValidee, referenceValidee, idempotencyKey]
    );

    const nouveauMontantPaye = round2(Number(facture.montant_paye) + montantNum);
    const nouveauStatut = nouveauMontantPaye >= round2(Number(facture.total)) ? 'payee' : facture.statut;
    await conn.query(
      'UPDATE factures SET montant_paye = ?, statut = ? WHERE id = ? AND user_id = ?',
      [nouveauMontantPaye, nouveauStatut, facture.id, req.tenantId]
    );
    await conn.commit();

    queueWebhookEvent(req.tenantId, 'payment.received', {
      facture_id: facture.id, montant: montantNum, methode: methodeValidee
    }).catch(err => console.warn('Webhook payment.received ignoré :', err.message));

    const [updatedRows] = await pool.query(
      'SELECT * FROM factures WHERE id = ? AND user_id = ?',
      [facture.id, req.tenantId]
    );
    if (nouveauStatut === 'payee' && facture.statut !== 'payee') {
      notifierUtilisateur(req.tenantId, 'facture_payee', { facture: updatedRows[0] });
    }
    return res.status(201).json({ facture: updatedRows[0] });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    if (err?.code === 'ER_DUP_ENTRY' && idempotencyKey) {
      try {
        const [existingPayments] = await pool.query(
          'SELECT facture_id FROM paiements WHERE user_id = ? AND idempotency_key = ? LIMIT 1',
          [req.tenantId, idempotencyKey]
        );
        if (existingPayments.length) {
          if (Number(existingPayments[0].facture_id) !== Number(req.params.id)) {
            return res.status(409).json({
              error: 'Cette Idempotency-Key est déjà utilisée pour une autre facture.',
              code: 'IDEMPOTENCY_KEY_REUTILISEE'
            });
          }
          const [existingFacture] = await pool.query(
            'SELECT * FROM factures WHERE id = ? AND user_id = ?',
            [existingPayments[0].facture_id, req.tenantId]
          );
          if (existingFacture.length) {
            return res.status(200).json({ facture: existingFacture[0], idempotent_replay: true });
          }
        }
      } catch (replayErr) {
        return next(replayErr);
      }
    }
    return next(err);
  } finally {
    if (conn) conn.release();
  }
});

// computeTotals est réutilisée par factures-recurrentes.js pour que la génération
// automatique applique exactement la même règle de calcul (remise prorata avant TVA,
// arrondis) qu'une facture créée manuellement — un seul endroit de vérité pour ce calcul.
module.exports = router;
module.exports.computeTotals = computeTotals;
module.exports.ajusterStockFacture = ajusterStockFacture;
module.exports.resoudreEntrepotFacture = resoudreEntrepotFacture;
module.exports.insererLignesFacture = insererLignesFacture;
// envoyerFactureParEmail est réutilisée par config/scheduler.js pour l'envoi automatique
// des factures générées depuis un modèle récurrent (voir étape 2 ci-dessous).
module.exports.envoyerFactureParEmail = envoyerFactureParEmail;
