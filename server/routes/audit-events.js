'use strict';

const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { resolveTenant, requirePermission } = require('../middleware/tenant');
const { appendAuditEvent, verifyAuditChain, AuditConfigurationError } = require('../utils/audit-ledger');
const { genererPdfDepuisHtml } = require('../utils/pdf');

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

function buildExportFilters(req) {
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  if (from === false || to === false || (from && to && from > to)) {
    return { error: 'Période invalide. Utilisez des dates UTC au format YYYY-MM-DD.' };
  }
  const category = req.query.category === undefined ? null : String(req.query.category).trim().toLowerCase();
  const severity = req.query.severity === undefined ? null : String(req.query.severity).trim().toLowerCase();
  const eventType = req.query.event_type === undefined ? null : String(req.query.event_type).trim();
  const actorId = req.query.actor_user_id === undefined
    ? null
    : parsePositiveInteger(req.query.actor_user_id, null, Number.MAX_SAFE_INTEGER);
  const search = req.query.q === undefined ? null : String(req.query.q).trim();

  if ((category && !/^[a-z][a-z0-9_-]{1,39}$/.test(category)) ||
      (severity && !['info', 'low', 'medium', 'high', 'critical'].includes(severity)) ||
      (eventType && !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,119}$/.test(eventType)) ||
      (req.query.actor_user_id !== undefined && !actorId) ||
      (search !== null && (search.length < 1 || search.length > 100)) ||
      (req.query.q !== undefined && Array.isArray(req.query.q))) {
    return { error: 'Un ou plusieurs filtres d’export sont invalides.' };
  }

  const clauses = ['tenant_scope_id = ?'];
  const params = [Number(req.tenantId)];
  if (from) { clauses.push('created_at >= ?'); params.push(from + ' 00:00:00.000000'); }
  if (to) { clauses.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(to + ' 00:00:00'); }
  if (category) { clauses.push('category = ?'); params.push(category); }
  if (severity) { clauses.push('severity = ?'); params.push(severity); }
  if (eventType) { clauses.push('event_type = ?'); params.push(eventType); }
  if (actorId) { clauses.push('actor_user_id = ?'); params.push(actorId); }
  if (search) {
    const escaped = '%' + search.replace(/[\\%_]/g, '\\$&') + '%';
    clauses.push('(event_type LIKE ? OR entity_type LIKE ? OR entity_id LIKE ? OR outcome LIKE ? OR ip_address LIKE ? OR CAST(metadata_json AS CHAR) LIKE ?)');
    params.push(escaped, escaped, escaped, escaped, escaped, escaped);
  }
  return {
    where: clauses.join(' AND '),
    params,
    filters: { from, to, category, severity, event_type: eventType, actor_user_id: actorId, searchProvided: Boolean(search) }
  };
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvCell(value) {
  let text = value == null
    ? ''
    : (typeof value === 'object' ? JSON.stringify(value) : String(value));
  // Évite qu'un libellé contrôlé par un utilisateur devienne une formule à l'ouverture dans Excel/Calc.
  // Les tableurs peuvent ignorer des espaces ou caractères de contrôle avant une formule.
  // Détecter le premier caractère significatif, pas uniquement le premier octet de la cellule.
  const formulaProbe = text.replace(/^[\u0000-\u0020\uFEFF]+/, '');
  if (/^[=+\-@]/.test(formulaProbe) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

async function fetchExportRows(filter, maxRows) {
  const [rows] = await pool.query(
    `SELECT id, tenant_id, actor_user_id, actor_kind, event_type, category, severity,
            entity_type, entity_id, outcome, ip_address, user_agent, request_id, metadata_json,
            chain_sequence, previous_hash, event_hash, key_version, created_at
       FROM pro_audit_events
      WHERE ${filter.where}
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
    [...filter.params, maxRows + 1]
  );
  const truncated = rows.length > maxRows;
  return { rows: rows.slice(0, maxRows), truncated };
}

async function recordAuditExport(req, format, rowCount, truncated, filters) {
  await appendAuditEvent({
    ...context(req),
    eventType: 'audit.events.exported',
    category: 'security',
    severity: 'medium',
    entityType: 'audit_registry',
    outcome: 'success',
    metadata: { format, row_count: rowCount, truncated, filters }
  });
}

function csvValue(row) {
  const metadata = row.metadata_json && typeof row.metadata_json === 'string'
    ? (() => { try { return JSON.parse(row.metadata_json); } catch (_) { return row.metadata_json; } })()
    : row.metadata_json;
  return [
    row.id, row.created_at, row.tenant_id, row.actor_user_id, row.actor_kind,
    row.event_type, row.category, row.severity, row.entity_type, row.entity_id,
    row.outcome, row.ip_address, row.user_agent, row.request_id,
    metadata, row.chain_sequence, row.previous_hash, row.event_hash, row.key_version
  ];
}

function buildAuditPdfHtml(rows, filters) {
  const headers = ['Date UTC', 'Type', 'Catégorie', 'Risque', 'Acteur', 'Entité', 'Résultat', 'IP', 'Séquence', 'Empreinte'];
  const body = rows.map(row => {
    const actorName = row.actor_user_id ? String(row.actor_user_id) : row.actor_kind;
    const entity = [row.entity_type, row.entity_id].filter(Boolean).join(' #');
    return '<tr>' + [
      row.created_at, row.event_type, row.category, row.severity, actorName,
      entity, row.outcome, row.ip_address, row.chain_sequence,
      String(row.event_hash || '').slice(0, 20) + '…'
    ].map(value => '<td>' + escapeHtml(value) + '</td>').join('') + '</tr>';
  }).join('');
  const period = [filters.from || 'Début historique', filters.to || 'Aujourd’hui (UTC)'].join(' → ');
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Registre d'audit SamaFacture Pro</title>
<style>
@page{size:A4 landscape;margin:10mm}
*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172033;font-size:8px}
h1{font-size:18px;margin:0 0 5px}p{margin:3px 0 12px;color:#475569}
.meta{display:flex;justify-content:space-between;gap:10px;margin-bottom:12px;font-size:8px}
table{width:100%;border-collapse:collapse;table-layout:fixed}
th{background:#172b4d;color:#fff;text-align:left;padding:6px 4px;font-size:7px}
td{border-bottom:1px solid #dbe2ea;padding:5px 4px;overflow-wrap:anywhere;vertical-align:top}
tr:nth-child(even){background:#f5f7fa}
.footer{margin-top:10px;border-top:1px solid #cbd5e1;padding-top:6px;color:#64748b;font-size:7px}
</style></head><body>
<h1>Registre d'audit sécurisé</h1>
<p>SamaFacture Pro · Journal des événements de l'entreprise</p>
<div class="meta"><span>Période : ${escapeHtml(period)}</span><span>Généré le : ${escapeHtml(new Date().toISOString())}</span><span>Événements : ${rows.length}</span></div>
<table><thead><tr>${headers.map(h => '<th>' + escapeHtml(h) + '</th>').join('')}</tr></thead><tbody>${body}</tbody></table>
<div class="footer">Document confidentiel. Les empreintes affichées sont abrégées ; la vérification cryptographique complète est disponible dans le registre d'audit.</div>
</body></html>`;
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

router.get('/audit-events/export.csv', requireAuth, resolveTenant, requirePermission, async (req, res, next) => {
  noStore(res);
  try {
    const filter = buildExportFilters(req);
    if (filter.error) return res.status(400).json({ error: filter.error });
    const { rows, truncated } = await fetchExportRows(filter, 10000);
    const headers = [
      'id', 'created_at_utc', 'tenant_id', 'actor_user_id', 'actor_kind',
      'event_type', 'category', 'severity', 'entity_type', 'entity_id',
      'outcome', 'ip_address', 'user_agent', 'request_id', 'metadata_json',
      'chain_sequence', 'previous_hash', 'event_hash', 'key_version'
    ];
    const csv = '\uFEFF' + [
      headers.map(csvCell).join(';'),
      ...rows.map(row => csvValue(row).map(csvCell).join(';'))
    ].join('\r\n');

    await recordAuditExport(req, 'csv', rows.length, truncated, filter.filters);
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="samafacture-registre-audit.csv"');
    res.set('X-Export-Row-Count', String(rows.length));
    res.set('X-Export-Truncated', truncated ? 'true' : 'false');
    return res.send(csv);
  } catch (err) {
    return handleAuditError(err, res, next);
  }
});

router.get('/audit-events/export.pdf', requireAuth, resolveTenant, requirePermission, async (req, res, next) => {
  noStore(res);
  try {
    const filter = buildExportFilters(req);
    if (filter.error) return res.status(400).json({ error: filter.error });
    const { rows, truncated } = await fetchExportRows(filter, 1000);
    const html = buildAuditPdfHtml(rows, filter.filters);
    const pdf = await genererPdfDepuisHtml(html);

    await recordAuditExport(req, 'pdf', rows.length, truncated, filter.filters);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'attachment; filename="samafacture-registre-audit.pdf"');
    res.set('X-Export-Row-Count', String(rows.length));
    res.set('X-Export-Truncated', truncated ? 'true' : 'false');
    res.set('Content-Length', String(pdf.length));
    return res.send(pdf);
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
