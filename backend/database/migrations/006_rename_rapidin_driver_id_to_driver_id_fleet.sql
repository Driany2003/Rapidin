-- ============================================================
-- Migración 006: Renombrar rapidin_driver_id → driver_id_fleet
-- ============================================================

ALTER TABLE module_miauto_solicitud RENAME COLUMN rapidin_driver_id TO driver_id_fleet;
ALTER TABLE module_miauto_solicitud ALTER COLUMN driver_id_fleet TYPE TEXT;
