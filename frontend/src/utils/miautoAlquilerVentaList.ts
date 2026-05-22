/** Filtro `cuota_estado` en GET /miauto/alquiler-venta (subconsulta agregada de cuotas semanales). */
export const ALQUILER_VENTA_CUOTA_ESTADO_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'vencido', label: 'Con mora (cuotas vencidas)' },
  { value: 'pendiente', label: 'Con cuota pendiente (aún no vencida)' },
  { value: 'al_dia', label: 'Al día (sin vencidas, con cuotas)' },
  { value: 'sin_cuotas', label: 'Sin cuotas en sistema' },
];

/** Respuesta de GET /miauto/alquiler-venta (listado Alquiler/Venta). */
export interface AlquilerVentaListItem {
  id: string;
  dni: string;
  status: string;
  created_at: string;
  fecha_inicio_cobro_semanal: string;
  driver_name?: string;
  phone?: string;
  email?: string;
  cronograma_name?: string;
  vehiculo_name?: string;
  placa_asignada?: string;
  license_number?: string;
  cuotas_semanales_plan?: number;
  total_cuotas: number;
  cuotas_pagadas: number;
  cuotas_vencidas: number;
  total_pagado: number;
  total_pagado_pen?: number;
  total_pagado_usd?: number;
  /** Moneda dominante de las cuotas reales (o cronograma si no hay cuotas). */
  moneda?: 'USD' | 'PEN';
}

export function conductorDisplay(row: AlquilerVentaListItem): string {
  if (row.driver_name) return row.driver_name;
  if (row.phone) return `Tel: ${row.phone}`;
  if (row.email) return row.email;
  return '—';
}

/** Normaliza moneda de cuota (BD / API) a PEN o USD. */
export function monedaCuotasLabel(moneda?: string | null): 'USD' | 'PEN' {
  const u = String(moneda ?? '')
    .trim()
    .toUpperCase();
  return u === 'USD' ? 'USD' : 'PEN';
}

/** Símbolo $ o S/. según moneda de la cuota (misma regla que `monedaCuotasLabel`). */
export function symMoneda(moneda?: string | null): string {
  return monedaCuotasLabel(moneda) === 'USD' ? '$' : 'S/.';
}

/** Total pagado en cuotas semanales con prefijo de moneda dominante. */
export function formatTotalPagadoList(row: AlquilerVentaListItem): string {
  const pen = row.total_pagado_pen ?? 0;
  const usd = row.total_pagado_usd ?? 0;
  const moneda = row.moneda ?? 'PEN';
  if (moneda === 'USD' && usd > 0) return `$ ${usd.toFixed(2)}`;
  if (moneda === 'PEN' && pen > 0) return `S/. ${pen.toFixed(2)}`;
  if (usd > 0) return `$ ${usd.toFixed(2)}`;
  return `S/. ${pen.toFixed(2)}`;
}
