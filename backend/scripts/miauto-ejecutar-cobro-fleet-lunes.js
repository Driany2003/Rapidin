/**
 * Ejecuta el cobro Fleet de Yego Mi Auto (mismo job del lunes 7:10 Lima).
 * Cobra todas las cuotas pendientes/vencidas de todas las solicitudes activas.
 * Uso: node scripts/miauto-ejecutar-cobro-fleet-lunes.js
 */
import 'dotenv/config';
import { getCuotasToCharge } from '../services/miautoCuotaSemanalService.js';
import { runFleetCobroSoloSolicitud } from '../jobs/miautoWeeklyCharge.js';
import { appendMiautoFleetCobroJobAuditEvent } from '../utils/miautoFleetCobroAuditLog.js';

console.log('=== Cobro Fleet Yego Mi Auto (job lunes 7:10) ===');

await appendMiautoFleetCobroJobAuditEvent({ tipo: 'cobro_job_inicio', job: 'manual_script' });

const { cuotas } = await getCuotasToCharge();
console.log(`Cuotas en cola: ${cuotas.length}`);

if (cuotas.length === 0) {
  console.log('No hay cuotas pendientes de cobro.');
  process.exit(0);
}

// Solicitudes únicas con cuotas pendientes
const solicitudIds = [...new Set(cuotas.map((c) => String(c.solicitud_id)))];
console.log(`Solicitudes a cobrar: ${solicitudIds.length}`);

let success = 0, partial = 0, failed = 0;

for (const sid of solicitudIds) {
  const r = await runFleetCobroSoloSolicitud(sid);
  if (r?.success && !r?.partial) success++;
  else if (r?.partial) partial++;
  else failed++;
  console.log(`  [${r?.success ? (r?.partial ? 'PARCIAL' : 'OK') : 'FALLO'}] ${sid}`);
}

await appendMiautoFleetCobroJobAuditEvent({
  tipo: 'cobro_job_fin',
  job: 'manual_script',
  cuotas_en_cola: cuotas.length,
  success,
  partial,
  failed,
});

console.log(`\nResultado: ${success} cobrados | ${partial} parcial | ${failed} fallidos`);
process.exit(failed > 0 ? 1 : 0);
