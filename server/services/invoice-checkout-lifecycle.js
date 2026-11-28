'use strict';

function checkoutConflict(message, code = 'CHECKOUT_DEJA_ACTIF', status = 409) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

/**
 * Lecture sans verrou des sessions actives. L'appelant doit d'abord verrouiller
 * la facture avec SELECT ... FOR UPDATE : toutes les créations de checkout,
 * les paiements manuels et les annulations utilisent ainsi la facture comme
 * verrou de sérialisation commun.
 */
async function findActiveInvoiceCheckout(connection, userId, invoiceId) {
  const [rows] = await connection.query(
    `SELECT id, statut, expire_at
       FROM pro_invoice_checkouts
      WHERE user_id = ?
        AND facture_id = ?
        AND statut IN ('creation', 'en_attente')
        AND (expire_at IS NULL OR expire_at > NOW())
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    [userId, invoiceId]
  );
  return rows[0] || null;
}

/**
 * Réserve le solde d'une facture pour une session de paiement en ligne.
 * Doit être appelée dans une transaction. Le verrou de la facture empêche deux
 * requêtes concurrentes d'émettre deux sessions pour le même solde.
 */
async function reserveInvoiceCheckout(connection, {
  userId,
  invoiceId,
  provider,
  reference
}) {
  const [rows] = await connection.query(
    `SELECT id, numero, total, montant_paye, statut, type, devise
       FROM factures
      WHERE id = ? AND user_id = ?
      FOR UPDATE`,
    [invoiceId, userId]
  );
  const invoice = rows[0];
  if (!invoice || invoice.type !== 'facture') {
    throw checkoutConflict('Facture introuvable.', 'FACTURE_INTROUVABLE', 404);
  }
  if (invoice.statut === 'annulee') {
    throw checkoutConflict('Une facture annulée ne peut pas être payée.', 'FACTURE_ANNULEE');
  }

  const active = await findActiveInvoiceCheckout(connection, userId, invoice.id);
  if (active) {
    throw checkoutConflict(
      'Une session de paiement en ligne est déjà active pour cette facture. Attendez son expiration ou son traitement avant d’en créer une autre.'
    );
  }

  const remaining = Math.round((Number(invoice.total) - Number(invoice.montant_paye)) * 100) / 100;
  if (!Number.isFinite(remaining) || remaining <= 0) {
    throw checkoutConflict('Cette facture est déjà soldée.', 'FACTURE_DEJA_SOLDEE');
  }

  const currency = String(invoice.devise || 'FCFA').toUpperCase();
  if (!['FCFA', 'XOF'].includes(currency)) {
    throw checkoutConflict(
      'Les paiements en ligne ne sont activés que pour les factures en XOF/FCFA.',
      'DEVISE_CHECKOUT_NON_SUPPORTEE'
    );
  }
  if (Math.abs(remaining - Math.round(remaining)) > 0.001) {
    throw checkoutConflict(
      'Le solde XOF doit être un montant entier avant de créer un lien Wave ou PayDunya.',
      'SOLDE_CHECKOUT_NON_ENTIER'
    );
  }

  // Les durées reflètent les expirations natives des prestataires :
  // Wave : 30 minutes ; PayDunya : jusqu'à 24 heures pour une facture en attente.
  // Garder le verrou local aligné sur le délai réellement payable évite de considérer
  // trop tôt un ancien lien PayDunya comme expiré et d'en autoriser un second.
  const checkoutTtlMinutes = provider === 'paydunya' ? 24 * 60 : 30;
  const [inserted] = await connection.query(
    `INSERT INTO pro_invoice_checkouts
      (user_id, facture_id, fournisseur, reference_interne, montant, devise, statut, expire_at)
     VALUES (?, ?, ?, ?, ?, 'XOF', 'creation', DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [userId, invoice.id, provider, reference, remaining, checkoutTtlMinutes]
  );

  return {
    checkoutId: Number(inserted.insertId),
    invoice,
    remaining
  };
}

module.exports = { findActiveInvoiceCheckout, reserveInvoiceCheckout };
