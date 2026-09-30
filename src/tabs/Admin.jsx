import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { indexFace } from '../lib/faceApi';
import { supabase } from '../lib/supabaseClient';
import { getDate } from '../lib/dateUtils';
import { horaAFraccionDia, JORNADA_INICIO, JORNADA_MINUTOS, GRACIA_MIN } from '../lib/descuentoUtils';
import PhotoCapture from '../components/PhotoCapture';

function AdminLogin() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError('Correo o contraseña incorrectos.');
  };

  return (
    <form className="card" style={{ textAlign: 'center', padding: '30px 20px' }} onSubmit={handleSubmit}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Panel Admin</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>Inicia sesión para continuar</div>
      <input
        type="email"
        placeholder="Correo"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="username"
        required
      />
      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
      />
      <button className="btn btn-p" type="submit" disabled={loading}>
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
      {error && <div className="al al-e" style={{ display: 'block', marginTop: 8 }}>{error}</div>}
    </form>
  );
}

const COLOR_PALETTE = ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#00ACC1', '#F4511E', '#FFB300', '#6D4C41', '#00897B'];

function getNextColor(sups) {
  const used = sups.map((s) => s.color);
  const available = COLOR_PALETTE.filter((c) => !used.includes(c));
  return available.length > 0 ? available[0] : COLOR_PALETTE[sups.length % COLOR_PALETTE.length];
}

function SupervisorForm({ sups, onDone, onCancel }) {
  const [nombre, setNombre] = useState('');
  const [area, setArea] = useState(null);
  const [foto, setFoto] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    const nombreTrim = nombre.trim();
    if (!nombreTrim) return setError('Escribe el nombre del supervisor.');
    if (!area) return setError('Selecciona el área: Fábrica u Obra.');
    if (!foto) return setError('Toma una foto del supervisor.');
    setError('');
    setSaving(true);
    const color = getNextColor(sups);
    const { data, error: insErr } = await supabase
      .from('supervisores')
      .insert({ nombre: nombreTrim, color, area, foto, face_id: null })
      .select()
      .single();
    if (insErr) {
      setSaving(false);
      setError('Error guardando supervisor: ' + insErr.message);
      return;
    }
    const faceId = await indexFace(foto, 'sup_' + data.id);
    if (faceId) await supabase.from('supervisores').update({ face_id: faceId }).eq('id', data.id);
    setSaving(false);
    onDone();
  };

  return (
    <>
      <button className="btn btn-s" style={{ marginBottom: 12, fontSize: 13 }} onClick={onCancel}>← Volver a lista</button>
      <div className="card-t">Nombre del supervisor</div>
      <input type="text" placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <div className="card-t" style={{ marginTop: 4 }}>Área del supervisor</div>
      <div className="area-grid" style={{ marginBottom: 12 }}>
        <button className={`area-btn${area === 'fabrica' ? ' on' : ''}`} onClick={() => setArea('fabrica')}>
          <span style={{ fontSize: 18 }}>🏭</span>Fábrica $400
        </button>
        <button className={`area-btn${area === 'obra' ? ' on' : ''}`} onClick={() => setArea('obra')}>
          <span style={{ fontSize: 18 }}>🏗️</span>Obra $500
        </button>
      </div>
      <div className="card-t">Foto del supervisor</div>
      {foto ? (
        <div style={{ marginBottom: 8, textAlign: 'center' }}>
          <img src={foto} alt="Supervisor" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent)' }} />
          <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 4 }}>✅ Foto capturada</div>
          <button className="btn btn-s" style={{ fontSize: 13, marginTop: 8 }} onClick={() => setFoto(null)}>📷 Retomar foto</button>
        </div>
      ) : (
        <div style={{ marginBottom: 8 }}>
          <PhotoCapture onCapture={setFoto} label="📷 Tomar foto del supervisor" />
        </div>
      )}
      {error && <div className="al al-e" style={{ display: 'block' }}>{error}</div>}
      {saving ? (
        <div className="load" style={{ display: 'block' }}><div className="spin"></div>Guardando...</div>
      ) : (
        <button className="btn btn-g" onClick={guardar}>✅ Guardar supervisor</button>
      )}
    </>
  );
}

