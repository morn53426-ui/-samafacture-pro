-- Migration 005 : portail client, CRM, paramètres internationaux et garde-fous d'automatisation.
-- Toutes les relations sont cloisonnées par user_id et les jetons publics ne sont stockés qu'en hash.

CREATE TABLE IF NOT EXISTS pro_customer_portal_access (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  client_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  last_access_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_portal_token (token_hash),
  KEY idx_pro_portal_client (user_id, client_id, revoked_at, expires_at),
  CONSTRAINT fk_pro_portal_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_portal_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_portal_quote_decisions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  client_id INT UNSIGNED NOT NULL,
  facture_id INT UNSIGNED NOT NULL,
  portal_access_id BIGINT UNSIGNED NOT NULL,
  decision VARCHAR(12) NOT NULL,
  commentaire VARCHAR(1000) NULL,
  decided_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_portal_quote_decision (user_id, facture_id),
  KEY idx_pro_portal_quote_client (user_id, client_id, decided_at),
  CONSTRAINT fk_pro_portal_quote_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_portal_quote_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_portal_quote_invoice FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_portal_quote_access FOREIGN KEY (portal_access_id) REFERENCES pro_customer_portal_access(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_crm_activities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  client_id INT UNSIGNED NOT NULL,
  acteur_user_id INT UNSIGNED NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'note',
  titre VARCHAR(190) NOT NULL,
  description TEXT NULL,
  statut VARCHAR(16) NOT NULL DEFAULT 'terminee',
  due_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_pro_crm_client_date (user_id, client_id, created_at),
  KEY idx_pro_crm_tasks (user_id, statut, due_at),
  CONSTRAINT fk_pro_crm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_crm_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_crm_actor FOREIGN KEY (acteur_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_automation_runs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  automation_id BIGINT UNSIGNED NOT NULL,
  entity_type VARCHAR(30) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  run_key VARCHAR(120) NOT NULL,
  result VARCHAR(16) NOT NULL DEFAULT 'succes',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_automation_run (automation_id, run_key),
  KEY idx_pro_automation_runs_user (user_id, created_at),
  CONSTRAINT fk_pro_automation_runs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_automation_runs_automation FOREIGN KEY (automation_id) REFERENCES pro_automations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
