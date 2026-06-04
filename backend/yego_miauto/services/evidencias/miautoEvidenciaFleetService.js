import { query } from '../../../config/database.js';
import { uploadFileToMedia } from '../../../services/voucherService.js';
import { logger } from '../../../utils/logger.js';

export async function listBySolicitud(solicitudId) {
  const res = await query(
    `SELECT id, solicitud_id, cuota_semanal_id, file_name, file_path, created_at, created_by
     FROM module_miauto_evidencia_cobro_fleet
     WHERE solicitud_id = $1
     ORDER BY created_at DESC`,
    [solicitudId]
  );
  return res.rows;
}

export async function createEvidencia(solicitudId, cuotaSemanalId, file, userId) {
  const prefixedName = `evidencias-fleet/${solicitudId}/${Date.now()}-${file.originalname || 'evidencia'}`;
  const fileWithPrefix = { ...file, originalname: prefixedName };
  const fileUrl = await uploadFileToMedia(fileWithPrefix);

  const res = await query(
    `INSERT INTO module_miauto_evidencia_cobro_fleet (solicitud_id, cuota_semanal_id, file_name, file_path, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, solicitud_id, cuota_semanal_id, file_name, file_path, created_at, created_by`,
    [solicitudId, cuotaSemanalId || null, file.originalname || 'evidencia', fileUrl, userId || null]
  );
  return res.rows[0];
}

export async function deleteEvidencia(evidenciaId, solicitudId) {
  const res = await query(
    `DELETE FROM module_miauto_evidencia_cobro_fleet
     WHERE id = $1 AND solicitud_id = $2
     RETURNING id`,
    [evidenciaId, solicitudId]
  );
  return res.rowCount > 0;
}

export async function createMultiplesEvidencias(solicitudId, cuotaSemanalId, files, userId) {
  const results = [];
  for (const file of files) {
    try {
      const ev = await createEvidencia(solicitudId, cuotaSemanalId, file, userId);
      results.push(ev);
    } catch (err) {
      logger.error('Error subiendo evidencia fleet:', err);
      results.push({ error: err.message, file: file.originalname });
    }
  }
  return results;
}
