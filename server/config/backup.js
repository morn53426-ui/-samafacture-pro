const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const { pool } = require('./db');
const { captureException } = require('./monitoring');

const BACKUP_DIR = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.join(__dirname, '..', 'backups');
const DAILY_BACKUP_LOCK = 'samafacture:backup-daily';

const BACKUP_MAGIC = Buffer.from('SFBK1');

function getBackupEncryptionKey() {
  const value = process.env.BACKUP_ENCRYPTION_KEY;
  if (!value) return null;
  if (!/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error('BACKUP_ENCRYPTION_KEY doit être une clé hexadécimale de 64 caractères (32 octets).');
  }
  return Buffer.from(value, 'hex');
}

function isBackupEnabled() {
  return process.env.BACKUP_ENABLED !== 'false';
}

/** Lance mysqldump et vérifie à la fois la fermeture du processus et celle du flux gzip.
 * Un fichier gzip partiel ne doit jamais être considéré comme une sauvegarde réussie. */
async function runMysqldump(outputPath, encryptionKey = null) {
  const bin = process.env.MYSQLDUMP_PATH || 'mysqldump';
  const args = [
    `--host=${process.env.DB_HOST || 'localhost'}`,
    `--port=${process.env.DB_PORT || 3306}`,
    `--user=${process.env.DB_USER || 'root'}`,
    '--single-transaction',
    '--routines',
    '--events',
    process.env.DB_NAME || 'samafacture'
  ];
  const env = { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || '' };
  const dump = spawn(bin, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  dump.stderr.on('data', (chunk) => {
    if (stderr.length < 8192) stderr += chunk.toString().slice(0, 8192 - stderr.length);
  });

  const exitPromise = new Promise((resolve, reject) => {
    dump.once('error', (err) => reject(new Error(`Impossible de lancer mysqldump (${bin}) : ${err.message}`)));
    dump.once('close', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`mysqldump a échoué (code ${code ?? 'inconnu'}, signal ${signal || 'aucun'}) : ${stderr.slice(0, 500)}`));
    });
  });

  let cipher = null;
  const gzip = zlib.createGzip();
  const output = fs.createWriteStream(outputPath, { flags: 'wx', mode: 0o600 });
  if (encryptionKey) {
    const iv = crypto.randomBytes(12);
    cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
    output.write(Buffer.concat([BACKUP_MAGIC, iv]));
  }
  const pipePromise = encryptionKey
    ? pipeline(dump.stdout, gzip, cipher, output)
    : pipeline(dump.stdout, gzip, output);

  const results = await Promise.allSettled([exitPromise, pipePromise]);
  const failed = results.find((result) => result.status === 'rejected');
  if (failed) {
    if (dump.exitCode === null && !dump.killed) dump.kill('SIGTERM');
    throw failed.reason;
  }

  if (cipher) {
    await fs.promises.appendFile(outputPath, cipher.getAuthTag(), { mode: 0o600 });
  }
}

/** Supprime les sauvegardes locales expirées ; le nettoyage ne doit pas invalider un dump valide. */
async function nettoyerAnciennesSauvegardes() {
  const retentionJours = Number(process.env.BACKUP_RETENTION_DAYS) || 14;
  const limite = Date.now() - retentionJours * 24 * 60 * 60 * 1000;
  const fichiers = await fs.promises.readdir(BACKUP_DIR).catch(() => []);
  for (const fichier of fichiers) {
    if (!fichier.startsWith('samafacture-') || !(fichier.endsWith('.sql.gz') || fichier.endsWith('.sql.gz.enc'))) continue;
    const chemin = path.join(BACKUP_DIR, fichier);
    const stat = await fs.promises.stat(chemin).catch(() => null);
    if (stat && stat.mtimeMs < limite) {
      await fs.promises.unlink(chemin).catch(() => {});
      console.log(`🗑️  Ancienne sauvegarde supprimée (> ${retentionJours}j) : ${fichier}`);
    }
  }
}

