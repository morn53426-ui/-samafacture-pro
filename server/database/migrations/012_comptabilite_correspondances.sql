-- Migration 012 : correspondances comptables automatiques par entreprise.
-- Les écritures déjà validées ne sont jamais modifiées par ces réglages.
CREATE TABLE IF NOT EXISTS pro_compta_correspondances (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  type_source VARCHAR(20) NOT NULL,
  cle_source VARCHAR(100) NOT NULL,
  compte_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_compta_correspondance (user_id, type_source, cle_source),
  KEY idx_pro_compta_correspondance_account (compte_id, user_id),
  CONSTRAINT fk_pro_compta_correspondance_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_compta_correspondance_account
    FOREIGN KEY (compte_id, user_id)
    REFERENCES pro_compta_comptes(id, user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
