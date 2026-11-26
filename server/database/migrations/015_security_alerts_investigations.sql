-- Migration 015 / schéma v26 : alertes de sécurité persistantes et dossiers d'investigation.
-- Aucune FK vers users ou pro_audit_events : les preuves et suivis survivent au cycle de vie des comptes.
CREATE TABLE IF NOT EXISTS pro_security_alerts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_scope_id BIGINT UNSIGNED NOT NULL,
  fingerprint CHAR(64) NOT NULL,
  alert_type VARCHAR(120) NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'security',
  severity VARCHAR(12) NOT NULL DEFAULT 'medium',
  status VARCHAR(24) NOT NULL DEFAULT 'open',
  title VARCHAR(190) NOT NULL,
  description TEXT NULL,
  source_event_id BIGINT UNSIGNED NULL,
  entity_type VARCHAR(80) NULL,
  entity_id VARCHAR(100) NULL,
  occurrences INT UNSIGNED NOT NULL DEFAULT 1,
  first_seen_at DATETIME(6) NOT NULL,
  last_seen_at DATETIME(6) NOT NULL,
  acknowledged_by_user_id BIGINT UNSIGNED NULL,
  acknowledged_at DATETIME(6) NULL,
  assigned_to_user_id BIGINT UNSIGNED NULL,
  resolved_by_user_id BIGINT UNSIGNED NULL,
  resolved_at DATETIME(6) NULL,
  resolution_note VARCHAR(1000) NULL,
  details_json JSON NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_pro_security_alert_fingerprint (tenant_scope_id, fingerprint),
  KEY idx_pro_security_alert_status (tenant_scope_id, status, severity, last_seen_at),
  KEY idx_pro_security_alert_assignee (tenant_scope_id, assigned_to_user_id, status),
  KEY idx_pro_security_alert_entity (tenant_scope_id, entity_type, entity_id, last_seen_at),
  KEY idx_pro_security_alert_type (tenant_scope_id, alert_type, last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_security_investigations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_scope_id BIGINT UNSIGNED NOT NULL,
  reference VARCHAR(32) NOT NULL,
  alert_id BIGINT UNSIGNED NULL,
  title VARCHAR(190) NOT NULL,
  description TEXT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'open',
  priority VARCHAR(12) NOT NULL DEFAULT 'medium',
  assigned_to_user_id BIGINT UNSIGNED NULL,
  created_by_user_id BIGINT UNSIGNED NULL,
  closed_by_user_id BIGINT UNSIGNED NULL,
  closed_at DATETIME(6) NULL,
  resolution_note VARCHAR(2000) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_pro_security_investigation_reference (tenant_scope_id, reference),
  KEY idx_pro_security_investigation_status (tenant_scope_id, status, priority, updated_at),
  KEY idx_pro_security_investigation_alert (tenant_scope_id, alert_id),
  KEY idx_pro_security_investigation_assignee (tenant_scope_id, assigned_to_user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_security_case_activity (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_scope_id BIGINT UNSIGNED NOT NULL,
  alert_id BIGINT UNSIGNED NULL,
  investigation_id BIGINT UNSIGNED NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  activity_type VARCHAR(50) NOT NULL,
  previous_status VARCHAR(24) NULL,
  new_status VARCHAR(24) NULL,
  details_json JSON NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_pro_security_activity_alert (tenant_scope_id, alert_id, id),
  KEY idx_pro_security_activity_investigation (tenant_scope_id, investigation_id, id),
  KEY idx_pro_security_activity_actor (tenant_scope_id, actor_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- L'historique d'activité est append-only : les commentaires et décisions de dossier ne peuvent pas être réécrits/supprimés par l'application.
CREATE TRIGGER trg_pro_security_case_activity_block_update
BEFORE UPDATE ON pro_security_case_activity
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pro_security_case_activity is append-only';

CREATE TRIGGER trg_pro_security_case_activity_block_delete
BEFORE DELETE ON pro_security_case_activity
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pro_security_case_activity is append-only';
