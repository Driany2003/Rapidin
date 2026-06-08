export const getLoanProposalMessage = (driverName, loanAmount, weeklyInstallment, weeks, firstPaymentDate) => {
  return `Hola ${driverName},

Tu solicitud de préstamo ha sido aprobada.

Detalles del préstamo:
- Monto: ${loanAmount}
- Cuota semanal: ${weeklyInstallment}
- Número de semanas: ${weeks}
- Primera cuota: ${firstPaymentDate}

Por favor, revisa los detalles y procede con la firma del contrato.

Saludos,
Equipo Yego Rapidín`;
};

export const getLoanRejectionMessage = (driverName, reason) => {
  return `Hola ${driverName},

Lamentamos informarte que tu solicitud de préstamo ha sido rechazada.

Motivo: ${reason}

Si tienes preguntas, por favor contáctanos.

Saludos,
Equipo Yego Rapidín`;
};

export const getDisbursementMessage = (driverName, amount, date) => {
  return `Hola ${driverName},

Tu préstamo ha sido desembolsado exitosamente.

Monto: ${amount}
Fecha: ${date}

El dinero debería estar disponible en tu cuenta en las próximas horas.

Saludos,
Equipo Yego Rapidín`;
};

export const getPaymentConfirmationMessage = (driverName, amount, reference) => {
  return `Hola ${driverName},

Hemos recibido tu pago.

Monto: ${amount}
Referencia: ${reference}

Gracias por tu pago puntual.

Saludos,
Equipo Yego Rapidín`;
};

export const getPaymentReminderMessage = (driverName, installmentNumber, amount, dueDate) => {
  return `Hola ${driverName},

Recordatorio: Tu cuota #${installmentNumber} está próxima a vencer.

Monto: ${amount}
Fecha de vencimiento: ${dueDate}

Por favor, realiza el pago antes de la fecha de vencimiento para evitar cargos adicionales.

Saludos,
Equipo Yego Rapidín`;
};

export const getOverdueMessage = (driverName, installmentNumber, amount, daysOverdue) => {
  return `Hola ${driverName},

Tu cuota #${installmentNumber} está vencida.

Monto: ${amount}
Días de atraso: ${daysOverdue}

Por favor, realiza el pago lo antes posible para evitar cargos adicionales.

Saludos,
Equipo Yego Rapidín`;
};

const CUENTAS_BANCARIAS_WHATSAPP = `✅ INTERBANK
🔹 Cuenta Corriente - Soles: 200-3007251767
CCI: 003-200-003007251767-32

✅ BCP
🔹 Cuenta Corriente - Soles: 193-7121711-0-73
CCI: 002-19300712171107314`;

export function getMiAutoCuotaVencida(name, cuotasVencidas) {
  const lineas = cuotasVencidas.slice(0, 10).map(c => {
    if (c.mora > 0) {
      return `• ${c.label}: ${c.sym} ${c.pendiente.toFixed(2)} + ${c.sym} ${c.mora.toFixed(2)} mora = ${c.sym} ${c.total.toFixed(2)} total (venció ${c.fecha})`;
    }
    return `• ${c.label}: ${c.sym} ${c.total.toFixed(2)} (venció ${c.fecha})`;
  });
  const mas = cuotasVencidas.length > 10 ? `\n• Y ${cuotasVencidas.length - 10} cuota(s) más.` : '';
  return `Hola ${name},\n\nTienes ${cuotasVencidas.length} cuota(s) vencida(s) en tu contrato Yego Mi Auto:\n\n${lineas.join('\n')}${mas}\n\nPor favor regulariza tu situación lo antes posible. Gracias.\n\n${CUENTAS_BANCARIAS_WHATSAPP}`;
}

export function getMiAutoCuotaDetalle(name, cuota) {
  const { semana, viajes, cuotaSemanal, pf83, cobroDesdeSaldo, pendiente, saldoFavor, sym } = cuota;

  let descuentos = '';
  if (pf83 > 0.01) descuentos += `🔹 Cobro por ingresos (app):    - ${sym} ${pf83.toFixed(2)}\n`;
  if (cobroDesdeSaldo > 0.01) descuentos += `🔹 Cobro desde tu saldo:        - ${sym} ${cobroDesdeSaldo.toFixed(2)}\n`;
  if (descuentos) descuentos += `────────────────────────────────────\n`;

  const cubierto = pendiente <= 0.01;

  if (cubierto) {
    let msg = `Hola ${name},\n\nTe compartimos el resumen de tu semana en Yego Mi Auto - Semana ${semana}:\n\n• ${viajes} viajes | Cuota semanal: ${sym} ${cuotaSemanal.toFixed(2)}\n\nDescuentos aplicados:\n${descuentos}🔸 Cuota neta a pagar:            ${sym} 0.00 ✅\n\n¡Todo cubierto! No tienes pagos pendientes esta semana.`;
    if (saldoFavor > 0.01) msg += `\nSaldo a tu favor: ${sym} ${saldoFavor.toFixed(2)} 🎉`;
    msg += `\n\nCualquier consulta quedamos atentos.\n\n${CUENTAS_BANCARIAS_WHATSAPP}`;
    return msg;
  }

  return `Hola ${name},\n\nTe compartimos el detalle de tu cuota Yego Mi Auto - Semana ${semana}:\n\n• ${viajes} viajes\n• Cuota semanal: ${sym} ${cuotaSemanal.toFixed(2)}\n\nDescuentos aplicados:\n${descuentos}🔸 Cuota neta a pagar:            ${sym} ${pendiente.toFixed(2)}\n\nPendiente por regularizar: ${sym} ${pendiente.toFixed(2)}\n\n${CUENTAS_BANCARIAS_WHATSAPP}`;
}

export function getMiAutoCuotaSimple(name, cuotaSemanal, sym) {
  return `Hola ${name},\n\nRecuerda que hoy se vence tu cuota de Yego Mi Auto:\n\n• Cuota semanal: ${sym} ${cuotaSemanal.toFixed(2)}\n• Sin cobro por ingresos esta semana\n• Sin saldo disponible\n\n🔸 Total a pagar:                ${sym} ${cuotaSemanal.toFixed(2)}\n\nPor favor realiza tu pago a tiempo.\n\n${CUENTAS_BANCARIAS_WHATSAPP}`;
}







