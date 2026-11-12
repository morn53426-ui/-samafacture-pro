const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');

const { runMysqldump } = require('../config/backup');

function fakeSpawn({ code = 0, stdout = 'CREATE TABLE test (id INT);', stderr = '' } = {}) {
  return () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.killed = false;
    child.kill = () => { child.killed = true; return true; };

    setImmediate(() => {
      child.stderr.end(stderr);
      child.stdout.end(stdout);
      // Le flux de sortie peut finir avant l'événement close du processus réel.
      setImmediate(() => child.emit('close', code, null));
    });
    return child;
  };
}

test('mysqldump compresse le SQL et attend la fermeture réussie du processus', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'samafacture-backup-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const archive = path.join(dir, 'backup.sql.gz');

  await runMysqldump(archive, fakeSpawn({ code: 0, stdout: 'CREATE TABLE invoices (id INT);' }));

  const compressed = await fs.readFile(archive);
  assert.equal(zlib.gunzipSync(compressed).toString('utf8'), 'CREATE TABLE invoices (id INT);');
});

test('mysqldump refuse une archive si le processus finit avec un code non nul', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'samafacture-backup-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const archive = path.join(dir, 'backup.sql.gz');

  await assert.rejects(
    runMysqldump(archive, fakeSpawn({ code: 2, stdout: 'partial SQL', stderr: 'Access denied' })),
    /mysqldump a échoué \(code 2\)/
  );
  await assert.rejects(fs.access(archive));
});
