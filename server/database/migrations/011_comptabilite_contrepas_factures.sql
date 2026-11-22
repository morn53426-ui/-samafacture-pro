-- Migration 011 : journaliser les contrepassations comptables des annulations/réactivations de factures.
-- Chaque transition possède un identifiant propre ; plusieurs cycles sur une même facture restent possibles.
-- La facture ne peut pas supprimer son historique d'événements par cascade.

CREATE TABLE IF NOT EXISTS pro_compta_facture_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  facture_id INT UNSIGNED NOT NULL,
  transition VARCHAR(20) NOT NULL,
  previous_ecriture_id BIGINT UNSIGNED NOT NULL,
  ecriture_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pro_compta_facture_events (user_id, facture_id, id),
  KEY idx_pro_compta_facture_events_entry (user_id, ecriture_id),
  CONSTRAINT fk_pro_compta_facture_events_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_compta_facture_events_invoice
    FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
