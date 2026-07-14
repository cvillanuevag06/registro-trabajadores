import { useAppData } from '../context/AppDataContext';

export default function Historial() {
  const { workers, sups, regsHoy } = useAppData();

  const entradas = regsHoy.filter((r) => r.hora_entrada);
  const salidas = regsHoy.filter((r) => r.hora_salida);
  const autorizados = regsHoy.filter((r) => r.pago === 'autorizado');

  const getSupColor = (id) => sups.find((s) => s.id === id)?.color || '#888';

  return (
    <>
      <div className="sgrid">
        <div className="scard"><div className="snum" style={{ color: 'var(--green)' }}>{entradas.length}</div><div className="slbl">Entradas</div></div>
        <div className="scard"><div className="snum" style={{ color: 'var(--red)' }}>{salidas.length}</div><div className="slbl">Salidas</div></div>
        <div className="scard"><div className="snum" style={{ color: 'var(--green)' }}>{autorizados.length}</div><div className="slbl">Autorizados</div></div>
        <div className="scard"><div className="snum" style={{ color: 'var(--accent)' }}>{workers.length}</div><div className="slbl">Trabajadores</div></div>
      </div>

      <div className="card">
        <div className="card-t">Registros del día</div>
        {entradas.length === 0 ? (
          <div className="empty">Sin registros hoy</div>
        ) : (
          [...entradas].reverse().map((r) => {
            const sc = r.supervisor_id ? getSupColor(r.supervisor_id) : '';
            return (
              <div className="ri" key={r.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {r.foto_entrada ? (
                    <img className="rfoto" src={r.foto_entrada} alt={r.nombre} />
                  ) : (
                    <div style={{ width: 42, height: 42, borderRadius: 7, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div className="rname">{r.nombre}</div>
                    <div className="rmeta">{r.area || ''} · ${r.sueldo || '-'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7, paddingLeft: 52 }}>
                  <span className="badge b-e">🌅 {r.hora_entrada}</span>
                  {r.hora_salida ? (
                    <span className={`badge ${r.pago === 'autorizado' ? 'b-ok' : 'b-no'}`}>
                      🌆 {r.hora_salida} · {r.pago === 'autorizado' ? '✅ Pago' : '❌'}
                    </span>
                  ) : (
                    <span className="badge b-p">⏳ Sin salida</span>
                  )}
                  {r.supervisor_nombre && (
                    <span className="badge" style={{ background: `${sc}22`, color: sc }}>👷 {r.supervisor_nombre}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
