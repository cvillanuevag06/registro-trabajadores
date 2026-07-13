import { useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import { useAuth } from '../context/AuthContext';
import { findWorkerByFace } from '../lib/faceApi';
import { supabase } from '../lib/supabaseClient';
import { getHoraC } from '../lib/dateUtils';
import LivenessCapture from '../components/LivenessCapture';

const VERIFY_CONF = 85;

export default function Salida() {
  const { workers, regsHoy, refreshHistorialHoy } = useAppData();
  const { isAdmin } = useAuth();
  const [phase, setPhase] = useState('idle'); // idle | liveness | processing | none | notfound | match | success
  const [foto, setFoto] = useState(null);
  const [pendMatch, setPendMatch] = useState(null);
  const [similarity, setSimilarity] = useState(0);
  const [autoOk, setAutoOk] = useState(false);
  const [overridden, setOverridden] = useState(false);
  const [msg, setMsg] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setPhase('idle');
    setFoto(null);
    setPendMatch(null);
    setSimilarity(0);
    setAutoOk(false);
    setOverridden(false);
    setMsg('');
    setAlertMsg('');
  };

  const handleLivenessSuccess = async (img) => {
    setFoto(img);
    setPhase('processing');
    const { data: freshRegs } = await refreshHistorialHoy();
    const pend = (freshRegs || regsHoy).filter((r) => r.hora_entrada && !r.hora_salida);
    if (!pend.length) {
      setPhase('none');
      return;
    }
    const awsMatch = await findWorkerByFace(img, workers);
    if (!awsMatch.found) {
      setPhase('notfound');
      return;
    }
    const found = pend.find((p) => p.trabajador_id === awsMatch.worker.id);
    if (!found) {
      setMsg(`${awsMatch.worker.nombre} no tiene entrada pendiente hoy.`);
      setPhase('notfound');
      return;
    }
    setPendMatch(found);
    setSimilarity(Math.round(awsMatch.similarity));
    setAutoOk(awsMatch.similarity >= VERIFY_CONF);
    setPhase('match');
  };

  const authorizarPago = async () => {
    if (!pendMatch) return;
    setSaving(true);
    setAlertMsg('');
    const hora = getHoraC();
    const { data, error } = await supabase
      .from('historial')
      .update({ hora_salida: hora, foto_salida: foto, pago: 'autorizado' })
      .eq('id', pendMatch.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      setAlertMsg('Error autorizando pago: ' + error.message);
      return;
    }
    await refreshHistorialHoy();
    setMsg(`${data.nombre} · $${data.sueldo || 0} · ${hora}`);
    setPhase('success');
  };

  return (
    <>
      <div
        className="card"
        style={{ textAlign: 'center', padding: 9, background: 'rgba(176,64,48,0.08)', border: '1px solid var(--red)' }}
      >
        <span style={{ color: 'var(--red)', fontWeight: 700, fontSize: 13 }}>🌇 REGISTRO DE SALIDA</span>
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

      {phase === 'none' && (
        <div className="card">
          <div className="rbox warn">
            <div className="rico">⚠️</div>
            <div className="rtit">Sin entradas pendientes</div>
            <div className="rsub">No hay trabajadores con entrada registrada hoy.</div>
          </div>
          <button className="btn btn-s" onClick={reset}>↩ Volver</button>
        </div>
      )}

      {phase === 'notfound' && (
        <div className="card">
          <div className="rbox err">
            <div className="rico">❓</div>
            <div className="rtit">No reconocido</div>
            <div className="rsub">{msg || 'No se reconoció el rostro o no tiene entrada pendiente hoy.'}</div>
          </div>
          <button className="btn btn-s" onClick={reset}>↩ Reintentar</button>
        </div>
      )}

      {phase === 'match' && pendMatch && (
        <div className="card">
          <div className="wmatch" style={{ borderColor: autoOk ? 'var(--green)' : 'var(--red)' }}>
            {pendMatch.foto_entrada ? (
              <img src={pendMatch.foto_entrada} alt={pendMatch.nombre} />
            ) : (
              <div style={{ width: 50, height: 50, borderRadius: 8, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👤</div>
            )}
            <div>
              <div className="wname">{pendMatch.nombre}</div>
              <div className="wsub">Reconocido · {similarity}% · Liveness ✅</div>
            </div>
          </div>

          {!autoOk && !overridden && (
            <div className="rbox warn">
              <div className="rico">🔒</div>
              <div className="rtit">Identidad no confirmada</div>
              <div className="rsub">
                La similitud ({similarity}%) es menor al mínimo ({VERIFY_CONF}%).
                {isAdmin
                  ? ' Puedes autorizar el pago como administrador.'
                  : ' Un administrador debe iniciar sesión para autorizar este pago.'}
              </div>
            </div>
          )}

          {alertMsg && <div className="al al-e" style={{ display: 'block' }}>{alertMsg}</div>}

          {saving ? (
            <div className="load" style={{ display: 'block' }}><div className="spin"></div>Autorizando...</div>
          ) : (autoOk || overridden) ? (
            <button className="btn btn-g" onClick={authorizarPago}>💰 Autorizar pago</button>
          ) : isAdmin ? (
            <button className="btn btn-p" onClick={() => setOverridden(true)}>🔑 Autorizar como admin</button>
          ) : null}

          <button className="btn btn-s" onClick={reset}>↩ Cancelar</button>
        </div>
      )}

      {phase === 'success' && (
        <div className="card">
          <div className="rbox ok">
            <div className="rico">✅</div>
            <div className="rtit">Pago autorizado</div>
            <div className="rsub">{msg}</div>
          </div>
          <button className="btn btn-s" onClick={reset}>↩ Registrar otro</button>
        </div>
      )}
    </>
  );
}
