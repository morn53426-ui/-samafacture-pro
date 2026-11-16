const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const { restaurer } = require('../restore-backup');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'samafacture-restore-safety-'));
const fakeMysql = path.join(tempRoot, 'fake-mysql.sh');
const archivePath = path.join(tempRoot, 'backup.sql.gz');
const importLog = path.join(tempRoot, 'mysql-import.log');
const envKeys = [
  'MYSQL_PATH', 'DB_NAME', 'DB_HOST', 'DB_PORT', 'DB_USER',
  'DB_PASSWORD', 'RESTORE_ALLOW_NON_EMPTY', 'RESTORE_TABLE_COUNT',
  'RESTORE_IMPORT_LOG'
];
const previousEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));

describe('Protection de la restauration', () => {
  before(async () => {
    const script = [
      '#!/bin/sh',
      'for arg in "$@"; do',
      '  case "$arg" in',
      '    --execute=*) printf "%s\\n" "$RESTORE_TABLE_COUNT"; exit 0 ;;',
      '  esac',
      'done',
      'printf "import\\n" >> "$RESTORE_IMPORT_LOG"',
      'cat >/dev/null',
      'exit 0',
      ''
    ].join(String.fromCharCode(10));
    await fs.promises.writeFile(fakeMysql, script, { mode: 0o700 });
    await fs.promises.chmod(fakeMysql, 0o700);
    await fs.promises.writeFile(archivePath, zlib.gzipSync('CREATE TABLE restore_fixture (id INT);\n'));

    process.env.MYSQL_PATH = fakeMysql;
    process.env.DB_NAME = 'samafacture_restore_test';
    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_PORT = '3306';
    process.env.DB_USER = 'root';
    process.env.DB_PASSWORD = 'test-password';
    process.env.RESTORE_IMPORT_LOG = importLog;
    delete process.env.RESTORE_ALLOW_NON_EMPTY;
  });

  after(async () => {
    for (const key of envKeys) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  });

  test('refuse une base contenant des tables avant tout envoi de SQL', async () => {
    process.env.RESTORE_TABLE_COUNT = '3';
    await fs.promises.unlink(importLog).catch(() => {});

    await assert.rejects(
      restaurer(archivePath),
      /contient déjà 3 table\(s\) ou vue\(s\)/
    );
    assert.equal(fs.existsSync(importLog), false,
      'aucune commande d’import ne doit être lancée pour une base non vide');
  });

  test('autorise la restauration lorsque la base cible est vide', async () => {
    process.env.RESTORE_TABLE_COUNT = '0';
    await fs.promises.unlink(importLog).catch(() => {});

    await restaurer(archivePath);

    assert.equal(await fs.promises.readFile(importLog, 'utf8'), 'import\n');
  });

  test('un remplacement de base non vide exige le consentement explicite', async () => {
    process.env.RESTORE_TABLE_COUNT = '8';
    process.env.RESTORE_ALLOW_NON_EMPTY = 'true';
    await fs.promises.unlink(importLog).catch(() => {});

    await restaurer(archivePath);

    assert.equal(await fs.promises.readFile(importLog, 'utf8'), 'import\n');
    delete process.env.RESTORE_ALLOW_NON_EMPTY;
  });
});
