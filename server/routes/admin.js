const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const { pool } = require('../config/db');

const router = express.Router();

// Limite dédiée, appliquée avant l'authentification : freine les sondages répétés de la zone
// d'administration et protège les requêtes d'agrégation, plus coûteuses que le reste de l'API.
const adminLimiter = rateLimit({
  windowMs: 60 * 1000, limit: 60,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Trop de requêtes sur la zone d\'administration. Réessayez dans une minute.' }
});

// Journal structuré des accès à l'administration (sans donnée métier ni donnée personnelle
// autre que l'identifiant du compte), exploitable par la supervision.
function auditAdmin(event, req, details) {
  try {
    console.info(JSON.stringify({
      audit: 'platform_admin',
      event,
      user_id: req.user && req.user.id ? Number(req.user.id) : null,
      path: req.path,
      at: new Date().toISOString(),
      ...details
    }));
  } catch (_) { /* un échec de journalisation ne doit jamais bloquer la réponse */ }
}

function noStore(req, res, next) {
  res.set('Cache-Control', 'no-store, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
}

// Exécute toutes les lectures sur une seule connexion, en transaction lecture seule : les
// chiffres d'une même réponse restent cohérents entre eux et le pool n'est jamais saturé.
async function withReadSnapshot(task) {
  const conn = await pool.getConnection();
  try {
    await conn.query('START TRANSACTION READ ONLY');
    try {
      return await task(conn);
    } finally {
      await conn.query('ROLLBACK').catch(() => {});
    }
  } finally {
    conn.release();
  }
}

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
    // /access est interrogé par le tableau de bord de chaque utilisateur : on ne journalise
    // que les refus sur les routes de données, qui indiquent une tentative réelle.
    if (req.path !== '/access') auditAdmin('access_denied', req);
    return res.status(403).json({
      error: 'Accès réservé aux administrateurs de la plateforme.',
      code: 'ADMIN_ACCESS_DENIED'
    });
  }
  return next();
}

// users.role est un rôle métier d'entreprise, jamais un rôle d'administration plateforme.
router.use(noStore, adminLimiter, requireAuth, requirePlatformAdmin);

router.get('/access', (req, res) => res.json({ authorized: true }));

