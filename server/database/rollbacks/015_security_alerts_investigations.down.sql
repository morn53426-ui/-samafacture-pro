-- Rollback 015 (non destructif).
-- Arrêtez d'abord les versions applicatives qui écrivent des alertes et activités.
-- Les tables et leur contenu sont conservés. Seules les protections SQL append-only sont retirées.
DROP TRIGGER IF EXISTS trg_pro_security_case_activity_block_delete;
DROP TRIGGER IF EXISTS trg_pro_security_case_activity_block_update;
