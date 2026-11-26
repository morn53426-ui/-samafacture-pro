/**
 * Routes des paiements liés à une facture (voir refactorisation : routes/factures/).
 * Extrait depuis routes/factures.js — POST /:id/paiements (idempotent, sécurisé).
 */
const express = require('express');
const { pool } = require('../../config/db');
const { roundMoney, formatAmountWithCurrency } = require('../../utils/money-format');
const { optionalText } = require('../../utils/optional-fields');
const { notifierUtilisateur } = require('../../realtime');
const { queueWebhookEvent } = require('../../utils/pro-webhooks');
const round2 = roundMoney;

const router = express.Router();

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
  let montantNum = null;
  let methodeValidee = null;
  let referenceValidee = null;

  const respondWithExistingPayment = async existingPayment => {
    if (Number(existingPayment.facture_id) !== Number(req.params.id)) {
      return res.status(409).json({
        error: 'Cette Idempotency-Key est déjà utilisée pour une autre facture.',
        code: 'IDEMPOTENCY_KEY_REUTILISEE'
      });
    }

    const sameRequest =
      round2(Number(existingPayment.montant)) === montantNum &&
      existingPayment.methode === methodeValidee &&
      (existingPayment.reference ?? null) === (referenceValidee ?? null);
    if (!sameRequest) {
      return res.status(409).json({
        error: 'Cette Idempotency-Key a déjà été utilisée avec des paramètres différents.',
        code: 'IDEMPOTENCY_KEY_CONFLIT_REQUETE'
      });
    }

    const [existingFacture] = await pool.query(
      'SELECT * FROM factures WHERE id = ? AND user_id = ?',
      [existingPayment.facture_id, req.tenantId]
    );
    if (!existingFacture.length) return res.status(404).json({ error: 'Facture introuvable.' });
    return res.status(200).json({ facture: existingFacture[0], idempotent_replay: true });
  };

  try {
    idempotencyKey = req.get('Idempotency-Key')?.trim() || null;
    if (idempotencyKey && (idempotencyKey.length < 8 || idempotencyKey.length > 100)) {
      return res.status(400).json({ error: 'Idempotency-Key invalide (8 à 100 caractères).' });
    }

    const { montant, methode, reference } = req.body;
    montantNum = round2(Number(montant));
    methodeValidee = typeof methode === 'string' ? methode.trim().slice(0, 50) : '';
    referenceValidee = optionalText(reference, 100);
    if (!Number.isFinite(montantNum) || montantNum <= 0 ||
        montantNum > 999999999999.99 || !methodeValidee) {
      return res.status(400).json({ error: 'Montant positif (au centime) et méthode de paiement valides requis.' });
    }

    // Rejeu optimiste : la connexion transactionnelle n'existe pas encore, utiliser le pool.
    if (idempotencyKey) {
      const [existingPayments] = await pool.query(
        'SELECT facture_id, montant, methode, reference FROM paiements WHERE user_id = ? AND idempotency_key = ? LIMIT 1',
        [req.tenantId, idempotencyKey]
      );
      if (existingPayments.length) {
        return respondWithExistingPayment(existingPayments[0]);
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
        'SELECT facture_id, montant, methode, reference FROM paiements WHERE user_id = ? AND idempotency_key = ? LIMIT 1',
        [req.tenantId, idempotencyKey]
      );
      if (paymentRows.length) {
        await conn.rollback();
        return respondWithExistingPayment(paymentRows[0]);
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
          'SELECT facture_id, montant, methode, reference FROM paiements WHERE user_id = ? AND idempotency_key = ? LIMIT 1',
          [req.tenantId, idempotencyKey]
        );
        if (existingPayments.length) {
          return respondWithExistingPayment(existingPayments[0]);
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

module.exports = router;
