-- Migration 015 : alertes de sécurité tenant-aware et suivi des investigations.
-- Les références vers les événements, comptes et alertes sont conservées sans FK afin que
-- les dossiers historiques ne disparaissent pas en cascade lors d'une maintenance de compte.
CREATE TABLE IF NOT EXISTS pro_security_alerts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_scope_id BIGINT UNSIGNED NOT NULL,
  tenant_id BIGINT UNSIGNED NULL,
  rule_code VARCHAR(80) NOT NULL,
  fingerprint CHAR(64) NOT NULL,
  severity VARCHAR(12) NOT NULL DEFAULT 'high',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  title VARCHAR(180) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  source_event_id BIGINT UNSIGNED NULL,
  source_event_type VARCHAR(120) NOT NULL,
  first_seen_at DATETIME(6) NOT NULL,
  last_seen_at DATETIME(6) NOT NULL,
  occurrence_count INT UNSIGNED NOT NULL DEFAULT 1,
  resolved_at DATETIME(6) NULL,
  resolution_code VARCHAR(40) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_pro_security_alert_fingerprint (tenant_scope_id, fingerprint),
  KEY idx_pro_security_alert_status (tenant_scope_id, status, severity, last_seen_at, id),
  KEY idx_pro_security_alert_rule (tenant_scope_id, rule_code, last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_security_cases (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_scope_id BIGINT UNSIGNED NOT NULL,
  tenant_id BIGINT UNSIGNED NULL,
  source_alert_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  severity VARCHAR(12) NOT NULL DEFAULT 'high',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  assigned_to_user_id BIGINT UNSIGNED NULL,
  resolved_at DATETIME(6) NULL,
  closed_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_pro_security_case_alert (tenant_scope_id, source_alert_id),
  KEY idx_pro_security_case_status (tenant_scope_id, status, severity, updated_at, id),
  KEY idx_pro_security_case_assignee (tenant_scope_id, assigned_to_user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pro_security_case_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_scope_id BIGINT UNSIGNED NOT NULL,
  case_id BIGINT UNSIGNED NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  event_type VARCHAR(40) NOT NULL,
  from_status VARCHAR(20) NULL,
  to_status VARCHAR(20) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_pro_security_case_event_history (tenant_scope_id, case_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TRIGGER trg_pro_security_case_events_block_update
BEFORE UPDATE ON pro_security_case_events
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pro_security_case_events is append-only';

CREATE TRIGGER trg_pro_security_case_events_block_delete
BEFORE DELETE ON pro_security_case_events
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pro_security_case_events is append-only';