router.get('/overview', async (req, res, next) => {
  try {
    const period = resolvePeriod(req.query || {});
    if (!period) {
      return res.status(400).json({
        error: 'Période invalide. Utilisez deux dates YYYY-MM-DD espacées de 1 à 366 jours.'
      });
    }
    auditAdmin('overview_read', req, { from: period.from, to: period.to });
    const dates = [period.startAt, period.endAt];
    const fmt = period.bucket;
    const trafficSql = "SELECT DATE_FORMAT(created_at, '" + fmt + "') AS bucket, COUNT(*) AS page_views, COUNT(DISTINCT visitor_hash) AS estimated_sessions FROM sunupilot_analytics_pageviews WHERE created_at >= ? AND created_at < ? GROUP BY DATE_FORMAT(created_at, '" + fmt + "') ORDER BY bucket";
    const signupSql = "SELECT DATE_FORMAT(created_at, '" + fmt + "') AS bucket, COUNT(*) AS new_accounts FROM users WHERE created_at >= ? AND created_at < ? GROUP BY DATE_FORMAT(created_at, '" + fmt + "') ORDER BY bucket";
    const revenueSql = "SELECT DATE_FORMAT(COALESCE(paid_at, created_at), '" + fmt + "') AS bucket, devise AS currency, COUNT(*) AS confirmed_payments, SUM(montant) AS amount FROM abonnement_paiements WHERE statut = 'payee' AND COALESCE(paid_at, created_at) >= ? AND COALESCE(paid_at, created_at) < ? GROUP BY DATE_FORMAT(COALESCE(paid_at, created_at), '" + fmt + "'), devise ORDER BY bucket, devise";

    // mysql2 met en file les requêtes d'une même connexion : exécution séquentielle, un seul slot du pool.
    const results = await withReadSnapshot(conn => Promise.all([
      conn.query('SELECT COUNT(*) AS page_views, COUNT(DISTINCT visitor_hash) AS estimated_sessions FROM sunupilot_analytics_pageviews WHERE created_at >= ? AND created_at < ?', dates),
      conn.query("SELECT COUNT(*) AS registered_accounts, SUM(created_at >= ? AND created_at < ?) AS new_accounts, SUM(trial_status = 'trialing' AND trial_ends_at > UTC_TIMESTAMP()) AS active_trials, SUM(plan IN ('starter', 'standard', 'pro', 'entreprise')) AS accounts_with_paid_plan FROM users", dates),
      conn.query("SELECT plan, COUNT(*) AS accounts FROM users GROUP BY plan ORDER BY FIELD(plan, 'gratuit', 'starter', 'pro', 'entreprise'), plan"),
      conn.query("SELECT COUNT(*) AS active_saas_subscriptions FROM saas_subscriptions WHERE statut = 'active' AND (current_period_end IS NULL OR current_period_end >= UTC_DATE())"),
      conn.query("SELECT COUNT(DISTINCT user_id) AS accounts_with_confirmed_subscription_payment FROM abonnement_paiements WHERE statut = 'payee'"),
      conn.query("SELECT plan, COUNT(*) AS subscriptions FROM saas_subscriptions WHERE statut = 'active' AND (current_period_end IS NULL OR current_period_end >= UTC_DATE()) GROUP BY plan ORDER BY plan"),
      conn.query("SELECT devise AS currency, COUNT(*) AS confirmed_payments, SUM(montant) AS amount FROM abonnement_paiements WHERE statut = 'payee' AND COALESCE(paid_at, created_at) >= ? AND COALESCE(paid_at, created_at) < ? GROUP BY devise ORDER BY devise", dates),
      conn.query("SELECT devise AS currency, COUNT(*) AS confirmed_payments, SUM(montant) AS amount FROM abonnement_paiements WHERE statut = 'payee' GROUP BY devise ORDER BY devise"),
      conn.query(trafficSql, dates),
      conn.query(signupSql, dates),
      conn.query(revenueSql, dates),
      conn.query("SELECT page_path, COUNT(*) AS page_views, COUNT(DISTINCT visitor_hash) AS estimated_sessions FROM sunupilot_analytics_pageviews WHERE created_at >= ? AND created_at < ? GROUP BY page_path ORDER BY page_views DESC, page_path LIMIT 10", dates),
      conn.query("SELECT plan, devise AS currency, COUNT(*) AS confirmed_payments, SUM(montant) AS amount FROM abonnement_paiements WHERE statut = 'payee' AND COALESCE(paid_at, created_at) >= ? AND COALESCE(paid_at, created_at) < ? GROUP BY plan, devise ORDER BY devise, plan", dates)
    ]));
    const rows = results.map(result => result[0]);
    const traffic = rows[0][0] || {};
    const users = rows[1][0] || {};
    const saas = rows[3][0] || {};
    const confirmedPayers = rows[4][0] || {};
    return res.json({
      period: { from: period.from, to: period.to, days: period.days, bucket: period.bucket },
      summary: {
        page_views: Number(traffic.page_views || 0),
        estimated_sessions: Number(traffic.estimated_sessions || 0),
        registered_accounts: Number(users.registered_accounts || 0),
        new_accounts: Number(users.new_accounts || 0),
        active_trials: Number(users.active_trials || 0),
        accounts_with_paid_plan: Number(users.accounts_with_paid_plan || 0),
        active_saas_subscriptions: Number(saas.active_saas_subscriptions || 0),
        accounts_with_confirmed_subscription_payment: Number(confirmedPayers.accounts_with_confirmed_subscription_payment || 0)
      },
      plans: {
        accounts_by_plan: rows[2],
        active_saas_subscriptions_by_plan: rows[5]
      },
      revenue: {
        period_by_currency: rows[6],
        all_time_by_currency: rows[7],
        trend: rows[10],
        by_plan_by_currency: rows[12],
        recurring_metrics_available: false,
        recurring_metrics_note: "MRR et ARR ne sont pas calculés : aucun catalogue de prix approuvé ni cycle de renouvellement SaaS actif n'est actuellement confirmé."
      },
      traffic: { trend: rows[8], top_pages: rows[11] },
      signups: { trend: rows[9] },
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
