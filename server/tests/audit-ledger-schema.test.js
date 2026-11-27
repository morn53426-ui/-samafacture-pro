'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { verifyAuditLedgerSchema } = require('../config/audit-ledger-schema');

const TABLES = [
  { TABLE_NAME: 'pro_audit_events' },
  { TABLE_NAME: 'pro_audit_chain_heads' }
];

function trigger(name, event, overrides = {}) {
  return {
    TRIGGER_NAME: name,
    EVENT_OBJECT_TABLE: 'pro_audit_events',
    EVENT_MANIPULATION: event,
    ACTION_TIMING: 'BEFORE',
    ACTION_STATEMENT: "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pro_audit_events is append-only'",
    ...overrides
  };
}

const TRIGGERS = [
  trigger('trg_pro_audit_events_block_update', 'UPDATE'),
  trigger('trg_pro_audit_events_block_delete', 'DELETE')
];

function fakeConnection({ tables = TABLES, triggers = TRIGGERS } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('information_schema.TABLES')) return [tables, []];
      if (sql.includes('information_schema.TRIGGERS')) return [triggers, []];
      throw new Error('Requête inattendue dans le contrôle du registre d’audit.');
    }
  };
}

describe('Vérification du schéma append-only du registre d’audit', () => {
  test('accepte les tables et triggers conformes', async () => {
    const connection = fakeConnection();
    const result = await verifyAuditLedgerSchema(connection);

    assert.equal(result.valid, true);
    assert.deepEqual(result.tables, ['pro_audit_events', 'pro_audit_chain_heads']);
    assert.deepEqual(result.triggers, [
      'trg_pro_audit_events_block_update',
      'trg_pro_audit_events_block_delete'
    ]);
    assert.equal(connection.calls.length, 2);
    assert.ok(connection.calls.every(call => /^\\s*SELECT/i.test(call.sql)));
  });

  test('détecte une table de preuve absente', async () => {
    const connection = fakeConnection({ tables: [TABLES[0]] });

    await assert.rejects(
      verifyAuditLedgerSchema(connection),
      error => error.code === 'AUDIT_LEDGER_SCHEMA_DRIFT' &&
        error.issues.includes('table absente : pro_audit_chain_heads')
    );
  });

  test('détecte un trigger absent', async () => {
    const connection = fakeConnection({ triggers: [TRIGGERS[0]] });

    await assert.rejects(
      verifyAuditLedgerSchema(connection),
      error => error.code === 'AUDIT_LEDGER_SCHEMA_DRIFT' &&
        error.issues.includes('trigger absent : trg_pro_audit_events_block_delete')
    );
  });

  test('détecte une définition de trigger altérée', async () => {
    const altered = [
      TRIGGERS[0],
      trigger('trg_pro_audit_events_block_delete', 'DELETE', {
        ACTION_TIMING: 'AFTER',
        ACTION_STATEMENT: 'SET @audit_guard_disabled = 1'
      })
    ];
    const connection = fakeConnection({ triggers: altered });

    await assert.rejects(
      verifyAuditLedgerSchema(connection),
      error => error.code === 'AUDIT_LEDGER_SCHEMA_DRIFT' &&
        error.issues.includes('définition non conforme : trg_pro_audit_events_block_delete')
    );
  });

  test('refuse une connexion invalide', async () => {
    await assert.rejects(
      verifyAuditLedgerSchema(null),
      TypeError
    );
  });
});
