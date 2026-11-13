const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'samafacture-backup-test-'));
process.env.BACKUP_DIR = path.join(tempRoot, 'backups');

const { pool, setupTestDatabase, teardownTestEnvironment } = require('./setup');
const { executerSauvegardeQuotidienne, BACKUP_DIR } = require('../config/backup');

const fakeDump = path.join(tempRoot, 'fake-mysqldump.sh');

function ecrireFauxDump(exitCode) {
  fs.writeFileSync(
    fakeDump,
    `#!/bin/sh\nprintf 'CREATE TABLE backup_test_fixture (id INT);\\n'\nexit ${exitCode}\n`,
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

    ecrireFauxDump(0);
    const success = await executerSauvegardeQuotidienne();
    assert.equal(success, true);
    const [[apresSucces]] = await pool.query('SELECT derniere_sauvegarde FROM backup_meta WHERE id = 1');
    assert.equal(String(apresSucces.derniere_sauvegarde).slice(0, 10), aujourdHui);
    assert.equal((await fs.promises.readdir(BACKUP_DIR)).filter(name => name.endsWith('.sql.gz')).length, 1);

    const doublon = await executerSauvegardeQuotidienne();
    assert.equal(doublon, false, 'une seule sauvegarde quotidienne doit être enregistrée');
  });
});

