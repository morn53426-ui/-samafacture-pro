-- SamaFacture Pro — migration idempotence HTTP (étapes 30-41)
-- L'application applique également ces extensions automatiquement via server/config/db.js.
-- À exécuter manuellement seulement si vous gérez les migrations SQL séparément.

ALTER TABLE factures ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);
ALTER TABLE paiements ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);

ALTER TABLE factures ADD UNIQUE INDEX uk_factures_user_idempotency (user_id, idempotency_key);
ALTER TABLE paiements ADD UNIQUE INDEX uk_paiements_user_idempotency (user_id, idempotency_key);
