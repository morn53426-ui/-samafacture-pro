'use strict';

const crypto = require('node:crypto');
const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { resolveTenant, requirePermission } = require('../middleware/tenant');
const { appendAuditEvent, normalizeMetadata } = require('../utils/audit-ledger');
const { sanitizeCaseText } = require('../utils/security-alerts');

const router = express.Router();
const ALERT_STATUSES = new Set(['open', 'acknowledged', 'investigating', 'resolved', 'false_positive']);
const INVESTIGATION_STATUSES = new Set(['open', 'in_progress', 'pending_review', 'resolved', 'closed']);
const PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);

router.use((req, res, next) => {
  // Ce routeur est monté sur /api/pro : ne jamais appliquer ses gardes aux
  // routes professionnelles voisines gérées par professionnelRoutes.
  if (!req.path.startsWith('/security/')) return next();
  requireAuth(req, res, err => {
    if (err) return next(err);
    resolveTenant(req, res, tenantErr => {
      if (tenantErr) return next(tenantErr);
      return requirePermission(req, res, next);
    });
  });
});

function noStore(res) {
  res.set('Cache-Control', 'no-store, max-age=0');
  res.set('Pragma', 'no-cache');
}

function positiveId(value) {
  if (Array.isArray(value) || !/^\d+$/.test(String(value || ''))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parsePagination(query) {
  const page = query.page === undefined ? 1 : positiveId(query.page);
  const limit = query.limit === undefined ? 25 : positiveId(query.limit);
  if (!page || !limit || page > 100000 || limit > 100) return null;
  return { page, limit, offset: (page - 1) * limit };
}

function readJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return null; }
}

function actor(req) {
  return Number(req.actorId || req.user.id);
}

function tenant(req) {
  return Number(req.tenantId);
}

