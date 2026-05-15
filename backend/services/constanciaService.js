import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HeadingLevel, ImageRun } from 'docx';
import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

function formatDateEs(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const month = MONTHS_ES[d.getMonth()];
  const year = d.getFullYear();
  return `${day} de ${month} de ${year}`;
}

function formatDateNumeric(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function getLoanDataForConstancia(loanId) {
  const loanRes = await query(
    `SELECT l.id, l.request_id, l.disbursed_amount, l.total_amount, l.number_of_installments,
            l.disbursed_at, l.first_payment_date, l.status,
            d.first_name, d.last_name, d.dni, d.country
     FROM module_rapidin_loans l
     JOIN module_rapidin_drivers d ON d.id = l.driver_id
     WHERE l.id = $1`,
    [loanId]
  );
  if (loanRes.rows.length === 0) return null;
  const loan = loanRes.rows[0];

  const installmentsRes = await query(
    `SELECT installment_number, installment_amount, due_date
     FROM module_rapidin_installments
     WHERE loan_id = $1
     ORDER BY installment_number ASC`,
    [loanId]
  );
  loan.installments = installmentsRes.rows;

  const sigRes = await query(
    `SELECT file_path FROM module_rapidin_documents
     WHERE type = 'contract_signature'
       AND (loan_id = $1 OR request_id = $2)
     ORDER BY created_at DESC LIMIT 1`,
    [loanId, loan.request_id]
  );
  loan.signatureUrl = sigRes.rows[0]?.file_path || null;

  return loan;
}

export async function generateConstanciaWord(loanId) {
  const loan = await getLoanDataForConstancia(loanId);
  if (!loan) throw new Error('Préstamo no encontrado');

  const driverName = `${loan.first_name || ''} ${loan.last_name || ''}`.trim();
  const cuotaSemanal = loan.installments.length > 0
    ? loan.installments[0].installment_amount
    : (loan.number_of_installments > 0 ? loan.total_amount / loan.number_of_installments : 0);

  let signatureImageBuffer = null;
  if (loan.signatureUrl) {
    try {
      const response = await axios.get(loan.signatureUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
      });
      signatureImageBuffer = Buffer.from(response.data);
    } catch (err) {
      logger.warn(`No se pudo descargar la firma para loan ${loanId}:`, err.message);
    }
  }

  const tableRows = [
    new TableRow({
      children: [
        createHeaderCell('Sem'),
        createHeaderCell('Fecha de pago'),
        createHeaderCell('Cuota'),
      ],
    }),
    ...loan.installments.map((inst) =>
      new TableRow({
        children: [
          createDataCell(String(inst.installment_number), AlignmentType.CENTER),
          createDataCell(formatDateNumeric(inst.due_date)),
          createDataCell(`S/ ${Number(inst.installment_amount).toFixed(2)}`, AlignmentType.RIGHT),
        ],
      })
    ),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1134,
              right: 1134,
              bottom: 1134,
              left: 1134,
            },
          },
        },
        children: [
          new Paragraph({
            spacing: { before: 240 },
            children: [],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 120, before: 240 },
            children: [
              new TextRun({
                text: 'Constancia de préstamo a Socio Conductor',
                bold: true,
                size: 40,
                font: 'Arial',
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 360, before: 0 },
            children: [
              new TextRun({
                text: 'Yego Premium Oro',
                bold: true,
                size: 40,
                font: 'Arial',
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 240, after: 60 },
            children: [
              new TextRun({ text: 'Socio Conductor: ', bold: true, size: 22, font: 'Arial', color: '000000' }),
              new TextRun({ text: driverName, size: 22, font: 'Arial', color: '000000' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: 'ID/DNI: ', bold: true, size: 22, font: 'Arial', color: '000000' }),
              new TextRun({ text: loan.dni || '', size: 22, font: 'Arial', color: '000000' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: 'Fecha de desembolso: ', bold: true, size: 22, font: 'Arial', color: '000000' }),
              new TextRun({ text: formatDateEs(loan.disbursed_at), size: 22, font: 'Arial', color: '000000' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: 'Monto otorgado: ', bold: true, size: 22, font: 'Arial', color: '000000' }),
              new TextRun({ text: `S/ ${Number(loan.disbursed_amount).toFixed(2)}  |  `, size: 22, font: 'Arial', color: '000000' }),
              new TextRun({ text: 'Semanas para pagar: ', bold: true, size: 22, font: 'Arial', color: '000000' }),
              new TextRun({ text: String(loan.number_of_installments), size: 22, font: 'Arial', color: '000000' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({ text: 'Cuota semanal: ', bold: true, size: 22, font: 'Arial', color: '000000' }),
              new TextRun({ text: `S/ ${Number(cuotaSemanal).toFixed(2)}`, size: 22, font: 'Arial', color: '000000' }),
            ],
          }),
          new Paragraph({
            spacing: { before: 360, after: 120 },
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({ text: 'Condiciones', bold: true, size: 32, font: 'Arial', color: '000000' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: '1) El préstamo será pagado en cuotas semanales según cronograma. 2) Los pagos fuera de fecha generan recargos según política vigente. 3) En caso de incumplimiento se podrá reprogramar o suspender nuevos préstamos.',
                size: 22,
                font: 'Arial',
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 360, after: 120 },
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({ text: 'Cronograma de pagos', bold: true, size: 32, font: 'Arial', color: '000000' }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
          new Paragraph({ spacing: { before: 600 }, children: [] }),
          ...(signatureImageBuffer
            ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 80 },
                  children: [
                    new ImageRun({
                      data: signatureImageBuffer,
                      transformation: { width: 180, height: 90 },
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 40 },
                  children: [
                    new TextRun({
                      text: '________________________________________',
                      size: 22,
                      font: 'Arial',
                      color: '000000',
                    }),
                  ],
                }),
              ]
            : [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 80 },
                  children: [
                    new TextRun({
                      text: '________________________________________',
                      size: 22,
                      font: 'Arial',
                      color: '000000',
                    }),
                  ],
                }),
              ]),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({ text: 'Firma del Socio Conductor', bold: true, size: 22, font: 'Arial', color: '000000' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({ text: driverName, size: 22, font: 'Arial', color: '000000' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({ text: `DNI: ${loan.dni || ''}`, size: 22, font: 'Arial', color: '000000' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({ text: `Fecha: ${formatDateNumeric(loan.disbursed_at)}`, size: 22, font: 'Arial', color: '000000' }),
            ],
          }),
        ],
      },
    ],
  });

  const uploadsDir = path.join(__dirname, '../../uploads/constancias');
  ensureDir(uploadsDir);

  const fileName = `constancia_${loanId}_${Date.now()}.docx`;
  const filePath = path.join(uploadsDir, fileName);

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);

  await query(
    `INSERT INTO module_rapidin_documents (loan_id, type, file_name, file_path)
     VALUES ($1, 'constancia', $2, $3)`,
    [loanId, fileName, filePath]
  );

  return { filePath, fileName, buffer };
}

function createHeaderCell(text) {
  return new TableCell({
    width: { size: 33, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({ text, bold: true, size: 22, font: 'Arial', color: '000000' }),
        ],
      }),
    ],
  });
}

