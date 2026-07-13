import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

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

function AdminPanel() {
  const { signOut } = useAuth();
  return (
    <>
      <div className="card">
        <div className="admin-h">👥 Supervisores</div>
        <div className="empty">Módulo en construcción</div>
      </div>
      <div className="card">
        <div className="admin-h">💰 Sueldos base</div>
        <div className="empty">Módulo en construcción</div>
      </div>
      <div className="card">
        <div className="admin-h">📊 Exportar</div>
        <div className="empty">Módulo en construcción</div>
      </div>
      <button className="btn btn-s" onClick={signOut}>🔒 Salir del panel admin</button>
    </>
  );
}

export default function Admin() {
  const { isAdmin, authReady } = useAuth();
  if (!authReady) return null;
  return isAdmin ? <AdminPanel /> : <AdminLogin />;
}