async function withTransaction(task) {
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

async function findAlert(conn, tenantId, alertId, lock = false) {
  const [rows] = await conn.query(
    'SELECT * FROM pro_security_alerts WHERE id = ? AND tenant_scope_id = ? LIMIT 1' +
      (lock ? ' FOR UPDATE' : ''),
    [alertId, tenantId]
  );
  return rows[0] || null;
}

async function findInvestigation(conn, tenantId, investigationId, lock = false) {
  const [rows] = await conn.query(
    'SELECT * FROM pro_security_investigations WHERE id = ? AND tenant_scope_id = ? LIMIT 1' +
      (lock ? ' FOR UPDATE' : ''),
    [investigationId, tenantId]
  );
  return rows[0] || null;
}

async function assigneeBelongsToTenant(conn, tenantId, userId) {
  const [rows] = await conn.query(
    `SELECT u.id
       FROM users u
      WHERE u.id = ?
        AND (u.id = ? OR EXISTS (
          SELECT 1 FROM pro_team_members m
           WHERE m.owner_user_id = ? AND m.member_user_id = ? AND m.active = 1
        ))
      LIMIT 1`,
    [userId, tenantId, tenantId, userId]
  );
  return rows.length > 0;
}

function safeCaseNote(value) {
  const note = sanitizeCaseText(value, 4000);
  if (note.length < 3) return null;
  return note;
}

async function recordActivity(conn, req, entry) {
  const metadata = normalizeMetadata(entry.details || {});
  await conn.query(
    `INSERT INTO pro_security_case_activity
      (tenant_scope_id, alert_id, investigation_id, actor_user_id, activity_type,
       previous_status, new_status, details_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenant(req),
      entry.alertId || null,
      entry.investigationId || null,
      actor(req),
      entry.activityType,
      entry.previousStatus || null,
      entry.newStatus || null,
      metadata === null ? null : JSON.stringify(metadata)
    ]
  );
  await appendAuditEvent({
    tenantId: tenant(req),
    actorUserId: actor(req),
    actorKind: 'user',
    eventType: entry.auditEventType,
    category: 'security',
    severity: entry.severity || 'medium',
    entityType: entry.entityType,
    entityId: entry.alertId || entry.investigationId,
    outcome: 'success',
    metadata: entry.auditMetadata || entry.details || {}
  }, conn);
}

function mapAlert(row) {
  return {
    ...row,
    occurrences: Number(row.occurrences),
    details: readJson(row.details_json)
  };
}

function mapActivity(row) {
  return { ...row, details: readJson(row.details_json) };
}

router.get('/security/assignees', async (req, res, next) => {
  noStore(res);
  try {
    const [rows] = await pool.query(
      `SELECT id, nom FROM users WHERE id = ?
       UNION
       SELECT u.id, u.nom
         FROM pro_team_members m
         JOIN users u ON u.id = m.member_user_id
        WHERE m.owner_user_id = ? AND m.active = 1
       ORDER BY nom, id`,
      [tenant(req), tenant(req)]
    );
    res.json({ assignees: rows.map(row => ({ id: Number(row.id), nom: row.nom })) });
  } catch (err) { next(err); }
});

router.get('/security/alerts/summary', async (req, res, next) => {
  noStore(res);
  try {
    const scope = tenant(req);
    const [[total]] = await pool.query(
      'SELECT COUNT(*) AS total FROM pro_security_alerts WHERE tenant_scope_id = ?',
      [scope]
    );
    const [statuses] = await pool.query(
      'SELECT status, COUNT(*) AS total FROM pro_security_alerts WHERE tenant_scope_id = ? GROUP BY status',
      [scope]
    );
    const [severities] = await pool.query(
      "SELECT severity, COUNT(*) AS total FROM pro_security_alerts WHERE tenant_scope_id = ? AND status IN ('open','acknowledged','investigating') GROUP BY severity",
      [scope]
    );
    res.json({
      total: Number(total.total),
      by_status: Object.fromEntries(statuses.map(row => [row.status, Number(row.total)])),
      active_by_severity: Object.fromEntries(severities.map(row => [row.severity, Number(row.total)]))
    });
  } catch (err) { next(err); }
});

router.get('/security/alerts', async (req, res, next) => {
  noStore(res);
  try {
    const pagination = parsePagination(req.query);
    const status = req.query.status === undefined ? null : String(req.query.status);
    const severity = req.query.severity === undefined ? null : String(req.query.severity);
    if (!pagination || (status && !ALERT_STATUSES.has(status)) ||
        (severity && !PRIORITIES.has(severity))) {
      return res.status(400).json({ error: 'Filtres ou pagination des alertes invalides.' });
    }
    const where = ['tenant_scope_id = ?'];
    const params = [tenant(req)];
    if (status) { where.push('status = ?'); params.push(status); }
    if (severity) { where.push('severity = ?'); params.push(severity); }
    const clause = where.join(' AND ');
    const [[count]] = await pool.query(
      'SELECT COUNT(*) AS total FROM pro_security_alerts WHERE ' + clause,
      params
    );
    const [rows] = await pool.query(
      `SELECT id, alert_type, category, severity, status, title, description, source_event_id,
              entity_type, entity_id, occurrences, first_seen_at, last_seen_at,
              acknowledged_by_user_id, acknowledged_at, assigned_to_user_id,
              resolved_by_user_id, resolved_at, resolution_note, details_json, created_at, updated_at
         FROM pro_security_alerts WHERE ${clause}
        ORDER BY FIELD(severity, 'critical', 'high', 'medium', 'low'), last_seen_at DESC, id DESC
        LIMIT ? OFFSET ?`,
      [...params, pagination.limit, pagination.offset]
    );
    res.json({
      alerts: rows.map(mapAlert),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: Number(count.total),
        total_pages: Math.ceil(Number(count.total) / pagination.limit)
      }
    });
  } catch (err) { next(err); }
});

router.get('/security/alerts/:id', async (req, res, next) => {
  noStore(res);
  const alertId = positiveId(req.params.id);
  if (!alertId) return res.status(400).json({ error: 'Identifiant d’alerte invalide.' });
  try {
    const alert = await findAlert(pool, tenant(req), alertId);
    if (!alert) return res.status(404).json({ error: 'Alerte introuvable.' });
    const [activity] = await pool.query(
      'SELECT id, actor_user_id, activity_type, previous_status, new_status, details_json, created_at FROM pro_security_case_activity WHERE tenant_scope_id = ? AND alert_id = ? ORDER BY id DESC LIMIT 100',
      [tenant(req), alertId]
    );
    const [investigations] = await pool.query(
      'SELECT id, reference, title, status, priority, assigned_to_user_id, created_at, updated_at FROM pro_security_investigations WHERE tenant_scope_id = ? AND alert_id = ? ORDER BY id DESC',
      [tenant(req), alertId]
    );
    res.json({ alert: mapAlert(alert), activity: activity.map(mapActivity), investigations });
  } catch (err) { next(err); }
});

router.post('/security/alerts/:id/acknowledge', async (req, res, next) => {
  const alertId = positiveId(req.params.id);
  if (!alertId) return res.status(400).json({ error: 'Identifiant d’alerte invalide.' });
  try {
    const alert = await withTransaction(async conn => {
      const current = await findAlert(conn, tenant(req), alertId, true);
      if (!current) return null;
      if (current.status !== 'open') {
        const err = new Error('Seules les alertes ouvertes peuvent être prises en compte.');
        err.status = 409;
        throw err;
      }
      await conn.query(
        "UPDATE pro_security_alerts SET status = 'acknowledged', acknowledged_by_user_id = ?, acknowledged_at = UTC_TIMESTAMP(6) WHERE id = ? AND tenant_scope_id = ?",
        [actor(req), alertId, tenant(req)]
      );
      await recordActivity(conn, req, {
        alertId,
        activityType: 'alert.acknowledged',
        previousStatus: current.status,
        newStatus: 'acknowledged',
        auditEventType: 'security.alert.acknowledged',
        entityType: 'security_alert'
      });
      return findAlert(conn, tenant(req), alertId);
    });
    if (!alert) return res.status(404).json({ error: 'Alerte introuvable.' });
    res.json({ alert: mapAlert(alert) });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.post('/security/alerts/:id/assign', async (req, res, next) => {
  const alertId = positiveId(req.params.id);
  const assigneeId = positiveId(req.body.assigned_to_user_id);
  if (!alertId || !assigneeId) return res.status(400).json({ error: 'Alerte ou responsable invalide.' });
  try {
    const alert = await withTransaction(async conn => {
      const current = await findAlert(conn, tenant(req), alertId, true);
      if (!current) return null;
      if (!await assigneeBelongsToTenant(conn, tenant(req), assigneeId)) {
        const err = new Error('Le responsable doit appartenir à cette entreprise.');
        err.status = 400;
        throw err;
      }
      await conn.query(
        'UPDATE pro_security_alerts SET assigned_to_user_id = ? WHERE id = ? AND tenant_scope_id = ?',
        [assigneeId, alertId, tenant(req)]
      );
      await recordActivity(conn, req, {
        alertId,
        activityType: 'alert.assigned',
        previousStatus: current.status,
        newStatus: current.status,
        details: { assigned_to_user_id: assigneeId },
        auditEventType: 'security.alert.assigned',
        entityType: 'security_alert'
      });
      return findAlert(conn, tenant(req), alertId);
    });
    if (!alert) return res.status(404).json({ error: 'Alerte introuvable.' });
    res.json({ alert: mapAlert(alert) });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

async function finalizeAlert(req, res, next, finalStatus) {
  const alertId = positiveId(req.params.id);
  const note = safeCaseNote(req.body.resolution_note);
  if (!alertId || !note || note.length < 10 || note.length > 1000) {
    return res.status(400).json({ error: 'Identifiant invalide et décision de clôture de 10 à 1 000 caractères obligatoire.' });
  }
  try {
    const alert = await withTransaction(async conn => {
      const current = await findAlert(conn, tenant(req), alertId, true);
      if (!current) return null;
      if (['resolved', 'false_positive'].includes(current.status)) {
        const err = new Error('Cette alerte est déjà clôturée.');
        err.status = 409;
        throw err;
      }
      await conn.query(
        'UPDATE pro_security_alerts SET status = ?, resolved_by_user_id = ?, resolved_at = UTC_TIMESTAMP(6), resolution_note = ? WHERE id = ? AND tenant_scope_id = ?',
        [finalStatus, actor(req), note, alertId, tenant(req)]
      );
      await recordActivity(conn, req, {
        alertId,
        activityType: finalStatus === 'false_positive' ? 'alert.false_positive' : 'alert.resolved',
        previousStatus: current.status,
        newStatus: finalStatus,
        details: { resolution_note: note },
        auditEventType: finalStatus === 'false_positive' ? 'security.alert.false_positive' : 'security.alert.resolved',
        entityType: 'security_alert'
      });
      return findAlert(conn, tenant(req), alertId);
    });
    if (!alert) return res.status(404).json({ error: 'Alerte introuvable.' });
    res.json({ alert: mapAlert(alert) });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

router.post('/security/alerts/:id/resolve', (req, res, next) => finalizeAlert(req, res, next, 'resolved'));
router.post('/security/alerts/:id/false-positive', (req, res, next) => finalizeAlert(req, res, next, 'false_positive'));

router.get('/security/investigations', async (req, res, next) => {
  noStore(res);
  try {
    const pagination = parsePagination(req.query);
    const status = req.query.status === undefined ? null : String(req.query.status);
    if (!pagination || (status && !INVESTIGATION_STATUSES.has(status))) {
      return res.status(400).json({ error: 'Filtres ou pagination des investigations invalides.' });
    }
    const where = ['i.tenant_scope_id = ?'];
    const params = [tenant(req)];
    if (status) { where.push('i.status = ?'); params.push(status); }
    const clause = where.join(' AND ');
    const [[count]] = await pool.query(
      'SELECT COUNT(*) AS total FROM pro_security_investigations i WHERE ' + clause,
      params
    );
    const [rows] = await pool.query(
      `SELECT i.id, i.reference, i.alert_id, i.title, i.description, i.status, i.priority,
              i.assigned_to_user_id, i.created_by_user_id, i.closed_by_user_id, i.closed_at,
              i.resolution_note, i.created_at, i.updated_at, a.alert_type, a.severity AS alert_severity
         FROM pro_security_investigations i
         LEFT JOIN pro_security_alerts a
           ON a.id = i.alert_id AND a.tenant_scope_id = i.tenant_scope_id
        WHERE ${clause}
        ORDER BY FIELD(i.priority, 'critical', 'high', 'medium', 'low'), i.updated_at DESC, i.id DESC
        LIMIT ? OFFSET ?`,
      [...params, pagination.limit, pagination.offset]
    );
    res.json({
      investigations: rows,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: Number(count.total),
        total_pages: Math.ceil(Number(count.total) / pagination.limit)
      }
    });
  } catch (err) { next(err); }
});

router.get('/security/investigations/:id', async (req, res, next) => {
  noStore(res);
  const investigationId = positiveId(req.params.id);
  if (!investigationId) return res.status(400).json({ error: 'Identifiant d’investigation invalide.' });
  try {
    const investigation = await findInvestigation(pool, tenant(req), investigationId);
    if (!investigation) return res.status(404).json({ error: 'Investigation introuvable.' });
    const [activity] = await pool.query(
      'SELECT id, actor_user_id, activity_type, previous_status, new_status, details_json, created_at FROM pro_security_case_activity WHERE tenant_scope_id = ? AND investigation_id = ? ORDER BY id DESC LIMIT 200',
      [tenant(req), investigationId]
    );
    res.json({
      investigation,
      activity: activity.map(mapActivity)
    });
  } catch (err) { next(err); }
});

router.post('/security/investigations', async (req, res, next) => {
  const titleRaw = String(req.body.title || '').trim();
  const title = sanitizeCaseText(titleRaw, 190);
  const descriptionRaw = String(req.body.description || '').trim();
  const description = sanitizeCaseText(descriptionRaw, 4000);
  const alertId = req.body.alert_id == null || req.body.alert_id === '' ? null : positiveId(req.body.alert_id);
  const priority = String(req.body.priority || 'medium').toLowerCase();
  const assignedId = req.body.assigned_to_user_id == null || req.body.assigned_to_user_id === ''
    ? null
    : positiveId(req.body.assigned_to_user_id);
  if (!title || titleRaw.length > 190 || description.length > 4000 ||
      (req.body.alert_id != null && req.body.alert_id !== '' && !alertId) ||
      (descriptionRaw.length > 4000) ||
      !PRIORITIES.has(priority) || (req.body.assigned_to_user_id != null && req.body.assigned_to_user_id !== '' && !assignedId)) {
    return res.status(400).json({ error: 'Les données du dossier d’investigation sont invalides.' });
  }

  try {
    const investigation = await withTransaction(async conn => {
      let linkedAlert = null;
      if (alertId) {
        linkedAlert = await findAlert(conn, tenant(req), alertId, true);
        if (!linkedAlert) {
          const err = new Error('Alerte introuvable dans cette entreprise.');
          err.status = 404;
          throw err;
        }
        if (['resolved', 'false_positive'].includes(linkedAlert.status)) {
          const err = new Error('Une alerte clôturée ne peut pas ouvrir une nouvelle investigation.');
          err.status = 409;
          throw err;
        }
        const [[activeCase]] = await conn.query(
          "SELECT id FROM pro_security_investigations WHERE tenant_scope_id = ? AND alert_id = ? AND status NOT IN ('resolved','closed') LIMIT 1",
          [tenant(req), alertId]
        );
        if (activeCase) {
          const err = new Error('Une investigation active existe déjà pour cette alerte.');
          err.status = 409;
          throw err;
        }
      }
      if (assignedId && !await assigneeBelongsToTenant(conn, tenant(req), assignedId)) {
        const err = new Error('Le responsable doit appartenir à cette entreprise.');
        err.status = 400;
        throw err;
      }
      const reference = 'INV-' + new Date().getUTCFullYear() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      const [insert] = await conn.query(
        `INSERT INTO pro_security_investigations
          (tenant_scope_id, reference, alert_id, title, description, status, priority,
           assigned_to_user_id, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
        [tenant(req), reference, alertId, title, description || null, priority, assignedId, actor(req)]
      );
      const id = Number(insert.insertId);
      await recordActivity(conn, req, {
        investigationId: id,
        alertId,
        activityType: 'investigation.created',
        newStatus: 'open',
        details: { reference, title, priority, alert_id: alertId, assigned_to_user_id: assignedId },
        auditEventType: 'security.investigation.created',
        entityType: 'security_investigation'
      });
      if (linkedAlert && linkedAlert.status !== 'investigating') {
        await conn.query(
          "UPDATE pro_security_alerts SET status = 'investigating' WHERE id = ? AND tenant_scope_id = ?",
          [alertId, tenant(req)]
        );
        await recordActivity(conn, req, {
          alertId,
          investigationId: id,
          activityType: 'alert.investigation_opened',
          previousStatus: linkedAlert.status,
          newStatus: 'investigating',
          details: { investigation_id: id, reference },
          auditEventType: 'security.alert.investigation_opened',
          entityType: 'security_alert'
        });
      }
      return findInvestigation(conn, tenant(req), id);
    });
    res.status(201).json({ investigation });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.patch('/security/investigations/:id', async (req, res, next) => {
  const investigationId = positiveId(req.params.id);
  if (!investigationId) return res.status(400).json({ error: 'Identifiant d’investigation invalide.' });
  const status = req.body.status === undefined ? undefined : String(req.body.status);
  const priority = req.body.priority === undefined ? undefined : String(req.body.priority).toLowerCase();
  const assignedRaw = req.body.assigned_to_user_id;
  const assignedId = assignedRaw === undefined
    ? undefined
    : (assignedRaw === null || assignedRaw === '' ? null : positiveId(assignedRaw));
  const invalidAssignee = assignedRaw !== undefined && assignedRaw !== null && assignedRaw !== '' && assignedId === null;
  const resolutionRaw = req.body.resolution_note === undefined ? undefined : String(req.body.resolution_note).trim();
  const resolutionNote = resolutionRaw === undefined ? undefined : safeCaseNote(resolutionRaw);
  if ((status !== undefined && !INVESTIGATION_STATUSES.has(status)) ||
      (priority !== undefined && !PRIORITIES.has(priority)) ||
      invalidAssignee ||
      (resolutionRaw !== undefined && (resolutionRaw.length > 2000 || !resolutionNote)) ||
      (status !== undefined && ['resolved', 'closed'].includes(status) && (!resolutionNote || resolutionNote.length < 10))) {
    return res.status(400).json({ error: 'Mise à jour du dossier invalide. Une note de décision est requise pour clôturer.' });
  }
  if (status === undefined && priority === undefined && assignedId === undefined && resolutionNote === undefined) {
    return res.status(400).json({ error: 'Aucun champ de mise à jour fourni.' });
  }

  try {
    const investigation = await withTransaction(async conn => {
      const current = await findInvestigation(conn, tenant(req), investigationId, true);
      if (!current) return null;
      if (assignedId && !await assigneeBelongsToTenant(conn, tenant(req), assignedId)) {
        const err = new Error('Le responsable doit appartenir à cette entreprise.');
        err.status = 400;
        throw err;
      }
      const fields = [];
      const values = [];
      if (status !== undefined) { fields.push('status = ?'); values.push(status); }
      if (priority !== undefined) { fields.push('priority = ?'); values.push(priority); }
      if (assignedId !== undefined) { fields.push('assigned_to_user_id = ?'); values.push(assignedId); }
      if (resolutionNote !== undefined) { fields.push('resolution_note = ?'); values.push(resolutionNote); }
      if (status !== undefined && ['resolved', 'closed'].includes(status)) {
        fields.push('closed_by_user_id = ?', 'closed_at = UTC_TIMESTAMP(6)');
        values.push(actor(req));
      } else if (status !== undefined) {
        fields.push('closed_by_user_id = NULL', 'closed_at = NULL');
      }
      await conn.query(
        'UPDATE pro_security_investigations SET ' + fields.join(', ') + ' WHERE id = ? AND tenant_scope_id = ?',
        [...values, investigationId, tenant(req)]
      );
      const nextStatus = status === undefined ? current.status : status;
      const details = {};
      if (priority !== undefined) details.priority = priority;
      if (assignedId !== undefined) details.assigned_to_user_id = assignedId;
      if (resolutionNote !== undefined) details.resolution_note = resolutionNote;
      await recordActivity(conn, req, {
        investigationId,
        alertId: current.alert_id,
        activityType: 'investigation.updated',
        previousStatus: current.status,
        newStatus: nextStatus,
        details,
        auditEventType: 'security.investigation.updated',
        entityType: 'security_investigation'
      });
      if (current.alert_id && status !== undefined && ['resolved', 'closed'].includes(status)) {
        await conn.query(
          "UPDATE pro_security_alerts SET status = 'resolved', resolved_by_user_id = ?, resolved_at = UTC_TIMESTAMP(6), resolution_note = ? WHERE id = ? AND tenant_scope_id = ? AND status = 'investigating'",
          [actor(req), resolutionNote || 'Investigation clôturée.', current.alert_id, tenant(req)]
        );
        await recordActivity(conn, req, {
          alertId: current.alert_id,
          investigationId,
          activityType: 'alert.resolved_by_investigation',
          previousStatus: 'investigating',
          newStatus: 'resolved',
          auditEventType: 'security.alert.resolved_by_investigation',
          entityType: 'security_alert'
        });
      }
      return findInvestigation(conn, tenant(req), investigationId);
    });
    if (!investigation) return res.status(404).json({ error: 'Investigation introuvable.' });
    res.json({ investigation });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.post('/security/investigations/:id/notes', async (req, res, next) => {
  const investigationId = positiveId(req.params.id);
  const note = safeCaseNote(req.body.note);
  if (!investigationId || !note) {
    return res.status(400).json({ error: 'Identifiant invalide ou note de 3 à 4 000 caractères obligatoire.' });
  }
  try {
    const activity = await withTransaction(async conn => {
      const investigation = await findInvestigation(conn, tenant(req), investigationId, true);
      if (!investigation) return null;
      await recordActivity(conn, req, {
        investigationId,
        alertId: investigation.alert_id,
        activityType: 'investigation.note_added',
        previousStatus: investigation.status,
        newStatus: investigation.status,
        details: { note },
        auditEventType: 'security.investigation.note_added',
        entityType: 'security_investigation'
      });
      const [[last]] = await conn.query(
        'SELECT id, actor_user_id, activity_type, previous_status, new_status, details_json, created_at FROM pro_security_case_activity WHERE tenant_scope_id = ? AND investigation_id = ? ORDER BY id DESC LIMIT 1',
        [tenant(req), investigationId]
      );
      return mapActivity(last);
    });
    if (!activity) return res.status(404).json({ error: 'Investigation introuvable.' });
    res.status(201).json({ activity });
  } catch (err) { next(err); }
});

module.exports = router;
