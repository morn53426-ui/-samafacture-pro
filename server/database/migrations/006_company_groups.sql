-- Migration 006 : groupes d'entreprises et rattachement explicite de sociétés.
-- Chaque société conserve son propre compte users.id comme tenant : aucune donnée
-- historique (factures, paiements, clients, stocks, écritures) n'est déplacée.
-- L'accès du groupe à une société n'est accordé qu'après acceptation par son propriétaire.

CREATE TABLE IF NOT EXISTS pro_company_groups (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_user_id INT UNSIGNED NOT NULL,
  nom VARCHAR(190) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_company_group_owner (owner_user_id),
  CONSTRAINT fk_pro_company_group_owner
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_company_group_companies (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL,
  company_owner_id INT UNSIGNED NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  linked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_group_company (group_id, company_owner_id),
  UNIQUE KEY uk_pro_company_single_group (company_owner_id),
  KEY idx_pro_group_company_group (group_id, is_primary, linked_at),
  CONSTRAINT fk_pro_group_company_group
    FOREIGN KEY (group_id) REFERENCES pro_company_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_group_company_owner
    FOREIGN KEY (company_owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_company_group_invitations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL,
  invited_email VARCHAR(190) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  statut VARCHAR(20) NOT NULL DEFAULT 'envoyee',
  expire_at DATETIME NOT NULL,
  accepted_company_owner_id INT UNSIGNED NULL,
  accepted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_company_group_invite_token (token_hash),
  KEY idx_pro_company_group_invite_pending (group_id, invited_email, statut, expire_at),
  CONSTRAINT fk_pro_company_group_invite_group
    FOREIGN KEY (group_id) REFERENCES pro_company_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_company_group_invite_accepted_owner
    FOREIGN KEY (accepted_company_owner_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
