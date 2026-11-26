'use strict';

const crypto = require('node:crypto');
const { pool } = require('../config/db');

const GENESIS_HASH = '0'.repeat(64);
const SENSITIVE_KEY = /(password|passwd|pwd|passphrase|secret|token|authorization|cookie|api.?key|private.?key|cvv|cvc|card.?number|otp|one.?time|verification.?code|reset.?token|signature)/i;
const BEARER_VALUE = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const CARD_VALUE = /\b(?:\d[ -]*?){13,19}\b/g;
const SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);
const OUTCOMES = new Set(['success', 'failure', 'denied', 'blocked', 'pending', 'error']);

class AuditConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuditConfigurationError';
    this.code = 'AUDIT_LEDGER_KEY_NOT_CONFIGURED';
  }
}

function sortedValue(value, depth = 0) {
  if (depth > 6) return '[MAX_DEPTH]';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    return value.replace(BEARER_VALUE, 'Bearer [REDACTED]')
      .replace(CARD_VALUE, '[REDACTED_CARD_NUMBER]')
      .slice(0, 1000);
  }
  if (Array.isArray(value)) return value.slice(0, 50).map(item => sortedValue(item, depth + 1));
  if (typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort().slice(0, 80)) {
      result[key.slice(0, 100)] = SENSITIVE_KEY.test(key)
        ? '[REDACTED]'
        : sortedValue(value[key], depth + 1);
    }
    return result;
  }
  return String(value).slice(0, 100);
}

function normalizeMetadata(metadata) {
  if (metadata === undefined || metadata === null) return null;
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new TypeError('Les métadonnées d’audit doivent être un objet.');
  }
  const normalized = sortedValue(metadata);
  const serialized = JSON.stringify(normalized);
  if (Buffer.byteLength(serialized, 'utf8') > 8192) {
    throw new RangeError('Les métadonnées d’audit dépassent la limite de 8 Ko.');
  }
  return normalized;
}

function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ':' + stableStringify(value[key])
    ).join(',') + '}';
  }
  return JSON.stringify(value);
}

function getCurrentKeyVersion() {
  const parsed = Number(process.env.AUDIT_LOG_HMAC_KEY_VERSION || 1);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new AuditConfigurationError('AUDIT_LOG_HMAC_KEY_VERSION doit être un entier compris entre 1 et 65535.');
  }
  return parsed;
}

function getKeyForVersion(version) {
  let keyring = {};
  if (process.env.AUDIT_LOG_HMAC_KEYRING) {
    try {
      keyring = JSON.parse(process.env.AUDIT_LOG_HMAC_KEYRING);
    } catch (_) {
      throw new AuditConfigurationError('AUDIT_LOG_HMAC_KEYRING doit contenir un objet JSON valide.');
    }
    if (!keyring || typeof keyring !== 'object' || Array.isArray(keyring)) {
      throw new AuditConfigurationError('AUDIT_LOG_HMAC_KEYRING doit être un objet JSON versionné.');
    }
  }

  let material = keyring[String(version)];
  if (!material && version === getCurrentKeyVersion()) {
    material = process.env.AUDIT_LOG_HMAC_KEY || process.env.DATA_ENCRYPTION_KEY;
  }
  if (!material && process.env.NODE_ENV !== 'production' && version === 1) material = process.env.JWT_SECRET;
  if (typeof material !== 'string' || Buffer.byteLength(material, 'utf8') < 32) {
    throw new AuditConfigurationError(
      'Clé HMAC d’audit indisponible ou trop courte. Configurez AUDIT_LOG_HMAC_KEY (32 octets minimum) ou DATA_ENCRYPTION_KEY, et conservez les anciennes clés dans AUDIT_LOG_HMAC_KEYRING.'
    );
  }
  // Domain separation : la clé de signature est dérivée sans réutiliser directement
  // la clé source employée par le chiffrement des secrets.
  return Buffer.from(crypto.hkdfSync(
    'sha256',
    Buffer.from(material, 'utf8'),
    Buffer.from('SamaFacturePro/audit-ledger', 'utf8'),
    Buffer.from('hmac-sha256/version:' + version, 'utf8'),
    32
  ));
}

