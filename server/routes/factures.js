const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { resolveTenant, requirePermission } = require('../middleware/tenant');
const { FREE_MONTHLY_INVOICE_LIMIT, isPaidPlan } = require('../utils/plans');
const { sendMail } = require('../config/mailer');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { genererPdfFacture } = require('../utils/pdf');
const { notifierUtilisateur } = require('../realtime');
const { enqueuePdfJob, getPdfJob, getPdfPath } = require('../pdf-queue');
const { queueWebhookEvent } = require('../utils/pro-webhooks');

const router = express.Router();
router.use(requireAuth, resolveTenant, requirePermission);

async function nextNumero(conn, userId, type) {
  const prefix = type === 'devis' ? 'DEV' : 'FAC';
  const year = new Date().getFullYear();

  // Incrément atomique via la table compteurs_numerotation : la ligne (user_id, type, année)
  // est verrouillée le temps de l'opération (dans la transaction en cours), ce qui élimine
  // tout risque de doublon même si deux factures sont créées en même temps.
  await conn.query(
    `INSERT INTO compteurs_numerotation (user_id, type, annee, dernier_numero)
     VALUES (?, ?, ?, LAST_INSERT_ID(1))
     ON DUPLICATE KEY UPDATE dernier_numero = LAST_INSERT_ID(dernier_numero + 1)`,
    [userId, type, year]
  );
  const [[{ n }]] = await conn.query('SELECT LAST_INSERT_ID() as n');
  const next = String(n).padStart(4, '0');
  return `${prefix}-${year}-${next}`;
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
  const quantityScale = 1000n;
  const taxScale = 10000n; // taux exprimé en centièmes de pourcentage
  const brutLignes = lignes.map((ligne) => {
    const quantite = parseDecimalInput(ligne.quantite, {
      field: 'Quantité', scale: 3, maxScaled: 99999999999999n
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

  // Répartir la remise au centime près ; la dernière ligne absorbe l'écart d'arrondi.
  let remiseDistribuee = 0n;
  const lignesAvecRemise = brutLignes.map((ligne, index) => {
    const part = index === brutLignes.length - 1
      ? remiseCents - remiseDistribuee
      : (sousTotalCents > 0n
        ? roundBigIntDivision(remiseCents * ligne.ligneHTCents, sousTotalCents)
        : 0n);
    remiseDistribuee += part;
    return { ...ligne, ligneHTNetteCents: ligne.ligneHTCents - part };
  });

  let totalTVACents = 0n;
  const computedLignes = lignesAvecRemise.map((ligne) => {
    const ligneTVACents = roundBigIntDivision(
      ligne.ligneHTNetteCents * ligne.tvaHundredths,
      taxScale
    );
    totalTVACents += ligneTVACents;
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
async function appliquerAjustementsStock(conn, userId, ajustements) {
  if (!ajustements.length) return;
  const parProduit = new Map();
  for (const { produit_id, delta } of ajustements) {
    if (!produit_id) continue;
    parProduit.set(Number(produit_id), (parProduit.get(Number(produit_id)) || 0) + Number(delta));
  }
  const ids = [...parProduit.keys()];
  if (!ids.length) return;

  // Le stock historique du catalogue reste le total agrégé. Le dépôt principal est
  // initialisé une seule fois à partir du stock existant pour assurer une migration
  // douce des anciennes entreprises. Chaque vente/annulation alimente ensuite le
  // journal multi-entrepôts dans la même transaction SQL que la facture.
  await conn.query(
    "INSERT IGNORE INTO pro_entrepots (user_id, code, nom, par_defaut) VALUES (?, 'PRINCIPAL', 'Magasin principal', 1)",
    [userId]
  );
  const [[warehouse]] = await conn.query(
    'SELECT id, nom FROM pro_entrepots WHERE user_id = ? AND code = ? LIMIT 1',
    [userId, 'PRINCIPAL']
  );
  await conn.query(
    'INSERT IGNORE INTO pro_stocks_entrepots (user_id, entrepot_id, produit_id, quantite) SELECT p.user_id, ?, p.id, GREATEST(0, p.stock - COALESCE(existing.total, 0)) FROM produits p LEFT JOIN (SELECT user_id, produit_id, SUM(quantite) AS total FROM pro_stocks_entrepots GROUP BY user_id, produit_id) existing ON existing.user_id = p.user_id AND existing.produit_id = p.id WHERE p.user_id = ? AND p.id IN (' + ids.map(() => '?').join(',') + ')',
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
async function ajusterStockFacture(conn, factureId, userId, sens) {
  const [lignes] = await conn.query(
    'SELECT produit_id, quantite FROM facture_lignes WHERE facture_id = ? AND produit_id IS NOT NULL',
    [factureId]
  );
  await appliquerAjustementsStock(conn, userId, lignes.map((l) => ({ produit_id: l.produit_id, delta: sens * l.quantite })));
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

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM factures f${whereSql}`, params);
    const [rows] = await pool.query(
      `SELECT f.*, c.nom as client_nom, c.email as client_email FROM factures f JOIN clients c ON c.id = f.client_id${whereSql}
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
      `SELECT f.*, c.nom as client_nom, c.email as client_email, c.telephone as client_telephone, c.adresse as client_adresse
       FROM factures f JOIN clients c ON c.id = f.client_id WHERE f.id = ? AND f.user_id = ?`,
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
      pool.query('SELECT * FROM paiements WHERE facture_id = ? ORDER BY date_paiement DESC', [facture.id])
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
    const { client_id, type, date_emission, date_echeance, date_validite, objet, reference_externe, conditions_reglement, devise, remise, frais_livraison, mode_paiement, commentaires, lignes } = req.body;

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
        quantite: parseDecimalInput(ligne.quantite, { field: 'Quantité', scale: 3, maxScaled: 99999999999999n }).value,
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
      for (const l of lignes) {
        if (l.produit_id && !ownedIds.has(l.produit_id)) l.produit_id = null;
      }
    }

    const [companyRows] = await pool.query('SELECT devise FROM users WHERE id = ?', [req.tenantId]);
    const companyCurrency = String(companyRows[0]?.devise || 'FCFA').toUpperCase();
    const documentCurrency = String(devise || companyCurrency).toUpperCase();
    const supportedCurrencies = ['FCFA','XOF','XAF','GNF','EUR','USD','GBP','CAD','MAD'];
    if (!supportedCurrencies.includes(documentCurrency)) return res.status(400).json({ error: 'Devise de document non prise en charge.' });
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

    // Quota du plan gratuit : 10 factures par mois (les devis restent illimités sur tous les
    // plans). On relit le plan depuis la base plutôt que le jeton JWT, pour qu'un changement
    // de plan prenne effet immédiatement sans attendre l'expiration de la session.
    if (docType === 'facture') {
      const [[userRow]] = await pool.query('SELECT plan FROM users WHERE id = ?', [req.tenantId]);
      if (!isPaidPlan(userRow?.plan)) {
        const [[{ n: countThisMonth }]] = await pool.query(
          `SELECT COUNT(*) as n FROM factures
           WHERE user_id = ? AND type = 'facture' AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
          [req.tenantId]
        );
        if (countThisMonth >= FREE_MONTHLY_INVOICE_LIMIT) {
          notifierUtilisateur(req.tenantId, 'alerte_quota', {
            message: `Vous avez atteint la limite de ${FREE_MONTHLY_INVOICE_LIMIT} factures du plan Gratuit ce mois-ci.`
          });
          return res.status(403).json({
            error: `Le plan Gratuit est limité à ${FREE_MONTHLY_INVOICE_LIMIT} factures par mois. Passez à un plan payant dans Paramètres pour continuer.`,
            code: 'QUOTA_DEPASSE'
          });
        }
      }
    }

    const { computedLignes, sous_total, total_tva, total, remise: remiseAppliquee, frais_livraison: fraisLivraisonValides } = computeTotals(lignesValidees, remise, frais_livraison);
    // Code court utilisé pour la vérification publique de la facture (via QR code) : évite
    // qu'un tiers puisse deviner l'URL de vérification d'une autre facture en changeant l'id.
    const verificationCode = crypto.randomBytes(5).toString('hex');

    conn = await pool.getConnection();
    await conn.beginTransaction();
    const numero = await nextNumero(conn, req.tenantId, docType);
    const [result] = await conn.query(
      `INSERT INTO factures (user_id, client_id, numero, type, date_emission, date_echeance, date_validite, objet, reference_externe, conditions_reglement, devise, statut, remise, frais_livraison, mode_paiement, commentaires, sous_total, total_tva, total, verification_code, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en_attente', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.tenantId, client_id, numero, docType, date_emission || new Date().toISOString().slice(0, 10),
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
      await appliquerAjustementsStock(conn, req.tenantId, computedLignes.map((l) => ({ produit_id: l.produit_id, delta: -l.quantite })));
    }

    await conn.commit();
    const [factureRows] = await pool.query('SELECT * FROM factures WHERE id = ?', [factureId]);
    res.status(201).json({ facture: factureRows[0] });
    if (docType === 'facture') {
      queueWebhookEvent(req.tenantId, 'invoice.created', { invoice_id: factureId, numero, total }).catch(err => console.warn('Webhook invoice.created ignoré :', err.message));
    }
  } catch (err) {
    if (conn) await conn.rollback();
    if (err?.code === 'ER_DUP_ENTRY' && req.get('Idempotency-Key')) {
      try {
        const [existing] = await pool.query(
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
    const [existingRows] = await pool.query('SELECT * FROM factures WHERE id = ? AND user_id = ?', [req.params.id, req.tenantId]);
    const existing = existingRows[0];
    if (!existing) { conn.release(); return res.status(404).json({ error: 'Facture introuvable.' }); }

    const { statut } = req.body;
    const valides = ['en_attente', 'payee', 'en_retard', 'annulee'];
    if (!valides.includes(statut)) { conn.release(); return res.status(400).json({ error: 'Statut invalide.' }); }

    await conn.beginTransaction();
    await conn.query('UPDATE factures SET statut = ? WHERE id = ? AND user_id = ?', [statut, existing.id, req.tenantId]);

    // Symétrie avec le décompte automatique du stock (voir POST / et /transformer-en-facture
    // ci-dessus) : annuler une facture doit restituer le stock déjà décompté, et ré-annuler
    // l'annulation (repasser à un autre statut) doit le redécompter — sinon le stock affiché
    // dérive silencieusement de la réalité à chaque annulation/réactivation.
    if (existing.type === 'facture' && existing.statut !== 'annulee' && statut === 'annulee') {
      await ajusterStockFacture(conn, existing.id, req.tenantId, +1); // restitue (+ stock)
    } else if (existing.type === 'facture' && existing.statut === 'annulee' && statut !== 'annulee') {
      await ajusterStockFacture(conn, existing.id, req.tenantId, -1); // redécompte (- stock)
    }

    await conn.commit();
    const [rows] = await pool.query('SELECT * FROM factures WHERE id = ? AND user_id = ?', [existing.id, req.tenantId]);
    res.json({ facture: rows[0] });
  } catch (err) {
    await conn.rollback();
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
    const [devisRows] = await pool.query(`SELECT * FROM factures WHERE id = ? AND user_id = ? AND type = 'devis'`, [req.params.id, req.tenantId]);
    const devis = devisRows[0];
    if (!devis) return res.status(404).json({ error: 'Devis introuvable.' });

    await conn.beginTransaction();
    const numero = await nextNumero(conn, req.tenantId, 'facture');
    await conn.query(`UPDATE factures SET type = 'facture', numero = ?, statut = 'en_attente', date_validite = NULL WHERE id = ? AND user_id = ?`, [numero, devis.id, req.tenantId]);

    // Décompte du stock au moment où le devis devient une vraie vente (même règle qu'à la
    // création directe d'une facture, voir POST / ci-dessus) — jamais fait tant que ce
    // n'était qu'un devis.
    const [lignesDevis] = await conn.query('SELECT produit_id, quantite FROM facture_lignes WHERE facture_id = ? AND produit_id IS NOT NULL', [devis.id]);
    await appliquerAjustementsStock(conn, req.tenantId, lignesDevis.map((l) => ({ produit_id: l.produit_id, delta: -l.quantite })));

    await conn.commit();

    const [rows] = await pool.query('SELECT * FROM factures WHERE id = ? AND user_id = ?', [devis.id, req.tenantId]);
    res.json({ facture: rows[0] });
  } catch (err) {
    await conn.rollback();
    next(err);
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
    const [sourceRows] = await pool.query('SELECT * FROM factures WHERE id = ? AND user_id = ?', [req.params.id, req.tenantId]);
    const source = sourceRows[0];
    if (!source) return res.status(404).json({ error: 'Document introuvable.' });

    const [lignesSource] = await pool.query('SELECT * FROM facture_lignes WHERE facture_id = ?', [source.id]);

    await conn.beginTransaction();
    const numero = await nextNumero(conn, req.tenantId, source.type);
    const [result] = await conn.query(
      `INSERT INTO factures (user_id, client_id, numero, type, date_emission, date_echeance, date_validite, objet, reference_externe, conditions_reglement, statut, remise, frais_livraison, mode_paiement, commentaires, sous_total, total_tva, total)
       VALUES (?, ?, ?, ?, CURDATE(), NULL, ?, ?, ?, ?, 'en_attente', ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.tenantId, source.client_id, numero, source.type, source.date_validite || null,
        source.objet || null, source.reference_externe || null, source.conditions_reglement || null,
        source.remise, source.frais_livraison, source.mode_paiement, source.commentaires,
        source.sous_total, source.total_tva, source.total
      ]
    );
    const nouvelId = result.insertId;

    await insererLignesFacture(conn, nouvelId, lignesSource);

    await conn.commit();
    const [rows] = await pool.query('SELECT * FROM factures WHERE id = ? AND user_id = ?', [nouvelId, req.tenantId]);
    res.status(201).json({ facture: rows[0] });
  } catch (err) {
    await conn.rollback();
    next(err);
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
     FROM factures f JOIN clients c ON c.id = f.client_id JOIN users u ON u.id = f.user_id
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

  await sendMail({
    to: destinataire,
    subject: `${emetteur} vous a envoyé un ${label} — ${facture.numero}`,
    text: `Bonjour ${facture.client_nom},\n\n${emetteur} vous a envoyé un ${label} d'un montant de ${facture.total} FCFA.\n\nConsultez-le en ligne : ${consultUrl}\n\nMerci de votre confiance.`,
    html: `<p>Bonjour ${facture.client_nom},</p><p><strong>${emetteur}</strong> vous a envoyé un ${label} (${facture.numero}) d'un montant de <strong>${facture.total} FCFA</strong>.</p><p><a href="${consultUrl}" style="display:inline-block;padding:10px 18px;background:#0FA980;color:#fff;border-radius:8px;text-decoration:none;">Consulter le ${label}</a></p><p>Ou copiez ce lien : ${consultUrl}</p>`,
    attachments
  });

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
       FROM factures f JOIN clients c ON c.id = f.client_id JOIN users u ON u.id = f.user_id
       WHERE f.id = ? AND f.user_id = ? AND f.type = 'facture'`,
      [req.params.id, req.tenantId]
    );
    const facture = rows[0];
    if (!facture) return res.status(404).json({ error: 'Facture introuvable.' });
    if (facture.statut === 'payee') return res.status(400).json({ error: 'Cette facture est déjà payée.' });

    const destinataire = (req.body && req.body.email) || facture.client_email;
    if (!destinataire) return res.status(400).json({ error: "Aucune adresse email pour ce client." });

    if (!facture.verification_code) {
      facture.verification_code = crypto.randomBytes(5).toString('hex');
      await pool.query('UPDATE factures SET verification_code = ? WHERE id = ?', [facture.verification_code, facture.id]);
    }

    const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const consultUrl = `${baseUrl}/consulter.html?id=${facture.id}&code=${facture.verification_code}`;
    const emetteur = facture.entreprise_nom || facture.user_nom;
    const resteAPayer = Number(facture.total) - Number(facture.montant_paye);

    let attachments;
    try {
      const pdfBuffer = await genererPdfFacture(facture.id, { ...req.user, id: req.tenantId });
      attachments = [{ filename: `facture-${facture.numero}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }];
    } catch (pdfErr) {
      console.error('PDF joint à la relance échoué (email envoyé sans pièce jointe) :', pdfErr.message);
    }

    await sendMail({
      to: destinataire,
      subject: `Rappel : facture ${facture.numero} en attente de paiement`,
      text: `Bonjour ${facture.client_nom},\n\nNous vous rappelons que la facture ${facture.numero} d'un montant de ${resteAPayer} FCFA est toujours en attente de règlement.\n\nConsultez-la ici : ${consultUrl}\n\nMerci de régulariser dans les meilleurs délais.`,
      html: `<p>Bonjour ${facture.client_nom},</p><p>Nous vous rappelons que la facture <strong>${facture.numero}</strong> d'un montant restant dû de <strong>${resteAPayer} FCFA</strong> est toujours en attente de règlement.</p><p><a href="${consultUrl}" style="display:inline-block;padding:10px 18px;background:#E8A33D;color:#0F1B33;border-radius:8px;text-decoration:none;font-weight:600;">Consulter la facture</a></p><p>Merci de régulariser dans les meilleurs délais.</p>`,
      attachments
    });

    res.json({ success: true, sent_to: destinataire });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /factures/{id}:
 *   delete:
 *     summary: Supprime une facture/devis (et ses lignes/paiements associés)
 *     tags: [Factures]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: "Supprimé." }
 *       404: { description: "Document introuvable.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.delete('/:id', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const [existingRows] = await pool.query('SELECT * FROM factures WHERE id = ? AND user_id = ?', [req.params.id, req.tenantId]);
    const existing = existingRows[0];
    if (!existing) { conn.release(); return res.status(404).json({ error: 'Facture introuvable.' }); }

    await conn.beginTransaction();
    // Restitue le stock déjà décompté avant de supprimer, sauf si la facture était déjà
    // annulée (son stock avait alors déjà été restitué par PUT /:id/statut — le restituer
    // une seconde fois créerait un stock fantôme supérieur à la réalité).
    if (existing.type === 'facture' && existing.statut !== 'annulee') {
      await ajusterStockFacture(conn, existing.id, req.tenantId, +1);
    }
    await conn.query('DELETE FROM factures WHERE id = ? AND user_id = ?', [existing.id, req.tenantId]);
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
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
  try {
    const idempotencyKey = req.get('Idempotency-Key')?.trim() || null;
    if (idempotencyKey && (idempotencyKey.length < 8 || idempotencyKey.length > 100)) {
      return res.status(400).json({ error: 'Idempotency-Key invalide (8 à 100 caractères).' });
    }
    const { montant, methode, reference } = req.body;
    const montantNum = Number(montant);
    if (!Number.isFinite(montantNum) || montantNum <= 0 || !methode) {
      return res.status(400).json({ error: 'Montant (positif) et méthode de paiement requis.' });
    }

    if (idempotencyKey) {
      const [existingPayment] = await pool.query(
        'SELECT p.*, f.* FROM paiements p JOIN factures f ON f.id = p.facture_id WHERE p.user_id = ? AND p.idempotency_key = ?',
        [req.tenantId, idempotencyKey]
      );
      if (existingPayment.length) {
        const [existingFacture] = await pool.query('SELECT * FROM factures WHERE id = ? AND user_id = ?', [existingPayment[0].facture_id, req.tenantId]);
        return res.status(200).json({ facture: existingFacture[0], idempotent_replay: true });
      }
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();
    // SELECT ... FOR UPDATE : verrouille la ligne facture le temps de la transaction, pour
    // que deux paiements enregistrés au même instant (ex. webhook + saisie manuelle, ou
    // double-clic) ne se basent jamais sur le même montant_paye de départ — même bug de
    // fond que la numérotation concurrente des factures (voir nextNumero), appliqué ici au
    // solde d'une facture pour ne jamais perdre un paiement en cas d'écritures simultanées.
    const [factureRows] = await conn.query('SELECT * FROM factures WHERE id = ? AND user_id = ? FOR UPDATE', [req.params.id, req.tenantId]);
    const facture = factureRows[0];
    if (!facture) {
      await conn.rollback();
      return res.status(404).json({ error: 'Facture introuvable.' });
    }

    // Le premier contrôle d'idempotence est optimiste et se fait avant la transaction.
    // Sous concurrence, deux requêtes peuvent toutefois franchir ce contrôle avant que
    // l'une des deux ait inséré le paiement. La facture est maintenant verrouillée par
    // SELECT ... FOR UPDATE : on refait donc le contrôle DANS la transaction. La seconde
    // requête attend le commit de la première, voit alors son paiement et le rejoue proprement
    // au lieu de tomber sur une erreur de contrainte unique / 500.
    if (idempotencyKey) {
      const [paymentRows] = await conn.query(
        'SELECT facture_id FROM paiements WHERE user_id = ? AND idempotency_key = ? LIMIT 1',
        [req.tenantId, idempotencyKey]
      );
      if (paymentRows.length) {
        await conn.rollback();
        const [existingFacture] = await pool.query(
          'SELECT * FROM factures WHERE id = ? AND user_id = ?',
          [paymentRows[0].facture_id, req.tenantId]
        );
        return res.status(200).json({ facture: existingFacture[0], idempotent_replay: true });
      }
    }

    // Empêche un paiement de dépasser le solde restant dû (ex. saisie manuelle erronée,
    // ou double soumission d'un même règlement) — le solde est lu sous le verrou FOR UPDATE
    // ci-dessus, donc cohérent même si un autre paiement vient d'être enregistré à l'instant.
    const resteAPayerAvant = round2(Number(facture.total) - Number(facture.montant_paye));
    if (round2(montantNum) > resteAPayerAvant) {
      await conn.rollback();
      return res.status(400).json({
        error: `Le montant dépasse le solde restant dû (${resteAPayerAvant} FCFA).`
      });
    }

    await conn.query(
      `INSERT INTO paiements (user_id, facture_id, montant, methode, reference, idempotency_key) VALUES (?, ?, ?, ?, ?, ?)`,
      [req.tenantId, facture.id, montantNum, methode, reference || null, idempotencyKey]
    );

    const nouveauMontantPaye = Number(facture.montant_paye) + montantNum;
    const nouveauStatut = nouveauMontantPaye >= Number(facture.total) ? 'payee' : facture.statut;
    await conn.query('UPDATE factures SET montant_paye = ?, statut = ? WHERE id = ?', [nouveauMontantPaye, nouveauStatut, facture.id]);
    await conn.commit();
    queueWebhookEvent(req.tenantId, 'payment.received', { facture_id: facture.id, montant: montantNum, methode }).catch(err => console.warn('Webhook payment.received ignoré :', err.message));

    const [updatedRows] = await pool.query('SELECT * FROM factures WHERE id = ?', [facture.id]);
    res.status(201).json({ facture: updatedRows[0] });

    if (nouveauStatut === 'payee' && facture.statut !== 'payee') {
      notifierUtilisateur(req.tenantId, 'facture_payee', { facture: updatedRows[0] });
    }
  } catch (err) {
    if (conn) await conn.rollback();
    if (err?.code === 'ER_DUP_ENTRY' && req.get('Idempotency-Key')) {
      try {
        const key = req.get('Idempotency-Key').trim();
        const [existingPayment] = await pool.query(
          'SELECT facture_id FROM paiements WHERE user_id = ? AND idempotency_key = ?',
          [req.tenantId, key]
        );
        if (existingPayment.length) {
          const [existingFacture] = await pool.query('SELECT * FROM factures WHERE id = ? AND user_id = ?', [existingPayment[0].facture_id, req.tenantId]);
          return res.status(200).json({ facture: existingFacture[0], idempotent_replay: true });
        }
      } catch (replayErr) { return next(replayErr); }
    }
    next(err);
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
module.exports.insererLignesFacture = insererLignesFacture;
// envoyerFactureParEmail est réutilisée par config/scheduler.js pour l'envoi automatique
// des factures générées depuis un modèle récurrent (voir étape 2 ci-dessous).
module.exports.envoyerFactureParEmail = envoyerFactureParEmail;
