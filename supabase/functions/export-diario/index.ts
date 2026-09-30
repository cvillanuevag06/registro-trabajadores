import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import ExcelJS from "npm:exceljs@4.4.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const JORNADA_INICIO = { h: 7, m: 15 };
const JORNADA_MINUTOS = 570;
const GRACIA_MIN = 15;

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ===== Fecha de "hoy" en zona horaria de Ciudad de México =====
function fechaMexicoCity(): { iso: string; display: string; mes: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;
  const iso = `${y}-${m}-${d}`;
  const display = new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' });
  return { iso, display, mes: `${y}-${m}` };
}

// ===== Helpers de hora (idénticos a los del cliente) =====
function parseHora(horaStr: string | null | undefined): { h: number; m: number } | null {
  const m = /(\d{1,2}):(\d{2})\s*([ap])/i.exec(horaStr || '');
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const isPM = m[3].toLowerCase() === 'p';
  if (isPM && h !== 12) h += 12;
  if (!isPM && h === 12) h = 0;
  return { h, m: min };
}
function horaAFraccionDia(horaStr: string | null | undefined): number | null {
  const t = parseHora(horaStr);
  return t ? (t.h * 60 + t.m) / 1440 : null;
}

// ===== Helpers de color (idénticos a los del cliente) =====
function toPastel(hex: string | null | undefined): string {
  if (!hex || hex === '#888') return 'FFFAFAFA';
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const pr = Math.round(r * 0.2 + 255 * 0.8);
  const pg = Math.round(g * 0.2 + 255 * 0.8);
  const pb = Math.round(b * 0.2 + 255 * 0.8);
  return 'FF' + pr.toString(16).padStart(2, '0').toUpperCase() + pg.toString(16).padStart(2, '0').toUpperCase() + pb.toString(16).padStart(2, '0').toUpperCase();
}
function toMedium(hex: string | null | undefined): string {
  if (!hex || hex === '#888') return 'FFE0E0E0';
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const pr = Math.round(r * 0.45 + 255 * 0.55);
  const pg = Math.round(g * 0.45 + 255 * 0.55);
  const pb = Math.round(b * 0.45 + 255 * 0.55);
  return 'FF' + pr.toString(16).padStart(2, '0').toUpperCase() + pg.toString(16).padStart(2, '0').toUpperCase() + pb.toString(16).padStart(2, '0').toUpperCase();
}
function styleHeaderRow(row: any, dark: boolean) {
  row.height = 20;
  row.eachCell((cell: any) => {
    cell.font = { bold: true, color: { argb: dark ? 'FFFFFFFF' : 'FF2A1F15' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: dark ? 'FF2A1F15' : 'FFE4E0DB' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF6B5240' } } };
  });
}

// ===== Excel 1: Lista Eventuales (réplica exacta de exportSheet1) =====
async function buildListaEventuales(ents: any[], hoyDisplay: string): Promise<Uint8Array> {
  const areaPeso = (a: string) => a === 'fabrica' ? 0 : a === 'obra' ? 1 : 2;
  const ordenados = [...ents].sort((a, b) => {
    const areaCompare = areaPeso(a.area) - areaPeso(b.area);
    if (areaCompare !== 0) return areaCompare;
    const supCompare = (a.supervisor_nombre || 'Sin asignar').localeCompare(b.supervisor_nombre || 'Sin asignar', 'es');
    return supCompare !== 0 ? supCompare : a.nombre.localeCompare(b.nombre, 'es');
  });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Lista Eventuales');
  ws.columns = [
    { key: 'no', width: 6 },
    { key: 'nombre', width: 26 },
    { key: 'jefe', width: 20 },
    { key: 'area', width: 14 },
    { key: 'sueldo', width: 12 },
    { key: 'horaE', width: 12 },
    { key: 'minTarde', width: 11 },
    { key: 'pago', width: 12 },
    { key: 'firma', width: 22 },
  ];
  ws.mergeCells('A1:I1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'Lista Eventuales';
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center' };
  ws.mergeCells('A2:I2');
  const fechaCell = ws.getCell('A2');
  fechaCell.value = `Fecha: ${hoyDisplay}`;
  fechaCell.font = { bold: true, size: 11 };
  ws.addRow([]);
  const headerRow = ws.addRow(['No.', 'Nombre del Empleado', 'Jefe inmediato', 'Área', 'Sueldo Base', 'Hora Entrada', 'Min. Tarde', 'Pago Final', 'Firma']);
  styleHeaderRow(headerRow, true);
  headerRow.eachCell({ includeEmpty: true }, (cell: any) => { cell.border = { ...cell.border, top: { style: 'thin', color: { argb: 'FF000000' } }, left: { style: 'thin', color: { argb: 'FF000000' } }, right: { style: 'thin', color: { argb: 'FF000000' } } }; });
  const dataStartRow = headerRow.number + 1;
  const tableBorder = { style: 'thin', color: { argb: 'FF000000' } };
  ordenados.forEach((r, i) => {
    const rowNum = dataStartRow + i;
    const row = ws.addRow([i + 1, r.nombre, r.supervisor_nombre || '', r.area ? r.area.charAt(0).toUpperCase() + r.area.slice(1) : '', r.sueldo || 0, '', '', '', '']);
    row.height = 30;
    row.eachCell({ includeEmpty: true }, (cell: any) => { cell.border = { top: tableBorder, left: tableBorder, bottom: tableBorder, right: tableBorder }; });
    row.getCell(5).numFmt = '"$"#,##0';
    const horaCell = row.getCell(6);
    const fraccion = horaAFraccionDia(r.hora_entrada);
    if (fraccion != null) { horaCell.value = fraccion; horaCell.numFmt = 'h:mm AM/PM'; } else { horaCell.value = r.hora_entrada || ''; }
    row.getCell(7).value = fraccion != null ? { formula: `MAX(0,ROUND((F${rowNum}-TIME(${JORNADA_INICIO.h},${JORNADA_INICIO.m},0))*1440,0))` } : 0;
    const pagoCell = row.getCell(8);
    pagoCell.value = { formula: `IF(G${rowNum}<${GRACIA_MIN},E${rowNum},MAX(0,FLOOR(E${rowNum}-(G${rowNum}*E${rowNum}/${JORNADA_MINUTOS}),10)))` };
    pagoCell.numFmt = '"$"#,##0';
  });
  const totalRowNum = dataStartRow + ordenados.length;
  const totalRow = ws.addRow(['', '', '', '', '', '', '', '', '']);
  totalRow.getCell(7).value = 'TOTAL';
  const totalPagoCell = totalRow.getCell(8);
  totalPagoCell.value = { formula: `SUM(H${dataStartRow}:H${totalRowNum - 1})` };
  totalPagoCell.numFmt = '"$"#,##0';
  totalRow.eachCell({ includeEmpty: true }, (cell: any) => {
    cell.font = { bold: true, size: 12 };
    cell.border = { top: { style: 'medium', color: { argb: 'FF2A1F15' } } };
  });
  ws.addRow([]);
  ws.addRow([]);
  const resumenTitleRow = ws.addRow(['Resumen por supervisor']);
  resumenTitleRow.getCell(1).font = { bold: true, size: 12 };
  const resumenHeaderRow = ws.addRow(['Supervisor', 'Trabajadores']);
  styleHeaderRow(resumenHeaderRow, false);
  const conteo: Record<string, number> = {};
  ordenados.forEach(r => {
    const s = r.supervisor_nombre || 'Sin asignar';
    conteo[s] = (conteo[s] || 0) + 1;
  });
  Object.keys(conteo)
    .sort((a, b) => a.localeCompare(b, 'es'))
    .forEach(sup => {
      ws.addRow([sup, conteo[sup]]);
    });
  await ws.protect('', { selectLockedCells: true, selectUnlockedCells: true });
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

// ===== Excel 2: Por Supervisor (réplica exacta de exportSheet2) =====
async function buildPorSupervisor(ents: any[], hoyDisplay: string, sups: any[]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Umma Control'; wb.created = new Date();
  const ws = wb.addWorksheet('Por Supervisor', { views: [{ showGridLines: false }] });
  ws.columns = [{ key: 'sup', width: 22 }, { key: 'nombre', width: 24 }, { key: 'area', width: 14 }, { key: 'sueldo', width: 12 }, { key: 'foto', width: 36 }];
  styleHeaderRow(ws.addRow(['Supervisor', 'Nombre', 'Área', 'Sueldo', 'Foto']), true);
  const grupos: Record<string, any[]> = {};
  ents.forEach(r => { const s = r.supervisor_nombre || 'Sin asignar'; if (!grupos[s]) grupos[s] = []; grupos[s].push(r); });
  Object.keys(grupos).forEach(supNombre => {
    const sup = sups.find(s => s.nombre === supNombre);
    const supColor = sup && sup.color ? sup.color : '#888888';
    const pastel = toPastel(supColor);
    const medium = toMedium(supColor);
    grupos[supNombre].forEach((r, i) => {
      const areaLabel = r.area ? r.area.charAt(0).toUpperCase() + r.area.slice(1) : '';
      const fotoUrl = r.foto_entrada || '';
      const row = ws.addRow([i === 0 ? supNombre : '', r.nombre, areaLabel, r.sueldo ? '$' + r.sueldo : '', '']);
      row.height = fotoUrl ? 42 : 15;
      row.eachCell({ includeEmpty: true }, (cell: any) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pastel } };
        cell.font = { size: 10, color: { argb: 'FF1A1A1A' } };
        cell.alignment = { vertical: 'middle' };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } } };
      });
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i === 0 ? medium : pastel } };
      if (i === 0) row.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF1A1A1A' } };
      if (fotoUrl) {
        try {
          const imgId = wb.addImage({ base64: fotoUrl, extension: 'jpeg' });
          ws.addImage(imgId, { tl: { col: 4.1, row: row.number - 1 + 0.08 }, ext: { width: 42, height: 52 } });
        } catch (_e) { /* noop, igual que el cliente */ }
      }
    });
    const sep = ws.addRow(['', '', '', '', '']);
    sep.height = 5;
    sep.eachCell({ includeEmpty: true }, (cell: any) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0EDE9' } }; });
  });
  ws.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
  Object.keys(grupos).filter(s => s !== 'Sin asignar').forEach(supNombre => {
    const sup = sups.find(s => s.nombre === supNombre);
    const supColor = sup && sup.color ? sup.color : '#888888';
    const pastel = toPastel(supColor);
    const medium = toMedium(supColor);
    const ws2 = wb.addWorksheet(supNombre.substring(0, 31), { views: [{ showGridLines: false }] });
    ws2.columns = [{ key: 'nombre', width: 24 }, { key: 'area', width: 14 }, { key: 'sueldo', width: 12 }, { key: 'foto', width: 36 }];
    ws2.mergeCells('A1:D1');
    const tc = ws2.getCell('A1');
    tc.value = 'Supervisor: ' + supNombre + '   |   ' + hoyDisplay;
    tc.font = { bold: true, size: 13, color: { argb: 'FF2A1F15' } };
    tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: medium } };
    tc.alignment = { horizontal: 'center', vertical: 'middle' };
    ws2.getRow(1).height = 26;
    styleHeaderRow(ws2.addRow(['Nombre', 'Área', 'Sueldo', 'Foto']), true);
    let total = 0;
    grupos[supNombre].forEach(r => {
      const fotoUrl = r.foto_entrada || '';
      total += Number(r.sueldo || 0);
      const row = ws2.addRow([r.nombre, r.area ? r.area.charAt(0).toUpperCase() + r.area.slice(1) : '', r.sueldo ? '$' + r.sueldo : '', '']);
      row.height = fotoUrl ? 42 : 15;
      row.eachCell({ includeEmpty: true }, (cell: any) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pastel } };
        cell.font = { size: 10, color: { argb: 'FF1A1A1A' } };
        cell.alignment = { vertical: 'middle' };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } } };
      });
      if (fotoUrl) {
        try {
          const imgId = wb.addImage({ base64: fotoUrl, extension: 'jpeg' });
          ws2.addImage(imgId, { tl: { col: 3.1, row: row.number - 1 + 0.08 }, ext: { width: 42, height: 52 } });
        } catch (_e) { /* noop */ }
      }
    });
    const tot = ws2.addRow(['TOTAL', '', '$' + total, '']);
    tot.height = 18;
    tot.eachCell({ includeEmpty: true }, (cell: any) => {
      cell.font = { bold: true, size: 11, color: { argb: 'FF2A1F15' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: medium } };
      cell.border = { top: { style: 'medium', color: { argb: 'FF2A1F15' } } };
      cell.alignment = { vertical: 'middle' };
    });
    tot.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    ws2.views = [{ state: 'frozen', ySplit: 2, showGridLines: false }];
  });
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ error: 'Supabase service role no configurado' }, 500);
    }

    // Permite forzar una fecha específica vía POST body (para pruebas/reprocesos),
    // si no se especifica usa "hoy" en horario de Ciudad de México.
    let fechaOverride: string | null = null;
    try {
      const body = await req.json();
      if (body && body.fecha) fechaOverride = body.fecha;
    } catch (_e) { /* body vacío, usar fecha de hoy */ }

    const { iso, display, mes } = fechaOverride
      ? { iso: fechaOverride, display: fechaOverride, mes: fechaOverride.slice(0, 7) }
      : fechaMexicoCity();

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const [{ data: historial, error: histErr }, { data: sups, error: supErr }] = await Promise.all([
      sb.from('historial').select('*').eq('fecha', iso).order('created_at', { ascending: true }),
      sb.from('supervisores').select('*'),
    ]);

    if (histErr) return json({ error: 'Error consultando historial', detail: histErr.message }, 500);
    if (supErr) return json({ error: 'Error consultando supervisores', detail: supErr.message }, 500);

    const ents = (historial || []).filter((r: any) => r.hora_entrada);
    if (!ents.length) {
      return json({ ok: true, skipped: true, reason: 'Sin entradas ese día', fecha: iso });
    }

    const buf1 = await buildListaEventuales(ents, display);
    const buf2 = await buildPorSupervisor(ents, display, sups || []);

    const path1 = `${mes}/${iso}_lista-eventuales.xlsx`;
    const path2 = `${mes}/${iso}_por-supervisor.xlsx`;

    const [up1, up2] = await Promise.all([
      sb.storage.from('excels').upload(path1, buf1, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      }),
      sb.storage.from('excels').upload(path2, buf2, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      }),
    ]);

    if (up1.error) return json({ error: 'Error subiendo lista eventuales', detail: up1.error.message }, 500);
    if (up2.error) return json({ error: 'Error subiendo por supervisor', detail: up2.error.message }, 500);

    return json({ ok: true, fecha: iso, registros: ents.length, archivos: [path1, path2] });

  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});