function SupervisoresSection() {
  const { sups, refreshSupervisores } = useAppData();
  const [view, setView] = useState('main'); // main | list | form
  const [confirmId, setConfirmId] = useState(null);
  const [delError, setDelError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const delSup = async (id) => {
    setDeleting(true);
    setDelError('');
    const { error } = await supabase.from('supervisores').delete().eq('id', id);
    setDeleting(false);
    if (error) {
      setDelError('Error eliminando: ' + error.message);
      return;
    }
    setConfirmId(null);
    await refreshSupervisores();
  };

  return (
    <div className="card">
      <div className="admin-h">👥 Supervisores</div>
      {view === 'main' && (
        <button className="btn btn-p" onClick={() => setView('list')}>👥 Ver y gestionar supervisores</button>
      )}
      {view === 'list' && (
        <>
          <button className="btn btn-s" style={{ marginBottom: 12, fontSize: 13 }} onClick={() => setView('main')}>← Volver</button>
          {delError && <div className="al al-e" style={{ display: 'block' }}>{delError}</div>}
          {sups.length === 0 ? (
            <div style={{ padding: 8, color: 'var(--text2)', fontSize: 13 }}>Sin supervisores aún</div>
          ) : (
            sups.map((s) => (
              <div className="sup-list-item" key={s.id} style={{ flexWrap: 'wrap', gap: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: s.color, flexShrink: 0 }}></div>
                <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{s.nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{s.area === 'obra' ? '🏗️ Obra' : '🏭 Fábrica'}</div>
                {confirmId === s.id ? (
                  <>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>¿Eliminar?</span>
                    <button
                      className="btn-del"
                      disabled={deleting}
                      onClick={() => delSup(s.id)}
                    >
                      {deleting ? '...' : 'Sí, eliminar'}
                    </button>
                    <button
                      className="btn btn-s"
                      style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
                      disabled={deleting}
                      onClick={() => setConfirmId(null)}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button className="btn-del" onClick={() => { setConfirmId(s.id); setDelError(''); }}>Eliminar</button>
                )}
              </div>
            ))
          )}
          <button className="btn btn-p" style={{ marginTop: 8 }} onClick={() => setView('form')}>➕ Agregar supervisor</button>
        </>
      )}
      {view === 'form' && (
        <SupervisorForm
          sups={sups}
          onCancel={() => setView('list')}
          onDone={async () => {
            await refreshSupervisores();
            setView('list');
          }}
        />
      )}
    </div>
  );
}

function SueldosSection() {
  const { cfg, refreshConfig } = useAppData();
  const [open, setOpen] = useState(false);
  const [obra, setObra] = useState(cfg.sueldoObra);
  const [fabrica, setFabrica] = useState(cfg.sueldoFabrica);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const abrir = () => {
    setObra(cfg.sueldoObra);
    setFabrica(cfg.sueldoFabrica);
    setMsg('');
    setOpen(true);
  };

  const guardar = async () => {
    setSaving(true);
    const sueldoObra = parseInt(obra, 10) || 500;
    const sueldoFabrica = parseInt(fabrica, 10) || 400;
    const { error } = await supabase
      .from('config')
      .update({ sueldo_obra: sueldoObra, sueldo_fabrica: sueldoFabrica })
      .eq('id', 1);
    setSaving(false);
    if (error) {
      setMsg('Error guardando sueldos: ' + error.message);
      return;
    }
    await refreshConfig();
    setOpen(false);
    setMsg(`✅ Sueldos guardados: Obra $${sueldoObra}, Fábrica $${sueldoFabrica}`);
  };

  return (
    <div className="card">
      <div className="admin-h">💰 Sueldos base</div>
      {!open ? (
        <button className="btn btn-p" onClick={abrir}>💰 Gestionar sueldos</button>
      ) : (
        <>
          <button className="btn btn-s" style={{ marginBottom: 12, fontSize: 13 }} onClick={() => setOpen(false)}>← Volver</button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>🏗️ Obra</div>
              <input type="text" placeholder="500" value={obra} onChange={(e) => setObra(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>🏭 Fábrica</div>
              <input type="text" placeholder="400" value={fabrica} onChange={(e) => setFabrica(e.target.value)} />
            </div>
          </div>
          {saving ? (
            <div className="load" style={{ display: 'block' }}><div className="spin"></div>Guardando...</div>
          ) : (
            <button className="btn btn-g" onClick={guardar}>💾 Guardar sueldos</button>
          )}
        </>
      )}
      {msg && <div className={`al ${msg.startsWith('✅') ? 'al-ok' : 'al-e'}`} style={{ display: 'block', marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

function toPastel(hex) {
  if (!hex || hex === '#888') return 'FFFAFAFA';
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const pr = Math.round(r * 0.2 + 255 * 0.8), pg = Math.round(g * 0.2 + 255 * 0.8), pb = Math.round(b * 0.2 + 255 * 0.8);
  return 'FF' + pr.toString(16).padStart(2, '0').toUpperCase() + pg.toString(16).padStart(2, '0').toUpperCase() + pb.toString(16).padStart(2, '0').toUpperCase();
}

function toMedium(hex) {
  if (!hex || hex === '#888') return 'FFE0E0E0';
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const pr = Math.round(r * 0.45 + 255 * 0.55), pg = Math.round(g * 0.45 + 255 * 0.55), pb = Math.round(b * 0.45 + 255 * 0.55);
  return 'FF' + pr.toString(16).padStart(2, '0').toUpperCase() + pg.toString(16).padStart(2, '0').toUpperCase() + pb.toString(16).padStart(2, '0').toUpperCase();
}

function styleHeaderRow(row, dark) {
  row.height = 20;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: dark ? 'FFFFFFFF' : 'FF2A1F15' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: dark ? 'FF2A1F15' : 'FFE4E0DB' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF6B5240' } } };
  });
}

function downloadWorkbook(wb, filename) {
  return wb.xlsx.writeBuffer().then((buf) => {
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

function ExportSection() {
  const { sups, regsHoy, refreshHistorialHoy } = useAppData();
  const [busy, setBusy] = useState('');

  const exportSheet1 = async () => {
    setBusy('1');
    const { data } = await refreshHistorialHoy();
    const ents = (data || regsHoy).filter((r) => r.hora_entrada);
    if (!ents.length) {
      alert('Sin entradas hoy.');
      setBusy('');
      return;
    }
    const hoy = getDate();
    const ordenados = [...ents].sort((a, b) => {
      const supCompare = (a.supervisor_nombre || 'Sin asignar').localeCompare(b.supervisor_nombre || 'Sin asignar', 'es');
      return supCompare !== 0 ? supCompare : a.nombre.localeCompare(b.nombre, 'es');
    });

    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Lista Eventuales');
    ws.columns = [
      { key: 'no', width: 6 },
      { key: 'nombre', width: 26 },
      { key: 'jefe', width: 20 },
      { key: 'area', width: 14 },
      { key: 'horaE', width: 12 },
      { key: 'sueldo', width: 12 },
      { key: 'minTarde', width: 11 },
      { key: 'estado', width: 12 },
      { key: 'pago', width: 12 },
      { key: 'firma', width: 22 },
    ];

    ws.mergeCells('A1:J1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'Lista Eventuales';
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };

    ws.mergeCells('A2:J2');
    const fechaCell = ws.getCell('A2');
    fechaCell.value = `Fecha: ${hoy}`;
    fechaCell.font = { bold: true, size: 11 };
    ws.addRow([]);

    const headerRow = ws.addRow(['No.', 'Nombre del Empleado', 'Jefe inmediato', 'Área', 'Hora Entrada', 'Sueldo', 'Min. Tarde', 'Estado', 'Pago Final', 'Firma']);
    styleHeaderRow(headerRow, true);

    const dataStartRow = headerRow.number + 1;
    ordenados.forEach((r, i) => {
      const rowNum = dataStartRow + i;
      const row = ws.addRow([
        i + 1,
        r.nombre,
        r.supervisor_nombre || '',
        r.area ? r.area.charAt(0).toUpperCase() + r.area.slice(1) : '',
        '',
        r.sueldo || 0,
        '',
        '',
        '',
        '',
      ]);

      const horaCell = row.getCell(5);
      const fraccion = horaAFraccionDia(r.hora_entrada);
      if (fraccion != null) {
        horaCell.value = fraccion;
        horaCell.numFmt = 'h:mm AM/PM';
      } else {
        horaCell.value = r.hora_entrada || '';
      }

      row.getCell(6).numFmt = '"$"#,##0';

      const minTardeCell = row.getCell(7);
      minTardeCell.value = fraccion != null
        ? { formula: `MAX(0,ROUND((E${rowNum}-TIME(${JORNADA_INICIO.h},${JORNADA_INICIO.m},0))*1440,0))` }
        : 0;

      row.getCell(8).value = { formula: `IF(G${rowNum}<${GRACIA_MIN},"A tiempo","Descuento")` };

      const pagoCell = row.getCell(9);
      pagoCell.value = { formula: `IF(G${rowNum}<${GRACIA_MIN},F${rowNum},MAX(0,FLOOR(F${rowNum}-(G${rowNum}*F${rowNum}/${JORNADA_MINUTOS}),10)))` };
      pagoCell.numFmt = '"$"#,##0';
    });

    const totalRowNum = dataStartRow + ordenados.length;
    const totalRow = ws.addRow(['', '', '', '', '', '', '', '', '', '']);
    totalRow.getCell(5).value = 'TOTAL';
    const totalPagoCell = totalRow.getCell(9);
    totalPagoCell.value = { formula: `SUM(I${dataStartRow}:I${totalRowNum - 1})` };
    totalPagoCell.numFmt = '"$"#,##0';
    totalRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { bold: true, size: 12 };
      cell.border = { top: { style: 'medium', color: { argb: 'FF2A1F15' } } };
    });

    ws.addRow([]);
    ws.addRow([]);
    const resumenTitleRow = ws.addRow(['Resumen por supervisor']);
    resumenTitleRow.getCell(1).font = { bold: true, size: 12 };
    const resumenHeaderRow = ws.addRow(['Supervisor', 'Trabajadores']);
    styleHeaderRow(resumenHeaderRow, false);

    const conteo = {};
    ordenados.forEach((r) => {
      const s = r.supervisor_nombre || 'Sin asignar';
      conteo[s] = (conteo[s] || 0) + 1;
    });
    Object.keys(conteo)
      .sort((a, b) => a.localeCompare(b, 'es'))
      .forEach((sup) => {
        ws.addRow([sup, conteo[sup]]);
      });

    await downloadWorkbook(wb, `umma_lista_eventuales_${hoy.replace(/\//g, '-')}.xlsx`);
    setBusy('');
  };

  const exportSheet2 = async () => {
    setBusy('2');
    const { data } = await refreshHistorialHoy();
    const ents = (data || regsHoy).filter((r) => r.hora_entrada);
    if (!ents.length) {
      alert('Sin entradas hoy.');
      setBusy('');
      return;
    }
    const hoy = getDate();
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Umma Control';
    wb.created = new Date();
    const ws = wb.addWorksheet('Por Supervisor', { views: [{ showGridLines: false }] });
    ws.columns = [{ key: 'sup', width: 22 }, { key: 'nombre', width: 24 }, { key: 'area', width: 14 }, { key: 'sueldo', width: 12 }, { key: 'foto', width: 36 }];
    styleHeaderRow(ws.addRow(['Supervisor', 'Nombre', 'Área', 'Sueldo', 'Foto']), true);
    const grupos = {};
    ents.forEach((r) => {
      const s = r.supervisor_nombre || 'Sin asignar';
      if (!grupos[s]) grupos[s] = [];
      grupos[s].push(r);
    });
    Object.keys(grupos).forEach((supNombre) => {
      const sup = sups.find((s) => s.nombre === supNombre);
      const supColor = sup?.color || '#888888';
      const pastel = toPastel(supColor);
      const medium = toMedium(supColor);
      grupos[supNombre].forEach((r, i) => {
        const areaLabel = r.area ? r.area.charAt(0).toUpperCase() + r.area.slice(1) : '';
        const fotoUrl = r.foto_entrada || '';
        const row = ws.addRow([i === 0 ? supNombre : '', r.nombre, areaLabel, r.sueldo ? '$' + r.sueldo : '', '']);
        row.height = fotoUrl ? 42 : 15;
        row.eachCell({ includeEmpty: true }, (cell) => {
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
          } catch {
            /* imagen corrupta, se omite */
          }
        }
      });
      const sep = ws.addRow(['', '', '', '', '']);
      sep.height = 5;
      sep.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0EDE9' } };
      });
    });
    ws.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
    Object.keys(grupos).filter((s) => s !== 'Sin asignar').forEach((supNombre) => {
      const sup = sups.find((s) => s.nombre === supNombre);
      const supColor = sup?.color || '#888888';
      const pastel = toPastel(supColor);
      const medium = toMedium(supColor);
      const ws2 = wb.addWorksheet(supNombre.substring(0, 31), { views: [{ showGridLines: false }] });
      ws2.columns = [{ key: 'nombre', width: 24 }, { key: 'area', width: 14 }, { key: 'sueldo', width: 12 }, { key: 'foto', width: 36 }];
      ws2.mergeCells('A1:D1');
      const tc = ws2.getCell('A1');
      tc.value = 'Supervisor: ' + supNombre + '   |   ' + hoy;
      tc.font = { bold: true, size: 13, color: { argb: 'FF2A1F15' } };
      tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: medium } };
      tc.alignment = { horizontal: 'center', vertical: 'middle' };
      ws2.getRow(1).height = 26;
      styleHeaderRow(ws2.addRow(['Nombre', 'Área', 'Sueldo', 'Foto']), true);
      let total = 0;
      grupos[supNombre].forEach((r) => {
        const fotoUrl = r.foto_entrada || '';
        total += Number(r.sueldo || 0);
        const row = ws2.addRow([r.nombre, r.area ? r.area.charAt(0).toUpperCase() + r.area.slice(1) : '', r.sueldo ? '$' + r.sueldo : '', '']);
        row.height = fotoUrl ? 42 : 15;
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pastel } };
          cell.font = { size: 10, color: { argb: 'FF1A1A1A' } };
          cell.alignment = { vertical: 'middle' };
          cell.border = { bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } } };
        });
        if (fotoUrl) {
          try {
            const imgId = wb.addImage({ base64: fotoUrl, extension: 'jpeg' });
            ws2.addImage(imgId, { tl: { col: 3.1, row: row.number - 1 + 0.08 }, ext: { width: 42, height: 52 } });
          } catch {
            /* imagen corrupta, se omite */
          }
        }
      });
      const tot = ws2.addRow(['TOTAL', '', '$' + total, '']);
      tot.height = 18;
      tot.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { bold: true, size: 11, color: { argb: 'FF2A1F15' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: medium } };
        cell.border = { top: { style: 'medium', color: { argb: 'FF2A1F15' } } };
        cell.alignment = { vertical: 'middle' };
      });
      tot.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
      ws2.views = [{ state: 'frozen', ySplit: 2, showGridLines: false }];
    });
    await downloadWorkbook(wb, `umma_supervisores_${hoy.replace(/\//g, '-')}.xlsx`);
    setBusy('');
  };

  return (
    <div className="card">
      <div className="admin-h">📊 Exportar</div>
      <button className="btn btn-s" style={{ marginBottom: 8 }} onClick={exportSheet1} disabled={!!busy}>
        {busy === '1' ? 'Generando...' : '📥 Excel 1 — Lista Eventuales'}
      </button>
      <button className="btn btn-s" onClick={exportSheet2} disabled={!!busy}>
        {busy === '2' ? 'Generando...' : '📥 Excel 2 — Por supervisor'}
      </button>
    </div>
  );
}

function SistemaSection() {
  const [msg, setMsg] = useState('');
  return (
    <div className="card">
      <div className="admin-h">⚠️ Sistema</div>
      <button
        className="btn btn-s"
        style={{ marginBottom: 8 }}
        onClick={() => setMsg('✅ Ya no es necesario: con Supabase, las fotos no se acumulan en este celular — viven en la base de datos en la nube.')}
      >
        🧹 Limpiar fotos antiguas
      </button>
      <button
        className="btn btn-r"
        onClick={() => setMsg('Para borrar el historial completo, hazlo desde el panel de Supabase (Table Editor → historial → eliminar filas). Esto evita borrados accidentales desde el celular.')}
      >
        🗑️ Resetear app
      </button>
      {msg && <div className="al al-w" style={{ display: 'block', marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

function AdminPanel() {
  const { signOut } = useAuth();
  return (
    <>
      <SupervisoresSection />
      <SueldosSection />
      <ExportSection />
      <SistemaSection />
      <button className="btn btn-s" onClick={signOut}>🔒 Salir del panel admin</button>
    </>
  );
}

export default function Admin() {
  const { isAdmin, authReady } = useAuth();
  if (!authReady) return null;
  return isAdmin ? <AdminPanel /> : <AdminLogin />;
}
