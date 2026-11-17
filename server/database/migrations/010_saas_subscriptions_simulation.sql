-- Migration 010 : fondation du moteur d'abonnements SaaS en mode préparatoire.
-- Ces tables sont vides par défaut : aucun prix n'est publié, aucun mandat n'est créé
-- et aucune tentative de prélèvement n'est exécutée par cette migration.

CREATE TABLE IF NOT EXISTS saas_subscription_price_versions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  plan VARCHAR(20) NOT NULL,
  version SMALLINT UNSIGNED NOT NULL,
  interval_months SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  amount DECIMAL(14,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'XOF',
  tax_included TINYINT(1) NOT NULL DEFAULT 0,
  tax_code VARCHAR(40) NULL,
  statut VARCHAR(20) NOT NULL DEFAULT 'draft',
  valid_from DATETIME NULL,
  valid_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_saas_price_plan_version (plan, version),
  KEY idx_saas_price_status_validity (statut, valid_from, valid_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_subscriptions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  price_version_id BIGINT UNSIGNED NULL,
  plan VARCHAR(20) NOT NULL,
  statut VARCHAR(24) NOT NULL DEFAULT 'incomplete',
  amount DECIMAL(14,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'XOF',
  interval_months SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  billing_anchor_day TINYINT UNSIGNED NOT NULL,
  billing_timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Dakar',
  current_period_start DATE NULL,
  current_period_end DATE NULL,
  next_renewal_at DATETIME NULL,
  auto_renew_enabled TINYINT(1) NOT NULL DEFAULT 0,
  cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
  cancelled_at DATETIME NULL,
  ended_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_saas_subscription_user_status (user_id, statut, created_at),
  KEY idx_saas_subscription_due (statut, auto_renew_enabled, next_renewal_at, id),
  CONSTRAINT fk_saas_subscription_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_saas_subscription_price
    FOREIGN KEY (price_version_id) REFERENCES saas_subscription_price_versions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_subscription_consents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subscription_id BIGINT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  consent_scope VARCHAR(40) NOT NULL,
  opted_in TINYINT(1) NOT NULL DEFAULT 0,
  amount DECIMAL(14,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'XOF',
  interval_months SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  terms_version VARCHAR(40) NOT NULL,
  terms_sha256 CHAR(64) NOT NULL,
  terms_snapshot MEDIUMTEXT NOT NULL,
  consented_at DATETIME NULL,
  revoked_at DATETIME NULL,
  source_ip_sha256 CHAR(64) NULL,
  user_agent_sha256 CHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_saas_consent_subscription (subscription_id, consent_scope, created_at),
  KEY idx_saas_consent_user (user_id, consented_at, revoked_at),
  CONSTRAINT fk_saas_consent_subscription
    FOREIGN KEY (subscription_id) REFERENCES saas_subscriptions(id) ON DELETE CASCADE,
  CONSTRAINT fk_saas_consent_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_subscription_mandates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subscription_id BIGINT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  fournisseur VARCHAR(20) NOT NULL,
  provider_mandate_reference VARCHAR(190) NULL,
  provider_token_enc MEDIUMTEXT NULL,
  statut VARCHAR(20) NOT NULL DEFAULT 'pending',
  authorized_at DATETIME NULL,
  revoked_at DATETIME NULL,
  expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_saas_mandate_provider_ref (fournisseur, provider_mandate_reference),
  KEY idx_saas_mandate_subscription_status (subscription_id, statut),
  KEY idx_saas_mandate_user (user_id, statut),
  CONSTRAINT fk_saas_mandate_subscription
    FOREIGN KEY (subscription_id) REFERENCES saas_subscriptions(id) ON DELETE CASCADE,
  CONSTRAINT fk_saas_mandate_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_subscription_periods (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subscription_id BIGINT UNSIGNED NOT NULL,
  sequence_number INT UNSIGNED NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'XOF',
  statut VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  idempotency_key CHAR(64) NOT NULL,
  due_at DATETIME NULL,
  paid_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_saas_period_subscription_start (subscription_id, period_start),
  UNIQUE KEY uk_saas_period_idempotency (idempotency_key),
  KEY idx_saas_period_due (statut, due_at, id),
  CONSTRAINT fk_saas_period_subscription
    FOREIGN KEY (subscription_id) REFERENCES saas_subscriptions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_subscription_payment_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subscription_id BIGINT UNSIGNED NOT NULL,
  period_id BIGINT UNSIGNED NOT NULL,
  mandate_id BIGINT UNSIGNED NULL,
  fournisseur VARCHAR(20) NOT NULL,
  attempt_number SMALLINT UNSIGNED NOT NULL,
  idempotency_key CHAR(64) NOT NULL,
  provider_reference VARCHAR(190) NULL,
  amount DECIMAL(14,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'XOF',
  statut VARCHAR(20) NOT NULL DEFAULT 'queued',
  failure_code VARCHAR(80) NULL,
  result_code VARCHAR(80) NULL,
  simulated TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  UNIQUE KEY uk_saas_attempt_idempotency (idempotency_key),
  UNIQUE KEY uk_saas_attempt_period_number (period_id, attempt_number),
  UNIQUE KEY uk_saas_attempt_provider_ref (fournisseur, provider_reference),
  KEY idx_saas_attempt_subscription (subscription_id, created_at),
  CONSTRAINT fk_saas_attempt_subscription
    FOREIGN KEY (subscription_id) REFERENCES saas_subscriptions(id) ON DELETE CASCADE,
  CONSTRAINT fk_saas_attempt_period
    FOREIGN KEY (period_id) REFERENCES saas_subscription_periods(id) ON DELETE CASCADE,
  CONSTRAINT fk_saas_attempt_mandate
    FOREIGN KEY (mandate_id) REFERENCES saas_subscription_mandates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_subscription_webhook_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fournisseur VARCHAR(20) NOT NULL,
  provider_event_id VARCHAR(190) NOT NULL,
  payload_sha256 CHAR(64) NOT NULL,
  signature_valid TINYINT(1) NOT NULL DEFAULT 0,
  statut VARCHAR(20) NOT NULL DEFAULT 'received',
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  UNIQUE KEY uk_saas_webhook_provider_event (fournisseur, provider_event_id),
  KEY idx_saas_webhook_status_received (statut, received_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_subscription_audit_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subscription_id BIGINT UNSIGNED NULL,
  user_id INT UNSIGNED NULL,
  event_type VARCHAR(60) NOT NULL,
  actor_type VARCHAR(20) NOT NULL DEFAULT 'system',
  actor_user_id INT UNSIGNED NULL,
  details_json MEDIUMTEXT NULL,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_saas_audit_subscription_date (subscription_id, occurred_at, id),
  KEY idx_saas_audit_user_date (user_id, occurred_at, id),
  CONSTRAINT fk_saas_audit_subscription
    FOREIGN KEY (subscription_id) REFERENCES saas_subscriptions(id) ON DELETE SET NULL,
  CONSTRAINT fk_saas_audit_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_saas_audit_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
