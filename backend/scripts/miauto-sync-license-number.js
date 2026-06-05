/**
 * Script: sincronizar license_number desde Yango Fleet para todas las solicitudes Mi Auto.
 * Usa la API contractor-profile/contractor-data para obtener la licencia.
 *
 * Uso: node backend/scripts/miauto-sync-license-number.js
 */
import { query } from '../config/database.js';
import { getContractorProfile } from '../services/yangoService.js';

const DELAY_MS = 500;

async function main() {
  const { rows } = await query(
    `SELECT id, placa_asignada, dni, driver_id_fleet
     FROM module_miauto_solicitud
     WHERE driver_id_fleet IS NOT NULL AND TRIM(driver_id_fleet) <> ''
       AND (license_number IS NULL OR TRIM(license_number) = '')
     ORDER BY created_at DESC`
  );
  console.log(`Solicitudes sin license_number: ${rows.length}`);

  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const profile = await getContractorProfile(row.driver_id_fleet);
      if (profile.success && profile.license_number) {
        await query(
          'UPDATE module_miauto_solicitud SET license_number = $1 WHERE id = $2',
          [profile.license_number, row.id]
        );
        console.log(`  [OK] ${row.placa_asignada} | DNI ${row.dni} → ${profile.license_number}`);
        updated++;
      } else {
        console.log(`  [--] ${row.placa_asignada} | DNI ${row.dni} → sin licencia (${profile.error || 'no encontrada'})`);
        errors++;
      }
    } catch (e) {
      console.log(`  [ERR] ${row.placa_asignada} | DNI ${row.dni}: ${e.message}`);
      errors++;
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log(`\nResumen: ${updated} actualizados | ${errors} errores`);
  process.exit(0);
}

main();
