-- SamaFacture Pro — schema MySQL (compatible WAMPserver / phpMyAdmin)
-- A importer dans la base "samafacture" (InnoDB, utf8mb4)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- Utilisateurs (chaque compte = une entreprise, dans cette version de base)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  token_version INT UNSIGNED NOT NULL DEFAULT 0,
  role VARCHAR(30) NOT NULL DEFAULT 'administrateur', -- administrateur | comptable | employe | commercial | manager
  entreprise_nom VARCHAR(190),
  entreprise_logo MEDIUMTEXT,
  entreprise_adresse VARCHAR(255),
  entreprise_telephone VARCHAR(40),
  entreprise_email VARCHAR(190),
  entreprise_ninea VARCHAR(60),
  entreprise_rccm VARCHAR(80),
  entreprise_site_web VARCHAR(190),
  entreprise_banque VARCHAR(120),
  entreprise_rib VARCHAR(100),
  entreprise_conditions_reglement TEXT,
  entreprise_mentions_legales TEXT,
  photo MEDIUMTEXT,
  facture_template VARCHAR(20) NOT NULL DEFAULT 'classique',
  facture_personnalisation TEXT, -- JSON : couleur_principale, couleur_secondaire, couleur_texte, police, taille_texte, epaisseur_texte, logo_taille (voir server/routes/auth.js et public/js/facture-templates.js)
  google_id VARCHAR(255),
  reset_token_hash VARCHAR(64),
  reset_token_expires DATETIME,
  signature_default MEDIUMTEXT,
  devise VARCHAR(10) NOT NULL DEFAULT 'FCFA',
  plan VARCHAR(20) NOT NULL DEFAULT 'gratuit', -- gratuit | starter | pro | entreprise
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users_email (email),
  UNIQUE KEY uk_users_google_id (google_id),
  KEY idx_users_reset_token_hash (reset_token_hash) -- voir AMELIORATIONS_SCALABILITE.md : SELECT ... WHERE reset_token_hash = ? (server/routes/auth.js) tournait sans index
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  nom VARCHAR(190) NOT NULL,
  email VARCHAR(190),
  telephone VARCHAR(40),
  whatsapp VARCHAR(40),
  adresse VARCHAR(255),
  notes TEXT,
  photo TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_clients_user (user_id),
  KEY idx_clients_user_created (user_id, created_at),
  CONSTRAINT fk_clients_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Produits / services
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS produits (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  nom VARCHAR(190) NOT NULL,
  reference VARCHAR(100),
  prix_ht DECIMAL(14,2) NOT NULL DEFAULT 0,
  tva DECIMAL(5,2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  categorie VARCHAR(100),
  description TEXT,
  image TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_produits_user (user_id),
  CONSTRAINT fk_produits_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Factures & devis
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS factures (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  client_id INT UNSIGNED NOT NULL,
  numero VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'facture', -- facture | devis
  date_emission DATE NOT NULL,
  date_echeance DATE NULL,
  statut VARCHAR(20) NOT NULL DEFAULT 'en_attente', -- en_attente | payee | en_retard | annulee
  remise DECIMAL(14,2) NOT NULL DEFAULT 0,
  frais_livraison DECIMAL(14,2) NOT NULL DEFAULT 0,
  mode_paiement VARCHAR(50),
  commentaires TEXT,
  objet VARCHAR(190),
  reference_externe VARCHAR(100),
  date_validite DATE NULL,
  conditions_reglement TEXT,
  sous_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_tva DECIMAL(14,2) NOT NULL DEFAULT 0,
  total DECIMAL(14,2) NOT NULL DEFAULT 0,
  montant_paye DECIMAL(14,2) NOT NULL DEFAULT 0,
  verification_code VARCHAR(10),
  idempotency_key VARCHAR(100),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_factures_user (user_id),
  KEY idx_factures_client (client_id),
  KEY idx_factures_user_type_created_at (user_id, type, created_at),
  KEY idx_factures_user_type_statut (user_id, type, statut),
  KEY idx_factures_user_type_date (user_id, type, date_emission),
  KEY idx_factures_user_date (user_id, date_emission),
  KEY idx_factures_user_type_client (user_id, type, client_id),
  KEY idx_factures_user_type_id (user_id, type, id),
  CONSTRAINT fk_factures_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_factures_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  UNIQUE KEY uk_factures_numero (user_id, type, numero),
  UNIQUE KEY uk_factures_user_idempotency (user_id, idempotency_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Lignes de facture / devis
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facture_lignes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  facture_id INT UNSIGNED NOT NULL,
  produit_id INT UNSIGNED NULL,
  designation VARCHAR(255) NOT NULL,
  quantite DECIMAL(14,2) NOT NULL DEFAULT 1,
  prix_unitaire DECIMAL(14,2) NOT NULL DEFAULT 0,
  tva DECIMAL(5,2) NOT NULL DEFAULT 0,
  total_ligne DECIMAL(14,2) NOT NULL DEFAULT 0,
  KEY idx_lignes_facture (facture_id),
  CONSTRAINT fk_lignes_facture FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE CASCADE,
  CONSTRAINT fk_lignes_produit FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Paiements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS paiements (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  facture_id INT UNSIGNED NOT NULL,
  montant DECIMAL(14,2) NOT NULL,
  methode VARCHAR(50) NOT NULL, -- wave | orange_money | paydunya | stripe | paypal | especes | cheque | virement | carte
  reference VARCHAR(100),
  idempotency_key VARCHAR(100),
  date_paiement DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_paiements_facture (facture_id),
  KEY idx_paiements_user_date (user_id, date_paiement),
  UNIQUE KEY uk_paiements_user_idempotency (user_id, idempotency_key),
  CONSTRAINT fk_paiements_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_paiements_facture FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Dépenses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS depenses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  libelle VARCHAR(190) NOT NULL,
  montant DECIMAL(14,2) NOT NULL DEFAULT 0,
  categorie VARCHAR(100),
  date_depense DATE NOT NULL,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_depenses_user (user_id),
  KEY idx_depenses_user_date (user_id, date_depense),
  CONSTRAINT fk_depenses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Compteurs de numérotation (factures/devis) — permet un incrément atomique,
-- sans risque de doublon même sous forte concurrence (contrairement à un simple
-- COUNT(*) sur la table factures, sujet à une condition de course).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compteurs_numerotation (
  user_id INT UNSIGNED NOT NULL,
  type VARCHAR(20) NOT NULL, -- facture | devis
  annee INT NOT NULL,
  dernier_numero INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, type, annee),
  CONSTRAINT fk_compteurs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Factures récurrentes (fonctionnalité Pro) : modèle de facture régénéré
-- automatiquement selon une fréquence donnée (hebdomadaire, mensuelle, annuelle).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS factures_recurrentes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  client_id INT UNSIGNED NOT NULL,
  libelle VARCHAR(190) NOT NULL,
  frequence VARCHAR(20) NOT NULL DEFAULT 'mensuelle', -- hebdomadaire | mensuelle | annuelle
  prochaine_date DATE NOT NULL,
  remise DECIMAL(14,2) NOT NULL DEFAULT 0,
  frais_livraison DECIMAL(14,2) NOT NULL DEFAULT 0,
  mode_paiement VARCHAR(50),
  commentaires TEXT,
  lignes_json TEXT NOT NULL, -- lignes d'articles au format JSON (désignation, quantité, prix, tva)
  actif TINYINT(1) NOT NULL DEFAULT 1,
  -- Désactivé par défaut (0) : l'envoi par email de chaque facture générée automatiquement
  -- est une action visible par le client, donc opt-in explicite plutôt qu'activé d'office
  -- sur des modèles déjà existants — voir POST/PUT /api/factures-recurrentes.
  envoi_auto_email TINYINT(1) NOT NULL DEFAULT 0,
  derniere_generation DATETIME,
  factures_generees INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_factures_recurrentes_user (user_id),
  KEY idx_factures_recurrentes_client (client_id),
  CONSTRAINT fk_factures_recurrentes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_factures_recurrentes_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Paiements d'abonnement (Wave / PayDunya — Orange Money et carte bancaire via PayDunya)
-- Si vous mettez à jour une base déjà déployée avec l'ancien schéma (sans la colonne
-- internal_reference), exécutez d'abord :
--   ALTER TABLE abonnement_paiements ADD COLUMN internal_reference VARCHAR(64) NOT NULL DEFAULT '' AFTER reference;
--   UPDATE abonnement_paiements SET internal_reference = reference WHERE internal_reference = '';
--   ALTER TABLE abonnement_paiements ADD KEY idx_abonnement_paiements_internal_reference (internal_reference);
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS abonnement_paiements (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  plan VARCHAR(20) NOT NULL,
  montant DECIMAL(14,2) NOT NULL,
  devise VARCHAR(10) NOT NULL DEFAULT 'XOF',
  fournisseur VARCHAR(20) NOT NULL, -- wave | paydunya
  reference VARCHAR(190) NOT NULL, -- identifiant de session Wave, ou jeton de facture PayDunya (utilisé par les webhooks)
  internal_reference VARCHAR(64) NOT NULL, -- référence générée par SamaFacture Pro à la création, stable et utilisée par la page de retour (`reference` ci-dessus est écrasée par la valeur du fournisseur une fois la session créée, donc inutilisable pour retrouver le paiement depuis l'URL de retour)
  statut VARCHAR(20) NOT NULL DEFAULT 'en_attente', -- en_attente | payee | echouee | expiree
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME,
  KEY idx_abonnement_paiements_user (user_id),
  KEY idx_abonnement_paiements_reference (reference),
  KEY idx_abonnement_paiements_internal_reference (internal_reference),
  CONSTRAINT fk_abonnement_paiements_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Suivi de la sauvegarde automatique quotidienne — une seule ligne, utilisée comme
-- verrou pour garantir qu'un seul processus (en mode cluster) lance mysqldump par jour.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS backup_meta (
  id TINYINT UNSIGNED PRIMARY KEY,
  derniere_sauvegarde DATE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Assistant Comptable (IA) — conversations et messages. Une conversation appartient à
-- un seul utilisateur (pas de partage). Les messages sont conservés en clair (contenu
-- texte du chat), pas de données de facturation dupliquées ici : l'assistant relit les
-- vraies tables (factures, clients...) à chaque question via ses outils, il ne les
-- recopie jamais dans l'historique de conversation.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assistant_conversations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  titre VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_assistant_conversations_user (user_id),
  CONSTRAINT fk_assistant_conversations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assistant_messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT UNSIGNED NOT NULL,
  role VARCHAR(10) NOT NULL, -- 'user' | 'assistant'
  contenu MEDIUMTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_assistant_messages_conversation (conversation_id),
  CONSTRAINT fk_assistant_messages_conversation FOREIGN KEY (conversation_id) REFERENCES assistant_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
