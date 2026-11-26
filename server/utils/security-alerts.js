'use strict';

const crypto = require('node:crypto');
const { pool } = require('../config/db');
const { appendAuditEvent, normalizeMetadata } = require('./audit-ledger');

const SEVERITY_RANK = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

function positiveId(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new TypeError(label + ' invalide.');
  return parsed;
}

function cleanText(value, max, label, required = false) {
  const text = String(value == null ? '' : value).trim();
  if (required && !text) throw new TypeError(label + ' obligatoire.');
  if (text.length > max) throw new RangeError(label + ' dépasse ' + max + ' caractères.');
  return text || null;
}

function sanitizeCaseText(value, maxLength = 4000) {
  return String(value == null ? '' : value).trim()
    .replace(/\\bBearer\\s+[A-Za-z0-9._~+/=-]+/gi, '[JETON MASQUÉ]')
    .replace(/\\b[A-Z]{2}\\d{2}[A-Z0-9]{10,30}\\b/gi, '[IBAN MASQUÉ]')
    .replace(/\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b/gi, '[EMAIL MASQUÉ]')
    .replace(/\\b(?:\\d[ -]*?){13,19}\\b/g, '[NUMÉRO DE CARTE MASQUÉ]')
    .slice(0, maxLength);
}

function buildFingerprint(tenantId, alertType, entityType, entityId, deduplicationKey) {
  return crypto.createHash('sha256')
    .update([
      'SamaFacturePro/security-alert/v1',
      tenantId,
      alertType,
      entityType || '',
      entityId || '',
      deduplicationKey || ''
    ].join('\n'), 'utf8')
    .digest('hex');
}

async function inTransaction(task, connection = null) {
  if (connection) return task(connection);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await task(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

async function createOrRefreshSecurityAlert(input, connection = null) {
  if (!input || typeof input !== 'object') throw new TypeError('Une alerte de sécurité est obligatoire.');
  const tenantId = positiveId(input.tenantId, 'Tenant');
  const alertType = cleanText(input.alertType, 120, 'Type d’alerte', true);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,119}$/.test(alertType)) throw new TypeError('Type d’alerte invalide.');
  const category = cleanText(input.category || 'security', 40, 'Catégorie', true).toLowerCase();
  if (!/^[a-z][a-z0-9_-]{1,39}$/.test(category)) throw new TypeError('Catégorie invalide.');
  const severity = String(input.severity || 'medium').toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(SEVERITY_RANK, severity) || severity === 'info') {
    throw new TypeError('La gravité doit être low, medium, high ou critical.');
  }
  const title = cleanText(input.title, 190, 'Titre', true);
  const description = sanitizeCaseText(cleanText(input.description, 4000, 'Description'), 4000) || null;
  const entityType = cleanText(input.entityType, 80, 'Type d’entité');
  const entityId = input.entityId == null ? null : cleanText(input.entityId, 100, 'Identifiant d’entité');
  const sourceEventId = input.sourceEventId == null ? null : positiveId(input.sourceEventId, 'Événement source');
  const details = normalizeMetadata(input.details || {});
  const fingerprint = buildFingerprint(
    tenantId,
    alertType,
    entityType,
    entityId,
    cleanText(input.deduplicationKey, 160, 'Clé de déduplication')
  );

  return inTransaction(async conn => {
    const [insertResult] = await conn.query(
      `INSERT IGNORE INTO pro_security_alerts
        (tenant_scope_id, fingerprint, alert_type, category, severity, status, title, description,
         source_event_id, entity_type, entity_id, occurrences, first_seen_at, last_seen_at, details_json)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), ?)`,
      [
        tenantId, fingerprint, alertType, category, severity, title, description,
        sourceEventId, entityType, entityId, JSON.stringify(details)
      ]
    );
    const [[current]] = await conn.query(
      'SELECT * FROM pro_security_alerts WHERE tenant_scope_id = ? AND fingerprint = ? LIMIT 1 FOR UPDATE',
      [tenantId, fingerprint]
    );
    if (!current) throw new Error('Alerte de sécurité introuvable après écriture.');

    const created = Number(insertResult.affectedRows) === 1;
    const previousStatus = created ? null : current.status;
    const reopened = !created && ['resolved', 'false_positive', 'closed'].includes(current.status);
    const nextStatus = reopened ? 'open' : current.status;
    const nextSeverity = SEVERITY_RANK[severity] > SEVERITY_RANK[current.severity]
      ? severity
      : current.severity;
    let alert = current;

    if (!created) {
      await conn.query(
        `UPDATE pro_security_alerts
            SET status = ?,
                severity = ?,
                occurrences = occurrences + 1,
                last_seen_at = UTC_TIMESTAMP(6),
                source_event_id = COALESCE(?, source_event_id),
                description = COALESCE(?, description),
                details_json = COALESCE(?, details_json),
                acknowledged_by_user_id = IF(?, NULL, acknowledged_by_user_id),
                acknowledged_at = IF(?, NULL, acknowledged_at),
                resolved_by_user_id = IF(?, NULL, resolved_by_user_id),
                resolved_at = IF(?, NULL, resolved_at),
                resolution_note = IF(?, NULL, resolution_note)
          WHERE id = ? AND tenant_scope_id = ?`,
        [
          nextStatus, nextSeverity, sourceEventId, description, JSON.stringify(details),
          reopened, reopened, reopened, reopened, reopened, Number(current.id), tenantId
        ]
      );
      [[alert]] = await conn.query(
        'SELECT * FROM pro_security_alerts WHERE id = ? AND tenant_scope_id = ? LIMIT 1',
        [current.id, tenantId]
      );
    }

    const activityType = created ? 'alert.created' : (reopened ? 'alert.reopened' : 'alert.repeated');
    const auditEventType = created ? 'security.alert.created' : (reopened ? 'security.alert.reopened' : 'security.alert.repeated');
    await conn.query(
      `INSERT INTO pro_security_case_activity
        (tenant_scope_id, alert_id, investigation_id, actor_user_id, activity_type,
         previous_status, new_status, details_json)
       VALUES (?, ?, NULL, NULL, ?, ?, ?, ?)`,
      [
        tenantId,
        Number(alert.id),
        activityType,
        previousStatus,
        alert.status,
        JSON.stringify(normalizeMetadata({
          occurrences: Number(alert.occurrences),
          severity: alert.severity,
          source_event_id: sourceEventId
        }))
      ]
    );
    await appendAuditEvent({
      tenantId,
      actorUserId: null,
      actorKind: 'system',
      eventType: auditEventType,
      category: 'security',
      severity: alert.severity,
      entityType: 'security_alert',
      entityId: Number(alert.id),
      outcome: 'success',
      metadata: {
        alert_type: alert.alert_type,
        occurrences: Number(alert.occurrences),
        source_event_id: sourceEventId
      }
    }, conn);
    return alert;
  }, connection);
}