function normalizeEvent(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Un événement d’audit est obligatoire.');
  const tenantId = input.tenantId === null || input.tenantId === undefined ? null : Number(input.tenantId);
  const actorUserId = input.actorUserId === null || input.actorUserId === undefined ? null : Number(input.actorUserId);
  if (tenantId !== null && (!Number.isSafeInteger(tenantId) || tenantId <= 0)) throw new TypeError('Identifiant de tenant invalide.');
  if (actorUserId !== null && (!Number.isSafeInteger(actorUserId) || actorUserId <= 0)) throw new TypeError('Identifiant d’acteur invalide.');

  const eventType = String(input.eventType || '').trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,119}$/.test(eventType)) throw new TypeError('Type d’événement invalide (2 à 120 caractères).');
  const category = String(input.category || 'security').trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]{1,39}$/.test(category)) throw new TypeError('Catégorie d’audit invalide.');
  const severity = String(input.severity || 'info').toLowerCase();
  if (!SEVERITIES.has(severity)) throw new TypeError('Niveau de risque invalide.');
  const outcome = String(input.outcome || 'success').toLowerCase();
  if (!OUTCOMES.has(outcome)) throw new TypeError('Résultat d’événement invalide.');
  const actorKind = String(input.actorKind || (actorUserId === null ? 'system' : 'user'));
  if (!['user', 'system', 'platform_admin', 'anonymous'].includes(actorKind)) throw new TypeError('Type d’acteur invalide.');

  return {
    tenantId,
    tenantScopeId: tenantId === null ? 0 : tenantId,
    actorUserId,
    actorKind,
    eventType,
    category,
    severity,
    entityType: input.entityType == null ? null : String(input.entityType).trim().slice(0, 80),
    entityId: input.entityId == null ? null : String(input.entityId).trim().slice(0, 100),
    outcome,
    ipAddress: input.ipAddress == null ? null : String(input.ipAddress).slice(0, 45),
    userAgent: input.userAgent == null ? null : String(input.userAgent).replace(/[\r\n]/g, ' ').slice(0, 255),
    requestId: input.requestId == null ? null : String(input.requestId).slice(0, 36),
    metadata: normalizeMetadata(input.metadata)
  };
}

function buildHashPayload(event, sequence, previousHash, createdAt, keyVersion) {
  return {
    tenant_scope_id: event.tenantScopeId,
    tenant_id: event.tenantId,
    actor_user_id: event.actorUserId,
    actor_kind: event.actorKind,
    event_type: event.eventType,
    category: event.category,
    severity: event.severity,
    entity_type: event.entityType,
    entity_id: event.entityId,
    outcome: event.outcome,
    ip_address: event.ipAddress,
    user_agent: event.userAgent,
    request_id: event.requestId,
    metadata: event.metadata,
    chain_sequence: sequence,
    previous_hash: previousHash,
    created_at: createdAt,
    key_version: keyVersion
  };
}

function signPayload(payload, key) {
  return crypto.createHmac('sha256', key).update(stableStringify(payload), 'utf8').digest('hex');
}

