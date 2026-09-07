const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Dashboard is read-heavy. Keep a very short per-user cache and, more importantly,
// deduplicate concurrent requests for the same user. This prevents opening several
// identical MySQL queries when a page/SPA retries or when multiple dashboard widgets
// request the same data at once. The cache is intentionally short so business data
// remains fresh and is bounded to avoid unbounded memory growth.
const DASHBOARD_CACHE_TTL_MS = Math.max(250, Number(process.env.DASHBOARD_CACHE_TTL_MS) || 1000);
const DASHBOARD_CACHE_MAX = 2000;
const dashboardCache = new Map();
const dashboardInFlight = new Map();

function pruneDashboardCache(now = Date.now()) {
  for (const [key, entry] of dashboardCache) {
    if (entry.expiresAt <= now) dashboardCache.delete(key);
  }
  while (dashboardCache.size > DASHBOARD_CACHE_MAX) {
    dashboardCache.delete(dashboardCache.keys().next().value);
  }
}

function emptyDashboard() {
  return {
    chiffre_affaires: 0,
    factures_payees: { n: 0, total: 0 },
    factures_en_attente: { n: 0, total: 0 },
    factures_en_retard: { n: 0, total: 0 },
    derniers_paiements: [],
    derniers_clients: [],
    evolution_mensuelle: [],
    top_clients: [],
    top_produits: [],
    tresorerie: 0
  };
}

