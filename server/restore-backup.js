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

async function verifierBaseRestaurationVide(mysqlBin, connectionArgs, databaseName) {
  if (process.env.RESTORE_ALLOW_NON_EMPTY === 'true') {
    console.warn('⚠️ RESTORE_ALLOW_NON_EMPTY=true : la vérification de la base cible non vide est désactivée.');
    return;
  }

  const query = 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()';
  const args = [
    ...connectionArgs,
    `--database=${databaseName}`,
    '--batch',
    '--skip-column-names',
    `--execute=${query}`
  ];
  const output = await new Promise((resolve, reject) => {
    const mysql = spawn(mysqlBin, args, {
      env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || '' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    mysql.stdout.on('data', chunk => {
      if (stdout.length < 1024) stdout += chunk.toString().slice(0, 1024 - stdout.length);
    });
    mysql.stderr.on('data', chunk => {
      if (stderr.length < 4096) stderr += chunk.toString().slice(0, 4096 - stderr.length);
    });
    mysql.once('error', err => reject(new Error(`Impossible de vérifier la base cible avec mysql : ${err.message}`)));
    mysql.once('close', (code, signal) => {
      if (code !== 0) {
        reject(new Error(`Vérification de la base cible impossible (code ${code ?? 'inconnu'}, signal ${signal || 'aucun'}) : ${stderr.slice(0, 500)}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });

  if (!/^\\d+$/.test(output)) {
    throw new Error('mysql n’a pas renvoyé un nombre valide pendant la vérification de la base cible.');
  }
  const count = Number(output);
  if (!Number.isSafeInteger(count)) {
    throw new Error('Le nombre d’objets de la base cible dépasse la plage prise en charge.');
  }
  if (count > 0) {
    throw new Error(
      `La base cible "${databaseName}" contient déjà ${count} table(s) ou vue(s). Restauration interrompue pour éviter d’écraser des données. Utilisez une base vide ou définissez explicitement RESTORE_ALLOW_NON_EMPTY=true après avoir vérifié la cible.`
    );
  }
}

async function restaurer(sourcePath) {
  if (!sourcePath) throw new Error('Indiquez le chemin du fichier de sauvegarde.');
  const absolutePath = path.resolve(sourcePath);
  await fs.promises.access(absolutePath, fs.constants.R_OK);

  const mysqlBin = process.env.MYSQL_PATH || 'mysql';
  const databaseName = process.env.DB_NAME || 'samafacture';
  const connectionArgs = [
    `--host=${process.env.DB_HOST || 'localhost'}`,
    `--port=${process.env.DB_PORT || 3306}`,
    `--user=${process.env.DB_USER || 'root'}`
  ];

  // Une restauration contenant des DROP TABLE ne doit jamais remplacer par accident
  // une base déjà utilisée. L'exception exige une variable d'environnement explicite.
  await verifierBaseRestaurationVide(mysqlBin, connectionArgs, databaseName);

  const prepared = await preparerFluxGzip(absolutePath);
  try {
    const args = [...connectionArgs, `--database=${databaseName}`];
    const mysql = spawn(mysqlBin, args, {
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
