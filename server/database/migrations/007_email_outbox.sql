-- Migration 007 : outbox email durable avec contenu chiffré et reprises.
-- Les jetons/liens présents dans les messages ne sont jamais stockés en clair.
CREATE TABLE IF NOT EXISTS email_outbox (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_user_id INT UNSIGNED NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  idempotency_key CHAR(64) NOT NULL,
  payload_enc MEDIUMTEXT NOT NULL,
  statut VARCHAR(20) NOT NULL DEFAULT 'queued',
  tentatives SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  prochaine_tentative DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verrouille_le DATETIME NULL,
  lock_token CHAR(36) NULL,
  dernier_code_erreur VARCHAR(80) NULL,
  envoye_le DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_email_outbox_idempotency (idempotency_key),
  UNIQUE KEY uk_email_outbox_entity (entity_type, entity_id),
  KEY idx_email_outbox_due (statut, prochaine_tentative, id),
  KEY idx_email_outbox_lease (statut, verrouille_le, id),
  CONSTRAINT fk_email_outbox_owner
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
