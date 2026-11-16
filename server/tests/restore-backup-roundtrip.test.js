const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const mysql = require('mysql2/promise');

const enabled = process.env.RUN_REAL_RESTORE_SMOKE === 'true';
const tempRoot = path.join(os.tmpdir(), 'samafacture-restore-roundtrip-' + crypto.randomUUID());
process.env.BACKUP_DIR = tempRoot;

const { effectuerSauvegarde } = require('../config/backup');
const { restaurer } = require('../restore-backup');

test('sauvegarde chiffrée et restauration complète via les vrais clients MySQL', { skip: !enabled }, async () => {
  const suffix = crypto.randomBytes(8).toString('hex');
  const sourceDb = 'sf_restore_source_' + suffix;
  const targetDb = 'sf_restore_target_' + suffix;
  const original = {
    DB_NAME: process.env.DB_NAME,
    BACKUP_DIR: process.env.BACKUP_DIR,
    BACKUP_ENCRYPTION_KEY: process.env.BACKUP_ENCRYPTION_KEY,
    MYSQLDUMP_PATH: process.env.MYSQLDUMP_PATH,
    MYSQL_PATH: process.env.MYSQL_PATH
  };
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  });

  try {
    await fs.mkdir(tempRoot, { recursive: true, mode: 0o700 });
    await connection.query('CREATE DATABASE ??', [sourceDb]);
    await connection.query('CREATE DATABASE ??', [targetDb]);
    await connection.query(
      'CREATE TABLE ?? (id INT PRIMARY KEY, label VARCHAR(120) NOT NULL, amount DECIMAL(14,2) NOT NULL)',
      [sourceDb + '.restore_roundtrip_fixture']
    );
    await connection.query(
      'INSERT INTO ?? (id, label, amount) VALUES (?, ?, ?), (?, ?, ?)',
      [sourceDb + '.restore_roundtrip_fixture', 1, 'SamaFacture restore probe', '123456.78', 2, 'Données francophones — Dakar', '987.65']
    );

    process.env.DB_NAME = sourceDb;
    process.env.BACKUP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    process.env.MYSQLDUMP_PATH = process.env.MYSQLDUMP_PATH || 'mysqldump';
    process.env.MYSQL_PATH = process.env.MYSQL_PATH || 'mysql';

    const backup = await effectuerSauvegarde();
    assert.ok(backup.path.endsWith('.sql.gz.enc'), 'la sauvegarde de recette doit être chiffrée');
    assert.ok(backup.size > 0, 'la sauvegarde chiffrée ne doit pas être vide');

    process.env.DB_NAME = targetDb;
    await restaurer(backup.path);

    const [rows] = await connection.query(
      'SELECT id, label, amount FROM ?? ORDER BY id',
      [targetDb + '.restore_roundtrip_fixture']
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0].label, 'SamaFacture restore probe');
    assert.equal(String(rows[0].amount), '123456.78');
    assert.equal(rows[1].label, 'Données francophones — Dakar');
    assert.equal(String(rows[1].amount), '987.65');
  } finally {
    process.env.DB_NAME = original.DB_NAME;
    process.env.BACKUP_DIR = original.BACKUP_DIR;
    process.env.BACKUP_ENCRYPTION_KEY = original.BACKUP_ENCRYPTION_KEY;
    process.env.MYSQLDUMP_PATH = original.MYSQLDUMP_PATH;
    process.env.MYSQL_PATH = original.MYSQL_PATH;
    await connection.query('DROP DATABASE IF EXISTS ??', [sourceDb]).catch(() => {});
    await connection.query('DROP DATABASE IF EXISTS ??', [targetDb]).catch(() => {});
    await connection.end();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
