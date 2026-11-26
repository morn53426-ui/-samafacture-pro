/**
 * Routes de statut des factures/devis : changement de statut, transformation
 * devis → facture, duplication. Extrait depuis routes/factures.js (Phase 2).
 */
const express = require('express');
const { pool } = require('../../config/db');
const { localDateString } = require('../../utils/local-date');
const {
  nextNumero,
  insererLignesFacture,
  resoudreEntrepotFacture,
  appliquerAjustementsStock,
  ajusterStockFacture
} = require('../../services/factures');
const { reserveMonthlyInvoiceQuota } = require('../../utils/invoice-quota');
const { notifierUtilisateur } = require('../../realtime');
const { recordInvoiceAccountingTransition } = require('../../services/accounting-invoice-lifecycle');
const round2 = require('../../utils/money-format').roundMoney;

const router = express.Router();

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

    // Une facture déjà comptabilisée est contre-passée dans la même transaction.
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

module.exports = router;
