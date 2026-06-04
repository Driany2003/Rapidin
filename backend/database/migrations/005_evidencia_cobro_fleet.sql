-- ============================================================
-- Migración 005: Tabla de evidencias de cobro fleet
-- ============================================================

CREATE TABLE IF NOT EXISTS module_miauto_evidencia_cobro_fleet (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    solicitud_id UUID NOT NULL REFERENCES module_miauto_solicitud(id) ON DELETE CASCADE,
    cuota_semanal_id UUID REFERENCES module_miauto_cuota_semanal(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES module_rapidin_users(id)
);

CREATE INDEX IF NOT EXISTS idx_miauto_ef_solicitud ON module_miauto_evidencia_cobro_fleet(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_miauto_ef_cuota ON module_miauto_evidencia_cobro_fleet(cuota_semanal_id);
