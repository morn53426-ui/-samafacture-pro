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
const CURRENT_SCHEMA_VERSION = 26;

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
  // v8 : registre persistant du quota mensuel, rétrocompatible avec les bases v7.
  // v9 : jour d'ancrage des factures récurrentes (date mensuelle stable).
  // v10 : index de parcours des échéances actives.
  // v11 : groupes multi-sociétés (migration 006).
  // v12 : outbox email chiffrée et durable (migration 007).
  // v13 : preuve email à usage unique avant rattachement multi-sociétés (migration 008).
  // v14 : preuve email à usage unique pour les invitations classiques d’équipe (migration 009).
  // v15 : fondation des abonnements SaaS (prix versionnés, consentements, mandats,
  // périodes, tentatives, inbox webhook et audit) ; aucune donnée ni paiement créé.
  // v16 : type structuré des fiches catalogue ; les anciennes fiches restent non classées.
  // v17 : entrepôt de sortie mémorisé sur les factures pour des mouvements multi-entrepôts réversibles.
  // v18 : marqueur transactionnel pour reprendre une seule fois la ventilation des stocks historiques.
  // v19 : historique des contrepassations et réactivations comptables des factures.
  // v20 : mode de règlement des dépenses (caisse 571 / banque 521).
  // v21 : état et dates UTC de l'essai gratuit de 15 jours, sans attribution rétroactive.
  // v22 : les événements comptables de facture ne doivent pas être supprimés en cascade par une suppression de facture.
  // v23 : correspondances comptables propres à chaque entreprise, pour ventes et catégories de dépenses.
  // v24 : statistiques de fréquentation pseudonymisées pour le centre administrateur Sunupilot.
  // v25 : registre d’audit signé, append-only, avec chaînes indépendantes par tenant.
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
    { table: 'users', column: 'facture_template', definition: "VARCHAR(20) NOT NULL DEFAULT 'classique'" },
    { table: 'users', column: 'google_id', definition: 'VARCHAR(255)' },
    { table: 'users', column: 'reset_token_hash', definition: 'VARCHAR(64)' },
    { table: 'users', column: 'token_version', definition: 'INT NOT NULL DEFAULT 0' },
    { table: 'users', column: 'reset_token_expires', definition: 'DATETIME' },
    { table: 'users', column: 'signature_default', definition: 'MEDIUMTEXT' },
    { table: 'users', column: 'terms_accepted_at', definition: 'DATETIME NULL' },
    { table: 'users', column: 'terms_version', definition: 'VARCHAR(30) NULL' },
    { table: 'users', column: 'privacy_version', definition: 'VARCHAR(30) NULL' },
    { table: 'users', column: 'trial_plan', definition: 'VARCHAR(20) NULL' },
    { table: 'users', column: 'trial_started_at', definition: 'DATETIME NULL' },
    { table: 'users', column: 'trial_ends_at', definition: 'DATETIME NULL' },
    { table: 'users', column: 'trial_status', definition: "VARCHAR(20) NOT NULL DEFAULT 'not_started'" },
    { table: 'users', column: 'pays_code', definition: "VARCHAR(2) NOT NULL DEFAULT 'SN'" },
    { table: 'users', column: 'langue', definition: "VARCHAR(5) NOT NULL DEFAULT 'fr'" },
    { table: 'users', column: 'locale', definition: "VARCHAR(12) NOT NULL DEFAULT 'fr-SN'" },
    { table: 'users', column: 'fuseau_horaire', definition: "VARCHAR(64) NOT NULL DEFAULT 'Africa/Dakar'" },
    { table: 'users', column: 'format_date', definition: "VARCHAR(20) NOT NULL DEFAULT 'dd/MM/yyyy'" },
    { table: 'users', column: 'regime_fiscal', definition: "VARCHAR(30) NOT NULL DEFAULT 'standard'" },
    { table: 'factures', column: 'devise', definition: "VARCHAR(10) NOT NULL DEFAULT 'FCFA'" },
    { table: 'factures', column: 'entrepot_id', definition: 'INT UNSIGNED NULL AFTER client_id' },
    { table: 'produits', column: 'type_catalogue', definition: "VARCHAR(20) NOT NULL DEFAULT 'non_classe' AFTER nom" },
    { table: 'produits', column: 'stock_minimum', definition: 'DECIMAL(14,3) NOT NULL DEFAULT 0' },
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
    { table: 'depenses', column: 'mode_reglement', definition: "VARCHAR(10) NOT NULL DEFAULT 'caisse' AFTER categorie" },
    { table: 'paiements', column: 'idempotency_key', definition: 'VARCHAR(100)' },
    { table: 'factures_recurrentes', column: 'envoi_auto_email', definition: 'TINYINT(1) NOT NULL DEFAULT 0' },
    { table: 'factures_recurrentes', column: 'jour_ancre', definition: 'TINYINT UNSIGNED NULL AFTER prochaine_date' },
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

  // Le jour d'ancrage est initialisé depuis la prochaine échéance des modèles
  // déjà existants. Une fois renseigné, il n'est jamais recalculé par la migration.
  await conn.query(
    'UPDATE factures_recurrentes SET jour_ancre = DAY(prochaine_date) WHERE jour_ancre IS NULL'
  );

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
    { table: 'users', name: 'idx_users_trial_status_end', columns: '(trial_status, trial_ends_at)' },
    { table: 'abonnement_paiements', name: 'idx_abonnement_paiements_internal_reference', columns: '(internal_reference)' },
    // Compteurs par statut (tableau de bord) + passage auto en "en_retard".
    { table: 'factures', name: 'idx_factures_user_type_statut', columns: '(user_id, type, statut)' },
    { table: 'factures', name: 'idx_factures_user_type_created_at', columns: '(user_id, type, created_at)' },
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
    { table: 'factures_recurrentes', name: 'idx_factures_recurrentes_active_due', columns: '(actif, prochaine_date)' },
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

  // Le stock multi-entrepôts accepte les quantités fractionnaires (poids, mètres, litres).
  const [stockTypeRows] = await conn.query(
    `SELECT DATA_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produits' AND COLUMN_NAME = 'stock'`
  );
  if (stockTypeRows.length && stockTypeRows[0].DATA_TYPE !== 'decimal') {
    await conn.query('ALTER TABLE produits MODIFY COLUMN stock DECIMAL(14,3) NOT NULL DEFAULT 0');
  }

  // Paiements de factures, comptabilité générale et achats/stocks (migration 004).
  const accountingPurchasingPath = path.join(__dirname, '..', 'database', 'migrations', '004_paiements_comptabilite_achats.sql');
  const accountingPurchasingSql = fs.readFileSync(accountingPurchasingPath, 'utf8');
  const accountingPurchasingStatements = accountingPurchasingSql
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);
  for (const statement of accountingPurchasingStatements) {
    await conn.query(statement);
  }

  // v19 : historique des transitions comptables des factures. CREATE TABLE IF NOT EXISTS
  // rend la reprise sûre pour les bases déjà migrées vers la version v20 ou inférieure.
  const invoiceAccountingEventsPath = path.join(__dirname, '..', 'database', 'migrations', '011_comptabilite_contrepas_factures.sql');
  const invoiceAccountingEventsSql = fs.readFileSync(invoiceAccountingEventsPath, 'utf8');
  const invoiceAccountingEventsStatements = invoiceAccountingEventsSql
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);
  for (const statement of invoiceAccountingEventsStatements) {
    await conn.query(statement);
  }

  // v22 : conserver l'identifiant de facture comme référence d'audit, sans FK
  // vers factures. Une facture supprimée par une voie exceptionnelle ne doit pas
  // effacer ses événements ; la FK user_id → users conserve la suppression complète
  // et volontaire du tenant via ON DELETE CASCADE.
  const [invoiceEventForeignKeys] = await conn.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'pro_compta_facture_events'
       AND CONSTRAINT_NAME = 'fk_pro_compta_facture_events_invoice'`
  );
  if (invoiceEventForeignKeys.length) {
    await conn.query('ALTER TABLE pro_compta_facture_events DROP FOREIGN KEY fk_pro_compta_facture_events_invoice');
  }

  // v18 : 004 vient de créer pro_entrepots sur les nouvelles bases ; cet ajout conditionnel
  // complète également les installations existantes où la table est déjà présente.
  const [stockBackfillMarkerRows] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pro_entrepots'
       AND COLUMN_NAME = 'backfill_stock_termine'`
  );
  if (Number(stockBackfillMarkerRows[0].n) === 0) {
    await conn.query('ALTER TABLE pro_entrepots ADD COLUMN backfill_stock_termine TINYINT(1) NOT NULL DEFAULT 0 AFTER actif');
  }

  // Portail client, CRM, paramètres internationaux et exécutions idempotentes des automations.
  const phaseFiveToSevenPath = path.join(__dirname, '..', 'database', 'migrations', '005_portail_crm_international_ia.sql');
  const phaseFiveToSevenSql = fs.readFileSync(phaseFiveToSevenPath, 'utf8');
  const phaseFiveToSevenStatements = phaseFiveToSevenSql
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);
  for (const statement of phaseFiveToSevenStatements) {
    await conn.query(statement);
  }


  // Groupes multi-sociétés : chaque filiale reste un compte/tenant indépendant.
  const companyGroupsPath = path.join(__dirname, '..', 'database', 'migrations', '006_company_groups.sql');
  const companyGroupsSql = fs.readFileSync(companyGroupsPath, 'utf8');
  const companyGroupsStatements = companyGroupsSql
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);
  for (const statement of companyGroupsStatements) {
    await conn.query(statement);
  }

  // Outbox email durable : contenu chiffré, idempotence et reprise après interruption.
  const emailOutboxPath = path.join(__dirname, '..', 'database', 'migrations', '007_email_outbox.sql');
  const emailOutboxSql = fs.readFileSync(emailOutboxPath, 'utf8');
  const emailOutboxStatements = emailOutboxSql
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);
  for (const statement of emailOutboxStatements) {
    await conn.query(statement);
  }

  // Vérification indépendante de l'adresse email avant l'acceptation d'une invitation de groupe.
  const companyGroupVerificationPath = path.join(__dirname, '..', 'database', 'migrations', '008_company_group_email_proof.sql');
  const companyGroupVerificationSql = fs.readFileSync(companyGroupVerificationPath, 'utf8');
  const companyGroupVerificationStatements = companyGroupVerificationSql
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);
  for (const statement of companyGroupVerificationStatements) {
    await conn.query(statement);
  }

  // Preuve email à usage unique pour les invitations classiques d'équipe.
  const teamInvitationVerificationPath = path.join(__dirname, '..', 'database', 'migrations', '009_team_invitation_email_proof.sql');
  const teamInvitationVerificationSql = fs.readFileSync(teamInvitationVerificationPath, 'utf8');
  const teamInvitationVerificationStatements = teamInvitationVerificationSql
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);
  for (const statement of teamInvitationVerificationStatements) {
    await conn.query(statement);
  }

  // Fondation du moteur d'abonnements SaaS : migration additive et idempotente.
  // Elle ne publie aucun tarif, ne crée aucun mandat et ne déclenche aucun paiement.
  const saasSubscriptionsPath = path.join(__dirname, '..', 'database', 'migrations', '010_saas_subscriptions_simulation.sql');
  const saasSubscriptionsSql = fs.readFileSync(saasSubscriptionsPath, 'utf8');
  const saasSubscriptionsStatements = saasSubscriptionsSql
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);
  for (const statement of saasSubscriptionsStatements) {
    await conn.query(statement);
  }


  // v23 : la clé composée compte_id + user_id interdit une correspondance
  // vers un compte comptable appartenant à une autre entreprise.
  const [mappingAccountIndexRows] = await conn.query(
    'SELECT COUNT(*) AS n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
    ['pro_compta_comptes', 'uk_pro_compta_compte_id_user']
  );
  if (Number(mappingAccountIndexRows[0].n) === 0) {
    await conn.query('ALTER TABLE pro_compta_comptes ADD UNIQUE INDEX uk_pro_compta_compte_id_user (id, user_id)');
  }

  const accountingMappingsPath = path.join(__dirname, '..', 'database', 'migrations', '012_comptabilite_correspondances.sql');
  const accountingMappingsSql = fs.readFileSync(accountingMappingsPath, 'utf8');
  const accountingMappingsStatements = accountingMappingsSql
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);
  for (const statement of accountingMappingsStatements) {
    await conn.query(statement);
  }

  // v24 : journal minimal de fréquentation ; aucune donnée métier n'est supprimée ni modifiée.
  const analyticsPath = path.join(__dirname, '..', 'database', 'migrations', '013_sunupilot_analytics.sql');
  const analyticsSql = fs.readFileSync(analyticsPath, 'utf8');
  const analyticsStatements = analyticsSql
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);
  for (const statement of analyticsStatements) {
    await conn.query(statement);
  }

  // v25 : registre d'audit signé, append-only et sans FK vers users pour conserver
  // les éléments de preuve au-delà du cycle de vie d'un compte.
  const auditLedgerPath = path.join(__dirname, '..', 'database', 'migrations', '014_audit_ledger.sql');
  const auditLedgerSql = fs.readFileSync(auditLedgerPath, 'utf8');
  const auditLedgerStatements = auditLedgerSql
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);
  for (const statement of auditLedgerStatements) {
    const triggerMatch = /^CREATE TRIGGER\s+([a-zA-Z0-9_]+)/i.exec(statement);
    if (triggerMatch) {
      const [existingTriggers] = await conn.query(
        'SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = ? LIMIT 1',
        [triggerMatch[1]]
      );
      if (existingTriggers.length) continue;
    }
    await conn.query(statement);
  }


  // v26 : alertes persistantes, dossiers d'investigation et historique d'activité append-only.
  const securityCasesPath = path.join(__dirname, '..', 'database', 'migrations', '015_security_alerts_investigations.sql');
  const securityCasesSql = fs.readFileSync(securityCasesPath, 'utf8');
  const securityCasesStatements = securityCasesSql
    .split(/\\r?\\n/)
    .filter(line => !line.trim().startsWith('--'))
    .join('\\n')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);
  for (const statement of securityCasesStatements) {
    const triggerMatch = /^CREATE TRIGGER\\s+([a-zA-Z0-9_]+)/i.exec(statement);
    if (triggerMatch) {
      const [existingTriggers] = await conn.query(
        'SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = ? LIMIT 1',
        [triggerMatch[1]]
      );
      if (existingTriggers.length) continue;
    }
    await conn.query(statement);
  }

}

module.exports = { pool, initDatabase };
