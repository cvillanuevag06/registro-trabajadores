export const JORNADA_INICIO = { h: 7, m: 15 };
export const JORNADA_MINUTOS = 570; // 9.5 horas pagadas (7:15 a 17:30 menos 45 min de comida sin pago)
export const GRACIA_MIN = 15; // hasta las 7:30 no se descuenta nada; de ahí en adelante se cobra cualquier minuto

function parseHora(horaStr) {
  const m = /(\d{1,2}):(\d{2})\s*([ap])/i.exec(horaStr || '');
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const isPM = m[3].toLowerCase() === 'p';
  if (isPM && h !== 12) h += 12;
  if (!isPM && h === 12) h = 0;
  return { h, m: min };
}

// Fracción del día (0-1) para escribir Hora Entrada como celda de hora real en Excel.
export function horaAFraccionDia(horaStr) {
  const t = parseHora(horaStr);
  return t ? (t.h * 60 + t.m) / 1440 : null;
}

// Minutos tarde a partir de un hora_entrada ya guardado (sirve para recalcular registros pasados).
export function getMinutosTardeDeHora(horaStr) {
  const t = parseHora(horaStr);
  if (!t) return 0;
  const diff = (t.h * 60 + t.m) - (JORNADA_INICIO.h * 60 + JORNADA_INICIO.m);
  return diff > 0 ? diff : 0;
}

// Minutos tarde en el momento actual (para feedback inmediato al registrar la entrada).
export function getMinutosTarde() {
  const now = new Date();
  const inicio = new Date(now);
  inicio.setHours(JORNADA_INICIO.h, JORNADA_INICIO.m, 0, 0);
  const diff = Math.round((now - inicio) / 60000);
  return diff > 0 ? diff : 0;
}

export function getDescuentoEstado(minutosTarde) {
  return minutosTarde < GRACIA_MIN ? 'na' : 'cobrar';
}

export function calcPagoFinal(sueldo, minutosTarde) {
  if (!sueldo) return 0;
  if (minutosTarde < GRACIA_MIN) return sueldo;
  const pago = sueldo - (minutosTarde * sueldo) / JORNADA_MINUTOS;
  return Math.floor(Math.max(0, pago) / 10) * 10;
}

export const RETARDO_LABEL = {
  na: 'A tiempo',
  cobrar: 'Descuento',
};
