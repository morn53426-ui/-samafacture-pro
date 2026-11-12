-- Phase 5: liens de portail client opaques, révocables et à expiration.
CREATE TABLE IF NOT EXISTS pro_client_portal_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  client_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_by INT UNSIGNED NULL,
  last_accessed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_client_portal_token_hash (token_hash),
  KEY idx_client_portal_owner (user_id, client_id, revoked_at, expires_at),
  CONSTRAINT fk_client_portal_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_client_portal_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_client_portal_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Phase 7: historique des tentatives d'automatisation (aucun secret ni contenu sensible).
CREATE TABLE IF NOT EXISTS pro_automation_runs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  automation_id INT UNSIGNED NOT NULL,
  client_id INT UNSIGNED NULL,
  statut VARCHAR(30) NOT NULL,
  destinataire VARCHAR(190) NULL,
  detail VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_automation_runs_user_date (user_id, created_at),
  KEY idx_automation_runs_automation_date (automation_id, created_at),
  KEY idx_automation_runs_client_date (client_id, created_at),
  CONSTRAINT fk_automation_runs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_automation_runs_automation FOREIGN KEY (automation_id) REFERENCES pro_automations(id) ON DELETE CASCADE,
  CONSTRAINT fk_automation_runs_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
