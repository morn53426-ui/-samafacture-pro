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
  const backupUser = 'sf_backup_' + suffix;
  const backupPassword = crypto.randomBytes(24).toString('hex');
  const keys = ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'BACKUP_DIR', 'BACKUP_ENCRYPTION_KEY', 'MYSQLDUMP_PATH', 'MYSQL_PATH'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
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
    // Simule le compte applicatif Docker : accès limité à la base source, sans
    // PROCESS ni SELECT global. Une sauvegarde doit réussir avec ce profil minimal.
    await connection.query(
      `CREATE USER '${backupUser}'@'%' IDENTIFIED BY '${backupPassword}'`
    );
    await connection.query(
      `GRANT SELECT, SHOW VIEW, TRIGGER, EVENT ON ${sourceDb}.* TO '${backupUser}'@'%'`
    );
    const [backupGrants] = await connection.query(`SHOW GRANTS FOR '${backupUser}'@'%'`);
    const grantsText = backupGrants.map(row => Object.values(row).join(' ')).join('\n');
    assert.doesNotMatch(grantsText, /ON \*\.\*/i,
      'le compte de sauvegarde ne doit recevoir aucun privilège global');
    await connection.query(
      'CREATE TABLE ?? (id INT PRIMARY KEY, label VARCHAR(120) NOT NULL, amount DECIMAL(14,2) NOT NULL)',
      [sourceDb + '.restore_roundtrip_fixture']
    );
    await connection.query(
      'INSERT INTO ?? (id, label, amount) VALUES (?, ?, ?), (?, ?, ?)',
      [sourceDb + '.restore_roundtrip_fixture', 1, 'SamaFacture restore probe', '123456.78', 2, 'Données francophones — Dakar', '987.65']
    );

    process.env.DB_NAME = sourceDb;
    process.env.DB_USER = backupUser;
    process.env.DB_PASSWORD = backupPassword;
    process.env.BACKUP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    process.env.MYSQLDUMP_PATH = process.env.MYSQLDUMP_PATH || 'mysqldump';
    process.env.MYSQL_PATH = process.env.MYSQL_PATH || 'mysql';

    const backup = await effectuerSauvegarde();
    assert.ok(backup.path.endsWith('.sql.gz.enc'), 'la sauvegarde de recette doit être chiffrée');
    assert.ok(backup.size > 0, 'la sauvegarde chiffrée ne doit pas être vide');

    // La restauration reste effectuée avec les identifiants administrateur du smoke test.
    process.env.DB_NAME = targetDb;
    process.env.DB_USER = original.DB_USER || 'root';
    process.env.DB_PASSWORD = original.DB_PASSWORD || '';
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
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await connection.query(`DROP USER IF EXISTS '${backupUser}'@'%'`).catch(() => {});
    await connection.query('DROP DATABASE IF EXISTS ??', [sourceDb]).catch(() => {});
    await connection.query('DROP DATABASE IF EXISTS ??', [targetDb]).catch(() => {});
    await connection.end();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
