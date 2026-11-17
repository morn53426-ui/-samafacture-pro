'use strict';

const { FREE_MONTHLY_INVOICE_LIMIT, isPaidPlan } = require('./plans');
const { localDateString } = require('./local-date');

/**
 * Réserve une facture dans le registre du mois courant.
 * À appeler à l'intérieur de la transaction qui écrit la facture.
 * Le verrou du compte sérialise les créations concurrentes, quelle que soit leur API d'origine.
 */
async function reserveMonthlyInvoiceQuota(conn, userId, { now = new Date() } = {}) {
  const [users] = await conn.query(
    'SELECT plan, fuseau_horaire FROM users WHERE id = ? FOR UPDATE',
    [userId]
  );
  if (!users.length) {
    const error = new Error('Compte utilisateur introuvable.');
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const paidPlan = isPaidPlan(users[0].plan);
  const currentLocalDate = localDateString(users[0].fuseau_horaire || 'Africa/Dakar', now);
  const periodStart = currentLocalDate.slice(0, 7) + '-01';
  if (!/^\d{4}-\d{2}-01$/.test(periodStart)) {
    throw new Error('Impossible de déterminer la période locale du quota de facturation.');
  }

  // Le compte est déjà verrouillé avec SELECT ... FOR UPDATE ci-dessus : une seule
  // transaction peut initialiser ce compteur pour cet utilisateur/mois à la fois.
  // On fait une lecture explicite, puis un comptage et un INSERT si le registre n'existe
  // pas encore. Cela évite de dépendre du comportement d'un INSERT IGNORE ... SELECT agrégé
  // et garantit qu'une ligne est toujours créée avant l'incrément.
  const [[usage]] = await conn.query(
    'SELECT nombre_factures FROM facture_usage_mensuelle WHERE user_id = ? AND periode = ? FOR UPDATE',
    [userId, periodStart]
  );

  let used;
  if (usage) {
    used = Number(usage.nombre_factures || 0);
  } else {
    // Initialisation rétrocompatible : reprendre les factures créées ce mois avant la v8.
    // created_at (et non date_emission) empêche de choisir une date passée pour contourner
    // le quota. Une facture supprimée ensuite reste comptabilisée dans le registre.
    const [[historique]] = await conn.query(
      `SELECT COUNT(*) AS nombre_factures
       FROM factures
       WHERE user_id = ?
         AND type = 'facture'
         AND created_at >= ?
         AND created_at < DATE_ADD(?, INTERVAL 1 MONTH)`,
      [userId, periodStart, periodStart]
    );
    used = Number(historique?.nombre_factures || 0);
    await conn.query(
      'INSERT INTO facture_usage_mensuelle (user_id, periode, nombre_factures) VALUES (?, ?, ?)',
      [userId, periodStart, used]
    );
  }
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
