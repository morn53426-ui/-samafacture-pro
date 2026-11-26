-- Rollback 015 (non destructif).
-- Arrêtez d'abord les versions applicatives qui écrivent des alertes et activités.
-- Les tables et leur contenu sont conservés. Seules les protections SQL append-only sont retirées.
DROP TRIGGER IF EXISTS trg_pro_security_case_activity_block_delete;
DROP TRIGGER IF EXISTS trg_pro_security_case_activity_block_update;

-- Permet à une prochaine version v26 de rejouer la migration et de recréer les triggers.
UPDATE _samafacture_schema_meta SET version = 25 WHERE id = 1 AND version >= 26;
