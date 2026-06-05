/**
 * Script: actualizar driver_id_fleet para todas las solicitudes Mi Auto.
 * Recorre module_miauto_solicitud y resuelve el contractor_id desde la API de Yango.
 *
 * Uso: node backend/scripts/miauto-sync-driver-id-fleet.js
 */
import { query } from '../config/database.js';
import { resolveFleetDriverIdFromDni } from '../yego_miauto/services/utils/miautoDriverLookup.js';

const DELAY_MS = 800; // pausa entre llamadas a la API para no saturar

async function main() {
  const { rows } = await query(
    `SELECT id, dni, placa_asignada, driver_id_fleet
     FROM module_miauto_solicitud
     WHERE dni IS NOT NULL AND TRIM(dni) <> ''
     ORDER BY created_at DESC`
  );
  console.log(`Total solicitudes con DNI: ${rows.length}`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    const cleanDni = (row.dni || '').replace(/\D/g, '');
    if (!cleanDni) {
      skipped++;
      continue;
    }
    try {
      const newId = await resolveFleetDriverIdFromDni(cleanDni);
      if (newId && newId !== row.driver_id_fleet) {
        await query(
          'UPDATE module_miauto_solicitud SET driver_id_fleet = $1 WHERE id = $2',
          [newId, row.id]
        );
        console.log(`  [OK] ${row.placa_asignada || row.id} | DNI ${cleanDni} → ${newId}`);
        updated++;
      } else if (newId) {
        console.log(`  [=] ${row.placa_asignada || row.id} | DNI ${cleanDni} → ${newId} (sin cambios)`);
        skipped++;
      } else {
        console.log(`  [--] ${row.placa_asignada || row.id} | DNI ${cleanDni} → NO ENCONTRADO`);
        errors++;
      }
    } catch (e) {
      console.log(`  [ERR] ${row.placa_asignada || row.id} | DNI ${cleanDni}: ${e.message}`);
      errors++;
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log(`\nResumen: ${updated} actualizados | ${skipped} sin cambios | ${errors} errores`);
  process.exit(0);
}

main();
