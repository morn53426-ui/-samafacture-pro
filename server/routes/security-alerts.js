'use strict';

const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { resolveTenant, requirePermission } = require('../middleware/tenant');
const { appendAuditEvent } = require('../utils/audit-ledger');

const router = express.Router();
const ALERT_STATUSES = new Set(['open', 'investigating', 'resolved', 'dismissed']);
const CASE_STATUSES = new Set(['open', 'investigating', 'resolved', 'closed']);
const RESOLUTION_CODES = new Set(['mitigated', 'false_positive', 'accepted', 'not_applicable']);
const ALERT_TRANSITIONS = Object.freeze({
  open: new Set(['investigating', 'resolved', 'dismissed']),
  investigating: new Set(['open', 'resolved', 'dismissed']),
  resolved: new Set(),
  dismissed: new Set()
});

router.use(requireAuth, resolveTenant, requirePermission);

function noStore(res) {
  res.set('Cache-Control', 'no-store, max-age=0');
  res.set('Pragma', 'no-cache');
}

function positiveId(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function tenantId(req) {
  const parsed = positiveId(req.tenantId);
  return parsed;
}

function actorId(req) {
  return positiveId(req.actorId || req.user?.id);
}

function safePage(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

async function withTransaction(task) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await task(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

function safeEvidence(value) {
  let source = value;
  if (typeof source === 'string') {
    try { source = JSON.parse(source); } catch (_) { return null; }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const evidence = {};
  const attempts = Number(source.attempts_in_window);
  if (Number.isSafeInteger(attempts) && attempts > 0) evidence.attempts_in_window = attempts;
  const observed = Number(source.observed_amount);
  if (source.observed_amount !== undefined && Number.isFinite(observed) && observed > 0) {
    evidence.observed_amount = observed;
  }
  const historicalMedian = Number(source.historical_median);
  if (source.historical_median !== undefined && Number.isFinite(historicalMedian) && historicalMedian > 0) {
    evidence.historical_median = historicalMedian;
  }
  const currency = String(source.currency || '').toUpperCase();
  if (/^[A-Z]{3,8}$/.test(currency)) evidence.currency = currency;
  const sampleSize = Number(source.sample_size);
  if (Number.isSafeInteger(sampleSize) && sampleSize > 0) evidence.sample_size = sampleSize;
  const multiplier = Number(source.multiplier);
  if (Number.isFinite(multiplier) && multiplier > 0) evidence.multiplier = multiplier;
  return Object.keys(evidence).length ? evidence : null;
}

function auditContext(req, eventType, entityType, entityId, metadata) {
  return {
    tenantId: tenantId(req),
    actorUserId: actorId(req),
    actorKind: 'user',
    eventType,
    category: 'security',
    severity: 'high',
    entityType,
    entityId,
    outcome: 'success',
    metadata
  };
}

router.get('/security-alerts', async (req, res, next) => {
  noStore(res);
  try {
    const scope = tenantId(req);
    if (!scope) return res.status(403).json({ error: 'Tenant actif invalide.' });
    const page = safePage(req.query.page, 1, 100000);
    const limit = safePage(req.query.limit, 25, 100);
    const offset = (page - 1) * limit;
    const where = ['a.tenant_scope_id = ?'];
    const params = [scope];

    if (req.query.status) {
      if (!ALERT_STATUSES.has(String(req.query.status))) {
        return res.status(400).json({ error: 'Statut d’alerte invalide.' });
      }
      where.push('a.status = ?');
      params.push(String(req.query.status));
    }
    if (req.query.severity) {
      if (!['low', 'medium', 'high', 'critical'].includes(String(req.query.severity))) {
        return res.status(400).json({ error: 'Niveau de gravité invalide.' });
      }
      where.push('a.severity = ?');
      params.push(String(req.query.severity));
    }

    const clause = where.join(' AND ');
    const [[count]] = await pool.query(
      'SELECT COUNT(*) AS total FROM pro_security_alerts a WHERE ' + clause,
      params
    );
    const [alerts] = await pool.query(
      `SELECT a.id, a.rule_code, a.severity, a.status, a.title, a.summary, a.source_event_id,
              a.source_event_type, a.first_seen_at, a.last_seen_at, a.occurrence_count,
              a.resolved_at, a.created_at, a.updated_at,
              (SELECT c.id FROM pro_security_cases c
                WHERE c.tenant_scope_id = a.tenant_scope_id AND c.source_alert_id = a.id LIMIT 1) AS case_id,
              (SELECT e.metadata_json FROM pro_audit_events e
                WHERE e.tenant_scope_id = a.tenant_scope_id
                  AND e.entity_type = 'security_alert'
                  AND e.entity_id = CAST(a.id AS CHAR) COLLATE utf8mb4_unicode_ci
                  AND e.event_type IN ('security.alert.created', 'security.alert.reopened')
                ORDER BY e.chain_sequence DESC LIMIT 1) AS evidence_json,
              CASE WHEN a.rule_code = 'auth.login.failed.threshold' THEN
                (SELECT COUNT(*)
                   FROM pro_audit_events failed
                  WHERE failed.tenant_scope_id = a.tenant_scope_id
                    AND failed.tenant_id = a.tenant_id
                    AND failed.event_type = 'auth.login.failed'
                    AND failed.entity_type = 'account'
                    AND failed.entity_id = source_auth_event.entity_id
                    AND failed.outcome = 'failure'
                    AND failed.created_at >= DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 15 MINUTE))
              ELSE NULL END AS attempts_in_window
         FROM pro_security_alerts a
         LEFT JOIN pro_audit_events source_auth_event
           ON source_auth_event.id = a.source_event_id
          AND source_auth_event.tenant_scope_id = a.tenant_scope_id
          AND source_auth_event.tenant_id = a.tenant_id
          AND source_auth_event.event_type = 'auth.login.failed'
          AND source_auth_event.entity_type = 'account'
          AND source_auth_event.outcome = 'failure'
        WHERE ${clause}
        ORDER BY FIELD(a.severity, 'critical', 'high', 'medium', 'low'), a.last_seen_at DESC, a.id DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const visibleAlerts = alerts.map(({ evidence_json, attempts_in_window, ...alert }) => {
      const evidence = safeEvidence(evidence_json) || {};
      if (alert.rule_code === 'auth.login.failed.threshold') {
        const attempts = Number(attempts_in_window);
        // Remplace la preuve de création par le décompte courant, même lorsqu'il est retombé à zéro.
        evidence.attempts_in_window = Number.isSafeInteger(attempts) && attempts >= 0 ? attempts : 0;
      }
      return {
        ...alert,
        evidence: Object.keys(evidence).length ? evidence : null
      };
    });
    return res.json({
      alerts: visibleAlerts,
      pagination: {
        page,
        limit,
        total: Number(count.total),
        total_pages: Math.ceil(Number(count.total) / limit)
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/security-alerts/:id/status', async (req, res, next) => {
  noStore(res);
  try {
    const scope = tenantId(req);
    const id = positiveId(req.params.id);
    const nextStatus = String(req.body?.status || '');
    const resolutionCode = req.body?.resolution_code == null ? null : String(req.body.resolution_code);
    if (!scope) return res.status(403).json({ error: 'Tenant actif invalide.' });
    if (!id || !ALERT_STATUSES.has(nextStatus)) {
      return res.status(400).json({ error: 'Identifiant ou statut d’alerte invalide.' });
    }
    if ((nextStatus === 'resolved' || nextStatus === 'dismissed') && !resolutionCode) {
      return res.status(400).json({ error: 'Un code de résolution est obligatoire pour clôturer une alerte.' });
    }
    if (resolutionCode !== null && !RESOLUTION_CODES.has(resolutionCode)) {
      return res.status(400).json({ error: 'Code de résolution invalide.' });
    }
    const updated = await withTransaction(async connection => {
      const [rows] = await connection.query(
        'SELECT id, status, source_event_type FROM pro_security_alerts WHERE id = ? AND tenant_scope_id = ? FOR UPDATE',
        [id, scope]
      );
      if (!rows.length) return { missing: true };
      const previous = rows[0].status;
      if (previous === nextStatus) return { unchanged: true, status: previous };
      if (!ALERT_TRANSITIONS[previous]?.has(nextStatus)) {
        return { conflict: true, reason: 'invalid_transition' };
      }
      if (nextStatus === 'dismissed' || nextStatus === 'resolved') {
        const [activeCases] = await connection.query(
          `SELECT id FROM pro_security_cases
            WHERE tenant_scope_id = ? AND source_alert_id = ? AND status IN ('open', 'investigating')
            LIMIT 1`,
          [scope, id]
        );
        if (activeCases.length) return { conflict: true, reason: 'active_case' };
      }
      await connection.query(
        `UPDATE pro_security_alerts
            SET status = ?,
                resolved_at = IF(? IN ('resolved', 'dismissed'), UTC_TIMESTAMP(6), NULL),
                resolution_code = IF(? IN ('resolved', 'dismissed'), ?, NULL),
                updated_at = UTC_TIMESTAMP(6)
          WHERE id = ? AND tenant_scope_id = ?`,
        [nextStatus, nextStatus, nextStatus, resolutionCode, id, scope]
      );
      await appendAuditEvent(auditContext(
        req,
        'security.alert.status_changed',
        'security_alert',
        id,
        { from_status: previous, to_status: nextStatus }
      ), connection);
      return { status: nextStatus };
    });
    if (updated.missing) return res.status(404).json({ error: 'Alerte introuvable pour ce tenant.' });
    if (updated.conflict && updated.reason === 'active_case') return res.status(409).json({ error: 'Clôturez d’abord le dossier d’investigation lié à cette alerte.' });
    if (updated.conflict) return res.status(409).json({ error: 'Transition de statut impossible pour cette alerte.' });
    return res.json({ id, ...updated });
  } catch (error) {
    return next(error);
  }
});

router.get('/security-cases', async (req, res, next) => {
  noStore(res);
  try {
    const scope = tenantId(req);
    if (!scope) return res.status(403).json({ error: 'Tenant actif invalide.' });
    const status = req.query.status == null || req.query.status === '' ? null : String(req.query.status);
    if (status !== null && !CASE_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Statut de dossier invalide.' });
    }
    const page = safePage(req.query.page, 1, 100000);
    const limit = safePage(req.query.limit, 25, 100);
    const offset = (page - 1) * limit;
    const where = ['c.tenant_scope_id = ?'];
    const params = [scope];
    if (status) {
      where.push('c.status = ?');
      params.push(status);
    }
    const clause = where.join(' AND ');
    const [[count]] = await pool.query(
      'SELECT COUNT(*) AS total FROM pro_security_cases c WHERE ' + clause,
      params
    );
    const [cases] = await pool.query(
      `SELECT c.id, c.source_alert_id, c.title, c.severity, c.status,
              c.created_by_user_id, c.assigned_to_user_id, c.resolved_at,
              c.closed_at, c.created_at, c.updated_at,
              a.summary AS alert_summary, a.occurrence_count, a.last_seen_at
         FROM pro_security_cases c
         INNER JOIN pro_security_alerts a
           ON a.id = c.source_alert_id AND a.tenant_scope_id = c.tenant_scope_id
        WHERE ${clause}
        ORDER BY FIELD(c.severity, 'critical', 'high', 'medium', 'low'), c.updated_at DESC, c.id DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return res.json({
      cases,
      pagination: { page, limit, total: Number(count.total), total_pages: Math.ceil(Number(count.total) / limit) }
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/security-cases', async (req, res, next) => {
  noStore(res);
  try {
    const scope = tenantId(req);
    const actor = actorId(req);
    const alertId = positiveId(req.body?.alert_id);
    if (!scope || !actor || !alertId) {
      return res.status(400).json({ error: 'Tenant, auteur ou identifiant d’alerte invalide.' });
    }
    const created = await withTransaction(async connection => {
      const [alerts] = await connection.query(
        `SELECT id, title, severity, status, source_event_type, rule_code
           FROM pro_security_alerts
          WHERE id = ? AND tenant_scope_id = ?
          FOR UPDATE`,
        [alertId, scope]
      );
      if (!alerts.length) return { missing: true };
      const [existing] = await connection.query(
        'SELECT id FROM pro_security_cases WHERE tenant_scope_id = ? AND source_alert_id = ? LIMIT 1',
        [scope, alertId]
      );
      if (existing.length) return { duplicate: true, caseId: Number(existing[0].id) };

      const alert = alerts[0];
      if (['resolved', 'dismissed'].includes(alert.status)) {
        return { closedAlert: true };
      }
      const [insert] = await connection.query(
        `INSERT INTO pro_security_cases
          (tenant_scope_id, tenant_id, source_alert_id, title, severity, status, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, 'open', ?)`,
        [scope, scope, alertId, alert.title, alert.severity, actor]
      );
      const caseId = Number(insert.insertId);
      await connection.query(
        `INSERT INTO pro_security_case_events
          (tenant_scope_id, case_id, actor_user_id, event_type, from_status, to_status)
         VALUES (?, ?, ?, 'case.created', NULL, 'open')`,
        [scope, caseId, actor]
      );
      await connection.query(
        `UPDATE pro_security_alerts
            SET status = 'investigating', resolved_at = NULL, resolution_code = NULL,
                updated_at = UTC_TIMESTAMP(6)
          WHERE id = ? AND tenant_scope_id = ?`,
        [alertId, scope]
      );
      await appendAuditEvent(auditContext(
        req,
        'security.case.created',
        'security_case',
        caseId,
        { alert_id: alertId, source_event_type: alert.source_event_type, rule_code: alert.rule_code }
      ), connection);
      return { caseId };
    });
    if (created.missing) return res.status(404).json({ error: 'Alerte introuvable pour ce tenant.' });
    if (created.duplicate) return res.status(409).json({ error: 'Un dossier existe déjà pour cette alerte.', case_id: created.caseId });
    if (created.closedAlert) return res.status(409).json({ error: 'Impossible d’ouvrir un dossier sur une alerte résolue ou écartée. Un nouveau signal doit d’abord la rouvrir.' });
    return res.status(201).json({ id: created.caseId, status: 'open', alert_id: alertId });
  } catch (error) {
    return next(error);
  }
});

router.put('/security-cases/:id/status', async (req, res, next) => {
  noStore(res);
  try {
    const scope = tenantId(req);
    const actor = actorId(req);
    const caseId = positiveId(req.params.id);
    const nextStatus = String(req.body?.status || '');
    if (!scope || !actor || !caseId || !CASE_STATUSES.has(nextStatus)) {
      return res.status(400).json({ error: 'Identifiant ou statut de dossier invalide.' });
    }
    const updated = await withTransaction(async connection => {
      const [rows] = await connection.query(
        'SELECT id, source_alert_id, status FROM pro_security_cases WHERE id = ? AND tenant_scope_id = ? FOR UPDATE',
        [caseId, scope]
      );
      if (!rows.length) return { missing: true };
      const current = rows[0];
      if (current.status === 'closed') return { conflict: true };
      if (current.status === nextStatus) return { unchanged: true, status: current.status };
      const allowedTransitions = {
        open: ['investigating', 'resolved', 'closed'],
        investigating: ['open', 'resolved', 'closed'],
        resolved: ['investigating', 'closed']
      };
      if (!allowedTransitions[current.status]?.includes(nextStatus)) return { conflict: true };

      await connection.query(
        `UPDATE pro_security_cases
            SET status = ?,
                resolved_at = IF(? IN ('resolved', 'closed'), COALESCE(resolved_at, UTC_TIMESTAMP(6)), NULL),
                closed_at = IF(? = 'closed', COALESCE(closed_at, UTC_TIMESTAMP(6)), NULL),
                updated_at = UTC_TIMESTAMP(6)
          WHERE id = ? AND tenant_scope_id = ?`,
        [nextStatus, nextStatus, nextStatus, caseId, scope]
      );
      await connection.query(
        `INSERT INTO pro_security_case_events
          (tenant_scope_id, case_id, actor_user_id, event_type, from_status, to_status)
         VALUES (?, ?, ?, 'case.status_changed', ?, ?)`,
        [scope, caseId, actor, current.status, nextStatus]
      );
      await connection.query(
        `UPDATE pro_security_alerts
            SET status = ?,
                resolved_at = IF(? IN ('resolved', 'closed'), COALESCE(resolved_at, UTC_TIMESTAMP(6)), NULL),
                resolution_code = IF(? IN ('resolved', 'closed'), 'mitigated', NULL),
                updated_at = UTC_TIMESTAMP(6)
          WHERE id = ? AND tenant_scope_id = ?`,
        [
          nextStatus === 'resolved' || nextStatus === 'closed' ? 'resolved' : 'investigating',
          nextStatus, nextStatus, current.source_alert_id, scope
        ]
      );
      await appendAuditEvent(auditContext(
        req,
        'security.case.status_changed',
        'security_case',
        caseId,
        { from_status: current.status, to_status: nextStatus, alert_id: Number(current.source_alert_id) }
      ), connection);
      return { status: nextStatus };
    });
    if (updated.missing) return res.status(404).json({ error: 'Dossier introuvable pour ce tenant.' });
    if (updated.conflict) return res.status(409).json({ error: 'Transition de statut impossible.' });
    return res.json({ id: caseId, ...updated });
  } catch (error) {
    return next(error);
  }
});

router.get('/security-cases/:id/events', async (req, res, next) => {
  noStore(res);
  try {
    const scope = tenantId(req);
    const caseId = positiveId(req.params.id);
    if (!scope || !caseId) return res.status(400).json({ error: 'Identifiant de dossier invalide.' });
    const [cases] = await pool.query(
      'SELECT id FROM pro_security_cases WHERE id = ? AND tenant_scope_id = ? LIMIT 1',
      [caseId, scope]
    );
    if (!cases.length) return res.status(404).json({ error: 'Dossier introuvable pour ce tenant.' });
    const [events] = await pool.query(
      `SELECT id, actor_user_id, event_type, from_status, to_status, created_at
         FROM pro_security_case_events
        WHERE tenant_scope_id = ? AND case_id = ?
        ORDER BY id ASC`,
      [scope, caseId]
    );
    return res.json({ events });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
