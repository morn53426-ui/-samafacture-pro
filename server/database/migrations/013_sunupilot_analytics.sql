-- Migration 013 : mesure de fréquentation de première partie pour le centre administrateur.
-- Le serveur stocke une empreinte HMAC ; ni identifiant de session brut, ni IP, email ou user-agent.

CREATE TABLE IF NOT EXISTS sunupilot_analytics_pageviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  visitor_hash CHAR(64) NOT NULL,
  page_path VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sunupilot_pageviews_created (created_at),
  KEY idx_sunupilot_pageviews_visitor_created (visitor_hash, created_at),
  KEY idx_sunupilot_pageviews_path_created (page_path, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
