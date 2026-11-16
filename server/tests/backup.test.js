const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'samafacture-backup-test-'));
process.env.BACKUP_DIR = path.join(tempRoot, 'backups');

const { pool, setupTestDatabase, teardownTestEnvironment } = require('./setup');
const { executerSauvegardeQuotidienne, effectuerSauvegarde, BACKUP_DIR } = require('../config/backup');
const { preparerFluxGzip } = require('../restore-backup');

const fakeDump = path.join(tempRoot, 'fake-mysqldump.sh');

function ecrireFauxDump(exitCode, delaySeconds = 0) {
  fs.writeFileSync(
    fakeDump,
    `#!/bin/sh\nif [ ${delaySeconds} -gt 0 ]; then sleep ${delaySeconds}; fi\nprintf 'CREATE TABLE backup_test_fixture (id INT);\\n'\nexit ${exitCode}\n`,
    { mode: 0o700 }
  );
  fs.chmodSync(fakeDump, 0o700);
}

describe('Sauvegardes automatiques', () => {
  before(async () => {
    await setupTestDatabase();
    await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
  });

  after(async () => {
    await teardownTestEnvironment();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  test('un échec de mysqldump ne marque pas la journée comme sauvegardée et permet une nouvelle tentative', async () => {
    const hier = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const aujourdHui = new Date().toISOString().slice(0, 10);
    await pool.query(
      'INSERT INTO backup_meta (id, derniere_sauvegarde) VALUES (1, ?) ON DUPLICATE KEY UPDATE derniere_sauvegarde = VALUES(derniere_sauvegarde)',
      [hier]
    );

    ecrireFauxDump(9);
    process.env.MYSQLDUMP_PATH = fakeDump;
    await assert.rejects(executerSauvegardeQuotidienne(), /mysqldump a échoué/);

    const [[apresEchec]] = await pool.query('SELECT derniere_sauvegarde FROM backup_meta WHERE id = 1');
    assert.equal(String(apresEchec.derniere_sauvegarde).slice(0, 10), hier);
    assert.equal((await fs.promises.readdir(BACKUP_DIR)).filter(name => name.endsWith('.sql.gz')).length, 0);
    assert.equal((await fs.promises.readdir(BACKUP_DIR)).filter(name => name.endsWith('.tmp')).length, 0,
      'une sauvegarde échouée ne doit laisser aucun fichier temporaire visible');

    ecrireFauxDump(0);
    const success = await executerSauvegardeQuotidienne();
    assert.equal(success, true);
    const [[apresSucces]] = await pool.query('SELECT derniere_sauvegarde FROM backup_meta WHERE id = 1');
    assert.equal(String(apresSucces.derniere_sauvegarde).slice(0, 10), aujourdHui);
    assert.equal((await fs.promises.readdir(BACKUP_DIR)).filter(name => name.endsWith('.sql.gz')).length, 1);
    assert.equal((await fs.promises.readdir(BACKUP_DIR)).filter(name => name.endsWith('.tmp')).length, 0,
      'le fichier temporaire doit être renommé, jamais conservé');

    const doublon = await executerSauvegardeQuotidienne();
    assert.equal(doublon, false, 'une seule sauvegarde quotidienne doit être enregistrée');
  });

  test('une archive ne devient visible qu’après la fin du dump temporaire', async () => {
    ecrireFauxDump(0, 2);
    process.env.MYSQLDUMP_PATH = fakeDump;
    delete process.env.BACKUP_ENCRYPTION_KEY;

    const fichiersAvant = new Set(await fs.promises.readdir(BACKUP_DIR));
    const operation = effectuerSauvegarde();
    await new Promise(resolve => setTimeout(resolve, 150));

    const enCours = (await fs.promises.readdir(BACKUP_DIR)).filter(name => !fichiersAvant.has(name));
    assert.equal(enCours.some(name => name.endsWith('.sql.gz') && !name.endsWith('.tmp')), false,
      'aucune archive définitive ne doit apparaître avant la fin de mysqldump');
    assert.equal(enCours.some(name => name.endsWith('.sql.gz.tmp')), true,
      'le dump doit rester dans un fichier temporaire pendant son exécution');

    const resultat = await operation;
    assert.ok(resultat.path.endsWith('.sql.gz'));
    const apres = await fs.promises.readdir(BACKUP_DIR);
    assert.equal(apres.some(name => name.endsWith('.sql.gz.tmp')), false,
      'le fichier temporaire doit disparaître après publication atomique');
    assert.ok(apres.includes(path.basename(resultat.path)));
  });

  test('le mode production refuse de créer une sauvegarde non chiffrée sans clé', async () => {
    const savedMode = process.env.NODE_ENV;
    const savedKey = process.env.BACKUP_ENCRYPTION_KEY;
    process.env.NODE_ENV = 'production';
    delete process.env.BACKUP_ENCRYPTION_KEY;
    try {
      const before = await fs.promises.readdir(BACKUP_DIR);
      await assert.rejects(effectuerSauvegarde(), /obligatoire en production/);
      assert.deepEqual(await fs.promises.readdir(BACKUP_DIR), before, 'aucun nouveau fichier de sauvegarde ne doit être créé');
    } finally {
      process.env.NODE_ENV = savedMode;
      if (savedKey === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
      else process.env.BACKUP_ENCRYPTION_KEY = savedKey;
    }
  });

  test('une sauvegarde avec clé est chiffrée et déchiffrable avant restauration', async () => {
    ecrireFauxDump(0);
    process.env.MYSQLDUMP_PATH = fakeDump;
    process.env.BACKUP_ENCRYPTION_KEY = 'ab'.repeat(32);

    const result = await effectuerSauvegarde();
    assert.ok(result.path.endsWith('.sql.gz.enc'));
    assert.equal((await fs.promises.readdir(BACKUP_DIR)).some(name => name.endsWith('.tmp')), false,
      'l’archive chiffrée finale ne doit être visible qu’après le renommage atomique');

    const prepared = await preparerFluxGzip(result.path);
    try {
      assert.equal(prepared.temporary, true);
      const sql = zlib.gunzipSync(await fs.promises.readFile(prepared.gzipPath)).toString('utf8');
      assert.match(sql, /CREATE TABLE backup_test_fixture/);

      const tamperedPath = path.join(tempRoot, 'tampered.sql.gz.enc');
      const encrypted = await fs.promises.readFile(result.path);
      encrypted[encrypted.length - 1] ^= 0x01;
      await fs.promises.writeFile(tamperedPath, encrypted, { mode: 0o600 });
      await assert.rejects(preparerFluxGzip(tamperedPath), /Authentification\/déchiffrement/);
    } finally {
      await fs.promises.unlink(prepared.gzipPath).catch(() => {});
      delete process.env.BACKUP_ENCRYPTION_KEY;
    }
  });
  test('une rétention invalide ne supprime pas les sauvegardes existantes', async () => {
    const savedRetention = process.env.BACKUP_RETENTION_DAYS;
    const savedKey = process.env.BACKUP_ENCRYPTION_KEY;
    const savedMode = process.env.NODE_ENV;
    const savedDumpPath = process.env.MYSQLDUMP_PATH;
    const archiveExistante = path.join(BACKUP_DIR, 'samafacture-protection-retention.sql.gz');

    process.env.BACKUP_RETENTION_DAYS = '-1';
    process.env.NODE_ENV = 'test';
    delete process.env.BACKUP_ENCRYPTION_KEY;
    ecrireFauxDump(0);
    process.env.MYSQLDUMP_PATH = fakeDump;
    await fs.promises.writeFile(archiveExistante, 'archive de test', { mode: 0o600 });

    try {
      await effectuerSauvegarde();
      await fs.promises.access(archiveExistante, fs.constants.R_OK);
    } finally {
      await fs.promises.unlink(archiveExistante).catch(() => {});
      if (savedRetention === undefined) delete process.env.BACKUP_RETENTION_DAYS;
      else process.env.BACKUP_RETENTION_DAYS = savedRetention;
      if (savedKey === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
      else process.env.BACKUP_ENCRYPTION_KEY = savedKey;
      if (savedMode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = savedMode;
      if (savedDumpPath === undefined) delete process.env.MYSQLDUMP_PATH;
      else process.env.MYSQLDUMP_PATH = savedDumpPath;
    }
  });

});

