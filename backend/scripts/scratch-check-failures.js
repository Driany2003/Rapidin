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
        SELECT cs.id, 
               COALESCE(rd.first_name || ' ' || rd.last_name, s.id::text) as conductor_nombre, 
               cs.week_start_date, 
               cs.amount_due, cs.late_fee, cs.paid_amount, cs.moneda
        FROM module_miauto_cuota_semanal cs
        JOIN module_miauto_solicitud s ON s.id = cs.solicitud_id
        LEFT JOIN module_rapidin_drivers rd ON rd.id = s.driver_id_fleet
        WHERE cs.id = ANY($1::uuid[])
    `, [ids]);
    
    const report = res.rows.map(row => {
        const failure = failures.find(f => f.id === row.id);
        return {
            conductor: row.conductor_nombre,
            semana: row.week_start_date ? row.week_start_date.toISOString().slice(0,10) : 'N/A',
            pendiente: (Number(row.amount_due) + Number(row.late_fee) - Number(row.paid_amount)).toFixed(2) + ' ' + row.moneda,
            motivo: failure ? failure.reason : 'N/A'
        };
    });
    
    // Agrupar por motivo para mejor lectura
    const summary = report.reduce((acc, item) => {
        if (!acc[item.motivo]) acc[item.motivo] = [];
        acc[item.motivo].push(item);
        return acc;
    }, {});

    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
