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
        "SELECT * FROM pro_automations WHERE actif = 1 AND type IN ('relance_impayes_email','relance_devis_email','alerte_stock_email') AND (prochaine_execution IS NULL OR prochaine_execution <= NOW()) ORDER BY id ASC LIMIT 50"
      );
      for (const automation of automations) {
        try {
          const config = typeof automation.configuration_json === 'string'
            ? JSON.parse(automation.configuration_json || '{}')
            : (automation.configuration_json || {});

          if (automation.type === 'relance_devis_email') {
            const horizon = Math.min(30, Math.max(0, Number(config.jours_avant_expiration) || 5));
            const frequency = Math.min(90, Math.max(1, Number(config.frequence_jours) || 3));
            const [quotes] = await pool.query(
              `SELECT f.id, f.numero, f.total, f.devise, f.date_validite, c.nom AS client, c.email
               FROM factures f JOIN clients c ON c.id = f.client_id AND c.user_id = f.user_id
               LEFT JOIN pro_portal_quote_decisions d ON d.facture_id = f.id AND d.user_id = f.user_id
               WHERE f.user_id = ? AND f.type = 'devis' AND f.statut = 'en_attente'
                 AND f.date_validite BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
                 AND d.id IS NULL AND c.email IS NOT NULL AND c.email <> ''
               ORDER BY f.date_validite ASC LIMIT 250`,
              [automation.user_id, horizon]
            );
            let sent = 0, failed = false;
            for (const quote of quotes) {
              const runKey = 'devis:' + quote.id;
              const [prior] = await pool.query('SELECT id FROM pro_automation_runs WHERE automation_id = ? AND run_key = ? LIMIT 1', [automation.id, runKey]);
              if (prior.length) continue;
              const result = await sendMail({
                to: quote.email,
                subject: 'Votre devis ' + quote.numero + ' arrive à expiration',
                text: 'Bonjour ' + quote.client + ',\\n\\nVotre devis ' + quote.numero +
                  ' d’un montant de ' + Number(quote.total).toLocaleString('fr-FR') + ' ' + (quote.devise || 'FCFA') +
                  ' est valable jusqu’au ' + quote.date_validite + '. Contactez notre entreprise si vous souhaitez le valider.\\n'
              });
              if (result.sent) {
                await pool.query(
                  "INSERT IGNORE INTO pro_automation_runs (user_id, automation_id, entity_type, entity_id, run_key, result) VALUES (?, ?, 'devis', ?, ?, 'succes')",
                  [automation.user_id, automation.id, quote.id, runKey]
                );
                sent++;
              } else failed = true;
            }
            const delay = failed ? 1 : frequency * 24;
            await pool.query(
              'UPDATE pro_automations SET derniere_execution = NOW(), prochaine_execution = DATE_ADD(NOW(), INTERVAL ? HOUR), dernier_resultat = ? WHERE id = ? AND user_id = ?',
              [delay, failed ? (sent ? 'partiel' : 'smtp_non_configure') : 'succes', automation.id, automation.user_id]
            );
            continue;
          }

          if (automation.type === 'alerte_stock_email') {
            const frequency = Math.min(30, Math.max(1, Number(config.frequence_jours) || 1));
            const [products] = await pool.query(
              'SELECT nom, reference, stock, stock_minimum FROM produits WHERE user_id = ? AND stock_minimum > 0 AND stock <= stock_minimum ORDER BY (stock_minimum - stock) DESC, nom ASC LIMIT 200',
              [automation.user_id]
            );
            const [[account]] = await pool.query('SELECT email, entreprise_nom FROM users WHERE id = ?', [automation.user_id]);
            const runKey = 'stock:' + new Date().toISOString().slice(0, 10);
            const [prior] = await pool.query('SELECT id FROM pro_automation_runs WHERE automation_id = ? AND run_key = ? LIMIT 1', [automation.id, runKey]);
            if (!prior.length && products.length && account?.email) {
              const details = products.map(p => '- ' + p.nom + (p.reference ? ' (' + p.reference + ')' : '') +
                ' : stock ' + Number(p.stock) + ', seuil ' + Number(p.stock_minimum)).join('\\n');
              const result = await sendMail({
                to: account.email,
                subject: 'Alerte stock — ' + (account.entreprise_nom || 'SamaFacture Pro'),
                text: 'Les produits suivants ont atteint leur seuil minimum :\\n\\n' + details
              });
              if (result.sent) {
                await pool.query(
                  "INSERT IGNORE INTO pro_automation_runs (user_id, automation_id, entity_type, entity_id, run_key, result) VALUES (?, ?, 'stock', 0, ?, 'succes')",
                  [automation.user_id, automation.id, runKey]
                );
              }
            } else if (!products.length && !prior.length) {
              await pool.query(
                "INSERT IGNORE INTO pro_automation_runs (user_id, automation_id, entity_type, entity_id, run_key, result) VALUES (?, ?, 'stock', 0, ?, 'aucune_alerte')",
                [automation.user_id, automation.id, runKey]
              );
            }
            await pool.query(
              'UPDATE pro_automations SET derniere_execution = NOW(), prochaine_execution = DATE_ADD(NOW(), INTERVAL ? DAY), dernier_resultat = ? WHERE id = ? AND user_id = ?',
              [frequency, products.length ? (account?.email ? 'succes' : 'email_entreprise_absent') : 'aucune_alerte', automation.id, automation.user_id]
            );
            continue;
          }

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
  }, intervalMs);
  timer.unref(); // ne bloque pas l'arrêt propre du serveur

  // Les webhooks sont traités à part pour respecter les délais de retry (1, 5, 30 min...)
  // sans attendre le prochain passage horaire du moteur de factures récurrentes.
  const webhookIntervalMs = Math.max(10000, Number(process.env.WEBHOOK_DELIVERY_INTERVAL_MS) || 30000);
  const webhookTimer = setInterval(livrerWebhooksEnAttente, webhookIntervalMs);
  webhookTimer.unref();
}

module.exports = { startScheduler, verifierFacturesRecurrentes, expirerPaiementsAbonnementEnAttente, executerRelancesAutomatiques, livrerWebhooksEnAttente };