async function buildDashboard(userId) {
  // One summary query replaces the old factures + depenses queries. It also gives us
  // invoice_count so a brand-new account does not needlessly execute four more joins.
  const [summaryRows] = await pool.query(
    `SELECT
       COUNT(*) AS invoice_count,
       COALESCE(SUM(montant_paye),0) AS chiffre_affaires,
       COALESCE(SUM(CASE WHEN statut = 'payee' THEN 1 ELSE 0 END),0) AS payees_n,
       COALESCE(SUM(CASE WHEN statut = 'payee' THEN total ELSE 0 END),0) AS payees_total,
       COALESCE(SUM(CASE WHEN statut = 'en_attente' AND (date_echeance IS NULL OR date_echeance >= CURDATE()) THEN 1 ELSE 0 END),0) AS attente_n,
       COALESCE(SUM(CASE WHEN statut = 'en_attente' AND (date_echeance IS NULL OR date_echeance >= CURDATE()) THEN total ELSE 0 END),0) AS attente_total,
       COALESCE(SUM(CASE WHEN statut = 'en_retard' OR (statut = 'en_attente' AND date_echeance IS NOT NULL AND date_echeance < CURDATE()) THEN 1 ELSE 0 END),0) AS retard_n,
       COALESCE(SUM(CASE WHEN statut = 'en_retard' OR (statut = 'en_attente' AND date_echeance IS NOT NULL AND date_echeance < CURDATE()) THEN total ELSE 0 END),0) AS retard_total,
       (SELECT COALESCE(SUM(d.montant),0) FROM depenses d WHERE d.user_id = ?) AS total_depenses
     FROM factures
     WHERE user_id = ? AND type = 'facture'`,
    [userId, userId]
  );
  const summary = summaryRows?.[0] || {};

  const base = {
    chiffre_affaires: Number(summary?.chiffre_affaires || 0),
    factures_payees: { n: Number(summary?.payees_n || 0), total: Number(summary?.payees_total || 0) },
    factures_en_attente: { n: Number(summary?.attente_n || 0), total: Number(summary?.attente_total || 0) },
    factures_en_retard: { n: Number(summary?.retard_n || 0), total: Number(summary?.retard_total || 0) },
    tresorerie: Number(summary?.chiffre_affaires || 0) - Number(summary?.total_depenses || 0)
  };

  // Always keep the latest clients available. Invoice-related widgets can safely be
  // returned empty when the account has no invoices, avoiding unnecessary DB work for
  // the thousands of newly-created accounts used by load tests.
  if (Number(summary?.invoice_count || 0) === 0) {
    // Compte neuf / sans facture : conserver la liste des derniers clients tout en
    // n'effectuant qu'UN seul aller-retour MySQL. Sous un test de charge avec 1000
    // utilisateurs distincts, deux requêtes par utilisateur saturent inutilement la
    // file du pool alors que la majorité des comptes n'ont aucune facture.
        const [rows] = await pool.query(
      `SELECT 'client' AS row_type, c.id, c.user_id, c.nom, c.email, c.telephone, c.adresse, c.created_at
         FROM clients c
        WHERE c.user_id = ?
        ORDER BY c.created_at DESC
        LIMIT 5`,
      [userId]
    );
    const derniersClients = (rows || []).map(({ row_type, ...client }) => client);
    return { ...base, derniers_paiements: [], derniers_clients: derniersClients, evolution_mensuelle: [], top_clients: [], top_produits: [] };
  }

  // These five reads are independent and are deliberately kept as separate result sets:
  // this preserves compatibility with existing MySQL/WAMP installations without enabling
  // multipleStatements globally. They execute concurrently, but only after the inexpensive
  // summary has established that the user actually has invoice data.
  const [
    [derniersPaiements],
    [derniersClients],
    [evolutionMensuelle],
    [topClients],
    [topProduits]
  ] = await Promise.all([
    pool.query(
      `SELECT p.*, f.numero, c.nom as client_nom FROM paiements p
       JOIN factures f ON f.id = p.facture_id JOIN clients c ON c.id = f.client_id
       WHERE p.user_id = ? ORDER BY p.date_paiement DESC LIMIT 5`,
      [userId]
    ),
    pool.query(`SELECT * FROM clients WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`, [userId]),
    pool.query(
      `SELECT DATE_FORMAT(date_emission, '%Y-%m') as mois, COALESCE(SUM(total),0) as total
       FROM factures WHERE user_id = ? AND type = 'facture' AND date_emission >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY mois ORDER BY mois`,
      [userId]
    ),
    pool.query(
      `SELECT c.id, c.nom, COUNT(f.id) as nb_factures, COALESCE(SUM(f.total),0) as total
       FROM clients c JOIN factures f ON f.client_id = c.id
       WHERE c.user_id = ? AND f.type = 'facture'
       GROUP BY c.id, c.nom ORDER BY total DESC LIMIT 5`,
      [userId]
    ),
    pool.query(
      `SELECT fl.designation, SUM(fl.quantite) as quantite_totale, COALESCE(SUM(fl.total_ligne),0) as total
       FROM facture_lignes fl JOIN factures f ON f.id = fl.facture_id
       WHERE f.user_id = ? AND f.type = 'facture'
       GROUP BY fl.designation ORDER BY total DESC LIMIT 5`,
      [userId]
    )
  ]);

  return {
    ...base,
    derniers_paiements: derniersPaiements || [],
    derniers_clients: derniersClients || [],
    evolution_mensuelle: evolutionMensuelle || [],
    top_clients: topClients || [],
    top_produits: topProduits || []
  };
}

/**
 * @openapi
 * /dashboard:
 *   get:
 *     summary: Statistiques du tableau de bord (trésorerie, factures en retard, évolution mensuelle des ventes...)
 *     tags: [Tableau de bord]
 *     responses:
 *       200:
 *         description: Statistiques calculées pour l'utilisateur connecté.
 */
router.get('/', async (req, res, next) => {
  const userId = req.user.id;
  const key = String(userId);
  const now = Date.now();

  try {
    pruneDashboardCache(now);
    const cached = dashboardCache.get(key);
    if (cached && cached.expiresAt > now) {
      // Refresh recency without changing the short TTL policy.
      dashboardCache.delete(key);
      dashboardCache.set(key, cached);
      return res.json(cached.value);
    }

    // Only one build per user at a time. Other concurrent requests await the same promise
    // instead of multiplying the six DB queries by the number of open tabs/connections.
    let pending = dashboardInFlight.get(key);
    if (!pending) {
      pending = buildDashboard(userId)
        .then(value => {
          dashboardCache.delete(key);
          dashboardCache.set(key, { value, expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS });
          return value;
        })
        .finally(() => dashboardInFlight.delete(key));
      dashboardInFlight.set(key, pending);
    }

    return res.json(await pending);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
