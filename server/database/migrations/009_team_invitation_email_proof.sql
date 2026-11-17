-- Migration 009 : preuve indépendante de possession de l'adresse email pour les invitations classiques d'équipe.
-- Le jeton brut ne quitte que le message chiffré de l'outbox ; MySQL conserve son SHA-256.
CREATE TABLE IF NOT EXISTS pro_team_invitation_verifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invitation_id INT UNSIGNED NOT NULL,
  member_user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_team_invitation_verification (invitation_id),
  UNIQUE KEY uk_team_invitation_verification_token (token_hash),
  KEY idx_team_invitation_verification_member (member_user_id, expires_at, used_at),
  CONSTRAINT fk_team_invitation_verification_invitation
    FOREIGN KEY (invitation_id) REFERENCES pro_team_invitations(id) ON DELETE CASCADE,
  CONSTRAINT fk_team_invitation_verification_member
    FOREIGN KEY (member_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
