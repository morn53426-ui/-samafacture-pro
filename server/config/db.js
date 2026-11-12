const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { getRuntimeConfig } = require('./runtime');

const runtimeConfig = getRuntimeConfig();

const SCHEMA_PATH = path.join(__dirname, '..', 'database', 'schema.sql');

// Tous les appels concurrents d'initDatabase() dans un même processus partagent la
// même promesse. Le verrou MySQL ci-dessous reste indispensable pour synchroniser
// plusieurs workers/processus (cluster), mais il ne faut pas faire patienter 5 appels
// du même worker les uns derrière les autres.
let initializationPromise = null;
const CURRENT_SCHEMA_VERSION = 7;

// Pool de connexions MySQL — configuré via les variables d'environnement (.env)
// Valeurs par défaut alignées sur une installation WAMPserver standard
// (hôte: localhost, port: 3306, utilisateur: root, mot de passe vide).
// DB_POOL_SIZE est réglable pour la production (une valeur plus élevée permet de traiter
// davantage de requêtes en parallèle, dans la limite de ce que MySQL peut absorber —
// vérifiez `max_connections` côté serveur MySQL si vous l'augmentez fortement).
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'samafacture',
  waitForConnections: true,
  connectionLimit: runtimeConfig.dbPoolSize,
  queueLimit: runtimeConfig.dbQueueLimit, // file d'attente bornée sous forte charge
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  dateStrings: true, // renvoie les DATE/DATETIME sous forme de chaînes 'YYYY-MM-DD' plutôt que des objets Date
  decimalNumbers: true // renvoie les colonnes DECIMAL en Number JS plutôt qu'en chaîne (évite les bugs de calcul/format)
});

// Un pool ne doit jamais faire planter le process sur une erreur de connexion isolée
// (coupure réseau passagère, MySQL redémarré...) — on journalise et on laisse le pool
// se rétablir de lui-même au prochain appel.
pool.on('error', (err) => {
  console.error('Erreur du pool MySQL (non fatale) :', err.message);
});

/**
 * Crée la base de données si elle n'existe pas encore, puis applique le schéma
 * (chaque instruction du fichier schema.sql est idempotente grâce à IF NOT EXISTS).
 * A appeler une fois au démarrage du serveur, avant de commencer à écouter les requêtes.
 */
async function initDatabase() {
  if (initializationPromise) return initializationPromise;

  initializationPromise = initializeDatabaseOnce();
  try {
    return await initializationPromise;
  } catch (err) {
    // Une panne transitoire ne doit pas condamner définitivement le processus :
    // le prochain appel pourra retenter l'initialisation.
    initializationPromise = null;
    throw err;
  }
}

async function initializeDatabaseOnce() {
  const dbName = process.env.DB_NAME || 'samafacture';

  // Connexion sans base sélectionnée, pour pouvoir la créer si besoin.
  const rootConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  });
  try {
    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } catch (err) {
    if (err.code !== 'ER_DBACCESS_DENIED_ERROR' && err.code !== 'ER_DB_CREATE_EXISTS') throw err;
    const [schemas] = await rootConn.query(
      'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
      [dbName]
    );
    if (!schemas.length) throw err;
  } finally {
    await rootConn.end();
  }

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const cleaned = schema
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');
  const statements = cleaned
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const conn = await pool.getConnection();
  let lockAcquired = false;
  try {
    // GET_LOCK est la synchronisation inter-processus. L'appel en mémoire ci-dessus
    // évite les attentes inutiles entre appels d'un même processus.
    const [[lockRow]] = await conn.query(`SELECT GET_LOCK('samafacture_schema_init', 60) as acquis`);
    if (lockRow.acquis !== 1) {
      throw new Error(
        "Impossible d'obtenir le verrou d'initialisation du schéma après 60s — un autre " +
        'processus semble bloqué en cours d\'initialisation. Vérifiez les logs des autres workers.'
      );
    }
    lockAcquired = true;

    // Marqueur persistant : après la première initialisation complète, les autres
    // workers qui acquièrent le verrou n'ont plus à rejouer tout le schema.sql.
    // Les migrations restent exécutées pour les anciennes installations seulement.
    await conn.query(`
      CREATE TABLE IF NOT EXISTS _samafacture_schema_meta (
        id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
        version INT UNSIGNED NOT NULL,
        initialized_at DATETIME NOT NULL
      ) ENGINE=InnoDB
    `);

    const [[meta]] = await conn.query(
      'SELECT version FROM _samafacture_schema_meta WHERE id = 1 LIMIT 1'
    );

    if (!meta) {
      for (const statement of statements) {
        await conn.query(statement);
      }
      await runMigrations(conn);
      await conn.query(
        'INSERT INTO _samafacture_schema_meta (id, version, initialized_at) VALUES (1, ?, NOW())',
        [CURRENT_SCHEMA_VERSION]
      );
    } else if (Number(meta.version) < CURRENT_SCHEMA_VERSION) {
      // Une installation plus ancienne possède le marqueur mais pas encore toutes
      // les migrations de cette version. On les applique une seule fois sous le
      // verrou inter-processus puis on avance le numéro de version.
      await runMigrations(conn);
      await conn.query(
        'UPDATE _samafacture_schema_meta SET version = ?, initialized_at = NOW() WHERE id = 1',
        [CURRENT_SCHEMA_VERSION]
      );
    }
  } finally {
    if (lockAcquired) {
      try {
        await conn.query(`SELECT RELEASE_LOCK('samafacture_schema_init')`);
      } catch (releaseErr) {
        console.error('Impossible de libérer le verrou du schéma :', releaseErr.message);
      }
    }
    conn.release();
  }
}