/** Effectue une sauvegarde. En cas d'échec, l'appelant reçoit une erreur explicite. */
async function effectuerSauvegarde() {
  const encryptionKey = getBackupEncryptionKey();
  await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const suffixe = require('crypto').randomBytes(3).toString('hex');
  const extension = encryptionKey ? '.sql.gz.enc' : '.sql.gz';
  const fichier = path.join(BACKUP_DIR, `samafacture-${horodatage}-${suffixe}${extension}`);

  try {
    await runMysqldump(fichier, encryptionKey);
    const stat = await fs.promises.stat(fichier);
    if (!stat.size) throw new Error('mysqldump a produit un fichier vide.');
    console.log(`💾 Sauvegarde de la base effectuée : ${fichier} (${(stat.size / 1024).toFixed(0)} Ko)${encryptionKey ? ' — chiffrée AES-256-GCM' : ' — non chiffrée (développement uniquement)'}`);
    await nettoyerAnciennesSauvegardes().catch((err) => {
      console.warn('Nettoyage des anciennes sauvegardes ignoré :', err.message);
    });
    return { path: fichier, size: stat.size };
  } catch (err) {
    console.error('⚠️  Échec de la sauvegarde :', err.message);
    captureException(err);
    await fs.promises.unlink(fichier).catch(() => {});
    throw err;
  }
}

/** Verrou distribué : la date n'est mise à jour QU'APRÈS un dump terminé et non vide.
 * Si mysqldump échoue ou si un worker s'arrête, le verrou est libéré et l'essai suivant
 * (au prochain contrôle horaire) pourra recommencer. */
async function executerSauvegardeQuotidienne() {
  if (!isBackupEnabled()) return false;

  const conn = await pool.getConnection();
  let lockAcquired = false;
  try {
    const [[lock]] = await conn.query('SELECT GET_LOCK(?, 0) AS acquired', [DAILY_BACKUP_LOCK]);
    if (Number(lock?.acquired) !== 1) return false;
    lockAcquired = true;

    await conn.query(
      "INSERT IGNORE INTO backup_meta (id, derniere_sauvegarde) VALUES (1, '1970-01-01')"
    );
    const [[row]] = await conn.query(
      'SELECT derniere_sauvegarde FROM backup_meta WHERE id = 1'
    );
    const aujourdHui = new Date().toISOString().slice(0, 10);
    const derniere = row?.derniere_sauvegarde
      ? String(row.derniere_sauvegarde).slice(0, 10)
      : '';

    if (derniere === aujourdHui) return false;

    await effectuerSauvegarde();
    await conn.query(
      'UPDATE backup_meta SET derniere_sauvegarde = ? WHERE id = 1',
      [aujourdHui]
    );
    return true;
  } finally {
    if (lockAcquired) {
      await conn.query('SELECT RELEASE_LOCK(?)', [DAILY_BACKUP_LOCK]).catch(() => {});
    }
    conn.release();
  }
}

function startBackupScheduler() {
  if (!isBackupEnabled()) {
    console.log('💾 Sauvegarde automatique désactivée (BACKUP_ENABLED=false).');
    return;
  }

  const parsedHour = Number(process.env.BACKUP_HOUR ?? 2);
  const heureCible = Number.isInteger(parsedHour) && parsedHour >= 0 && parsedHour <= 23
    ? parsedHour
    : 2;

  async function verifier(forceHour = false) {
    if (!forceHour && new Date().getHours() < heureCible) return;
    try {
      const effectuée = await executerSauvegardeQuotidienne();
      if (effectuée) console.log('💾 Sauvegarde quotidienne terminée et enregistrée.');
    } catch (err) {
      console.error('⚠️  Sauvegarde quotidienne non validée ; une nouvelle tentative sera faite au prochain contrôle :', err.message);
      captureException(err);
    }
  }

  const auDemarrage = process.env.BACKUP_ON_STARTUP === 'true';
  verifier(auDemarrage);
  const timer = setInterval(() => verifier(false), 60 * 60 * 1000);
  timer.unref();
}

module.exports = {
  startBackupScheduler,
  effectuerSauvegarde,
  executerSauvegardeQuotidienne,
  BACKUP_DIR
};
