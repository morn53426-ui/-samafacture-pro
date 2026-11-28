-- Rollback 014 (non destructif).
-- Arrêtez d'abord les versions applicatives qui écrivent dans pro_audit_events.
-- Les triggers sont retirés, mais les tables, les événements et les têtes de chaîne sont conservés.
-- Ne supprimez jamais ces tables sans export/archivage approuvé et procédure de conservation validée.
DROP TRIGGER IF EXISTS trg_pro_audit_events_block_delete;
DROP TRIGGER IF EXISTS trg_pro_audit_events_block_update;
