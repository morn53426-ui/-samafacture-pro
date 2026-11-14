// Restaure une sauvegarde gzip (.sql.gz) ou chiffrée (.sql.gz.enc).
// Utiliser une base cible vide et vérifier la sauvegarde avant toute restauration.
// Usage : npm run restore -- /chemin/vers/samafacture-....sql.gz.enc
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

const MAGIC = Buffer.from('SFBK1');

async function preparerFluxGzip(sourcePath) {
  if (!sourcePath.endsWith('.enc')) return { gzipPath: sourcePath, temporary: false };

  const keyText = process.env.BACKUP_ENCRYPTION_KEY || '';
  if (!/^[a-fA-F0-9]{64}$/.test(keyText)) {
    throw new Error('BACKUP_ENCRYPTION_KEY est absente ou invalide (64 caractères hexadécimaux requis).');
  }

  const stat = await fs.promises.stat(sourcePath);
  if (stat.size < MAGIC.length + 12 + 16) throw new Error('Fichier de sauvegarde chiffré trop court ou corrompu.');

  const handle = await fs.promises.open(sourcePath, 'r');
  const header = Buffer.alloc(MAGIC.length + 12);
  const tag = Buffer.alloc(16);
  try {
    await handle.read(header, 0, header.length, 0);
    await handle.read(tag, 0, tag.length, stat.size - tag.length);
  } finally {
    await handle.close();
  }

  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('Format de sauvegarde chiffrée inconnu.');
  }

  const iv = header.subarray(MAGIC.length);
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(keyText, 'hex'), iv);
  decipher.setAuthTag(tag);
  const gzipPath = path.join(os.tmpdir(), `samafacture-restore-${crypto.randomBytes(12).toString('hex')}.sql.gz`);

  try {
    // Le tag GCM est vérifié avant de transmettre la moindre instruction à MySQL.
    await pipeline(
      fs.createReadStream(sourcePath, { start: header.length, end: stat.size - tag.length - 1 }),
      decipher,
      fs.createWriteStream(gzipPath, { flags: 'wx', mode: 0o600 })
    );
    return { gzipPath, temporary: true };
  } catch (err) {
    await fs.promises.unlink(gzipPath).catch(() => {});
    throw new Error(`Authentification/déchiffrement de la sauvegarde refusé : ${err.message}`);
  }
}

async function restaurer(sourcePath) {
  if (!sourcePath) throw new Error('Indiquez le chemin du fichier de sauvegarde.');
  const absolutePath = path.resolve(sourcePath);
  await fs.promises.access(absolutePath, fs.constants.R_OK);
  const prepared = await preparerFluxGzip(absolutePath);

  try {
    const args = [
      `--host=${process.env.DB_HOST || 'localhost'}`,
      `--port=${process.env.DB_PORT || 3306}`,
      `--user=${process.env.DB_USER || 'root'}`,
      process.env.DB_NAME || 'samafacture'
    ];
    const mysql = spawn(process.env.MYSQL_PATH || 'mysql', args, {
      env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || '' },
      stdio: ['pipe', 'inherit', 'inherit']
    });

    const exitPromise = new Promise((resolve, reject) => {
      mysql.once('error', reject);
      mysql.once('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`mysql a échoué avec le code ${code}.`));
      });
    });
    const importPromise = pipeline(
      fs.createReadStream(prepared.gzipPath),
      zlib.createGunzip(),
      mysql.stdin
    );
    const results = await Promise.allSettled([exitPromise, importPromise]);
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) {
      if (mysql.exitCode === null && !mysql.killed) mysql.kill('SIGTERM');
      throw failed.reason;
    }
  } finally {
    if (prepared.temporary) await fs.promises.unlink(prepared.gzipPath).catch(() => {});
  }
}

if (require.main === module) {
  restaurer(process.argv[2])
    .then(() => console.log('Restauration terminée.'))
    .catch((err) => {
      console.error('Restauration échouée :', err.message);
      process.exitCode = 1;
    });
}

module.exports = { restaurer, preparerFluxGzip };
