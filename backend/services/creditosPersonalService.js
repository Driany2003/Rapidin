import axios from 'axios';
import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

const YEGO_USERS_API = 'https://api-gestion.yego.pro/api/users';

export async function fetchYegoUsers() {
  try {
    const response = await axios.get(YEGO_USERS_API, {
      params: { pageSize: 500, status: 'active' },
      timeout: 15000,
    });
    const users = response.data?.data?.data || [];
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      dni: u.dni,
      documentType: u.documentType,
      phone: u.phone,
      role: u.role,
      areaName: u.area?.name || null,
    }));
  } catch (err) {
    logger.error('Error fetching Yego users:', err.message);
    throw new Error('No se pudo obtener la lista de usuarios de Yego');
  }
}

export async function createCreditoPersonal(data, userId) {
  const {
    user_gestion_id, first_name, last_name, dni, document_type,
    email, phone, role, amount, number_of_installments,
    interest_rate = 7.00, payment_frequency = 'monthly',
  } = data;

  const totalAmount = amount * (1 + interest_rate / 100);
  const installmentAmount = totalAmount / number_of_installments;

  const result = await query(
    `INSERT INTO module_rapidin_creditos_personal
     (user_gestion_id, first_name, last_name, dni, document_type, email, phone, role,
      amount, total_amount, interest_rate, number_of_installments, payment_frequency,
      pending_balance, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id`,
    [user_gestion_id, first_name, last_name, dni, document_type, email, phone, role,
     amount, totalAmount, interest_rate, number_of_installments, payment_frequency,
     totalAmount, userId]
  );

  const creditoId = result.rows[0].id;

  for (let i = 1; i <= number_of_installments; i++) {
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + i);
    await query(
      `INSERT INTO module_rapidin_creditos_personal_cuotas
       (credito_id, installment_number, installment_amount, due_date)
       VALUES ($1, $2, $3, $4)`,
      [creditoId, i, installmentAmount, dueDate.toISOString().slice(0, 10)]
    );
  }

  return getCreditoPersonalById(creditoId);
}

export async function getCreditoPersonalById(id) {
  const r = await query(
    'SELECT * FROM module_rapidin_creditos_personal WHERE id = $1',
    [id]
  );
  if (r.rows.length === 0) return null;
  const credito = r.rows[0];

  const cuotas = await query(
    `SELECT * FROM module_rapidin_creditos_personal_cuotas
     WHERE credito_id = $1 ORDER BY installment_number`,
    [id]
  );
  credito.cuotas = cuotas.rows;

  const docs = await query(
    `SELECT * FROM module_rapidin_creditos_personal_docs
     WHERE credito_id = $1 ORDER BY created_at DESC`,
    [id]
  );
  credito.documentos = docs.rows;

  return credito;
}

export async function listCreditosPersonales(filters = {}) {
  const { status, page = 1, limit = 20, q } = filters;
  const params = [];
  let n = 1;
  let where = ' WHERE 1=1';
  if (status) {
    where += ` AND status = $${n}`;
    params.push(status);
    n++;
  }
  if (q) {
    const tok = `%${q.toLowerCase()}%`;
    where += ` AND (LOWER(first_name || ' ' || last_name) LIKE $${n} OR LOWER(dni) LIKE $${n})`;
    params.push(tok);
    n++;
  }

  const countRes = await query(
    `SELECT COUNT(*)::int AS total FROM module_rapidin_creditos_personal ${where}`,
    params
  );
  const total = countRes.rows[0]?.total ?? 0;

  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (Math.max(1, parseInt(page) || 1) - 1) * limitNum;

  const data = await query(
    `SELECT * FROM module_rapidin_creditos_personal ${where}
     ORDER BY created_at DESC LIMIT $${n} OFFSET $${n + 1}`,
    [...params, limitNum, offset]
  );

  return { data: data.rows, total };
}

export async function addDocumentoCredito(creditoId, fileName, filePath) {
  await query(
    `INSERT INTO module_rapidin_creditos_personal_docs (credito_id, type, file_name, file_path)
     VALUES ($1, 'compromiso_pago', $2, $3)`,
    [creditoId, fileName, filePath]
  );
}