async function withConnection(task) {
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

async function appendAuditEvent(input, connection = null) {
  const event = normalizeEvent(input);
  const keyVersion = getCurrentKeyVersion();
  const key = getKeyForVersion(keyVersion);

  const append = async conn => {
    await conn.query(
      `INSERT INTO pro_audit_chain_heads (tenant_scope_id, last_sequence, last_hash)
       VALUES (?, 0, ?)
       ON DUPLICATE KEY UPDATE tenant_scope_id = VALUES(tenant_scope_id)`,
      [event.tenantScopeId, GENESIS_HASH]
    );
    const [heads] = await conn.query(
      'SELECT last_sequence, last_hash FROM pro_audit_chain_heads WHERE tenant_scope_id = ? FOR UPDATE',
      [event.tenantScopeId]
    );
    if (!heads.length) throw new Error('Tête de chaîne d’audit introuvable.');

    const sequence = Number(heads[0].last_sequence) + 1;
    const previousHash = String(heads[0].last_hash);
    const [[timeRow]] = await conn.query(
      "SELECT DATE_FORMAT(UTC_TIMESTAMP(6), '%Y-%m-%d %H:%i:%s.%f') AS created_at"
    );
    const createdAt = timeRow.created_at;
    const eventHash = signPayload(buildHashPayload(event, sequence, previousHash, createdAt, keyVersion), key);

    const [insertResult] = await conn.query(
      `INSERT INTO pro_audit_events
        (tenant_scope_id, tenant_id, actor_user_id, actor_kind, event_type, category, severity,
         entity_type, entity_id, outcome, ip_address, user_agent, request_id, metadata_json,
         chain_sequence, previous_hash, event_hash, key_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.tenantScopeId, event.tenantId, event.actorUserId, event.actorKind,
        event.eventType, event.category, event.severity, event.entityType, event.entityId,
        event.outcome, event.ipAddress, event.userAgent, event.requestId,
        event.metadata === null ? null : JSON.stringify(event.metadata),
        sequence, previousHash, eventHash, keyVersion, createdAt
      ]
    );

    await conn.query(
      'UPDATE pro_audit_chain_heads SET last_sequence = ?, last_hash = ? WHERE tenant_scope_id = ?',
      [sequence, eventHash, event.tenantScopeId]
    );
    return {
      id: Number(insertResult.insertId), tenantId: event.tenantId, sequence,
      previousHash, eventHash, keyVersion, createdAt
    };
  };

  return connection ? append(connection) : withConnection(append);
}

function parseMetadata(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try { return JSON.parse(value); } catch (_) { return null; }
}

async function verifyAuditChain(tenantId, connection = pool) {
  const normalizedTenant = tenantId === null || tenantId === undefined ? null : Number(tenantId);
  if (normalizedTenant !== null && (!Number.isSafeInteger(normalizedTenant) || normalizedTenant <= 0)) {
    throw new TypeError('Identifiant de tenant invalide.');
  }
  const scopeId = normalizedTenant === null ? 0 : normalizedTenant;
  const batchSize = 500;
  let expectedSequence = 1;
  let previousHash = GENESIS_HASH;
  let checked = 0;
  let cursor = 0;

  // Parcours borné en mémoire : un historique long ne doit pas être chargé en une seule fois.
  while (true) {
    const [rows] = await connection.query(
      `SELECT tenant_scope_id, tenant_id, actor_user_id, actor_kind, event_type, category, severity,
              entity_type, entity_id, outcome, ip_address, user_agent, request_id, metadata_json,
              chain_sequence, previous_hash, event_hash, key_version,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s.%f') AS created_at
         FROM pro_audit_events
        WHERE tenant_scope_id = ? AND chain_sequence > ?
        ORDER BY chain_sequence ASC
        LIMIT ?`,
      [scopeId, cursor, batchSize]
    );
    if (!rows.length) break;

    for (const row of rows) {
      const sequence = Number(row.chain_sequence);
      if (sequence !== expectedSequence) {
        return { valid: false, reason: 'sequence_gap', checked, failedSequence: sequence };
      }
      if (String(row.previous_hash) !== previousHash) {
        return { valid: false, reason: 'previous_hash_mismatch', checked, failedSequence: sequence };
      }

      let key;
      try {
        key = getKeyForVersion(Number(row.key_version));
      } catch (_) {
        return { valid: false, reason: 'key_unavailable', checked, failedSequence: sequence };
      }

      const event = {
        tenantId: row.tenant_id === null ? null : Number(row.tenant_id),
        tenantScopeId: Number(row.tenant_scope_id),
        actorUserId: row.actor_user_id === null ? null : Number(row.actor_user_id),
        actorKind: row.actor_kind,
        eventType: row.event_type,
        category: row.category,
        severity: row.severity,
        entityType: row.entity_type,
        entityId: row.entity_id,
        outcome: row.outcome,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        requestId: row.request_id,
        metadata: parseMetadata(row.metadata_json)
      };
      const payload = buildHashPayload(event, sequence, previousHash, row.created_at, Number(row.key_version));
      const expectedHash = signPayload(payload, key);
      const receivedHash = String(row.event_hash || '');
      const matches = /^[a-f0-9]{64}$/.test(receivedHash) &&
        crypto.timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(receivedHash, 'hex'));
      if (!matches) {
        return { valid: false, reason: 'event_hash_mismatch', checked, failedSequence: sequence };
      }
      previousHash = receivedHash;
      expectedSequence += 1;
      checked += 1;
      cursor = sequence;
    }
    if (rows.length < batchSize) break;
  }

  const [heads] = await connection.query(
    'SELECT last_sequence, last_hash FROM pro_audit_chain_heads WHERE tenant_scope_id = ? LIMIT 1',
    [scopeId]
  );
  if (checked === 0 && heads.length === 0) {
    return { valid: true, checked: 0, lastHash: GENESIS_HASH };
  }
  if (!heads.length || Number(heads[0].last_sequence) !== checked || String(heads[0].last_hash) !== previousHash) {
    return { valid: false, reason: 'chain_head_mismatch', checked };
  }
  return { valid: true, checked, lastHash: previousHash };
}

module.exports = { appendAuditEvent, verifyAuditChain, AuditConfigurationError, GENESIS_HASH, normalizeMetadata };
