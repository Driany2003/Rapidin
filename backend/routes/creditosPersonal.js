import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { filterByCountry } from '../middleware/permissions.js';
import { uploadVoucher } from '../middleware/upload.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/responses.js';
import { logger } from '../utils/logger.js';
import {
  fetchYegoUsers,
  createCreditoPersonal,
  getCreditoPersonalById,
  listCreditosPersonales,
  addDocumentoCredito,
} from '../services/creditosPersonalService.js';

const router = express.Router();

router.use(verifyToken);
router.use(filterByCountry);

router.get('/usuarios', async (req, res) => {
  try {
    const users = await fetchYegoUsers();
    return successResponse(res, users);
  } catch (error) {
    logger.error('Error obteniendo usuarios Yego:', error);
    return errorResponse(res, error.message, 500);
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, page, limit, q } = req.query;
    const result = await listCreditosPersonales({ status, page, limit, q });
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    return paginatedResponse(res, result.data, pageNum, limitNum, result.total);
  } catch (error) {
    logger.error('Error listando créditos personal:', error);
    return errorResponse(res, error.message, 500);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const credito = await getCreditoPersonalById(req.params.id);
    if (!credito) return errorResponse(res, 'Crédito no encontrado', 404);
    return successResponse(res, credito);
  } catch (error) {
    logger.error('Error obteniendo crédito personal:', error);
    return errorResponse(res, error.message, 500);
  }
});

router.post('/', async (req, res) => {
  try {
    const credito = await createCreditoPersonal(req.body, req.user?.id);
    return successResponse(res, credito, 'Crédito personal creado', 201);
  } catch (error) {
    logger.error('Error creando crédito personal:', error);
    return errorResponse(res, error.message, 400);
  }
});

router.post('/:id/documentos', uploadVoucher.single('file'), async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 'Archivo requerido', 400);
    const filePath = req.file.path || req.file.location || '';
    const fileName = req.file.originalname || req.file.filename || 'documento';
    await addDocumentoCredito(req.params.id, fileName, filePath);
    return successResponse(res, { fileName, filePath }, 'Documento subido', 201);
  } catch (error) {
    logger.error('Error subiendo documento crédito:', error);
    return errorResponse(res, error.message, 400);
  }
});

export default router;