/**
 * Ajoute les colonnes introduites après la création initiale des tables, pour les
 * installations existantes (CREATE TABLE IF NOT EXISTS ne modifie pas une table déjà là).
 * Chaque ajout est protégé : une colonne déjà présente ne provoque pas d'erreur.
 */
async function runMigrations(conn) {
  // Registre de consommation mensuelle : le quota ne doit pas être réinitialisé par
  // la suppression d'une facture, ni contourné par duplication/conversion/récurrence.
  // L'initialisation des anciennes périodes est faite à la première réservation.
  await conn.query(`
    CREATE TABLE IF NOT EXISTS facture_usage_mensuelle (
      user_id INT UNSIGNED NOT NULL,
      periode DATE NOT NULL,
      nombre_factures INT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, periode),
      CONSTRAINT fk_facture_usage_mensuelle_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const columnsToEnsure = [
    { table: 'users', column: 'photo', definition: 'MEDIUMTEXT' },
    { table: 'users', column: 'token_version', definition: 'INT UNSIGNED NOT NULL DEFAULT 0' },
    { table: 'users', column: 'facture_template', definition: "VARCHAR(20) NOT NULL DEFAULT 'classique'" },
    { table: 'users', column: 'google_id', definition: 'VARCHAR(255)' },
    { table: 'users', column: 'reset_token_hash', definition: 'VARCHAR(64)' },
    { table: 'users', column: 'reset_token_expires', definition: 'DATETIME' },
    { table: 'users', column: 'signature_default', definition: 'MEDIUMTEXT' },
    { table: 'users', column: 'facture_personnalisation', definition: 'TEXT' },
    { table: 'users', column: 'entreprise_rccm', definition: 'VARCHAR(80)' },
    { table: 'users', column: 'entreprise_site_web', definition: 'VARCHAR(190)' },
    { table: 'users', column: 'entreprise_banque', definition: 'VARCHAR(120)' },
    { table: 'users', column: 'entreprise_rib', definition: 'VARCHAR(100)' },
    { table: 'users', column: 'entreprise_conditions_reglement', definition: 'TEXT' },
    { table: 'users', column: 'entreprise_mentions_legales', definition: 'TEXT' },
    { table: 'produits', column: 'prix_achat', definition: 'DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER prix_ht' },
    { table: 'factures', column: 'verification_code', definition: 'VARCHAR(10)' },
    { table: 'factures', column: 'idempotency_key', definition: 'VARCHAR(100)' },
    { table: 'factures', column: 'objet', definition: 'VARCHAR(190)' },
    { table: 'factures', column: 'reference_externe', definition: 'VARCHAR(100)' },
    { table: 'factures', column: 'date_validite', definition: 'DATE NULL' },
    { table: 'factures', column: 'conditions_reglement', definition: 'TEXT' },
    { table: 'paiements', column: 'idempotency_key', definition: 'VARCHAR(100)' },
    { table: 'factures_recurrentes', column: 'envoi_auto_email', definition: 'TINYINT(1) NOT NULL DEFAULT 0' },
    { table: 'abonnement_paiements', column: 'internal_reference', definition: "VARCHAR(64) NOT NULL DEFAULT ''" }
  ];

  for (const { table, column, definition } of columnsToEnsure) {
    const [rows] = await conn.query(
      `SELECT COUNT(*) as n FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    if (rows[0].n === 0) {
      await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    }
  }

  // Élargit entreprise_logo si la colonne existe encore avec l'ancien type TEXT (~65 Ko max,
  // trop petit pour un logo encodé en base64). MEDIUMTEXT supporte jusqu'à 16 Mo.
  const [logoRows] = await conn.query(
    `SELECT DATA_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'entreprise_logo'`
  );
  if (logoRows.length && logoRows[0].DATA_TYPE === 'text') {
    await conn.query('ALTER TABLE users MODIFY COLUMN entreprise_logo MEDIUMTEXT');
  }

  // Index composites ajoutés en phase 6 (performance) pour les requêtes les plus fréquentes
  // (tableau de bord, rapports, liste des factures filtrée/triée) qui ne bénéficiaient
  // jusqu'ici que de l'index simple sur user_id — MySQL devait alors trier les résultats
  // en mémoire (filesort) plutôt que de lire directement dans l'ordre de l'index.
  // CREATE TABLE ... IF NOT EXISTS ne modifie pas une table déjà existante, donc ces index
  // sont ajoutés ici, comme les colonnes ci-dessus, de façon idempotente.
  // Compatibilité des anciennes installations : internal_reference a été ajoutée après
  // la création initiale de la table. Si la colonne vient d'être créée avec sa valeur vide,
  // on la reconstruit à partir de reference avant d'ajouter l'index. Cette opération ne modifie
  // pas les lignes déjà renseignées et reste sûre à chaque redémarrage.
  const [internalRefRows] = await conn.query(
    `SELECT COUNT(*) as n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'abonnement_paiements' AND COLUMN_NAME = 'internal_reference'`
  );
  if (internalRefRows[0].n > 0) {
    await conn.query(
      "UPDATE abonnement_paiements SET internal_reference = reference WHERE (internal_reference IS NULL OR internal_reference = '') AND reference IS NOT NULL"
    );
  }

  // Corrige les installations existantes : le schéma récent utilise CASCADE pour les
  // références client des factures, mais ALTER TABLE ... IF NOT EXISTS ne modifie pas une
  // contrainte déjà créée. On inspecte donc la règle réelle avant de la remplacer.
  const clientCascadeFks = [
    { table: 'factures', constraint: 'fk_factures_client', column: 'client_id' },
    { table: 'factures_recurrentes', constraint: 'fk_factures_recurrentes_client', column: 'client_id' }
  ];
  for (const { table, constraint, column } of clientCascadeFks) {
    const [fkRows] = await conn.query(
      `SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
      [table, constraint]
    );
    if (fkRows.length && fkRows[0].DELETE_RULE !== 'CASCADE') {
      await conn.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${constraint}\``);
      await conn.query(
        `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${constraint}\` FOREIGN KEY (\`${column}\`) REFERENCES clients(id) ON DELETE CASCADE`
      );
    }
  }

  const indexesToEnsure = [
    { table: 'users', name: 'idx_users_reset_token_hash', columns: '(reset_token_hash)' },
    { table: 'abonnement_paiements', name: 'idx_abonnement_paiements_internal_reference', columns: '(internal_reference)' },
    // Compteurs par statut (tableau de bord) + passage auto en "en_retard".
    { table: 'factures', name: 'idx_factures_user_type_created_at', columns: '(user_id, type, created_at)' },
    { table: 'factures', name: 'idx_factures_user_type_statut', columns: '(user_id, type, statut)' },
    // Filtrage par plage de dates (rapports, évolution mensuelle du tableau de bord).
    { table: 'factures', name: 'idx_factures_user_type_date', columns: '(user_id, type, date_emission)' },
    // Liste des factures/devis (GET /api/factures) triée par date sans filtre de type.
    { table: 'factures', name: 'idx_factures_user_date', columns: '(user_id, date_emission)' },
    // Dashboard : jointure/agrégation des factures par client et par type.
    { table: 'factures', name: 'idx_factures_user_type_client', columns: '(user_id, type, client_id)' },
    // Dashboard : jointure des lignes sur les factures filtrées par utilisateur/type.
    { table: 'factures', name: 'idx_factures_user_type_id', columns: '(user_id, type, id)' },
    // Dashboard : derniers paiements par utilisateur.
    { table: 'paiements', name: 'idx_paiements_user_date', columns: '(user_id, date_paiement)' },
    // Dashboard : derniers clients par utilisateur.
    { table: 'clients', name: 'idx_clients_user_created', columns: '(user_id, created_at)' },
    // Liste et rapport des dépenses, triés/filtrés par date.
    { table: 'depenses', name: 'idx_depenses_user_date', columns: '(user_id, date_depense)' },
    { table: 'factures', name: 'uk_factures_user_idempotency', columns: '(user_id, idempotency_key)', unique: true },
    { table: 'paiements', name: 'uk_paiements_user_idempotency', columns: '(user_id, idempotency_key)', unique: true }
  ];

  for (const { table, name, columns, unique = false } of indexesToEnsure) {
    const [rows] = await conn.query(
      `SELECT COUNT(*) as n FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [table, name]
    );
    if (rows[0].n === 0) {
      await conn.query(`ALTER TABLE \`${table}\` ADD ${unique ? 'UNIQUE INDEX' : 'INDEX'} \`${name}\` ${columns}`);
    }
  }

  // Modules professionnels (achats/ventes avancés, équipe, documents, caisse,
  // automatisations et intégrations). Le script ne contient que des CREATE TABLE
  // IF NOT EXISTS ; il peut donc être rejoué après une interruption de démarrage.
  const professionalMigrationPath = path.join(__dirname, '..', 'database', 'migrations', '003_professional_modules.sql');
  const professionalSql = fs.readFileSync(professionalMigrationPath, 'utf8');
  const professionalStatements = professionalSql
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);
  for (const statement of professionalStatements) {
    await conn.query(statement);
  }

}

module.exports = { pool, initDatabase };
