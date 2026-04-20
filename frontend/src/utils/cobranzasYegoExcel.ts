import XLSX from 'xlsx-js-style';

export type CobranzasExcelRow = {
  external_driver_id: string;
  amount: number;
  payment_date: string;
  observations?: string;
  sheet_name: string;
  row_in_sheet: number;
  conductor?: string;
};

function normHeader(h: unknown): string {
  return String(h ?? '').trim().replace(/\s+/g, ' ');
}

export function parseCobranzasAmount(val: unknown): number {
  if (val == null || val === '') return NaN;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const s = String(val).trim();
  if (!s) return NaN;
  const n = parseFloat(s.replace(/^S\/\.?\s*/i, '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

const MESES: Record<string, string> = {
  enero: '01', febrero: '02', marzo: '03', abril: '04',
  mayo: '05', junio: '06', julio: '07', agosto: '08',
  septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
};

function parseDateFromSheetName(sheetName: string): string | null {
  const m = /(\d{1,2})\s+al\s+\d{1,2}\s+(?:de\s+)?([a-záéíóú]+)(?:\s+(\d{4}))?/i.exec(sheetName);
  if (!m) return null;
  const mes = MESES[m[2].toLowerCase()];
  if (!mes) return null;
  return `${m[3] || new Date().getFullYear()}-${mes}-${m[1].padStart(2, '0')}`;
}

/**
 * Estructura fija del Excel "Archivo cobranzas YEGO":
 *   Col 0: N°  |  Col 1: driver_id  |  Col 2: Conductor  |  Col 3: Licencia
 *   Col 4: Celular  |  Col 5: Scoring  |  Col 6: Cobro (monto)
 *   Col 7: Cobro YEGO  |  Col 8: Abono YEGO a ANTICIPA  |  Col 9: Notas
 *
 * La fecha de pago se extrae del nombre de la hoja (ej. "Sem del 13 al 19 abril" → 2026-04-13).
 */
export function parseCobranzasYegoWorkbook(
  wb: { SheetNames: string[]; Sheets: Record<string, unknown> },
  sheetNamesFilter?: Set<string>
): { rows: CobranzasExcelRow[]; warnings: string[] } {
  const rows: CobranzasExcelRow[] = [];
  const warnings: string[] = [];

  for (const sheetName of wb.SheetNames) {
    if (sheetNamesFilter && sheetNamesFilter.size > 0 && !sheetNamesFilter.has(sheetName)) continue;
    const sh = wb.Sheets[sheetName];
    if (!sh) continue;

    const matrix = XLSX.utils.sheet_to_json<(string | number)[]>(sh, { header: 1, defval: '', raw: false });
    if (!matrix.length) { warnings.push(`Hoja "${sheetName}": vacía.`); continue; }

    const payment_date = parseDateFromSheetName(sheetName);
    if (!payment_date) {
      warnings.push(`Hoja "${sheetName}": no se pudo extraer la fecha del nombre de hoja. Se omite.`);
      continue;
    }

    const headers = (matrix[0] || []).map(normHeader);
    const idxDriver    = headers.findIndex((h) => h.toLowerCase() === 'driver_id');
    const idxConductor = headers.findIndex((h) => h.toLowerCase() === 'conductor');
    const idxCobro     = headers.findIndex((h) => /^cobro$/i.test(h));
    const idxAbono     = headers.findIndex((h) => /abono yego/i.test(h));
    const idxNotes     = idxAbono >= 0 ? idxAbono + 1 : -1;

    if (idxDriver < 0 || idxCobro < 0) {
      warnings.push(`Hoja "${sheetName}": faltan columnas driver_id o Cobro. Se omite.`);
      continue;
    }

    for (let r = 1; r < matrix.length; r++) {
      const line = matrix[r];
      if (!line?.length) continue;

      const ext = String(line[idxDriver] ?? '').trim().toLowerCase().replace(/-/g, '');
      if (!ext || !/^[0-9a-f]{32}$/.test(ext)) {
        const raw = String(line[idxDriver] ?? '').trim();
        if (raw) warnings.push(`Hoja "${sheetName}" fila ${r + 1}: driver_id no válido (${raw.slice(0, 12)}…).`);
        continue;
      }

      const amount = parseCobranzasAmount(line[idxCobro]);
      if (!Number.isFinite(amount) || amount < 0.01) continue;

      const conductor = idxConductor >= 0 ? String(line[idxConductor] ?? '').trim() || undefined : undefined;
      const notes     = idxNotes >= 0 ? String(line[idxNotes] ?? '').trim() : '';

      const obsParts = ['Cobranzas YEGO', sheetName];
      if (conductor) obsParts.push(conductor);
      if (notes && notes !== '-') obsParts.push(notes);

      rows.push({
        external_driver_id: ext,
        amount,
        payment_date,
        observations: obsParts.join(' · ').slice(0, 2000),
        sheet_name: sheetName,
        row_in_sheet: r + 1,
        conductor,
      });
    }
  }

  return { rows, warnings };
}

export function readCobranzasYegoFile(
  file: File,
  sheetNamesFilter?: Set<string>
): Promise<{ rows: CobranzasExcelRow[]; warnings: string[]; sheetNames: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const { rows, warnings } = parseCobranzasYegoWorkbook(wb, sheetNamesFilter);
        resolve({ rows, warnings, sheetNames: wb.SheetNames });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsArrayBuffer(file);
  });
}