async function detectRepeatedLoginFailures(input) {
  const tenantId = positiveId(input.tenantId, 'Tenant');
  const accountId = cleanText(input.accountId, 100, 'Compte', true);
  const threshold = Number(input.threshold || 5);
  const windowMinutes = Number(input.windowMinutes || 15);
  if (!Number.isSafeInteger(threshold) || threshold < 3 || threshold > 50 ||
      !Number.isSafeInteger(windowMinutes) || windowMinutes < 1 || windowMinutes > 60) {
    throw new TypeError('Seuil de détection invalide.');
  }

  const [[counts]] = await pool.query(
    `SELECT COUNT(*) AS attempts, MAX(id) AS latest_event_id
       FROM pro_audit_events
      WHERE tenant_scope_id = ?
        AND event_type = 'auth.login.failed'
        AND category = 'security'
        AND entity_type = 'account'
        AND entity_id = ?
        AND outcome = 'failure'
        AND created_at >= DATE_SUB(UTC_TIMESTAMP(6), INTERVAL ? MINUTE)`,
    [tenantId, accountId, windowMinutes]
  );
  const attempts = Number(counts.attempts || 0);
  if (attempts < threshold) return null;

  return createOrRefreshSecurityAlert({
    tenantId,
    alertType: 'auth.failed_login_burst',
    category: 'authentication',
    severity: attempts >= threshold * 2 ? 'critical' : 'high',
    title: 'Échecs répétés de connexion',
    description: 'Le compte a subi au moins ' + threshold + ' échecs de connexion en ' + windowMinutes + ' minutes.',
    entityType: 'account',
    entityId: accountId,
    sourceEventId: counts.latest_event_id == null ? null : Number(counts.latest_event_id),
    deduplicationKey: 'repeated-failures',
    details: { observed_attempts: attempts, threshold, window_minutes: windowMinutes }
  });
}

module.exports = {
  createOrRefreshSecurityAlert,
  detectRepeatedLoginFailures,
  buildFingerprint,
  sanitizeCaseText,
  SEVERITY_RANK
};
