/**
 * Routes CRUD de base des factures/devis (voir refactorisation : routes/factures/).
 * Extrait depuis routes/factures.js — GET /, GET /:id, POST /, DELETE /:id.
 */
const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { pool } = require('../../config/db');
const { localDateString } = require('../../utils/local-date');
const { SUPPORTED_CURRENCIES } = require('../../config/localization');
const { getPagination, buildPaginationMeta } = require('../../utils/pagination');
const { optionalText, optionalIsoDate } = require('../../utils/optional-fields');
const {
  MAX_MONEY_CENTS,
  parseDecimalInput,
  computeTotals,
  remiseInputValue
} = require('../../utils/factures');
const {
  nextNumero,
  insererLignesFacture,
  resoudreEntrepotFacture,
  appliquerAjustementsStock
} = require('../../services/factures');

const router = express.Router();

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
    // Le code protège les liens publics; la liste n'en a pas besoin, contrairement au détail.
    const factures = rows.map((row) => {
      const safeRow = { ...row };
      delete safeRow.verification_code;
      return safeRow;
    });
    res.json({ factures, pagination: buildPaginationMeta(page, limite, total) });
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
    // Factures et devis doivent tous deux figer la devise au premier document.
    // Le quota facture utilise déjà ce verrou ; le prendre ici aussi pour les devis
    // et relire la devise après le verrou évite toute valeur devenue obsolète.
    const [[company]] = await conn.query(
      'SELECT devise, fuseau_horaire FROM users WHERE id = ? FOR UPDATE',
      [req.tenantId]
    );
    if (!company) {
      await conn.rollback();
      return res.status(404).json({ error: 'Entreprise introuvable.' });
    }
    const companyCurrency = String(company.devise || 'FCFA').toUpperCase();
    const companyLocalDate = localDateString(company.fuseau_horaire || 'Africa/Dakar');
    const documentCurrency = String(devise || companyCurrency).toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(documentCurrency)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Devise de document non prise en charge.' });
    }
    if (documentCurrency !== companyCurrency) {
      await conn.rollback();
      return res.status(409).json({ error: 'La devise du document doit correspondre à la devise de base de l’entreprise. Les conversions multi-devises ne sont pas encore activées.' });
    }

    let invoiceWarehouseId = null;
    if (docType === 'facture') {
      const { reserveMonthlyInvoiceQuota } = require('../../utils/invoice-quota');
      const { notifierUtilisateur } = require('../../realtime');
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
    // bloque jamais la création si le stock devient négatif.
    if (docType === 'facture') {
      await appliquerAjustementsStock(conn, req.tenantId, invoiceWarehouseId, computedLignes.map((l) => ({ produit_id: l.produit_id, delta: -l.quantite })));
    }

    await conn.commit();
    const [factureRows] = await conn.query('SELECT * FROM factures WHERE id = ?', [factureId]);
    res.status(201).json({ facture: factureRows[0] });
    if (docType === 'facture') {
      const { queueWebhookEvent } = require('../../utils/pro-webhooks');
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

    // Une facture émise est un document final et ne se supprime jamais.
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

module.exports = router;
