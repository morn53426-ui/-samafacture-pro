'use strict';

const { FREE_MONTHLY_INVOICE_LIMIT, isPaidPlan } = require('./plans');

/**
 * Réserve une facture dans la transaction qui crée le document.
 * Le verrou sur users sérialise les réservations du même compte ; l'incrément est atomique,
 * même quand plusieurs routes ou workers créent des factures simultanément.
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

  // Reprend les factures du mois créées avant l'installation de la migration, une seule fois.
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

  // Les factures produites sous un plan payant restent comptabilisées : revenir à Gratuit
  // pendant le même mois ne permet pas de récupérer un quota neuf.
  if (!paidPlan && used >= FREE_MONTHLY_INVOICE_LIMIT) {
    return { allowed: false, unlimited: false, used, limit: FREE_MONTHLY_INVOICE_LIMIT, period_start: periodStart };
  }

  await conn.query(
    'UPDATE facture_usage_mensuelle SET nombre_factures = nombre_factures + 1 WHERE user_id = ? AND periode = ?',
    [userId, periodStart]
  );
  return { allowed: true, unlimited: paidPlan, used: used + 1, limit: FREE_MONTHLY_INVOICE_LIMIT, period_start: periodStart };
}

module.exports = { reserveMonthlyInvoiceQuota };
