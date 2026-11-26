'use strict';

const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { resolveTenant, requirePermission } = require('../middleware/tenant');
const { appendAuditEvent, verifyAuditChain, AuditConfigurationError } = require('../utils/audit-ledger');

const router = express.Router();

function parsePositiveInteger(value, fallback, maximum) {
  if (value === undefined) return fallback;
  if (Array.isArray(value) || !/^\d+$/.test(String(value))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null;
}

function parseDate(value) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : false;
}

function noStore(res) {
  res.set('Cache-Control', 'no-store, max-age=0');
  res.set('Pragma', 'no-cache');
}

function context(req) {
  return {
    tenantId: Number(req.tenantId),
    actorUserId: Number(req.actorId || req.user.id),
    actorKind: 'user',
    ipAddress: req.ip || null,
    userAgent: req.get('user-agent') || null,
    requestId: req.requestId || null
  };
}

function handleAuditError(err, res, next) {
  if (err instanceof AuditConfigurationError) {
    return res.status(503).json({
      error: 'Le registre d’audit signé n’est pas configuré sur ce serveur.',
      code: err.code
    });
  }
  return next(err);
}

router.get('/audit-events', requireAuth, resolveTenant, requirePermission, async (req, res, next) => {
  noStore(res);
  try {
    const page = parsePositiveInteger(req.query.page, 1, 1000000);
    const limit = parsePositiveInteger(req.query.limit, 25, 100);
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    if (!page || !limit || from === false || to === false || (from && to && from > to)) {
      return res.status(400).json({
        error: 'Filtres invalides. page >= 1, limit entre 1 et 100 et dates YYYY-MM-DD en UTC sont attendues.'
      });
    }
    const category = req.query.category === undefined ? null : String(req.query.category).trim().toLowerCase();
    const severity = req.query.severity === undefined ? null : String(req.query.severity).trim().toLowerCase();
    const eventType = req.query.event_type === undefined ? null : String(req.query.event_type).trim();
    const actorId = req.query.actor_user_id === undefined ? null : parsePositiveInteger(req.query.actor_user_id, null, Number.MAX_SAFE_INTEGER);
    const search = req.query.q === undefined ? null : String(req.query.q).trim();
    if ((category && !/^[a-z][a-z0-9_-]{1,39}$/.test(category)) ||
        (severity && !['info', 'low', 'medium', 'high', 'critical'].includes(severity)) ||
        (eventType && !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,119}$/.test(eventType)) ||
        (req.query.actor_user_id !== undefined && !actorId) ||
        (search !== null && (search.length < 1 || search.length > 100))) {
      return res.status(400).json({ error: 'Un ou plusieurs filtres de recherche sont invalides.' });
    }

    const scopeId = Number(req.tenantId);
    const filters = ['tenant_scope_id = ?'];
    const params = [scopeId];
    if (from) { filters.push('created_at >= ?'); params.push(from + ' 00:00:00.000000'); }
    if (to) { filters.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(to + ' 00:00:00'); }
    if (category) { filters.push('category = ?'); params.push(category); }
    if (severity) { filters.push('severity = ?'); params.push(severity); }
    if (eventType) { filters.push('event_type = ?'); params.push(eventType); }
    if (actorId) { filters.push('actor_user_id = ?'); params.push(actorId); }
    if (search) {
      const escaped = '%' + search.replace(/[\\%_]/g, '\\$&') + '%';
      filters.push('(event_type LIKE ? OR entity_type LIKE ? OR entity_id LIKE ? OR outcome LIKE ? OR ip_address LIKE ? OR CAST(metadata_json AS CHAR) LIKE ?)');
      params.push(escaped, escaped, escaped, escaped, escaped, escaped);
    }

    await appendAuditEvent({
      ...context(req),
      eventType: 'audit.events.read',
      category: 'security',
      severity: 'info',
      entityType: 'audit_registry',
      outcome: 'success',
      metadata: {
        page,
        limit,
        filters: { from, to, category, severity, eventType, actorId, searchProvided: Boolean(search) }
      }
    });

    const where = filters.join(' AND ');
    const offset = (page - 1) * limit;
    const [[countRow]] = await pool.query(
      'SELECT COUNT(*) AS total FROM pro_audit_events WHERE ' + where,
      params
    );
    const [rows] = await pool.query(
      `SELECT id, actor_user_id, actor_kind, event_type, category, severity, entity_type,
              entity_id, outcome, ip_address, user_agent, request_id, metadata_json,
              chain_sequence, previous_hash, event_hash, key_version, created_at
         FROM pro_audit_events
        WHERE ${where}
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      events: rows.map(row => ({
        ...row,
        metadata: row.metadata_json && typeof row.metadata_json === 'string'
          ? (() => { try { return JSON.parse(row.metadata_json); } catch (_) { return null; } })()
          : row.metadata_json
      })),
      pagination: {
        page,
        limit,
        total: Number(countRow.total),
        total_pages: Math.ceil(Number(countRow.total) / limit)
      },
      filters: { from, to, category, severity, event_type: eventType, actor_user_id: actorId }
    });
  } catch (err) {
    return handleAuditError(err, res, next);
  }
});

router.get('/audit-events/integrity', requireAuth, resolveTenant, requirePermission, async (req, res, next) => {
  noStore(res);
  try {
    await appendAuditEvent({
      ...context(req),
      eventType: 'audit.events.integrity_checked',
      category: 'security',
      severity: 'info',
      entityType: 'audit_registry',
      outcome: 'success'
    });
    const integrity = await verifyAuditChain(Number(req.tenantId));
    res.json({
      tenant_id: Number(req.tenantId),
      checked_at: new Date().toISOString(),
      ...integrity
    });
  } catch (err) {
    return handleAuditError(err, res, next);
  }
});

module.exports = router;
