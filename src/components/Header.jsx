import { useEffect, useState } from 'react';
import { getFecha, getHora } from '../lib/dateUtils';

const TABS = [
  { id: 'entrada', label: 'Entrada' },
  { id: 'salida', label: 'Salida' },
  { id: 'historial', label: 'Historial' },
  { id: 'supervisor', label: 'Supervisor' },
  { id: 'admin', label: 'Admin' },
];

export default function Header({ activeTab, onTabChange, ready }) {
  const [hora, setHora] = useState(getHora());

  useEffect(() => {
    const id = setInterval(() => setHora(getHora()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="header">
      <div className="h-top">
        <div className="logo">
          <div className="logo-icon">U</div>
          <div>
            <div className="logo-text">Umma · Control</div>
            <div className="logo-sub">{getFecha()}</div>
          </div>
        </div>
        <div className={`dot ${ready ? 'dot-ok' : 'dot-load'}`}></div>
      </div>
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${activeTab === t.id ? 'on' : ''}`}
            onClick={() => onTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="hora">{hora}</div>
    </div>
  );
}
