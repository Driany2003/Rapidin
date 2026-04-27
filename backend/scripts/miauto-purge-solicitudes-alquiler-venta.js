/**
 * Borra solo estas tablas Mi Auto (solicitudes y dependencias), en este orden.
 * No toca cronogramas ni tipo de cambio.
 *
 * Uso:
 *   cd backend && node scripts/miauto-purge-solicitudes-alquiler-venta.js --dry-run
 *   cd backend && node scripts/miauto-purge-solicitudes-alquiler-venta.js --apply
 *
 * Recomendación: backup JSON antes si necesitas recuperar.
 */
import pool, { getClient } from '../config/database.js';

/** Único alcance: hijos de solicitud primero, luego solicitud. */
const TABLAS_EN_ORDEN_BORRADO = [
  'module_miauto_comprobante_cuota_semanal',
  'module_miauto_cuota_semanal',
  'module_miauto_comprobante_pago',
  'module_miauto_comprobante_otros_gastos',
  'module_miauto_adjunto',
  'module_miauto_solicitud_cita',
  'module_miauto_otros_gastos',
  'module_miauto_solicitud',
];

async function tableExists(client, tableName) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    [tableName]
  );
  return (r.rowCount ?? 0) > 0;
}

async function countRows(client, tableName) {
  if (!(await tableExists(client, tableName))) return null;
  const r = await client.query(`SELECT COUNT(*)::bigint AS n FROM ${tableName}`);
  return String(r.rows[0]?.n ?? '0');
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const dry = argv.includes('--dry-run');

  if (!apply && !dry) {
    console.error('Indique --dry-run o --apply');
    process.exit(1);
  }

  const client = await getClient();
  try {
    const countsBefore = {};
    for (const t of TABLAS_EN_ORDEN_BORRADO) {
      countsBefore[t] = await countRows(client, t);
    }

    if (dry) {
      console.log(
        JSON.stringify(
          {
            modo: 'dry-run',
            tablas: TABLAS_EN_ORDEN_BORRADO,
            filas_actuales: countsBefore,
            nota: 'Sin cambios. Use --apply para ejecutar el borrado.',
          },
          null,
          2
        )
      );
      return;
    }

    await client.query('BEGIN');

    const deleted = {};
    for (const t of TABLAS_EN_ORDEN_BORRADO) {
      if (!(await tableExists(client, t))) {
        deleted[t] = 'omitida (tabla no existe)';
        continue;
      }
      const r = await client.query(`DELETE FROM ${t}`);
      deleted[t] = r.rowCount ?? 0;
    }

    await client.query('COMMIT');
    console.log(
      JSON.stringify(
        {
          modo: 'apply',
          tablas: TABLAS_EN_ORDEN_BORRADO,
          filas_antes: countsBefore,
          filas_borradas_delete: deleted,
        },
        null,
        2
      )
    );
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    console.error(e);
    process.exit(1);
  } finally {
    client.release();
  }

  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
