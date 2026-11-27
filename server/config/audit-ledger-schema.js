'use strict';

const AUDIT_TABLES = Object.freeze([
  'pro_audit_events',
  'pro_audit_chain_heads'
]);

const EXPECTED_ACTION_STATEMENT =
  "signal sqlstate '45000' set message_text = 'pro_audit_events is append-only'";

const EXPECTED_TRIGGERS = Object.freeze([
  {
    name: 'trg_pro_audit_events_block_update',
    event: 'UPDATE'
  },
  {
    name: 'trg_pro_audit_events_block_delete',
    event: 'DELETE'
  }
]);

function normalizeActionStatement(statement) {
  return String(statement || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/;$/, '')
    .trim()
    .toLowerCase();
}

/**
 * Vérifie le schéma append-only avec une connexion qui détient le privilège
 * MySQL TRIGGER. Le compte runtime n'a volontairement pas ce privilège et ne
 * peut donc pas lire information_schema.TRIGGERS.
 *
 * Cette fonction ne crée, ne modifie et ne supprime aucun objet SQL.
 */
async function verifyAuditLedgerSchema(connection) {
  if (!connection || typeof connection.query !== 'function') {
    throw new TypeError('Une connexion MySQL valide est requise pour vérifier le registre d’audit.');
  }

  const [tableRows] = await connection.query(
    `SELECT TABLE_NAME
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'
        AND TABLE_NAME IN (?, ?)`,
    AUDIT_TABLES
  );

  const existingTables = new Set(tableRows.map(row => String(row.TABLE_NAME).toLowerCase()));
  const issues = [];

  for (const tableName of AUDIT_TABLES) {
    if (!existingTables.has(tableName)) {
      issues.push('table absente : ' + tableName);
    }
  }

  const [triggerRows] = await connection.query(
    `SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE, EVENT_MANIPULATION,
            ACTION_TIMING, ACTION_STATEMENT
       FROM information_schema.TRIGGERS
      WHERE TRIGGER_SCHEMA = DATABASE()
        AND TRIGGER_NAME IN (?, ?)`,
    EXPECTED_TRIGGERS.map(trigger => trigger.name)
  );

  const triggersByName = new Map(
    triggerRows.map(row => [String(row.TRIGGER_NAME).toLowerCase(), row])
  );

  for (const expected of EXPECTED_TRIGGERS) {
    const trigger = triggersByName.get(expected.name);
    if (!trigger) {
      issues.push('trigger absent : ' + expected.name);
      continue;
    }

    const matches =
      String(trigger.EVENT_OBJECT_TABLE || '').toLowerCase() === 'pro_audit_events' &&
      String(trigger.EVENT_MANIPULATION || '').toUpperCase() === expected.event &&
      String(trigger.ACTION_TIMING || '').toUpperCase() === 'BEFORE' &&
      normalizeActionStatement(trigger.ACTION_STATEMENT) === EXPECTED_ACTION_STATEMENT;

    if (!matches) {
      issues.push('définition non conforme : ' + expected.name);
    }
  }

  if (issues.length) {
    const error = new Error(
      'Schéma du registre d’audit non conforme : ' + issues.join('; ') +
      '. Le worker de sauvegarde refuse de continuer ; restaurez les protections depuis ' +
      'la migration 014 après diagnostic.'
    );
    error.name = 'AuditLedgerSchemaDriftError';
    error.code = 'AUDIT_LEDGER_SCHEMA_DRIFT';
    error.issues = issues;
    throw error;
  }

  return {
    valid: true,
    tables: [...AUDIT_TABLES],
    triggers: EXPECTED_TRIGGERS.map(trigger => trigger.name)
  };
}

module.exports = { verifyAuditLedgerSchema };
