const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('node:stream/promises');
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

/** Lance mysqldump et attend à la fois sa sortie et son code de terminaison. */
async function runMysqldump(outputPath, spawnCommand = spawn) {
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
  // Le mot de passe passe par une variable d'environnement plutôt qu'en argument de
  // ligne de commande, pour ne pas apparaître dans la liste des processus système.
  const env = { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || '' };

  let dump;
  try {
    dump = spawnCommand(bin, args, { env });
  } catch (err) {
    throw new Error(`Impossible de lancer mysqldump ("${bin}") : ${err.message}`);
  }

  let stderr = '';
  dump.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
    if (stderr.length > 5000) stderr = stderr.slice(-5000);
  });

  // Le flux peut se terminer avant l'événement "close" du processus. Attendre les deux
  // évite de déclarer la sauvegarde réussie si mysqldump termine finalement avec un code != 0.
  const processClosed = new Promise((resolve, reject) => {
    dump.once('error', (err) => {
      reject(new Error(
        `Impossible de lancer mysqldump ("${bin}"). Vérifiez MYSQLDUMP_PATH dans .env. (${err.message})`
      ));
    });
    dump.once('close', (code, signal) => {
      if (code === 0) return resolve();
      reject(new Error(
        `mysqldump a échoué (code ${code}${signal ? `, signal ${signal}` : ''}) : ${stderr.slice(-500)}`
      ));
    });
  });

  const outputFinished = pipeline(
    dump.stdout,
    zlib.createGzip(),
    fs.createWriteStream(outputPath, { flags: 'wx' })
  );

  try {
    await Promise.all([processClosed, outputFinished]);
  } catch (err) {
    if (typeof dump.kill === 'function' && !dump.killed) dump.kill();
    await Promise.allSettled([processClosed, outputFinished]);
    throw err;
  }
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

/** Effectue une sauvegarde et renvoie un booléen exploitable par le planificateur/CLI. */
async function effectuerSauvegarde() {
  await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fichier = path.join(BACKUP_DIR, `samafacture-${horodatage}.sql.gz`);
  const fichierTemporaire = `${fichier}.tmp`;

  try {
    // Le nom définitif n'apparaît qu'après un dump complet et un renommage atomique.
    await runMysqldump(fichierTemporaire);
    await fs.promises.rename(fichierTemporaire, fichier);
    const { size } = await fs.promises.stat(fichier);
    console.log(`💾 Sauvegarde de la base effectuée : ${fichier} (${(size / 1024).toFixed(0)} Ko)`);

    // Un échec du nettoyage ne doit pas invalider ni supprimer une sauvegarde déjà complète.
    try {
      await nettoyerAnciennesSauvegardes();
    } catch (cleanupError) {
      console.error('⚠️ Sauvegarde réussie, mais le nettoyage des anciennes archives a échoué :', cleanupError.message);
      captureException(cleanupError);
    }
    return true;
  } catch (err) {
    console.error('⚠️  Échec de la sauvegarde automatique :', err.message);
    captureException(err);
    await fs.promises.unlink(fichierTemporaire).catch(() => {});
    return false;
  }
}

/**
 * Exécute la sauvegarde quotidienne sous verrou MySQL partagé entre les processus et
 * conteneurs. La date n'est enregistrée QU'APRÈS une archive réussie ; une panne ou un
 * redémarrage libère le verrou et permet un nouvel essai à la vérification suivante.
 */
async function executerSauvegardeQuotidienne() {
  const conn = await pool.getConnection();
  let lockAcquired = false;
  try {
    const [[lockRow]] = await conn.query(
      "SELECT GET_LOCK('samafacture_backup_daily', 0) AS acquired"
    );
    if (Number(lockRow?.acquired) !== 1) return false;
    lockAcquired = true;

    const [[row]] = await conn.query(
      'SELECT derniere_sauvegarde FROM backup_meta WHERE id = 1'
    );
    const dateDuJour = new Date().toISOString().slice(0, 10);
    if (String(row?.derniere_sauvegarde ?? '').slice(0, 10) === dateDuJour) {
      return false;
    }

    const sauvegardeReussie = await effectuerSauvegarde();
    if (!sauvegardeReussie) return false;

    await conn.query(
      'UPDATE backup_meta SET derniere_sauvegarde = ? WHERE id = 1',
      [dateDuJour]
    );
    return true;
  } finally {
    if (lockAcquired) {
      try {
        await conn.query("SELECT RELEASE_LOCK('samafacture_backup_daily')");
      } catch (releaseError) {
        console.error('Impossible de libérer le verrou de sauvegarde :', releaseError.message);
      }
    }
    conn.release();
  }
}

/**
 * Vérifie une fois par heure s'il faut lancer la sauvegarde du jour. En cas d'échec,
 * la date n'est pas marquée : l'exécution suivante réessaie automatiquement.
 */
function startBackupScheduler() {
  if (!isBackupEnabled()) {
    console.log('💾 Sauvegarde automatique désactivée (BACKUP_ENABLED=false).');
    return;
  }

  const heureCible = Number(process.env.BACKUP_HOUR ?? 2); // 2h du matin par défaut

  async function verifier(immediate = false) {
    if (!immediate && new Date().getHours() < heureCible) return;
    try {
      await executerSauvegardeQuotidienne();
    } catch (err) {
      console.error('⚠️  Erreur lors de la vérification de sauvegarde :', err.message);
      captureException(err);
    }
  }

  // BACKUP_ON_STARTUP lance une vérification immédiate, sans créer un doublon si
  // une sauvegarde valide a déjà été faite aujourd'hui sur une autre instance.
  verifier(process.env.BACKUP_ON_STARTUP === 'true');
  const timer = setInterval(() => verifier(false), 60 * 60 * 1000);
  timer.unref();
}

module.exports = { startBackupScheduler, effectuerSauvegarde, executerSauvegardeQuotidienne, runMysqldump, BACKUP_DIR };
