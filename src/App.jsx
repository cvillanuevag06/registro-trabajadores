import { useState } from 'react';
import './App.css';
import Header from './components/Header';
import { AppDataProvider, useAppData } from './context/AppDataContext';
import { AuthProvider } from './context/AuthContext';
import Entrada from './tabs/Entrada';
import Salida from './tabs/Salida';
import Historial from './tabs/Historial';
import Supervisor from './tabs/Supervisor';
import Admin from './tabs/Admin';

const TAB_COMPONENTS = {
  entrada: Entrada,
  salida: Salida,
  historial: Historial,
  supervisor: Supervisor,
  admin: Admin,
};

function AppContent() {
  const [activeTab, setActiveTab] = useState('entrada');
  const { ready, error } = useAppData();

  if (!ready) {
    return (
      <>
        <Header activeTab={activeTab} onTabChange={setActiveTab} ready={false} />
        <div className="content">
          <div className="einit">
            <div className="spin"></div>
            <p>Conectando con la base de datos...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header activeTab={activeTab} onTabChange={setActiveTab} ready={false} />
        <div className="content">
          <div className="al al-e" style={{ display: 'block' }}>
            Error de conexión: {error.message}
          </div>
        </div>
      </>
    );
  }

  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <>
      <Header activeTab={activeTab} onTabChange={setActiveTab} ready={true} />
      <div className="content">
        <ActiveComponent />
      </div>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppDataProvider>
        <AppContent />
      </AppDataProvider>
    </AuthProvider>
  );
}

export default App;
