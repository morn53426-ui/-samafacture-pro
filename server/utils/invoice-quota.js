'use strict';

const { FREE_MONTHLY_INVOICE_LIMIT, isPaidPlan } = require('./plans');

/**
 * Réserve une facture dans le registre du mois courant.
 * À appeler à l'intérieur de la transaction qui écrit la facture.
 * Le verrou du compte sérialise les créations concurrentes, quelle que soit leur API d'origine.
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

  const paidPlan = isPaidPlan(users[0].plan);
  const [[periodRow]] = await conn.query(
    "SELECT DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') AS period_start"
  );
  const periodStart = periodRow?.period_start;
  if (!periodStart) throw new Error('Impossible de déterminer la période du quota de facturation.');

  // Migration transparente : reprendre les factures déjà créées ce mois avant le registre v8.
  // created_at (et non date_emission) empêche de contourner le quota en choisissant une date passée.
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
  if (!paidPlan && used >= FREE_MONTHLY_INVOICE_LIMIT) {
    return { allowed: false, unlimited: false, used, limit: FREE_MONTHLY_INVOICE_LIMIT, period_start: periodStart };
  }

  await conn.query(
    'UPDATE facture_usage_mensuelle SET nombre_factures = nombre_factures + 1 WHERE user_id = ? AND periode = ?',
    [userId, periodStart]
  );
  return {
    allowed: true,
    unlimited: paidPlan,
    used: used + 1,
    limit: FREE_MONTHLY_INVOICE_LIMIT,
    period_start: periodStart
  };
}

module.exports = { reserveMonthlyInvoiceQuota };
