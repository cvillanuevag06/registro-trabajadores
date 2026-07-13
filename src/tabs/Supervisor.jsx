import { useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import { findSupervisorByFace } from '../lib/faceApi';
import { supabase } from '../lib/supabaseClient';
import LivenessCapture from '../components/LivenessCapture';

export default function Supervisor() {
  const { sups, regsHoy, cfg, refreshHistorialHoy } = useAppData();
  const [phase, setPhase] = useState('idle'); // idle | liveness | processing | notfound | assign | success
  const [supActual, setSupActual] = useState(null);
  const [similarity, setSimilarity] = useState(0);
  const [sel, setSel] = useState({});
  const [alertMsg, setAlertMsg] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setPhase('idle');
    setSupActual(null);
    setSimilarity(0);
    setSel({});
    setAlertMsg('');
    setMsg('');
  };

  const handleLivenessSuccess = async (img) => {
    setPhase('processing');
    const match = await findSupervisorByFace(img, sups);
    if (!match.found) {
      setPhase('notfound');
      return;
    }
    setSupActual(match.sup);
    setSimilarity(Math.round(match.similarity));
    setSel({});
    await refreshHistorialHoy();
    setPhase('assign');
  };

  const toggleWorker = (id) => {
    setSel((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const disponibles = regsHoy.filter((r) => r.hora_entrada && !r.supervisor_id);
  const selectedCount = Object.values(sel).filter(Boolean).length;

  const saveAssign = async () => {
    if (!supActual) return;
    const ids = Object.keys(sel).filter((k) => sel[k]);
    if (!ids.length) {
      setAlertMsg('Selecciona al menos un trabajador.');
      return;
    }
    setAlertMsg('');
    setSaving(true);
    const sueldo = supActual.area === 'obra' ? cfg.sueldoObra : supActual.area === 'fabrica' ? cfg.sueldoFabrica : null;
    const { error } = await supabase
      .from('historial')
      .update({ supervisor_id: supActual.id, supervisor_nombre: supActual.nombre, area: supActual.area, sueldo })
      .in('id', ids);
    setSaving(false);
    if (error) {
      setAlertMsg('Error guardando asignación: ' + error.message);
      return;
    }
    await refreshHistorialHoy();
    setMsg(`${ids.length} trabajador${ids.length > 1 ? 'es' : ''} asignado${ids.length > 1 ? 's' : ''} a ${supActual.nombre}`);
    setPhase('success');
  };

  return (
    <>
      <div
        className="card"
        style={{ textAlign: 'center', padding: 9, background: 'rgba(107,82,64,0.1)', border: '1px solid var(--accent)' }}
      >
        <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 13 }}>👷 ACCESO DE SUPERVISOR</span>
      </div>

      {phase === 'idle' && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="card-t">Identifícate para asignar trabajadores</div>
          {sups.length === 0 ? (
            <div className="al al-w" style={{ display: 'block' }}>No hay supervisores registrados. Agrégalos en Admin.</div>
          ) : (
            <button className="btn btn-p" onClick={() => setPhase('liveness')}>📷 Identificarme</button>
          )}
        </div>
      )}

      {phase === 'liveness' && (
        <div className="card">
          <div className="card-t">Verificación de identidad</div>
          <LivenessCapture onSuccess={handleLivenessSuccess} onCancel={reset} />
        </div>
      )}

      {phase === 'processing' && (
        <div className="einit">
          <div className="spin"></div>
          <p>Identificando supervisor...</p>
        </div>
      )}

      {phase === 'notfound' && (
        <div className="card">
          <div className="rbox err">
            <div className="rico">❌</div>
            <div className="rtit">Supervisor no reconocido</div>
            <div className="rsub">Tu cara no coincide con ningún supervisor registrado.</div>
          </div>
          <button className="btn btn-s" onClick={reset}>↩ Reintentar</button>
        </div>
      )}

      {phase === 'assign' && supActual && (
        <>
          <div className="card" style={{ textAlign: 'center', padding: 12, borderLeft: `5px solid ${supActual.color}` }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{supActual.nombre}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
              Reconocido · {similarity}% · Selecciona tus trabajadores del día
            </div>
          </div>

          <div className="card">
            <div className="card-t">Trabajadores disponibles — {selectedCount} seleccionados</div>
            {disponibles.length === 0 ? (
              <div className="empty">Sin trabajadores disponibles.<br />Todos ya están asignados.</div>
            ) : (
              <div>
                {disponibles.map((r) => (
                  <div
                    key={r.id}
                    className={`worker-check-item${sel[r.id] ? ' selected' : ''}`}
                    onClick={() => toggleWorker(r.id)}
                  >
                    <div className={`wcheck${sel[r.id] ? ' checked' : ''}`}>{sel[r.id] ? '✓' : ''}</div>
                    {r.foto_entrada ? (
                      <img style={{ width: 40, height: 40, borderRadius: 7, objectFit: 'cover' }} src={r.foto_entrada} alt={r.nombre} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 7, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
                    )}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{r.nombre}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{r.hora_entrada}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {alertMsg && <div className="al al-e" style={{ display: 'block' }}>{alertMsg}</div>}

          {saving ? (
            <div className="load" style={{ display: 'block' }}><div className="spin"></div>Guardando...</div>
          ) : (
            <button className="btn btn-g" onClick={saveAssign}>✅ Guardar asignación</button>
          )}
          <button className="btn btn-s" onClick={reset}>↩ Salir</button>
        </>
      )}

      {phase === 'success' && (
        <div className="card">
          <div className="rbox ok">
            <div className="rico">✅</div>
            <div className="rtit">Asignación guardada</div>
            <div className="rsub">{msg}</div>
          </div>
          <button className="btn btn-s" onClick={reset}>↩ Volver</button>
        </div>
      )}
    </>
  );
}
