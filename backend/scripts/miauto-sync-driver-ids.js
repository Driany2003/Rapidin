import { query } from '../config/database.js';
import { MIAUTO_PARK_ID, normalizePhoneForDriversMatch } from '../yego_miauto/services/miautoDriverLookup.js';

/**
 * Convierte un driver_id de 32 caracteres hexadecimales a formato UUID (8-4-4-4-12).
 */
function fleetDriverIdToUuidText(raw) {
  const compact = String(raw ?? '')
    .trim()
    .replace(/-/g, '')
    .toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(compact)) return null;
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20, 32)}`;
}

async function run() {
  console.log('Iniciando alineación de rapidin_driver_id...');
  
  // 1. Obtener todas las solicitudes de Mi Auto
  const solicitudesRes = await query(
    `SELECT id, phone, rapidin_driver_id 
     FROM module_miauto_solicitud 
     WHERE (phone IS NOT NULL AND phone <> '')`
  );
  
  const solicitudes = solicitudesRes.rows;
  console.log(`Se encontraron ${solicitudes.length} solicitudes para procesar.`);

  let updatedCount = 0;
  let alreadySetCount = 0;
  let notFoundCount = 0;

  for (const sol of solicitudes) {
    // Normalizar el teléfono de la solicitud
    const { last9, with51, digits } = normalizePhoneForDriversMatch(sol.phone);
    if (!last9) {
      notFoundCount++;
      continue;
    }

    // 2. Buscar en la tabla drivers por teléfono y park_id específico
    // El usuario especificó fafd623109d740f8a1f15af7c3dd86c6 (que es MIAUTO_PARK_ID)
    const driverRes = await query(
      `SELECT driver_id 
       FROM drivers 
       WHERE park_id = $1 
         AND (
           REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = $2
           OR REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = $3
           OR RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9) = $4
         )
       LIMIT 1`,
      [MIAUTO_PARK_ID, digits, with51, last9]
    );

    if (driverRes.rows.length > 0) {
      const driver = driverRes.rows[0];
      const uuidText = fleetDriverIdToUuidText(driver.driver_id);

      if (uuidText) {
        if (sol.rapidin_driver_id === uuidText) {
          alreadySetCount++;
          continue;
        }

        // 3. Actualizar la tabla module_miauto_solicitud
        await query(
          `UPDATE module_miauto_solicitud 
           SET rapidin_driver_id = $1::uuid, updated_at = NOW() 
           WHERE id = $2::uuid`,
          [uuidText, sol.id]
        );
        updatedCount++;
        console.log(`[OK] Solicitud ${sol.id} alineada con driver ${uuidText}`);
      } else {
        console.warn(`[WARN] driver_id inválido para el teléfono ${sol.phone}: ${driver.driver_id}`);
        notFoundCount++;
      }
    } else {
      notFoundCount++;
    }
  }

  console.log('\nResumen:');
  console.log(`- Total procesadas: ${solicitudes.length}`);
  console.log(`- Actualizadas: ${updatedCount}`);
  console.log(`- Ya estaban correctas: ${alreadySetCount}`);
  console.log(`- No se encontró driver coincidente: ${notFoundCount}`);
  
  process.exit(0);
}

run().catch(err => {
  console.error('Error durante la ejecución:', err);
  process.exit(1);
});
