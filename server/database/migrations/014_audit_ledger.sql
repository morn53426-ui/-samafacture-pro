-- Migration 014 : registre d'audit signé, append-only et indépendant du cycle de vie des comptes.
-- tenant_scope_id=0 réserve les événements sans tenant authentifié.
-- Les colonnes d'identité ne possèdent volontairement aucune FK : les audits survivent à la suppression d'un compte.
CREATE TABLE IF NOT EXISTS pro_audit_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_scope_id BIGINT UNSIGNED NOT NULL,
  tenant_id BIGINT UNSIGNED NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  actor_kind VARCHAR(24) NOT NULL DEFAULT 'user',
  event_type VARCHAR(120) NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'security',
  severity VARCHAR(12) NOT NULL DEFAULT 'info',
  entity_type VARCHAR(80) NULL,
  entity_id VARCHAR(100) NULL,
  outcome VARCHAR(16) NOT NULL DEFAULT 'success',
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  request_id CHAR(36) NULL,
  metadata_json JSON NULL,
  chain_sequence BIGINT UNSIGNED NOT NULL,
  previous_hash CHAR(64) NOT NULL,
  event_hash CHAR(64) NOT NULL,
  key_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL,
  UNIQUE KEY uk_pro_audit_tenant_sequence (tenant_scope_id, chain_sequence),
  KEY idx_pro_audit_tenant_date (tenant_scope_id, created_at, id),
  KEY idx_pro_audit_tenant_event (tenant_scope_id, event_type, created_at),
  KEY idx_pro_audit_tenant_risk (tenant_scope_id, severity, created_at),
  KEY idx_pro_audit_entity (tenant_scope_id, entity_type, entity_id, created_at),
  KEY idx_pro_audit_actor (tenant_scope_id, actor_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_audit_chain_heads (
  tenant_scope_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  last_sequence BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_hash CHAR(64) NOT NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Les entrées sont immuables au niveau SQL. La tête de chaîne reste mutable afin de sérialiser les écritures.
CREATE TRIGGER trg_pro_audit_events_block_update
BEFORE UPDATE ON pro_audit_events
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pro_audit_events is append-only';

CREATE TRIGGER trg_pro_audit_events_block_delete
BEFORE DELETE ON pro_audit_events
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pro_audit_events is append-only';
