const crypto = require('crypto');
const { pool } = require('../config/db');

// Pages dont la fréquentation est mesurée. Liste blanche stricte : aucun chemin dynamique,
// aucun paramètre d'URL, jamais la page d'administration.
const PAGE_PATHS = new Set([
  '/', '/index.html', '/login.html', '/register.html', '/dashboard.html', '/abonnement.html',
  '/abonnement-retour.html', '/achats.html', '/aide.html', '/assistant-ia.html',
  '/automatisations.html', '/clients.html', '/comptabilite.html', '/conditions.html',
  '/confidentialite.html', '/consulter.html', '/crm.html', '/depenses.html', '/devis.html',
  '/facture-detail.html', '/facture-ia.html', '/factures-recurrentes.html', '/factures.html',
  '/finances.html', '/groupe-entreprise.html', '/internationalisation.html', '/invitation.html',
  '/mot-de-passe-oublie.html', '/nouvelle-facture.html', '/paiement-retour.html',
  '/paiement.html', '/paiements-professionnels.html', '/parametres.html', '/portail-client.html',
  '/produits.html', '/professionnel.html', '/rapports.html', '/reinitialiser-mot-de-passe.html',
  '/support.html', '/verifier.html'
]);

const DEFAULT_RETENTION_DAYS = 395; // ~13 mois ; durée à valider avant mise en production.
const MIN_RETENTION_DAYS = 30;
const MAX_RETENTION_DAYS = 825;
const PURGE_BATCH_SIZE = 5000;
const PURGE_MAX_BATCHES = 20;

function analyticsSecret() {
  return process.env.SUNUPILOT_ANALYTICS_HASH_SECRET || process.env.JWT_SECRET || '';
}

// Séparation de domaine : la clé HMAC dérive du secret avec une étiquette dédiée, de sorte que
// l'empreinte analytique ne soit jamais calculée directement avec la clé de signature des JWT.
function hashVisitor(sessionId) {
  const secret = analyticsSecret();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') return null;
    return crypto.createHmac('sha256', 'sunupilot-development-analytics-only')
      .update(sessionId).digest('hex');
  }
  const key = crypto.createHmac('sha256', secret).update('sunupilot-analytics-visitor-v1').digest();
  return crypto.createHmac('sha256', key).update(sessionId).digest('hex');
}

function retentionDays() {
  const parsed = Number.parseInt(process.env.SUNUPILOT_ANALYTICS_RETENTION_DAYS, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_RETENTION_DAYS;
  return Math.min(MAX_RETENTION_DAYS, Math.max(MIN_RETENTION_DAYS, parsed));
}

// Supprime par lots les vues plus anciennes que la durée de conservation, sans verrouiller
// longuement la table. Retourne le nombre total de lignes supprimées.
async function purgeOldPageviews(connection = pool) {
  const days = retentionDays();
  let total = 0;
  for (let batch = 0; batch < PURGE_MAX_BATCHES; batch += 1) {
    const [result] = await connection.query(
      'DELETE FROM sunupilot_analytics_pageviews WHERE created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY) LIMIT ' + PURGE_BATCH_SIZE,
      [days]
    );
    total += result.affectedRows || 0;
    if ((result.affectedRows || 0) < PURGE_BATCH_SIZE) break;
  }
  return total;
}

module.exports = { PAGE_PATHS, hashVisitor, retentionDays, purgeOldPageviews };
