-- Migration 012 : affectation explicite des catégories de dépenses aux comptes de charges.
-- Aucune catégorie ni écriture historique n'est modifiée automatiquement.

CREATE TABLE IF NOT EXISTS pro_compta_affectations_depenses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  categorie_key VARCHAR(100) NOT NULL,
  categorie_label VARCHAR(100) NOT NULL,
  compte_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pro_compta_affectation_depense (user_id, categorie_key),
  KEY idx_pro_compta_affectation_compte (user_id, compte_id),
  CONSTRAINT fk_pro_compta_affectations_depenses_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_compta_affectations_depenses_compte
    FOREIGN KEY (compte_id) REFERENCES pro_compta_comptes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
