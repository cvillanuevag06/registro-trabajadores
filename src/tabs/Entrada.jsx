import { useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import { findWorkerByFace, findPossibleWorkerByFace, indexFace } from '../lib/faceApi';
import { supabase } from '../lib/supabaseClient';
import { getDateISO, getHoraC } from '../lib/dateUtils';
import { getMinutosTarde, getDescuentoEstado } from '../lib/descuentoUtils';
import LivenessCapture from '../components/LivenessCapture';

export default function Entrada() {
  const { workers, regsHoy, refreshWorkers, refreshHistorialHoy } = useAppData();
  const [phase, setPhase] = useState('idle'); // idle | liveness | processing | match | maybe | new | blocked | success | error
  const [foto, setFoto] = useState(null);
  const [matchedWorker, setMatchedWorker] = useState(null);
  const [similarity, setSimilarity] = useState(0);
  const [nombreInput, setNombreInput] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [blockedMsg, setBlockedMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [regsFrescos, setRegsFrescos] = useState(null);

  const reset = () => {
    setPhase('idle');
    setFoto(null);
    setMatchedWorker(null);
    setSimilarity(0);
    setNombreInput('');
    setAlertMsg('');
    setBlockedMsg('');
    setRegsFrescos(null);
  };

  const yaTieneEntradaHoy = (worker, regs) => {
    const ya = (regs || []).find((r) => r.trabajador_id === worker.id && r.hora_entrada);
    return ya ? `${worker.nombre} ya tiene entrada hoy a las ${ya.hora_entrada}` : null;
  };

  const handleLivenessSuccess = async (img) => {
    setFoto(img);
    setPhase('processing');
    const { data: freshRegs } = await refreshHistorialHoy();
    setRegsFrescos(freshRegs || regsHoy);
    const match = await findWorkerByFace(img, workers);
    if (match.found) {
      const bloqueo = yaTieneEntradaHoy(match.worker, freshRegs || regsHoy);
      if (bloqueo) {
        setBlockedMsg(bloqueo);
        setPhase('blocked');
        return;
      }
      setMatchedWorker(match.worker);
      setSimilarity(Math.round(match.similarity));
      setPhase('match');
      return;
    }
    // No hubo un match seguro (≥80%). Antes de asumir "trabajador nuevo" y
    // crear otro perfil, probamos otra vez con un umbral más bajo: si se
    // parece a alguien que ya existe, se lo preguntamos al guardia en vez
    // de duplicarlo en silencio.
    const posible = await findPossibleWorkerByFace(img, workers);
    if (posible.found) {
      setMatchedWorker(posible.worker);
      setSimilarity(Math.round(posible.similarity));
      setPhase('maybe');
      return;
    }
    setMatchedWorker(null);
    setPhase('new');
  };

  const confirmarEsElMismo = () => {
    if (!matchedWorker) return;
    const bloqueo = yaTieneEntradaHoy(matchedWorker, regsFrescos || regsHoy);
    if (bloqueo) {
      setBlockedMsg(bloqueo);
      setPhase('blocked');
      return;
    }
    setPhase('match');
  };

  const confirmarEsNuevo = () => {
    setMatchedWorker(null);
    setSimilarity(0);
    setPhase('new');
  };

  const saveEntrada = async () => {
    const nombre = matchedWorker ? matchedWorker.nombre : nombreInput.trim();
    if (!nombre) {
      setAlertMsg('Escribe el nombre.');
      return;
    }
    setAlertMsg('');
    setSaving(true);

    let workerId;
    if (matchedWorker) {
      workerId = matchedWorker.id;
    } else {
      const { data, error } = await supabase.from('trabajadores').insert({ nombre, foto, face_id: null }).select().single();
      if (error) {
        setSaving(false);
        setAlertMsg('Error guardando trabajador: ' + error.message);
        return;
      }
      const faceId = await indexFace(foto, 'worker_' + data.id);
      if (!faceId) {
        await supabase.from('trabajadores').delete().eq('id', data.id);
        setSaving(false);
        setPhase('error');
        setAlertMsg('No se detectó un rostro claro en la foto. Intenta de nuevo.');
        return;
      }
      await supabase.from('trabajadores').update({ face_id: faceId }).eq('id', data.id);
      workerId = data.id;
      await refreshWorkers();
    }

    const hora = getHoraC();
    const minTarde = getMinutosTarde();
    const { error: histErr } = await supabase.from('historial').insert({
      trabajador_id: workerId,
      nombre,
      fecha: getDateISO(),
      hora_entrada: hora,
      foto_entrada: foto,
      pago: 'pendiente',
      min_tarde: minTarde,
      descuento_estado: getDescuentoEstado(minTarde),
    });

    setSaving(false);
    if (histErr) {
      setAlertMsg('Error guardando entrada: ' + histErr.message);
      return;
    }
    await refreshHistorialHoy();
    setBlockedMsg(`${nombre} · ${hora}`);
    setPhase('success');
  };

  return (
    <>
      <div
        className="card"
        style={{ textAlign: 'center', padding: 9, background: 'rgba(74,122,58,0.1)', border: '1px solid var(--green)' }}
      >
        <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 13 }}>🌅 REGISTRO DE ENTRADA</span>
      </div>

      {phase === 'idle' && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="card-t">Verificación de identidad</div>
          <button className="btn btn-p" onClick={() => setPhase('liveness')}>📷 Iniciar verificación</button>
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
          <p>Verificando identidad...</p>
        </div>
      )}

      {phase === 'blocked' && (
        <div className="card">
          <div className="rbox warn">
            <div className="rico">⚠️</div>
            <div className="rtit">Entrada ya registrada</div>
            <div className="rsub">{blockedMsg}</div>
          </div>
          <button className="btn btn-s" onClick={reset}>↩ Volver a intentar</button>
        </div>
      )}

      {phase === 'success' && (
        <div className="card">
          <div className="rbox ok">
            <div className="rico">✅</div>
            <div className="rtit">Entrada registrada</div>
            <div className="rsub">{blockedMsg}</div>
          </div>
          <button className="btn btn-s" onClick={reset}>↩ Registrar otro</button>
        </div>
      )}

      {phase === 'error' && (
        <div className="card">
          <div className="rbox err">
            <div className="rico">📷</div>
            <div className="rtit">Foto no válida</div>
            <div className="rsub">{alertMsg}</div>
          </div>
          <button className="btn btn-s" onClick={reset}>↩ Reintentar</button>
        </div>
      )}

      {phase === 'maybe' && matchedWorker && (
        <div className="card">
          <div className="wmatch" style={{ borderColor: 'var(--yellow, #d4a017)' }}>
            {matchedWorker.foto ? (
              <img src={matchedWorker.foto} alt={matchedWorker.nombre} />
            ) : (
              <div style={{ width: 50, height: 50, borderRadius: 8, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👤</div>
            )}
            <div>
              <div className="wname">¿Eres {matchedWorker.nombre}?</div>
              <div className="wsub">Se parece, pero no estamos seguros · {similarity}%</div>
            </div>
          </div>
          <div className="rbox info">
            <div className="rico">🤔</div>
            <div className="rtit">Confirma tu identidad</div>
            <div className="rsub">Si ya estás registrado y dices que eres nuevo, se crea un perfil duplicado.</div>
          </div>
          <button className="btn btn-g" onClick={confirmarEsElMismo}>✅ Sí, soy yo</button>
          <button className="btn btn-s" onClick={confirmarEsNuevo}>🆕 No, soy nuevo</button>
        </div>
      )}

      {(phase === 'match' || phase === 'new') && (
        <div className="card">
          {phase === 'match' && matchedWorker && (
            <div className="wmatch">
              {matchedWorker.foto ? (
                <img src={matchedWorker.foto} alt={matchedWorker.nombre} />
              ) : (
                <div style={{ width: 50, height: 50, borderRadius: 8, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👤</div>
              )}
              <div>
                <div className="wname">¡{matchedWorker.nombre}!</div>
                <div className="wsub">Reconocido · {similarity}% · Liveness ✅</div>
              </div>
            </div>
          )}

          {phase === 'new' && (
            <>
              <div className="rbox info">
                <div className="rico">🆕</div>
                <div className="rtit">Trabajador nuevo</div>
                <div className="rsub">Escribe el nombre</div>
              </div>
              <input
                type="text"
                placeholder="Nombre completo"
                value={nombreInput}
                onChange={(e) => setNombreInput(e.target.value)}
              />
            </>
          )}

          {alertMsg && <div className="al al-e" style={{ display: 'block' }}>{alertMsg}</div>}
          {saving ? (
            <div className="load" style={{ display: 'block' }}><div className="spin"></div>Guardando...</div>
          ) : (
            <button className="btn btn-g" onClick={saveEntrada}>✅ Confirmar entrada</button>
          )}
          <button className="btn btn-s" onClick={reset}>↩ Cancelar</button>
        </div>
      )}
    </>
  );
}
