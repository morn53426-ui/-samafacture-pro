-- SamaFacture Pro — migration de stabilisation 2026-08-30
-- Cette migration est également reproduite de façon idempotente dans server/config/db.js
-- afin d'être appliquée automatiquement au démarrage.
-- À exécuter manuellement uniquement si vous utilisez un processus de migration externe.

-- Anciennes installations : abonnement_paiements peut ne pas avoir internal_reference.
ALTER TABLE abonnement_paiements
  ADD COLUMN IF NOT EXISTS internal_reference VARCHAR(64) NOT NULL DEFAULT '' AFTER reference;

UPDATE abonnement_paiements
SET internal_reference = reference
WHERE (internal_reference IS NULL OR internal_reference = '') AND reference IS NOT NULL;

ALTER TABLE abonnement_paiements
  ADD INDEX idx_abonnement_paiements_internal_reference (internal_reference);

-- Anciennes installations : index nécessaire pour les recherches de réinitialisation.
ALTER TABLE users
  ADD INDEX idx_users_reset_token_hash (reset_token_hash);
