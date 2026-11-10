-- Migration 003 : modules professionnels complémentaires SamaFacture Pro.
-- Tables isolées par user_id : chaque ressource appartient au compte authentifié.
-- Les données historiques des tables principales restent inchangées.

CREATE TABLE IF NOT EXISTS pro_commandes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  client_id INT UNSIGNED NOT NULL,
  numero VARCHAR(50) NOT NULL,
  statut VARCHAR(24) NOT NULL DEFAULT 'brouillon',
  date_commande DATE NOT NULL,
  date_livraison_prevue DATE NULL,
  devise VARCHAR(10) NOT NULL DEFAULT 'FCFA',
  total DECIMAL(14,2) NOT NULL DEFAULT 0,
  lignes_json LONGTEXT NOT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_commandes_numero (user_id, numero),
  KEY idx_pro_commandes_user_date (user_id, date_commande),
  KEY idx_pro_commandes_client (user_id, client_id),
  CONSTRAINT fk_pro_commandes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_commandes_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_bons_livraison (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  commande_id INT UNSIGNED NULL,
  facture_id INT UNSIGNED NULL,
  numero VARCHAR(50) NOT NULL,
  date_livraison DATE NOT NULL,
  statut VARCHAR(20) NOT NULL DEFAULT 'prepare',
  destinataire VARCHAR(190) NULL,
  adresse_livraison VARCHAR(255) NULL,
  lignes_json LONGTEXT NOT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_livraison_numero (user_id, numero),
  KEY idx_pro_livraison_user_date (user_id, date_livraison),
  CONSTRAINT fk_pro_livraison_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_livraison_commande FOREIGN KEY (commande_id) REFERENCES pro_commandes(id) ON DELETE SET NULL,
  CONSTRAINT fk_pro_livraison_facture FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_avoirs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  facture_id INT UNSIGNED NOT NULL,
  numero VARCHAR(50) NOT NULL,
  date_emission DATE NOT NULL,
  montant DECIMAL(14,2) NOT NULL,
  motif VARCHAR(500) NOT NULL,
  statut VARCHAR(20) NOT NULL DEFAULT 'brouillon',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_avoirs_numero (user_id, numero),
  KEY idx_pro_avoirs_facture (user_id, facture_id),
  CONSTRAINT fk_pro_avoirs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_avoirs_facture FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_payment_links (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  facture_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  montant DECIMAL(14,2) NOT NULL,
  devise VARCHAR(10) NOT NULL DEFAULT 'FCFA',
  statut VARCHAR(20) NOT NULL DEFAULT 'actif',
  expire_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_payment_link_token (token_hash),
  KEY idx_pro_payment_link_user (user_id, created_at),
  CONSTRAINT fk_pro_payment_links_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_payment_links_facture FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_refund_requests (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  paiement_id INT UNSIGNED NOT NULL,
  montant DECIMAL(14,2) NOT NULL,
  motif VARCHAR(500) NOT NULL,
  statut VARCHAR(20) NOT NULL DEFAULT 'a_traiter',
  reference_prestataire VARCHAR(190) NULL,
  traite_par INT UNSIGNED NULL,
  traite_le DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pro_refunds_user_status (user_id, statut, created_at),
  CONSTRAINT fk_pro_refunds_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_refunds_payment FOREIGN KEY (paiement_id) REFERENCES paiements(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_etablissements (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  nom VARCHAR(190) NOT NULL,
  code VARCHAR(40) NULL,
  adresse VARCHAR(255) NULL,
  telephone VARCHAR(40) NULL,
  email VARCHAR(190) NULL,
  responsable VARCHAR(190) NULL,
  actif TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_etablissement_code (user_id, code),
  KEY idx_pro_etablissement_user (user_id, actif),
  CONSTRAINT fk_pro_etablissement_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_caisses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  etablissement_id INT UNSIGNED NULL,
  nom VARCHAR(120) NOT NULL,
  devise VARCHAR(10) NOT NULL DEFAULT 'FCFA',
  solde_initial DECIMAL(14,2) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pro_caisses_user (user_id, active),
  CONSTRAINT fk_pro_caisses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_caisses_etablissement FOREIGN KEY (etablissement_id) REFERENCES pro_etablissements(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_caisse_operations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  caisse_id INT UNSIGNED NOT NULL,
  type VARCHAR(12) NOT NULL,
  montant DECIMAL(14,2) NOT NULL,
  motif VARCHAR(255) NOT NULL,
  reference VARCHAR(100) NULL,
  operation_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pro_caisse_ops_user_date (user_id, operation_date),
  CONSTRAINT fk_pro_caisse_ops_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_caisse_ops_caisse FOREIGN KEY (caisse_id) REFERENCES pro_caisses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_team_roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  nom VARCHAR(100) NOT NULL,
  permissions_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_team_role_name (user_id, nom),
  CONSTRAINT fk_pro_team_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_team_invitations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  email VARCHAR(190) NOT NULL,
  role VARCHAR(60) NOT NULL DEFAULT 'employe',
  permissions_json JSON NOT NULL,
  token_hash CHAR(64) NOT NULL,
  statut VARCHAR(20) NOT NULL DEFAULT 'envoyee',
  expire_at DATETIME NOT NULL,
  accepted_user_id INT UNSIGNED NULL,
  accepted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_team_invite_token (token_hash),
  KEY idx_pro_team_invite_user (user_id, email, statut),
  CONSTRAINT fk_pro_team_invites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_team_invites_member FOREIGN KEY (accepted_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  facture_id INT UNSIGNED NULL,
  client_id INT UNSIGNED NULL,
  nom_fichier VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  taille_octets INT UNSIGNED NOT NULL,
  contenu LONGBLOB NOT NULL,
  signature_nom VARCHAR(190) NULL,
  signature_data MEDIUMTEXT NULL,
  signature_hash CHAR(64) NULL,
  signed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pro_documents_user_date (user_id, created_at),
  KEY idx_pro_documents_facture (user_id, facture_id),
  CONSTRAINT fk_pro_documents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_documents_facture FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE SET NULL,
  CONSTRAINT fk_pro_documents_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_automations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  type VARCHAR(40) NOT NULL,
  nom VARCHAR(150) NOT NULL,
  actif TINYINT(1) NOT NULL DEFAULT 1,
  configuration_json JSON NOT NULL,
  prochaine_execution DATETIME NULL,
  derniere_execution DATETIME NULL,
  dernier_resultat VARCHAR(30) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pro_automations_due (actif, prochaine_execution),
  KEY idx_pro_automations_user (user_id, actif),
  CONSTRAINT fk_pro_automations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_api_keys (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  nom VARCHAR(120) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  scopes_json JSON NOT NULL,
  derniere_utilisation DATETIME NULL,
  expire_at DATETIME NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_api_token_hash (token_hash),
  KEY idx_pro_api_keys_user (user_id, revoked_at),
  CONSTRAINT fk_pro_api_keys_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_webhooks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  url VARCHAR(1000) NOT NULL,
  secret_enc TEXT NOT NULL,
  evenements_json JSON NOT NULL,
  actif TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pro_webhooks_user (user_id, actif),
  CONSTRAINT fk_pro_webhooks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_webhook_deliveries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  webhook_id INT UNSIGNED NOT NULL,
  evenement VARCHAR(100) NOT NULL,
  payload_json LONGTEXT NOT NULL,
  statut VARCHAR(20) NOT NULL DEFAULT 'en_attente',
  tentatives TINYINT UNSIGNED NOT NULL DEFAULT 0,
  prochaine_tentative DATETIME NULL,
  http_status SMALLINT UNSIGNED NULL,
  delivered_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pro_webhook_delivery_due (statut, prochaine_tentative),
  KEY idx_pro_webhook_delivery_user (user_id, created_at),
  CONSTRAINT fk_pro_webhook_delivery_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_webhook_delivery_webhook FOREIGN KEY (webhook_id) REFERENCES pro_webhooks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  acteur_user_id INT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  entite VARCHAR(100) NOT NULL,
  entite_id VARCHAR(80) NULL,
  details_json JSON NULL,
  adresse_ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pro_audit_user_date (user_id, created_at),
  KEY idx_pro_audit_entity (user_id, entite, entite_id),
  CONSTRAINT fk_pro_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_audit_actor FOREIGN KEY (acteur_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS pro_team_members (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_user_id INT UNSIGNED NOT NULL,
  member_user_id INT UNSIGNED NOT NULL,
  role VARCHAR(60) NOT NULL DEFAULT 'employe',
  permissions_json JSON NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_team_member (owner_user_id, member_user_id),
  KEY idx_pro_team_member_user (member_user_id, active),
  CONSTRAINT fk_pro_team_members_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_team_members_member FOREIGN KEY (member_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_acomptes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  facture_id INT UNSIGNED NOT NULL,
  numero VARCHAR(50) NOT NULL,
  date_emission DATE NOT NULL,
  montant DECIMAL(14,2) NOT NULL,
  statut VARCHAR(20) NOT NULL DEFAULT 'a_encaisser',
  methode VARCHAR(50) NULL,
  reference_paiement VARCHAR(190) NULL,
  encaisse_le DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_acomptes_numero (user_id, numero),
  KEY idx_pro_acomptes_facture (user_id, facture_id, statut),
  CONSTRAINT fk_pro_acomptes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_acomptes_facture FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
