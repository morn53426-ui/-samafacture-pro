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

const INVOICE_OUTLIER_RULE = Object.freeze({
  code: 'billing.invoice.amount_outlier',
  lookbackDays: 90,
  minimumSamples: 20,
  comparisonLimit: 50,
  multiplier: 5,
  severity: 'medium',
  title: 'Montant de facture inhabituel',
  summary: 'Le montant de cette facture dépasse au moins cinq fois la médiane des factures comparables de la même entreprise et de la même devise sur les 90 derniers jours. Ce signal nécessite une vérification humaine.'
});

function alertFingerprint(tenantScopeId, accountId) {
  return crypto.createHash('sha256')
    .update(['SamaFacturePro', FAILED_LOGIN_RULE.code, tenantScopeId, accountId].join(':'), 'utf8')
    .digest('hex');
}

function ruleFingerprint(tenantScopeId, ruleCode, entityId) {
  return crypto.createHash('sha256')
    .update(['SamaFacturePro', ruleCode, tenantScopeId, entityId].join(':'), 'utf8')
    .digest('hex');
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

async function evaluateInvoiceAmountOutlier(connection, event, sourceEventId) {
  if (event.eventType !== 'invoice.created' || event.entityType !== 'facture') return null;
  if (event.tenantId === null || !/^\d+$/.test(String(event.entityId || ''))) return null;

  const metadata = event.metadata || {};
  if (metadata.document_type !== 'facture') return null;
  const amount = Number(metadata.total);
  const currency = String(metadata.currency || '').trim().toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0 || !/^[A-Z]{3,8}$/.test(currency)) return null;

  const [history] = await connection.query(
    `SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.total')) AS DECIMAL(24, 2)) AS amount
       FROM pro_audit_events
      WHERE tenant_scope_id = ?
        AND tenant_id = ?
        AND event_type = 'invoice.created'
        AND entity_type = 'facture'
        AND outcome = 'success'
        AND id < ?
        AND created_at >= DATE_SUB(UTC_TIMESTAMP(6), INTERVAL ${INVOICE_OUTLIER_RULE.lookbackDays} DAY)
        AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.document_type')) = 'facture'
        AND UPPER(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.currency'))) = ?
        AND CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.total')) AS DECIMAL(24, 2)) > 0
      ORDER BY created_at DESC, id DESC
      LIMIT ${INVOICE_OUTLIER_RULE.comparisonLimit}`,
    [event.tenantScopeId, event.tenantId, sourceEventId, currency]
  );
  const historicalAmounts = history.map(row => Number(row.amount)).filter(value => Number.isFinite(value) && value > 0);
  if (historicalAmounts.length < INVOICE_OUTLIER_RULE.minimumSamples) return null;

  const historicalMedian = median(historicalAmounts);
  if (!historicalMedian || amount < historicalMedian * INVOICE_OUTLIER_RULE.multiplier) return null;

  const fingerprint = ruleFingerprint(event.tenantScopeId, INVOICE_OUTLIER_RULE.code, event.entityId);
  const [existingRows] = await connection.query(
    `SELECT id FROM pro_security_alerts
      WHERE tenant_scope_id = ? AND fingerprint = ?
      LIMIT 1 FOR UPDATE`,
    [event.tenantScopeId, fingerprint]
  );
  if (existingRows.length) return null;

  const [insert] = await connection.query(
    `INSERT INTO pro_security_alerts
      (tenant_scope_id, tenant_id, rule_code, fingerprint, severity, status, title, summary,
       source_event_id, source_event_type, first_seen_at, last_seen_at, occurrence_count)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, 'invoice.created',
             UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 1)`,
    [
      event.tenantScopeId, event.tenantId, INVOICE_OUTLIER_RULE.code, fingerprint,
      INVOICE_OUTLIER_RULE.severity, INVOICE_OUTLIER_RULE.title, INVOICE_OUTLIER_RULE.summary,
      sourceEventId
    ]
  );
  return {
    action: 'created',
    alertId: Number(insert.insertId),
    ruleCode: INVOICE_OUTLIER_RULE.code,
    severity: INVOICE_OUTLIER_RULE.severity,
    evidence: {
      observed_amount: amount,
      historical_median: historicalMedian,
      currency,
      sample_size: historicalAmounts.length,
      multiplier: INVOICE_OUTLIER_RULE.multiplier
    }
  };
}
/**
 * Détecte les signaux de sécurité et de facturation dérivés des événements déjà
 * présents dans le registre. Cette fonction ne contacte aucun prestataire externe.
 * Elle doit être appelée avec la même connexion/transaction que l'événement source.
 */
async function evaluateSecuritySignal(connection, event, sourceEventId) {
  if (!connection || !event) return null;
  if (event.eventType === 'invoice.created') {
    return evaluateInvoiceAmountOutlier(connection, event, sourceEventId);
  }
  if (event.eventType !== 'auth.login.failed') return null;
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
        AND created_at >= DATE_SUB(UTC_TIMESTAMP(6), INTERVAL ${FAILED_LOGIN_RULE.windowMinutes} MINUTE)`,
    [event.tenantScopeId, event.tenantId, accountId]
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
  let reopenedCaseId = null;
  if (shouldReopen) {
    const [relatedCases] = await connection.query(
      `SELECT id, status FROM pro_security_cases
        WHERE tenant_scope_id = ? AND source_alert_id = ?
        LIMIT 1 FOR UPDATE`,
      [event.tenantScopeId, existing.id]
    );
    if (relatedCases.length && ['resolved', 'closed'].includes(relatedCases[0].status)) {
      reopenedCaseId = Number(relatedCases[0].id);
      await connection.query(
        `UPDATE pro_security_cases
            SET status = 'open', resolved_at = NULL, closed_at = NULL, updated_at = UTC_TIMESTAMP(6)
          WHERE id = ? AND tenant_scope_id = ?`,
        [reopenedCaseId, event.tenantScopeId]
      );
      await connection.query(
        `INSERT INTO pro_security_case_events
          (tenant_scope_id, case_id, actor_user_id, event_type, from_status, to_status)
         VALUES (?, ?, NULL, 'case.reopened', ?, 'open')`,
        [event.tenantScopeId, reopenedCaseId, relatedCases[0].status]
      );
    }
  }
  await connection.query(
    `UPDATE pro_security_alerts
        SET status = ?, source_event_id = ?, source_event_type = 'auth.login.failed',
            last_seen_at = COALESCE(?, UTC_TIMESTAMP(6)),
            occurrence_count = occurrence_count + 1,
            resolved_at = IF(?, NULL, resolved_at),
            resolution_code = IF(?, NULL, resolution_code),
            updated_at = UTC_TIMESTAMP(6)
      WHERE id = ? AND tenant_scope_id = ?`,
    [
      shouldReopen ? 'open' : existing.status,
      sourceEventId,
      aggregate.last_seen,
      shouldReopen ? 1 : 0,
      shouldReopen ? 1 : 0,
      existing.id,
      event.tenantScopeId
    ]
  );
  return {
    action: shouldReopen ? 'reopened' : 'updated',
    alertId: Number(existing.id),
    caseId: reopenedCaseId,
    attempts,
    ruleCode: FAILED_LOGIN_RULE.code
  };
}

module.exports = { FAILED_LOGIN_RULE, INVOICE_OUTLIER_RULE, alertFingerprint, evaluateSecuritySignal, median };
