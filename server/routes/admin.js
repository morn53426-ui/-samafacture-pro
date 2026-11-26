const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { pool } = require('../config/db');

const router = express.Router();

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

function resolvePeriod(query) {
  const today = new Date().toISOString().slice(0, 10);
  let from = query.from;
  let to = query.to;
  if (from === undefined && to === undefined) {
    const start = new Date(today + 'T00:00:00.000Z');
    start.setUTCDate(start.getUTCDate() - 29);
    from = start.toISOString().slice(0, 10);
    to = today;
  } else {
    from = parseDate(from);
    to = parseDate(to);
    if (!from || !to) return null;
  }
  const start = new Date(from + 'T00:00:00.000Z');
  const end = new Date(to + 'T00:00:00.000Z');
  const days = Math.floor((end - start) / 86400000) + 1;
  if (days < 1 || days > 366) return null;
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    from, to, days,
    startAt: from + ' 00:00:00',
    endAt: end.toISOString().slice(0, 19).replace('T', ' '),
    bucket: days <= 31 ? '%Y-%m-%d' : '%Y-%m'
  };
}

function requirePlatformAdmin(req, res, next) {
  const ids = String(process.env.SUNUPILOT_ADMIN_USER_IDS || '')
    .split(',').map(value => value.trim()).filter(value => /^\d+$/.test(value));
  if (!ids.length) {
    return res.status(403).json({
      error: "L'accès administrateur n'est pas configuré sur ce serveur.",
      code: 'ADMIN_ACCESS_NOT_CONFIGURED'
    });
  }
  if (!ids.includes(String(req.user && req.user.id))) {
    return res.status(403).json({
      error: 'Accès réservé aux administrateurs de la plateforme.',
      code: 'ADMIN_ACCESS_DENIED'
    });
  }
  return next();
}

// users.role est un rôle métier d'entreprise, jamais un rôle d'administration plateforme.
router.use(requireAuth, requirePlatformAdmin);

router.get('/overview', async (req, res, next) => {
  try {
    const period = resolvePeriod(req.query || {});
    if (!period) {
      return res.status(400).json({
        error: 'Période invalide. Utilisez deux dates YYYY-MM-DD espacées de 1 à 366 jours.'
      });
    }
    const dates = [period.startAt, period.endAt];
    const fmt = period.bucket;
    const trafficSql = "SELECT DATE_FORMAT(created_at, '" + fmt + "') AS bucket, COUNT(*) AS page_views, COUNT(DISTINCT visitor_hash) AS estimated_sessions FROM sunupilot_analytics_pageviews WHERE created_at >= ? AND created_at < ? GROUP BY DATE_FORMAT(created_at, '" + fmt + "') ORDER BY bucket";
    const signupSql = "SELECT DATE_FORMAT(created_at, '" + fmt + "') AS bucket, COUNT(*) AS new_accounts FROM users WHERE created_at >= ? AND created_at < ? GROUP BY DATE_FORMAT(created_at, '" + fmt + "') ORDER BY bucket";
    const revenueSql = "SELECT DATE_FORMAT(COALESCE(paid_at, created_at), '" + fmt + "') AS bucket, devise AS currency, COUNT(*) AS confirmed_payments, SUM(montant) AS amount FROM abonnement_paiements WHERE statut = 'payee' AND COALESCE(paid_at, created_at) >= ? AND COALESCE(paid_at, created_at) < ? GROUP BY DATE_FORMAT(COALESCE(paid_at, created_at), '" + fmt + "'), devise ORDER BY bucket, devise";

    const results = await Promise.all([
      pool.query('SELECT COUNT(*) AS page_views, COUNT(DISTINCT visitor_hash) AS estimated_sessions FROM sunupilot_analytics_pageviews WHERE created_at >= ? AND created_at < ?', dates),
      pool.query("SELECT COUNT(*) AS registered_accounts, SUM(created_at >= ? AND created_at < ?) AS new_accounts, SUM(trial_status = 'trialing' AND trial_ends_at > UTC_TIMESTAMP()) AS active_trials, SUM(plan IN ('starter', 'pro', 'entreprise')) AS accounts_with_paid_plan FROM users", dates),
      pool.query("SELECT plan, COUNT(*) AS accounts FROM users GROUP BY plan ORDER BY FIELD(plan, 'gratuit', 'starter', 'pro', 'entreprise'), plan"),
      pool.query("SELECT COUNT(*) AS active_saas_subscriptions FROM saas_subscriptions WHERE statut = 'active' AND (current_period_end IS NULL OR current_period_end >= UTC_DATE())"),
      pool.query("SELECT plan, COUNT(*) AS subscriptions FROM saas_subscriptions WHERE statut = 'active' AND (current_period_end IS NULL OR current_period_end >= UTC_DATE()) GROUP BY plan ORDER BY plan"),
      pool.query("SELECT devise AS currency, COUNT(*) AS confirmed_payments, SUM(montant) AS amount FROM abonnement_paiements WHERE statut = 'payee' AND COALESCE(paid_at, created_at) >= ? AND COALESCE(paid_at, created_at) < ? GROUP BY devise ORDER BY devise", dates),
      pool.query("SELECT devise AS currency, COUNT(*) AS confirmed_payments, SUM(montant) AS amount FROM abonnement_paiements WHERE statut = 'payee' GROUP BY devise ORDER BY devise"),
      pool.query(trafficSql, dates),
      pool.query(signupSql, dates),
      pool.query(revenueSql, dates),
      pool.query("SELECT page_path, COUNT(*) AS page_views, COUNT(DISTINCT visitor_hash) AS estimated_sessions FROM sunupilot_analytics_pageviews WHERE created_at >= ? AND created_at < ? GROUP BY page_path ORDER BY page_views DESC, page_path LIMIT 10", dates)
    ]);
    const rows = results.map(result => result[0]);
    const traffic = rows[0][0] || {};
    const users = rows[1][0] || {};
    const saas = rows[3][0] || {};
    return res.json({
      period: { from: period.from, to: period.to, days: period.days, bucket: period.bucket },
      summary: {
        page_views: Number(traffic.page_views || 0),
        estimated_sessions: Number(traffic.estimated_sessions || 0),
        registered_accounts: Number(users.registered_accounts || 0),
        new_accounts: Number(users.new_accounts || 0),
        active_trials: Number(users.active_trials || 0),
        accounts_with_paid_plan: Number(users.accounts_with_paid_plan || 0),
        active_saas_subscriptions: Number(saas.active_saas_subscriptions || 0)
      },
      plans: {
        accounts_by_plan: rows[2],
        active_saas_subscriptions_by_plan: rows[4]
      },
      revenue: {
        period_by_currency: rows[5],
        all_time_by_currency: rows[6],
        trend: rows[9],
        recurring_metrics_available: false,
        recurring_metrics_note: "MRR et ARR ne sont pas calculés : aucun catalogue de prix approuvé ni cycle de renouvellement SaaS actif n'est actuellement confirmé."
      },
      traffic: { trend: rows[7], top_pages: rows[10] },
      signups: { trend: rows[8] },
      definitions: {
        estimated_sessions: "Identifiant aléatoire conservé dans sessionStorage pour un onglet ; ce n'est pas un décompte certifié de personnes physiques.",
        accounts_with_paid_plan: "Comptes avec Starter, Pro ou Entreprise dans le champ plan ; ce compteur ne prouve pas un paiement encaissé.",
        subscription_revenue: "Paiements abonnement_paiements au statut payee ; paiements des factures clients et tentatives simulées exclus."
      }
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
