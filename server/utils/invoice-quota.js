'use strict';

const { FREE_MONTHLY_INVOICE_LIMIT, isPaidPlan } = require('./plans');

/**
 * Reserve une place de facture pour le mois courant.
 *
 * À appeler à l'intérieur de la transaction qui crée, duplique ou convertit la facture.
 * Le verrou sur users sérialise les opérations du même compte, tandis que la table de
 * consommation conserve le quota même si une facture gratuite est ensuite supprimée.
 * Les installations antérieures sont initialisées depuis les factures encore présentes
 * sur le mois courant lors de la première réservation.
 */
async function reserveMonthlyInvoiceQuota(conn, userId) {
  const [users] = await conn.query(
    'SELECT plan FROM users WHERE id = ? FOR UPDATE',
    [userId]
  );
  if (!users.length) {
    const error = new Error('Compte utilisateur introuvable.');
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  if (isPaidPlan(users[0].plan)) {
    return { allowed: true, unlimited: true };
  }

  const [[periodRow]] = await conn.query(
    "SELECT DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') AS period_start"
  );
  const periodStart = periodRow?.period_start;
  if (!periodStart) {
    throw new Error('Impossible de déterminer la période du quota de facturation.');
  }

  // Initialisation rétrocompatible : au premier accès de ce mois, reprendre les factures
  // déjà créées sous une version précédente qui ne possédait pas encore cette table.
  await conn.query(
    `INSERT IGNORE INTO facture_usage_mensuelle (user_id, periode, nombre_factures)
     SELECT ?, ?, COUNT(*)
     FROM factures
     WHERE user_id = ?
       AND type = 'facture'
       AND created_at >= ?
       AND created_at < DATE_ADD(?, INTERVAL 1 MONTH)`,
    [userId, periodStart, userId, periodStart, periodStart]
  );

  const [[usage]] = await conn.query(
    'SELECT nombre_factures FROM facture_usage_mensuelle WHERE user_id = ? AND periode = ? FOR UPDATE',
    [userId, periodStart]
  );
  const used = Number(usage?.nombre_factures || 0);
  if (used >= FREE_MONTHLY_INVOICE_LIMIT) {
    return {
      allowed: false,
      unlimited: false,
      used,
      limit: FREE_MONTHLY_INVOICE_LIMIT,
      period_start: periodStart
    };
  }

  await conn.query(
    'UPDATE facture_usage_mensuelle SET nombre_factures = nombre_factures + 1 WHERE user_id = ? AND periode = ?',
    [userId, periodStart]
  );

  return {
    allowed: true,
    unlimited: false,
    used: used + 1,
    limit: FREE_MONTHLY_INVOICE_LIMIT,
    period_start: periodStart
  };
}

module.exports = { reserveMonthlyInvoiceQuota };
