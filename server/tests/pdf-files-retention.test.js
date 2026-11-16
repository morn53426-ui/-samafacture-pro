const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const originalJobsDir = process.env.PDF_JOBS_DIR;
const jobsDir = path.join(os.tmpdir(), 'samafacture-pdf-retention-' + process.pid);
process.env.PDF_JOBS_DIR = jobsDir;

const queuePath = require.resolve('../pdf-queue');
delete require.cache[queuePath];
const { cleanupExpiredPdfFiles } = require('../pdf-queue');

const OLD_PDF = '123e4567-e89b-42d3-a456-426614174000.pdf';
const FRESH_PDF = '123e4567-e89b-42d3-a456-426614174001.pdf';
const OLD_UNRELATED = 'invoice-export.pdf';
const OLD_DIRECTORY = '123e4567-e89b-42d3-a456-426614174002.pdf';

after(async () => {
  await fs.rm(jobsDir, { recursive: true, force: true });
  delete require.cache[queuePath];
  if (originalJobsDir === undefined) delete process.env.PDF_JOBS_DIR;
  else process.env.PDF_JOBS_DIR = originalJobsDir;
});

test('supprime uniquement les anciens PDF de tâches et conserve les fichiers récents ou étrangers', async () => {
  await fs.mkdir(jobsDir, { recursive: true });
  const now = Date.now();
  await fs.writeFile(path.join(jobsDir, OLD_PDF), Buffer.from('%PDF-old'));
  await fs.writeFile(path.join(jobsDir, FRESH_PDF), Buffer.from('%PDF-fresh'));
  await fs.writeFile(path.join(jobsDir, OLD_UNRELATED), Buffer.from('do not delete'));
  await fs.mkdir(path.join(jobsDir, OLD_DIRECTORY));

  const oldDate = new Date(now - 5000);
  const freshDate = new Date(now - 100);
  await fs.utimes(path.join(jobsDir, OLD_PDF), oldDate, oldDate);
  await fs.utimes(path.join(jobsDir, OLD_UNRELATED), oldDate, oldDate);
  await fs.utimes(path.join(jobsDir, FRESH_PDF), freshDate, freshDate);

  const result = await cleanupExpiredPdfFiles({ now, retentionMs: 1000 });

  assert.deepEqual(result, { removed: 1 });
  await assert.rejects(fs.stat(path.join(jobsDir, OLD_PDF)), { code: 'ENOENT' });
  assert.ok((await fs.stat(path.join(jobsDir, FRESH_PDF))).isFile());
  assert.ok((await fs.stat(path.join(jobsDir, OLD_UNRELATED))).isFile());
  assert.ok((await fs.stat(path.join(jobsDir, OLD_DIRECTORY))).isDirectory());
});

test('ne suit pas les liens symboliques lors du nettoyage', async () => {
  await fs.mkdir(jobsDir, { recursive: true });
  const outside = path.join(os.tmpdir(), 'samafacture-outside-' + process.pid + '.pdf');
  await fs.writeFile(outside, Buffer.from('%PDF-outside'));
  const link = path.join(jobsDir, '123e4567-e89b-42d3-a456-426614174003.pdf');
  try {
    await fs.symlink(outside, link);
  } catch (err) {
    if (err && ['EPERM', 'EACCES', 'ENOTSUP'].includes(err.code)) {
      await fs.unlink(outside).catch(() => {});
      return;
    }
    throw err;
  }

  const oldDate = new Date(Date.now() - 5000);
  await fs.utimes(outside, oldDate, oldDate);
  const result = await cleanupExpiredPdfFiles({ now: Date.now(), retentionMs: 1000 });

  assert.deepEqual(result, { removed: 0 });
  assert.ok((await fs.stat(outside)).isFile());
  assert.ok((await fs.lstat(link)).isSymbolicLink());
  await fs.unlink(link);
  await fs.unlink(outside);
});

test('retourne zéro si le répertoire PDF n’existe pas', async () => {
  await fs.rm(jobsDir, { recursive: true, force: true });
  assert.deepEqual(await cleanupExpiredPdfFiles(), { removed: 0 });
});
