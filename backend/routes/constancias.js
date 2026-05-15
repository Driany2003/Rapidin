import express from 'express';
import fs from 'fs';
import { param, validationResult } from 'express-validator';
import { verifyToken } from '../middleware/auth.js';
import { filterByCountry } from '../middleware/permissions.js';
import { successResponse, errorResponse } from '../utils/responses.js';
import { logger } from '../utils/logger.js';
import { query } from '../config/database.js';
import { generateConstanciaWord, getEligibleLoans, generateAllConstancias } from '../services/constanciaService.js';

const router = express.Router();

router.use(verifyToken);
router.use(filterByCountry);

const validateLoanId = [
  param('loanId').isUUID().withMessage('ID de préstamo inválido'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Error de validación', details: errors.array() });
    }
    next();
  },
];

router.get('/loan/:loanId', validateLoanId, async (req, res) => {
  try {
    const result = await generateConstanciaWord(req.params.loanId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    return res.send(result.buffer);
  } catch (error) {
    logger.error('Error generando constancia:', error);
    return errorResponse(res, error.message, 400);
  }
});

router.get('/eligible', async (req, res) => {
  try {
    const { country, date_from, date_to } = req.query;
    const loans = await getEligibleLoans({ country, date_from, date_to });
    return successResponse(res, loans);
  } catch (error) {
    logger.error('Error listando préstamos elegibles para constancia:', error);
    return errorResponse(res, error.message, 500);
  }
});

router.post('/generate-all', async (req, res) => {
  try {
    const { country, date_from, date_to } = req.body;
    const result = await generateAllConstancias({ country, date_from, date_to });
    return successResponse(res, result, `Constancias generadas: ${result.results.filter(r => r.success).length}/${result.total}`);
  } catch (error) {
    logger.error('Error generando constancias en lote:', error);
    return errorResponse(res, error.message, 500);
  }
});

const validateLoanAndDocId = [
  param('loanId').isUUID().withMessage('ID de préstamo inválido'),
  param('docId').isUUID().withMessage('ID de documento inválido'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Error de validación', details: errors.array() });
    }
    next();
  },
];

router.get('/loan/:loanId/file/:docId', validateLoanAndDocId, async (req, res) => {
  try {
    const doc = await query(
      `SELECT file_path, file_name FROM module_rapidin_documents
       WHERE id = $1 AND loan_id = $2 AND type = 'constancia'`,
      [req.params.docId, req.params.loanId]
    );
    if (doc.rows.length === 0) {
      return errorResponse(res, 'Documento no encontrado', 404);
    }
    const { file_path, file_name } = doc.rows[0];
    if (!fs.existsSync(file_path)) {
      return errorResponse(res, 'Archivo no encontrado en disco', 404);
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${file_name}"`);
    return res.sendFile(file_path);
  } catch (error) {
    logger.error('Error sirviendo constancia:', error);
    return errorResponse(res, error.message, 500);
  }
});

export default router;
