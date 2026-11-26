'use strict';

const crypto = require('crypto');

const FAILED_LOGIN_RULE = Object.freeze({
  code: 'auth.login.failed.threshold',
  threshold: 5,
  windowMinutes: 15,
  severity: 'high',
  title: 'Échecs de connexion répétés',
  summary: 'Au moins cinq tentatives de connexion échouées ont été enregistrées pour un même compte sur une période de quinze minutes.'
});

function alertFingerprint(tenantScopeId, accountId) {
  return crypto.createHash('sha256')
    .update(['SamaFacturePro', FAILED_LOGIN_RULE.code, tenantScopeId, accountId].join(':'), 'utf8')
    .digest('hex');
}

/**
 * Détecte uniquement les signaux dérivés des événements d'authentification déjà
 * présents dans le registre. Cette fonction ne contacte aucun prestataire externe.
 * Elle doit être appelée avec la même connexion/transaction que l'événement source.
 */
async function evaluateSecuritySignal(connection, event, sourceEventId) {
  if (!connection || !event || event.eventType !== 'auth.login.failed') return null;
  if (event.tenantId === null || !event.entityId || event.entityType !== 'account') return null;

  const accountId = String(event.entityId);
  if (!/^\d+$/.test(accountId)) return null;

  const [[aggregate]] = await connection.query(
    `SELECT COUNT(*) AS attempts, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
       FROM pro_audit_events
      WHERE tenant_scope_id = ?
        AND tenant_id = ?
        AND event_type = 'auth.login.failed'
        AND entity_type = 'account'
        AND entity_id = ?
        AND outcome = 'failure'
        AND created_at >= UTC_TIMESTAMP(6) - INTERVAL ? MINUTE`,
    [event.tenantScopeId, event.tenantId, accountId, FAILED_LOGIN_RULE.windowMinutes]
  );
  const attempts = Number(aggregate?.attempts || 0);
  if (attempts < FAILED_LOGIN_RULE.threshold) return null;

  const fingerprint = alertFingerprint(event.tenantScopeId, accountId);
  const [existingRows] = await connection.query(
    `SELECT id, status, occurrence_count
       FROM pro_security_alerts
      WHERE tenant_scope_id = ? AND fingerprint = ?
      LIMIT 1 FOR UPDATE`,
    [event.tenantScopeId, fingerprint]
  );

  if (!existingRows.length) {
    const [insert] = await connection.query(
      `INSERT INTO pro_security_alerts
        (tenant_scope_id, tenant_id, rule_code, fingerprint, severity, status, title, summary,
         source_event_id, source_event_type, first_seen_at, last_seen_at, occurrence_count)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, 'auth.login.failed',
               COALESCE(?, UTC_TIMESTAMP(6)), COALESCE(?, UTC_TIMESTAMP(6)), ?)`,
      [
        event.tenantScopeId, event.tenantId, FAILED_LOGIN_RULE.code, fingerprint,
        FAILED_LOGIN_RULE.severity, FAILED_LOGIN_RULE.title, FAILED_LOGIN_RULE.summary,
        sourceEventId, aggregate.first_seen, aggregate.last_seen, attempts
      ]
    );
    return {
      action: 'created',
      alertId: Number(insert.insertId),
      attempts,
      ruleCode: FAILED_LOGIN_RULE.code
    };
  }

  const existing = existingRows[0];
  const shouldReopen = existing.status === 'resolved' || existing.status === 'dismissed';
  await connection.query(
    `UPDATE pro_security_alerts
        SET status = ?, source_event_id = ?, source_event_type = 'auth.login.failed',
            last_seen_at = COALESCE(?, UTC_TIMESTAMP(6)),
            occurrence_count = GREATEST(occurrence_count, ?),
            resolved_at = IF(?, NULL, resolved_at),
            resolution_code = IF(?, NULL, resolution_code),
            updated_at = UTC_TIMESTAMP(6)
      WHERE id = ? AND tenant_scope_id = ?`,
    [
      shouldReopen ? 'open' : existing.status,
      sourceEventId,
      aggregate.last_seen,
      attempts,
      shouldReopen ? 1 : 0,
      shouldReopen ? 1 : 0,
      existing.id,
      event.tenantScopeId
    ]
  );
  return {
    action: shouldReopen ? 'reopened' : 'updated',
    alertId: Number(existing.id),
    attempts,
    ruleCode: FAILED_LOGIN_RULE.code
  };
}

module.exports = { FAILED_LOGIN_RULE, alertFingerprint, evaluateSecuritySignal };