function createDataCell(text, alignment = AlignmentType.LEFT) {
  return new TableCell({
    width: { size: 33, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
    },
    children: [
      new Paragraph({
        alignment,
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({ text, size: 22, font: 'Arial', color: '000000' }),
        ],
      }),
    ],
  });
}

export async function getEligibleLoans(filters = {}) {
  const { country, date_from, date_to } = filters;
  const params = [];
  let n = 1;
  let where = ` WHERE l.status = 'active' `;
  if (country) {
    where += ` AND l.country = $${n}`;
    params.push(country);
    n += 1;
  }
  if (date_from) {
    where += ` AND l.disbursed_at::date >= $${n}`;
    params.push(date_from);
    n += 1;
  }
  if (date_to) {
    where += ` AND l.disbursed_at::date <= $${n}`;
    params.push(date_to);
    n += 1;
  }

  const result = await query(
    `SELECT l.id, l.disbursed_amount, l.number_of_installments, l.disbursed_at,
            d.first_name, d.last_name, d.dni
     FROM module_rapidin_loans l
     JOIN module_rapidin_drivers d ON d.id = l.driver_id
     ${where}
     ORDER BY l.disbursed_at DESC`,
    params
  );
  return result.rows;
}

export async function generateAllConstancias(filters = {}) {
  const loans = await getEligibleLoans(filters);
  const results = [];
  for (const loan of loans) {
    try {
      const result = await generateConstanciaWord(loan.id);
      results.push({ loanId: loan.id, success: true, fileName: result.fileName });
    } catch (err) {
      logger.error(`Error generando constancia para loan ${loan.id}:`, err);
      results.push({ loanId: loan.id, success: false, error: err.message });
    }
  }
  return { total: loans.length, results };
}
