const { pool } = require('./db');
const { captureException } = require('./monitoring');
const { sendMail } = require('./mailer');
const { deliverPendingWebhooks } = require('../utils/pro-webhooks');

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


/**
 * Exécute les relances email professionnelles arrivées à échéance.
 * Chaque automation regroupe les impayés d'un client dans un seul email.
 * WhatsApp n'est pas envoyé en automatique tant qu'un fournisseur Business
 * et ses identifiants ne sont pas configurés.
 */
async function executerRelancesAutomatiques() {
  try {
    await withMysqlAdvisoryLock('samafacture:pro-automatic-reminders', async () => {
      const [automations] = await pool.query(
        "SELECT * FROM pro_automations WHERE actif = 1 AND type = 'relance_impayes_email' AND (prochaine_execution IS NULL OR prochaine_execution <= NOW()) ORDER BY id ASC LIMIT 50"
      );
      for (const automation of automations) {
        try {
          const config = typeof automation.configuration_json === 'string'
            ? JSON.parse(automation.configuration_json || '{}')
            : (automation.configuration_json || {});
          const jours = Math.min(120, Math.max(1, Number(config.jours_retard) || 7));
          const frequence = Math.min(90, Math.max(1, Number(config.frequence_jours) || 7));
          const [clients] = await pool.query(
            "SELECT c.id, c.nom, c.email, COUNT(f.id) AS nb_factures, SUM(f.total - f.montant_paye) AS solde, GROUP_CONCAT(CONCAT(f.numero, ' (reste ', FORMAT(f.total - f.montant_paye, 2), ')') ORDER BY f.date_echeance SEPARATOR '\\n') AS details FROM factures f JOIN clients c ON c.id = f.client_id WHERE f.user_id = ? AND c.user_id = ? AND f.type = 'facture' AND f.statut IN ('en_attente','en_retard') AND f.date_echeance IS NOT NULL AND f.date_echeance <= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND f.total > f.montant_paye AND c.email IS NOT NULL AND c.email != '' GROUP BY c.id, c.nom, c.email",
            [automation.user_id, automation.user_id, jours]
          );
          let sent = 0;
          for (const client of clients) {
            const result = await sendMail({
              to: client.email,
              subject: 'Rappel automatique de factures en attente',
              text: 'Bonjour ' + client.nom + ',\\n\\nCertaines factures restent en attente de règlement :\\n' +
                client.details + '\\n\\nSolde total restant : ' + Number(client.solde).toLocaleString('fr-FR') +
                ' FCFA. Merci de prendre contact avec notre entreprise si le règlement a déjà été effectué.'
            });
            if (result.sent) sent++;
          }
          const smtpOk = clients.length === 0 || sent === clients.length;
          const delayHours = smtpOk ? frequence * 24 : 1;
          await pool.query(
            'UPDATE pro_automations SET derniere_execution = NOW(), prochaine_execution = DATE_ADD(NOW(), INTERVAL ? HOUR), dernier_resultat = ? WHERE id = ? AND user_id = ?',
            [delayHours, smtpOk ? 'succes' : (sent ? 'partiel' : 'smtp_non_configure'), automation.id, automation.user_id]
          );
        } catch (err) {
          await pool.query(
            "UPDATE pro_automations SET derniere_execution = NOW(), prochaine_execution = DATE_ADD(NOW(), INTERVAL 1 HOUR), dernier_resultat = 'erreur' WHERE id = ? AND user_id = ?",
            [automation.id, automation.user_id]
          ).catch(() => {});
          console.error('Relance automatique #' + automation.id + ' impossible :', err.message);
          captureException(err);
        }
      }
    });
  } catch (err) {
    console.error('Erreur du moteur de relances automatiques :', err.message);
    captureException(err);
  }
}

async function livrerWebhooksEnAttente() {
  try {
    const count = await deliverPendingWebhooks();
    if (count) console.log('🔗 Webhooks livrés :', count);
  } catch (err) {
    console.error('Erreur de livraison des webhooks :', err.message);
    captureException(err);
  }
}

/** Démarre la vérification périodique (toutes les heures par défaut). */
function startScheduler() {
  const intervalMs = (Number(process.env.RECURRING_CHECK_INTERVAL_MIN) || 60) * 60 * 1000;
  verifierFacturesRecurrentes(); // premier passage juste après le démarrage
  expirerPaiementsAbonnementEnAttente();
  executerRelancesAutomatiques();
  livrerWebhooksEnAttente();
  const timer = setInterval(() => {
    verifierFacturesRecurrentes();
    expirerPaiementsAbonnementEnAttente();
    executerRelancesAutomatiques();
    livrerWebhooksEnAttente();
  }, intervalMs);
  timer.unref(); // ne bloque pas l'arrêt propre du serveur
}

module.exports = { startScheduler, verifierFacturesRecurrentes, expirerPaiementsAbonnementEnAttente, executerRelancesAutomatiques, livrerWebhooksEnAttente };
