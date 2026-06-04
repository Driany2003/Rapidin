import { Router } from 'express';
import { validateUUID } from '../../../middleware/validations.js';
import { uploadVoucher } from '../../../middleware/upload.js';
import { successResponse, errorResponse } from '../../../utils/responses.js';
import { logger } from '../../../utils/logger.js';
import {
  listBySolicitud,
  createEvidencia,
  deleteEvidencia,
  createMultiplesEvidencias,
} from '../../services/evidencias/miautoEvidenciaFleetService.js';

const router = Router();

router.get('/solicitudes/:id/evidencias-fleet', validateUUID, async (req, res) => {
  try {
    const list = await listBySolicitud(req.params.id);
    return successResponse(res, list);
  } catch (error) {
    logger.error('Error listando evidencias fleet:', error);
    return errorResponse(res, error.message || 'Error al listar evidencias', 500);
  }
});

router.post(
  '/solicitudes/:id/evidencias-fleet',
  validateUUID,
  uploadVoucher.array('files', 20),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return errorResponse(res, 'Al menos un archivo es requerido', 400);
      }
      const cuotaSemanalId = req.body.cuota_semanal_id || null;
      const results = await createMultiplesEvidencias(req.params.id, cuotaSemanalId, req.files, req.user?.id);
      const errors = results.filter((r) => r.error);
      if (errors.length === results.length) {
        return errorResponse(res, 'No se pudo subir ningún archivo', 500);
      }
      const created = results.filter((r) => !r.error);
      return successResponse(
        res,
        created,
        errors.length > 0
          ? `${created.length} archivo(s) subido(s), ${errors.length} error(es)`
          : `${created.length} archivo(s) subido(s) correctamente`,
        201
      );
    } catch (error) {
      logger.error('Error subiendo evidencias fleet:', error);
      return errorResponse(res, error.message || 'Error al subir evidencias', 400);
    }
  }
);

router.delete(
  '/solicitudes/:id/evidencias-fleet/:evId',
  validateUUID,
  async (req, res) => {
    try {
      const ok = await deleteEvidencia(req.params.evId, req.params.id);
      if (!ok) {
        return errorResponse(res, 'Evidencia no encontrada', 404);
      }
      return successResponse(res, null, 'Evidencia eliminada');
    } catch (error) {
      logger.error('Error eliminando evidencia fleet:', error);
      return errorResponse(res, error.message || 'Error al eliminar evidencia', 500);
    }
  }
);

export default router;
