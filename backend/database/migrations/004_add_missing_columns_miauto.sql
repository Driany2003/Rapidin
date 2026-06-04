-- ============================================================
-- Yego Rapidín 4.0 — Migración 004: Columnas faltantes en Mi Auto
-- ============================================================

ALTER TABLE module_miauto_cronograma_vehiculo ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE module_miauto_cronograma_rule ADD COLUMN IF NOT EXISTS cobro_saldo NUMERIC DEFAULT 0;
ALTER TABLE module_miauto_cronograma_rule ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
