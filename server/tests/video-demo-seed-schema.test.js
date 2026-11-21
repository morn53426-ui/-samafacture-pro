'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const schema = fs.readFileSync(path.join(root, 'database', 'schema.sql'), 'utf8');
const seed = fs.readFileSync(path.join(root, 'scripts', 'seed-video-demo.js'), 'utf8');

function extractCreateTableBlocks(sql) {
  const tables = new Map();
  const pattern = /CREATE TABLE IF NOT EXISTS\s+`?(\w+)`?\s*\(/gi;
  let match;

  while ((match = pattern.exec(sql))) {
    const name = match[1];
    let depth = 1;
    let quote = null;
    let end = pattern.lastIndex;

    while (end < sql.length && depth > 0) {
      const char = sql[end];
      if (quote) {
        if (char === quote && sql[end - 1] !== '\\') quote = null;
      } else if (char === "'" || char === '"' || char === '`') {
        quote = char;
      } else if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        depth -= 1;
      }
      end += 1;
    }

    assert.equal(depth, 0, 'unterminated CREATE TABLE for ' + name);
    const body = sql.slice(pattern.lastIndex, end - 1);
    const columns = new Set();

    for (const line of body.split(/\r?\n/)) {
      const field = line.trim().match(/^`?([a-zA-Z_][a-zA-Z0-9_]*)`?\s+(?:INT|TINYINT|SMALLINT|BIGINT|VARCHAR|CHAR|TEXT|MEDIUMTEXT|LONGTEXT|DECIMAL|DATE|DATETIME|TIMESTAMP|ENUM|JSON|BOOLEAN|BOOL|FLOAT|DOUBLE|BLOB|MEDIUMBLOB)\b/i);
      if (field) columns.add(field[1]);
    }

    tables.set(name, columns);
    pattern.lastIndex = end;
  }

  return tables;
}

test('the schema exposes every table populated by the demo seed', () => {
  const tables = extractCreateTableBlocks(schema);
  for (const name of ['users', 'clients', 'produits', 'factures', 'facture_lignes', 'paiements', 'depenses']) {
    assert.ok(tables.has(name), 'missing table in schema.sql: ' + name);
  }
});

test('every demo seed INSERT references columns present in schema.sql', () => {
  const tables = extractCreateTableBlocks(schema);
  const inserts = [...seed.matchAll(/INSERT INTO\s+`?(\w+)`?\s*\(([^)]+)\)/gi)];
  assert.ok(inserts.length >= 7, 'expected the user, client, product, invoice, line, payment and expense inserts');

  for (const insert of inserts) {
    const table = insert[1];
    const columns = insert[2].split(',').map(column => column.trim().replace(/^`|`$/g, ''));
    assert.ok(tables.has(table), 'seed inserts into unknown table: ' + table);
    for (const column of columns) {
      assert.ok(tables.get(table).has(column), 'schema column missing: ' + table + '.' + column);
    }
  }
});
