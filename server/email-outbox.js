'use strict';

const crypto = require('node:crypto');
const { pool } = require('./config/db');
const { sendMail } = require('./config/mailer');
const { decryptEmailPayload } = require('./utils/email-outbox-crypto');

const MAX_ATTEMPTS = 8;
const RETRY_DELAYS_SECONDS = [60, 300, 1800, 7200, 21600, 43200, 86400];
// SMTP est borné à 30 s par message ; un lot de 5 conserve une marge confortable
// sous le bail de 5 minutes, même avec un traitement séquentiel.
const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_POLL_INTERVAL_MS = 5000;

function retryDelaySeconds(attempt) {
  const index = Math.max(0, Math.min(RETRY_DELAYS_SECONDS.length - 1, Number(attempt) - 1));
  return RETRY_DELAYS_SECONDS[index];
}

function safeErrorCode(error) {
  const code = String(error?.code || error?.reason || 'email_delivery_failed');
  return /^[A-Za-z0-9_-]{1,80}$/.test(code) ? code : 'email_delivery_failed';
}

async function claimPendingEmails(batchSize = DEFAULT_BATCH_SIZE) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT id, entity_type, entity_id, payload_enc, tentatives
       FROM email_outbox
       WHERE
         ((statut IN ('queued', 'retry') AND prochaine_tentative <= NOW())
          OR (statut = 'processing' AND (verrouille_le IS NULL OR verrouille_le < DATE_SUB(NOW(), INTERVAL 5 MINUTE))))
       ORDER BY id ASC
       LIMIT ?
       FOR UPDATE SKIP LOCKED`,
      [batchSize]
    );

    const claimed = [];
    for (const row of rows) {
      const lockToken = crypto.randomUUID();
      const attempts = Number(row.tentatives || 0) + 1;
      await conn.query(
        `UPDATE email_outbox
         SET statut = 'processing', tentatives = ?, verrouille_le = NOW(),
             lock_token = ?, dernier_code_erreur = NULL, updated_at = NOW()
         WHERE id = ?`,
        [attempts, lockToken, row.id]
      );
      claimed.push({ ...row, tentatives: attempts, lockToken });
    }
    await conn.commit();
    return claimed;
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }
}

function extractEmailVerificationToken(verificationUrl) {
  try {
    const url = new URL(String(verificationUrl || ''));
    const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
    // Le fragment est utilisé pour les nouveaux liens : il n'est jamais envoyé dans le GET.
    // La query string reste lue temporairement pour les emails plus anciens encore valides.
    return fragment.get('verification_token') || url.searchParams.get('verification_token') || '';
  } catch (_) {
    return '';
  }
}

async function isEmailJobDeliverable(job, message) {
  if (job.entity_type === 'team_invitation') {
    const [[invitation]] = await pool.query(
      "SELECT id FROM pro_team_invitations WHERE id = ? AND statut = 'envoyee' AND expire_at > NOW() LIMIT 1",
      [job.entity_id]
    );
    return Boolean(invitation);
  }

  if (job.entity_type === 'team_invitation_verification') {
    const proofToken = extractEmailVerificationToken(message?.verification_url);
    if (!/^[a-f0-9]{64}$/i.test(proofToken)) return false;
    const proofHash = crypto.createHash('sha256').update(proofToken).digest('hex');
    const [[verification]] = await pool.query(
      "SELECT v.id FROM pro_team_invitation_verifications v " +
      "JOIN pro_team_invitations i ON i.id = v.invitation_id " +
      "JOIN users account ON account.id = v.member_user_id " +
      "WHERE v.id = ? AND v.token_hash = ? AND v.used_at IS NULL AND v.expires_at > NOW() " +
      "AND i.statut = 'envoyee' AND i.expire_at > NOW() " +
      "AND LOWER(account.email) = LOWER(i.email) LIMIT 1",
      [job.entity_id, proofHash]
    );
    return Boolean(verification);
  }

  if (job.entity_type === 'company_group_invitation') {
    const [[invitation]] = await pool.query(
      `SELECT id
       FROM pro_company_group_invitations
       WHERE id = ? AND statut = 'envoyee' AND expire_at > NOW()
       LIMIT 1`,
      [job.entity_id]
    );
    return Boolean(invitation);
  }

  if (job.entity_type === 'company_group_invitation_verification') {
    const proofToken = extractEmailVerificationToken(message?.verification_url);
    if (!/^[a-f0-9]{64}$/i.test(proofToken)) return false;
    const proofHash = crypto.createHash('sha256').update(proofToken).digest('hex');
    const [[verification]] = await pool.query(
      `SELECT v.id
       FROM pro_company_group_invitation_verifications v
       JOIN pro_company_group_invitations i ON i.id = v.invitation_id
       JOIN users account ON account.id = v.company_owner_id
       WHERE v.id = ? AND v.token_hash = ?
         AND v.used_at IS NULL AND v.expires_at > NOW()
         AND i.statut = 'envoyee' AND i.expire_at > NOW()
         AND LOWER(account.email) = LOWER(i.invited_email)
       LIMIT 1`,
      [job.entity_id, proofHash]
    );
    return Boolean(verification);
  }

  return true;
}

async function markEmailCancelled(job) {
  await pool.query(
    `UPDATE email_outbox
     SET statut = 'cancelled', verrouille_le = NULL, lock_token = NULL,
         dernier_code_erreur = 'entity_inactive', updated_at = NOW()
     WHERE id = ? AND statut = 'processing' AND lock_token = ?`,
    [job.id, job.lockToken]
  );
}

async function markEmailSent(job) {
  await pool.query(
    `UPDATE email_outbox
     SET statut = 'sent', envoye_le = NOW(), verrouille_le = NULL,
         lock_token = NULL, dernier_code_erreur = NULL, updated_at = NOW()
     WHERE id = ? AND statut = 'processing' AND lock_token = ?`,
    [job.id, job.lockToken]
  );
}

async function markEmailFailure(job, error) {
  const code = safeErrorCode(error);
  const terminal = Number(job.tentatives) >= MAX_ATTEMPTS;
  if (terminal) {
    await pool.query(
      `UPDATE email_outbox
       SET statut = 'failed', verrouille_le = NULL, lock_token = NULL,
           dernier_code_erreur = ?, updated_at = NOW()
       WHERE id = ? AND statut = 'processing' AND lock_token = ?`,
      [code, job.id, job.lockToken]
    );
    return { failed: true, retried: false, code };
  }

  const delaySeconds = retryDelaySeconds(job.tentatives);
  await pool.query(
    `UPDATE email_outbox
     SET statut = 'retry', prochaine_tentative = DATE_ADD(NOW(), INTERVAL ? SECOND),
         verrouille_le = NULL, lock_token = NULL, dernier_code_erreur = ?, updated_at = NOW()
     WHERE id = ? AND statut = 'processing' AND lock_token = ?`,
    [delaySeconds, code, job.id, job.lockToken]
  );
  return { failed: false, retried: true, code, delaySeconds };
}

/**
 * Réclame les messages de manière atomique (SKIP LOCKED), remet les tâches
 * interrompues en circulation après expiration du bail, puis confirme ou planifie
 * une nouvelle tentative sans jamais journaliser le contenu ou le destinataire.
 *
 * sender est injectable pour permettre des tests sans serveur SMTP réel.
 */
async function dispatchPendingEmails({ sender = sendMail, batchSize = DEFAULT_BATCH_SIZE } = {}) {
  if (typeof sender !== 'function') throw new TypeError('sender doit être une fonction.');
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
    throw new RangeError('batchSize doit être compris entre 1 et 100.');
  }

  const jobs = await claimPendingEmails(batchSize);
  const summary = { claimed: jobs.length, sent: 0, retried: 0, failed: 0, cancelled: 0 };

  for (const job of jobs) {
    try {
      // Déchiffre d'abord les preuves afin de lier la tâche à la version courante du jeton.
      // Un ancien email repris après une demande de renvoi ne doit pas livrer un lien déjà remplacé.
      const needsVerificationPayload = [
        'company_group_invitation_verification',
        'team_invitation_verification'
      ].includes(job.entity_type);
      const message = needsVerificationPayload ? decryptEmailPayload(job.payload_enc) : null;
      if (!await isEmailJobDeliverable(job, message)) {
        await markEmailCancelled(job);
        summary.cancelled += 1;
        continue;
      }
      // Une tâche récupérée après un crash à la dernière tentative a été
      // incrémentée au-delà de MAX_ATTEMPTS lors de sa nouvelle réservation :
      // elle passe directement en échec, sans nouvel appel SMTP.
      if (Number(job.tentatives) > MAX_ATTEMPTS) {
        const exhaustedError = new Error('Nombre maximal de tentatives email atteint.');
        exhaustedError.code = 'max_attempts_exceeded';
        const exhausted = await markEmailFailure(job, exhaustedError);
        if (exhausted.failed) summary.failed += 1;
        else summary.retried += 1;
        console.warn('Email outbox #' + job.id + ' abandonné : ' + exhausted.code);
        continue;
      }
      const deliveryMessage = message || decryptEmailPayload(job.payload_enc);
      const result = await sender(deliveryMessage);
      if (!result || result.sent !== true) {
        const error = new Error('Email delivery was not confirmed.');
        error.code = result?.reason || 'email_not_confirmed';
        throw error;
      }
      await markEmailSent(job);
      summary.sent += 1;
    } catch (error) {
      const result = await markEmailFailure(job, error);
      if (result.failed) summary.failed += 1;
      else summary.retried += 1;
      // Le code est volontairement le seul détail journalisé : les messages SMTP
      // bruts peuvent contenir un destinataire, un lien ou une donnée sensible.
      console.warn('Email outbox #' + job.id + ' non remis : ' + result.code);
    }
  }

  return summary;
}

function startEmailOutboxWorker({
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
  logger = console
} = {}) {
  if (!Number.isFinite(intervalMs) || intervalMs < 1000) {
    throw new RangeError('intervalMs doit être supérieur ou égal à 1000 ms.');
  }

  let stopped = false;
  let timer = null;
  let activePromise = null;

  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(tick, intervalMs);
    timer.unref?.();
  };

  const tick = () => {
    if (stopped || activePromise) return;
    activePromise = dispatchPendingEmails()
      .then(summary => {
        if (summary.sent || summary.retried || summary.failed) {
          logger.info(
            'Email outbox : ' + summary.sent + ' envoyé(s), ' +
            summary.retried + ' à réessayer, ' + summary.failed + ' en échec.'
          );
        }
      })
      .catch(error => {
        logger.error('Traitement email outbox impossible :', safeErrorCode(error));
      })
      .finally(() => {
        activePromise = null;
        schedule();
      });
  };

  schedule();
  return async function stopEmailOutboxWorker() {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (activePromise) await activePromise;
  };
}

module.exports = {
  MAX_ATTEMPTS,
  RETRY_DELAYS_SECONDS,
  retryDelaySeconds,
  safeErrorCode,
  extractEmailVerificationToken,
  dispatchPendingEmails,
  startEmailOutboxWorker
};
