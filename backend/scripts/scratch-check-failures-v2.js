import { query } from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
    const logPath = path.join(__dirname, '..', 'combined.log');
    if (!fs.existsSync(logPath)) {
        console.error("No se encontró combined.log");
        process.exit(1);
    }
    
    const log = fs.readFileSync(logPath, 'utf8');
    const lines = log.split('\n');
    const today = '2026-05-11 11';
    const failures = [];
    for (const line of lines) {
        if (line.includes('falló') && line.includes(today)) {
            try {
                const data = JSON.parse(line);
                const msg = data.message;
                const match = msg.match(/cuota ([^:]+): falló — (.*)/);
                if (match) {
                    failures.push({ id: match[1], reason: match[2] });
                }
            } catch (e) {}
        }
    }
    
    if (failures.length === 0) {
        console.log("No se encontraron fallos en el log para hoy.");
        process.exit(0);
    }
    
    const ids = [...new Set(failures.map(f => f.id))];
    const res = await query(`
        SELECT cs.id as cuota_id, 
               s.id as solicitud_id,
               rd.first_name || ' ' || rd.last_name as nombre_rapidin,
               d.first_name || ' ' || d.last_name as nombre_yango,
               cs.week_start_date, 
               cs.amount_due, cs.late_fee, cs.paid_amount, cs.moneda
        FROM module_miauto_cuota_semanal cs
        JOIN module_miauto_solicitud s ON s.id = cs.solicitud_id
        LEFT JOIN module_rapidin_drivers rd ON rd.id = s.driver_id_fleet
        LEFT JOIN drivers d ON (
            LOWER(REGEXP_REPLACE(d.driver_id::text, '-', '', 'g')) = LOWER(REGEXP_REPLACE(s.driver_id_fleet::text, '-', '', 'g'))
            AND d.park_id = 'fafd623109d740f8a1f15af7c3dd86c6'
        )
        WHERE cs.id = ANY($1::uuid[])
    `, [ids]);
    
    const report = res.rows.map(row => {
        const failure = failures.find(f => f.id === row.cuota_id);
        const nombre = row.nombre_rapidin || row.nombre_yango || null;
        return {
            solicitud_id: row.solicitud_id,
            conductor: nombre,
            semana: row.week_start_date ? row.week_start_date.toISOString().slice(0,10) : 'N/A',
            pendiente: (Number(row.amount_due) + Number(row.late_fee) - Number(row.paid_amount)).toFixed(2) + ' ' + row.moneda,
            motivo: failure ? failure.reason : 'N/A'
        };
    });
    
    const sinNombre = report.filter(r => !r.conductor);
    const conNombre = report.filter(r => r.conductor);

    console.log("=== FALLOS SIN NOMBRE (SOLO ID) ===");
    console.log(JSON.stringify(sinNombre, null, 2));
    
    console.log("\n=== TODOS LOS FALLOS ===");
    console.log(JSON.stringify(report, null, 2));
    
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
