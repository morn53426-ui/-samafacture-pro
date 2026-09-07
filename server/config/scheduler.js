const { pool } = require('./db');
const { captureException } = require('./monitoring');

/**
 * Marque comme "expirée" toute tentative de paiement d'abonnement restée bloquée en
 * "en_attente" au-delà du délai configuré (24h par défaut) — ex: l'utilisateur a fermé la
 * page de paiement sans finaliser, ou le webhook du fournisseur n'est jamais arrivé. Ne
 * touche jamais une ligne déjà "payee" (la clause statut = 'en_attente' l'exclut par
 * construction), donc aucun risque de rétrograder un paiement réellement confirmé.
 */
async function withMysqlAdvisoryLock(lockName, task) {
  const conn = await pool.getConnection();
  try {
    const [[row]] = await conn.query('SELECT GET_LOCK(?, 0) AS acquired', [lockName]);
    if (row.acquired !== 1) return false;
    try {
      await task();
      return true;
    } finally {
      await conn.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => {});
    }
  } finally {
    conn.release();
  }
}

async function expirerPaiementsAbonnementEnAttente() {
  try {
    await withMysqlAdvisoryLock('samafacture:expire-subscription-payments', async () => {
      const heures = Number(process.env.PAIEMENT_EXPIRATION_HEURES) || 24;
      const [result] = await pool.query(
        `UPDATE abonnement_paiements SET statut = 'expiree'
         WHERE statut = 'en_attente' AND created_at < DATE_SUB(NOW(), INTERVAL ? HOUR)`,
        [heures]
      );
      if (result.affectedRows) {
        console.log(`⏱️  ${result.affectedRows} paiement(s) d'abonnement marqué(s) "expiree".`);
      }
    });
  } catch (err) {
    console.error('⚠️  Erreur lors de l\'expiration des paiements en attente :', err.message);
    captureException(err);
  }
}

async function verifierFacturesRecurrentes() {
  const { genererFactureDepuisModele } = require('../routes/factures-recurrentes');
  const { envoyerFactureParEmail } = require('../routes/factures');
  const baseUrl = (process.env.APP_URL || 'http://localhost:4000').replace(/\/$/, '');
  try {
    await withMysqlAdvisoryLock('samafacture:recurring-invoices', async () => {
      const [dues] = await pool.query(
        `SELECT id, user_id, envoi_auto_email FROM factures_recurrentes WHERE actif = 1 AND prochaine_date <= CURDATE()`
      );
      for (const { id, user_id, envoi_auto_email } of dues) {
        try {
          const facture = await genererFactureDepuisModele(id, user_id);
          if (!facture) continue;
          console.log(`🔁 Facture récurrente générée : ${facture.numero} (modèle #${id})`);
          if (envoi_auto_email) {
            try {
              const resultat = await envoyerFactureParEmail(facture.id, user_id, baseUrl);
              console.log(`📧 Facture ${facture.numero} envoyée automatiquement à ${resultat.sent_to}.`);
            } catch (emailErr) {
              console.error(`⚠️  Envoi automatique échoué pour ${facture.numero} :`, emailErr.message);
              captureException(emailErr);
            }
          }
        } catch (err) {
          console.error(`⚠️  Échec de génération pour le modèle récurrent #${id} :`, err.message);
          captureException(err);
        }
      }
    });
  } catch (err) {
    console.error('⚠️  Erreur lors de la vérification des factures récurrentes :', err.message);
    captureException(err);
  }
}

/** Démarre la vérification périodique (toutes les heures par défaut). */
function startScheduler() {
  const intervalMs = (Number(process.env.RECURRING_CHECK_INTERVAL_MIN) || 60) * 60 * 1000;
  verifierFacturesRecurrentes(); // premier passage juste après le démarrage
  expirerPaiementsAbonnementEnAttente();
  const timer = setInterval(() => {
    verifierFacturesRecurrentes();
    expirerPaiementsAbonnementEnAttente();
  }, intervalMs);
  timer.unref(); // ne bloque pas l'arrêt propre du serveur
}

module.exports = { startScheduler, verifierFacturesRecurrentes, expirerPaiementsAbonnementEnAttente };
