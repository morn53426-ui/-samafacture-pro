-- Migration 004 : paiements de factures, comptabilité générale et achats/stocks.
-- Toutes les tables sont cloisonnées par user_id et créées de façon idempotente.

CREATE TABLE IF NOT EXISTS pro_payment_gateways (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  fournisseur VARCHAR(20) NOT NULL,
  credentials_enc MEDIUMTEXT NOT NULL,
  mode VARCHAR(12) NOT NULL DEFAULT 'test',
  actif TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_payment_gateway (user_id, fournisseur),
  CONSTRAINT fk_pro_payment_gateway_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_invoice_checkouts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  facture_id INT UNSIGNED NOT NULL,
  fournisseur VARCHAR(20) NOT NULL,
  reference_interne CHAR(64) NOT NULL,
  reference_prestataire VARCHAR(120) NULL,
  montant DECIMAL(14,2) NOT NULL,
  devise VARCHAR(10) NOT NULL DEFAULT 'XOF',
  checkout_url VARCHAR(1000) NULL,
  statut VARCHAR(20) NOT NULL DEFAULT 'en_attente',
  paiement_id INT UNSIGNED NULL,
  expire_at DATETIME NULL,
  paid_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_checkout_internal (reference_interne),
  UNIQUE KEY uk_pro_checkout_provider_ref (fournisseur, reference_prestataire),
  KEY idx_pro_checkout_invoice (user_id, facture_id, statut, created_at),
  CONSTRAINT fk_pro_checkout_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_checkout_invoice FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pro_checkout_payment FOREIGN KEY (paiement_id) REFERENCES paiements(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_payment_webhook_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fournisseur VARCHAR(20) NOT NULL,
  event_id VARCHAR(190) NOT NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  statut VARCHAR(20) NOT NULL DEFAULT 'recu',
  payload_hash CHAR(64) NULL,
  UNIQUE KEY uk_pro_payment_event (fournisseur, event_id),
  KEY idx_pro_payment_events_status (statut, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_compta_comptes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  code VARCHAR(20) NOT NULL,
  libelle VARCHAR(190) NOT NULL,
  classe TINYINT UNSIGNED NOT NULL,
  nature VARCHAR(10) NOT NULL DEFAULT 'debit',
  lettrable TINYINT(1) NOT NULL DEFAULT 0,
  actif TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_compta_compte (user_id, code),
  KEY idx_pro_compta_comptes_classe (user_id, classe, code),
  CONSTRAINT fk_pro_compta_comptes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_compta_journaux (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  code VARCHAR(12) NOT NULL,
  libelle VARCHAR(120) NOT NULL,
  type VARCHAR(20) NOT NULL,
  actif TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_compta_journal (user_id, code),
  CONSTRAINT fk_pro_compta_journaux_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_compta_ecritures (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  journal_id INT UNSIGNED NOT NULL,
  numero VARCHAR(50) NOT NULL,
  date_ecriture DATE NOT NULL,
  reference VARCHAR(120) NULL,
  libelle VARCHAR(255) NOT NULL,
  statut VARCHAR(20) NOT NULL DEFAULT 'validee',
  total_debit DECIMAL(16,2) NOT NULL DEFAULT 0,
  total_credit DECIMAL(16,2) NOT NULL DEFAULT 0,
  acteur_user_id INT UNSIGNED NULL,
  validee_le DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_compta_ecriture_numero (user_id, numero),
  KEY idx_pro_compta_ecriture_date (user_id, date_ecriture, journal_id),
  CONSTRAINT fk_pro_compta_ecritures_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_compta_ecritures_journal FOREIGN KEY (journal_id) REFERENCES pro_compta_journaux(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pro_compta_ecritures_actor FOREIGN KEY (acteur_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_compta_lignes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  ecriture_id BIGINT UNSIGNED NOT NULL,
  compte_id INT UNSIGNED NOT NULL,
  libelle VARCHAR(255) NOT NULL,
  debit DECIMAL(16,2) NOT NULL DEFAULT 0,
  credit DECIMAL(16,2) NOT NULL DEFAULT 0,
  tiers VARCHAR(190) NULL,
  facture_id INT UNSIGNED NULL,
  paiement_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pro_compta_lignes_account (user_id, compte_id, ecriture_id),
  KEY idx_pro_compta_lignes_invoice (user_id, facture_id),
  CONSTRAINT fk_pro_compta_lignes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_compta_lignes_entry FOREIGN KEY (ecriture_id) REFERENCES pro_compta_ecritures(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_compta_lignes_account FOREIGN KEY (compte_id) REFERENCES pro_compta_comptes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pro_compta_lignes_invoice FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE SET NULL,
  CONSTRAINT fk_pro_compta_lignes_payment FOREIGN KEY (paiement_id) REFERENCES paiements(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_fournisseurs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  nom VARCHAR(190) NOT NULL,
  email VARCHAR(190) NULL,
  telephone VARCHAR(40) NULL,
  adresse VARCHAR(255) NULL,
  ninea VARCHAR(60) NULL,
  notes TEXT NULL,
  actif TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_pro_fournisseur_user (user_id, actif, nom),
  CONSTRAINT fk_pro_fournisseur_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_entrepots (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  code VARCHAR(30) NOT NULL,
  nom VARCHAR(120) NOT NULL,
  adresse VARCHAR(255) NULL,
  par_defaut TINYINT(1) NOT NULL DEFAULT 0,
  actif TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_entrepot_code (user_id, code),
  KEY idx_pro_entrepot_user (user_id, actif),
  CONSTRAINT fk_pro_entrepot_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_stocks_entrepots (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  entrepot_id INT UNSIGNED NOT NULL,
  produit_id INT UNSIGNED NOT NULL,
  quantite DECIMAL(14,3) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_stock_entrepot_product (user_id, entrepot_id, produit_id),
  KEY idx_pro_stock_product (user_id, produit_id),
  CONSTRAINT fk_pro_stock_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_stock_entrepot FOREIGN KEY (entrepot_id) REFERENCES pro_entrepots(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_stock_product FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_commandes_fournisseurs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  fournisseur_id INT UNSIGNED NOT NULL,
  numero VARCHAR(50) NOT NULL,
  statut VARCHAR(24) NOT NULL DEFAULT 'brouillon',
  date_commande DATE NOT NULL,
  date_livraison_prevue DATE NULL,
  devise VARCHAR(10) NOT NULL DEFAULT 'XOF',
  total_ht DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_tva DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_ttc DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_purchase_order_num (user_id, numero),
  KEY idx_pro_purchase_order_supplier (user_id, fournisseur_id, date_commande),
  KEY idx_pro_purchase_order_status (user_id, statut, date_commande),
  CONSTRAINT fk_pro_purchase_order_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_purchase_order_supplier FOREIGN KEY (fournisseur_id) REFERENCES pro_fournisseurs(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_commandes_fournisseurs_lignes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  commande_id BIGINT UNSIGNED NOT NULL,
  produit_id INT UNSIGNED NULL,
  designation VARCHAR(255) NOT NULL,
  quantite DECIMAL(14,3) NOT NULL,
  quantite_recue DECIMAL(14,3) NOT NULL DEFAULT 0,
  prix_unitaire DECIMAL(14,2) NOT NULL,
  tva DECIMAL(5,2) NOT NULL DEFAULT 0,
  total_ligne DECIMAL(14,2) NOT NULL,
  KEY idx_pro_purchase_lines_order (user_id, commande_id),
  CONSTRAINT fk_pro_purchase_line_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_purchase_line_order FOREIGN KEY (commande_id) REFERENCES pro_commandes_fournisseurs(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_purchase_line_product FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_receptions_achats (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  commande_id BIGINT UNSIGNED NOT NULL,
  entrepot_id INT UNSIGNED NOT NULL,
  reference VARCHAR(80) NOT NULL,
  date_reception DATE NOT NULL,
  acteur_user_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_receipt_reference (user_id, reference),
  KEY idx_pro_receipt_order (user_id, commande_id, date_reception),
  CONSTRAINT fk_pro_receipt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_receipt_order FOREIGN KEY (commande_id) REFERENCES pro_commandes_fournisseurs(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pro_receipt_warehouse FOREIGN KEY (entrepot_id) REFERENCES pro_entrepots(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pro_receipt_actor FOREIGN KEY (acteur_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_receptions_achats_lignes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  reception_id BIGINT UNSIGNED NOT NULL,
  commande_ligne_id BIGINT UNSIGNED NOT NULL,
  produit_id INT UNSIGNED NULL,
  quantite DECIMAL(14,3) NOT NULL,
  prix_unitaire DECIMAL(14,2) NOT NULL,
  KEY idx_pro_receipt_lines (user_id, reception_id),
  CONSTRAINT fk_pro_receipt_line_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_receipt_line_receipt FOREIGN KEY (reception_id) REFERENCES pro_receptions_achats(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_receipt_line_order_line FOREIGN KEY (commande_ligne_id) REFERENCES pro_commandes_fournisseurs_lignes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pro_receipt_line_product FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_mouvements_stock (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  produit_id INT UNSIGNED NOT NULL,
  entrepot_id INT UNSIGNED NOT NULL,
  type VARCHAR(24) NOT NULL,
  quantite DECIMAL(14,3) NOT NULL,
  cout_unitaire DECIMAL(14,2) NOT NULL DEFAULT 0,
  reference VARCHAR(120) NULL,
  motif VARCHAR(255) NOT NULL,
  acteur_user_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pro_stock_movement_product (user_id, produit_id, created_at),
  KEY idx_pro_stock_movement_warehouse (user_id, entrepot_id, created_at),
  CONSTRAINT fk_pro_stock_movement_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_stock_movement_product FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pro_stock_movement_warehouse FOREIGN KEY (entrepot_id) REFERENCES pro_entrepots(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pro_stock_movement_actor FOREIGN KEY (acteur_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
