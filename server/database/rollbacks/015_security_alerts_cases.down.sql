-- Rollback 015 non destructif : retirer uniquement les triggers d'immuabilité.
-- Les alertes, dossiers et événements de suivi sont conservés.
DROP TRIGGER IF EXISTS trg_pro_security_case_events_block_update;
DROP TRIGGER IF EXISTS trg_pro_security_case_events_block_delete;
