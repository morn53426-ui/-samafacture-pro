const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pool } = require('./db');
const { captureException } = require('./monitoring');

const BACKUP_DIR = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.join(__dirname, '..', 'backups');

function isBackupEnabled() {
  return process.env.BACKUP_ENABLED !== 'false'; // activée par défaut
}

/**
 * Tente de "réclamer" la sauvegarde du jour : un seul appelant (même en mode cluster,
 * avec plusieurs processus) reçoit `true`, grâce au verrouillage de ligne MySQL
 * (SELECT ... FOR UPDATE dans une transaction). Les autres reçoivent `false` et ne
 * refont pas le travail.
 */
async function reclamerSauvegardeDuJour() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`INSERT IGNORE INTO backup_meta (id, derniere_sauvegarde) VALUES (1, '1970-01-01')`);
    const [[row]] = await conn.query('SELECT derniere_sauvegarde FROM backup_meta WHERE id = 1 FOR UPDATE');

    const aujourdHui = new Date().toISOString().slice(0, 10);
    if (row.derniere_sauvegarde === aujourdHui) {
      await conn.commit();
      return false; // déjà fait aujourd'hui (par ce processus ou un autre worker)
    }
    await conn.query('UPDATE backup_meta SET derniere_sauvegarde = ? WHERE id = 1', [aujourdHui]);
    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Lance mysqldump et compresse directement le résultat en .sql.gz, sans fichier intermédiaire. */
function runMysqldump(outputPath) {
  return new Promise((resolve, reject) => {
    const bin = process.env.MYSQLDUMP_PATH || 'mysqldump';
    const args = [
      `--host=${process.env.DB_HOST || 'localhost'}`,
      `--port=${process.env.DB_PORT || 3306}`,
      `--user=${process.env.DB_USER || 'root'}`,
      '--single-transaction', // évite de verrouper les tables pendant la sauvegarde
      '--routines',
      '--events',
      process.env.DB_NAME || 'samafacture'
    ];
    // Le mot de passe passe par une variable d'environnement plutôt qu'en argument de
    // ligne de commande, pour ne pas apparaître dans la liste des processus système.
    const env = { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || '' };

    let dump;
    try {
      dump = spawn(bin, args, { env });
    } catch (err) {
      return reject(new Error(`Impossible de lancer mysqldump (${bin}) : ${err.message}`));
    }

    const gzip = zlib.createGzip();
    const out = fs.createWriteStream(outputPath);
    let stderr = '';

    dump.on('error', (err) => {
      reject(new Error(
        `Impossible de lancer mysqldump ("${bin}"). Vérifiez MYSQLDUMP_PATH dans .env — ` +
        `sous WAMPserver, il se trouve généralement dans wamp64\\bin\\mysql\\mysqlX.X.X\\bin\\mysqldump.exe. (${err.message})`
      ));
    });
    dump.stderr.on('data', (d) => { stderr += d.toString(); });
    dump.stdout.pipe(gzip).pipe(out);

    out.on('finish', resolve);
    out.on('error', reject);
    dump.on('close', (code) => {
      if (code !== 0) reject(new Error(`mysqldump a échoué (code ${code}) : ${stderr.slice(0, 500)}`));
    });
  });
}

/** Supprime les sauvegardes plus anciennes que BACKUP_RETENTION_DAYS (14 jours par défaut). */
async function nettoyerAnciennesSauvegardes() {
  const retentionJours = Number(process.env.BACKUP_RETENTION_DAYS) || 14;
  const limite = Date.now() - retentionJours * 24 * 60 * 60 * 1000;

  const fichiers = await fs.promises.readdir(BACKUP_DIR).catch(() => []);
  for (const fichier of fichiers) {
    if (!fichier.startsWith('samafacture-') || !fichier.endsWith('.sql.gz')) continue;
    const chemin = path.join(BACKUP_DIR, fichier);
    const stat = await fs.promises.stat(chemin).catch(() => null);
    if (stat && stat.mtimeMs < limite) {
      await fs.promises.unlink(chemin).catch(() => {});
      console.log(`🗑️  Ancienne sauvegarde supprimée (> ${retentionJours}j) : ${fichier}`);
    }
  }
}

/** Effectue une sauvegarde immédiatement (utilisé par le planificateur et par le CLI manuel). */
async function effectuerSauvegarde() {
  await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fichier = path.join(BACKUP_DIR, `samafacture-${horodatage}.sql.gz`);

  try {
    await runMysqldump(fichier);
    const { size } = await fs.promises.stat(fichier);
    console.log(`💾 Sauvegarde de la base effectuée : ${fichier} (${(size / 1024).toFixed(0)} Ko)`);
    await nettoyerAnciennesSauvegardes();
  } catch (err) {
    console.error('⚠️  Échec de la sauvegarde automatique :', err.message);
    // Remonté à Sentry (si configuré) : un échec de sauvegarde qui passe inaperçu pendant
    // plusieurs jours est le genre de problème silencieux qu'une simple ligne de log ne
    // suffit pas à signaler en production.
    captureException(err);
    await fs.promises.unlink(fichier).catch(() => {}); // retire un fichier vide/partiel
  }
}

/**
 * Vérifie une fois par heure s'il faut lancer la sauvegarde du jour. Sûr en mode cluster
 * (voir reclamerSauvegardeDuJour) et tolérant aux redémarrages : si le serveur était
 * éteint à l'heure cible, la sauvegarde se déclenche dès la prochaine vérification tant
 * qu'elle n'a pas encore eu lieu ce jour-là.
 */
function startBackupScheduler() {
  if (!isBackupEnabled()) {
    console.log('💾 Sauvegarde automatique désactivée (BACKUP_ENABLED=false).');
    return;
  }

  const heureCible = Number(process.env.BACKUP_HOUR ?? 2); // 2h du matin par défaut (faible activité)

  async function verifier() {
    if (new Date().getHours() < heureCible) return;
    try {
      const doitSauvegarder = await reclamerSauvegardeDuJour();
      if (doitSauvegarder) await effectuerSauvegarde();
    } catch (err) {
      console.error('⚠️  Erreur lors de la vérification de sauvegarde :', err.message);
      captureException(err);
    }
  }

  if (process.env.BACKUP_ON_STARTUP === 'true') effectuerSauvegarde();
  verifier();
  const timer = setInterval(verifier, 60 * 60 * 1000); // vérifie toutes les heures
  timer.unref(); // ne bloque pas l'arrêt propre du serveur
}

module.exports = { startBackupScheduler, effectuerSauvegarde, BACKUP_DIR };
