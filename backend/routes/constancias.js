import express from 'express';
import fs from 'fs';
import { param, validationResult } from 'express-validator';
import { verifyToken } from '../middleware/auth.js';
import { filterByCountry } from '../middleware/permissions.js';
import { uploadVoucher } from '../middleware/upload.js';
import { successResponse, errorResponse } from '../utils/responses.js';
import { logger } from '../utils/logger.js';
import { query } from '../config/database.js';
import { generateConstanciaWord, getEligibleLoans, generateAllConstancias } from '../services/constanciaService.js';
import { uploadConstanciaToMedia } from '../services/voucherService.js';

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

// Subir constancia de préstamo (PDF o imagen)
router.post('/loan/:loanId/upload', validateLoanId, uploadVoucher.single('file'), async (req, res) => {
  try {
    const { loanId } = req.params;
    const file = req.file;

    if (!file) {
      return errorResponse(res, 'No se recibió ningún archivo', 400);
    }

    const loan = await query(
      'SELECT id FROM module_rapidin_loans WHERE id = $1',
      [loanId]
    );
    if (loan.rows.length === 0) {
      return errorResponse(res, 'Préstamo no encontrado', 404);
    }

    const fileUrl = await uploadConstanciaToMedia(file);
    const fileName = file.originalname || `constancia_${loanId}_${Date.now()}.pdf`;

    await query(
      `INSERT INTO module_rapidin_documents (loan_id, type, file_name, file_path)
       VALUES ($1, 'constancia_uploaded', $2, $3)`,
      [loanId, fileName, fileUrl]
    );

    return successResponse(res, { file_url: fileUrl, file_name: fileName }, 'Constancia subida exitosamente');
  } catch (error) {
    logger.error('Error subiendo constancia:', error);
    return errorResponse(res, error.message, 500);
  }
});

// Obtener constancias subidas para un préstamo
router.get('/loan/:loanId/documents', validateLoanId, async (req, res) => {
  try {
    const { loanId } = req.params;
    const docs = await query(
      `SELECT id, loan_id, file_name, file_path, created_at
       FROM module_rapidin_documents
       WHERE loan_id = $1 AND type = 'constancia_uploaded'
       ORDER BY created_at DESC`,
      [loanId]
    );
    return successResponse(res, docs.rows, 'Constancias obtenidas exitosamente');
  } catch (error) {
    logger.error('Error obteniendo constancias subidas:', error);
    return errorResponse(res, error.message, 500);
  }
});

// Obtener constancias subidas para múltiples préstamos (batch)
router.post('/loans/documents', async (req, res) => {
  try {
    const { loan_ids } = req.body;
    if (!Array.isArray(loan_ids) || loan_ids.length === 0) {
      return successResponse(res, {});
    }
    const docs = await query(
      `SELECT id, loan_id, file_name, file_path, created_at
       FROM module_rapidin_documents
       WHERE loan_id = ANY($1::uuid[]) AND type = 'constancia_uploaded'
       ORDER BY created_at DESC`,
      [loan_ids]
    );
    const grouped = {};
    for (const doc of docs.rows) {
      if (!grouped[doc.loan_id]) grouped[doc.loan_id] = [];
      grouped[doc.loan_id].push(doc);
    }
    return successResponse(res, grouped);
  } catch (error) {
    logger.error('Error en batch de constancias:', error);
    return errorResponse(res, error.message, 500);
  }
});

// Eliminar una constancia subida
router.delete('/documents/:docId', async (req, res) => {
  try {
    const { docId } = req.params;
    const doc = await query(
      `SELECT id, loan_id, type FROM module_rapidin_documents
       WHERE id = $1 AND type = 'constancia_uploaded'`,
      [docId]
    );
    if (doc.rows.length === 0) {
      return errorResponse(res, 'Documento no encontrado', 404);
    }
    await query('DELETE FROM module_rapidin_documents WHERE id = $1', [docId]);
    return successResponse(res, { id: docId, loan_id: doc.rows[0].loan_id }, 'Constancia eliminada correctamente');
  } catch (error) {
    logger.error('Error eliminando constancia:', error);
    return errorResponse(res, error.message, 500);
  }
});

export default router;
