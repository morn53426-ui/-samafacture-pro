-- Migration 008 : preuve indépendante de possession de l'adresse email avant l'acceptation d'une invitation multi-sociétés.
-- Le jeton de preuve est aléatoire, stocké uniquement sous forme SHA-256 et consommable une fois.
CREATE TABLE IF NOT EXISTS pro_company_group_invitation_verifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invitation_id BIGINT UNSIGNED NOT NULL,
  company_owner_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_company_group_invitation_verification (invitation_id),
  UNIQUE KEY uk_company_group_verification_token (token_hash),
  KEY idx_company_group_verification_owner (company_owner_id, expires_at, used_at),
  CONSTRAINT fk_company_group_verification_invitation
    FOREIGN KEY (invitation_id) REFERENCES pro_company_group_invitations(id) ON DELETE CASCADE,
  CONSTRAINT fk_company_group_verification_owner
    FOREIGN KEY (company_owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;