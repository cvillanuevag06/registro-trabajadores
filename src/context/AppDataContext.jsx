import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getDateISO } from '../lib/dateUtils';

const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  const [workers, setWorkers] = useState([]);
  const [sups, setSups] = useState([]);
  const [regsHoy, setRegsHoy] = useState([]);
  const [cfg, setCfg] = useState({ sueldoObra: 500, sueldoFabrica: 400 });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const refreshWorkers = useCallback(async () => {
    const { data, error } = await supabase.from('trabajadores').select('*').order('created_at', { ascending: true });
    if (!error && data) setWorkers(data);
    return { data, error };
  }, []);

  const refreshSupervisores = useCallback(async () => {
    const { data, error } = await supabase.from('supervisores').select('*').order('created_at', { ascending: true });
    if (!error && data) setSups(data);
    return { data, error };
  }, []);

  const refreshHistorialHoy = useCallback(async () => {
    const hoy = getDateISO();
    const { data, error } = await supabase
      .from('historial')
      .select('*')
      .eq('fecha', hoy)
      .order('created_at', { ascending: true });
    if (!error && data) setRegsHoy(data);
    return { data, error };
  }, []);

  const refreshConfig = useCallback(async () => {
    const { data, error } = await supabase.from('config').select('*').eq('id', 1).single();
    if (!error && data) setCfg({ sueldoObra: data.sueldo_obra, sueldoFabrica: data.sueldo_fabrica });
    return { data, error };
  }, []);

  useEffect(() => {
    (async () => {
      const results = await Promise.all([refreshWorkers(), refreshSupervisores(), refreshHistorialHoy(), refreshConfig()]);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) setError(firstError);
      setReady(true);
    })();
  }, [refreshWorkers, refreshSupervisores, refreshHistorialHoy, refreshConfig]);

  const value = useMemo(
    () => ({
      workers,
      sups,
      regsHoy,
      cfg,
      ready,
      error,
      refreshWorkers,
      refreshSupervisores,
      refreshHistorialHoy,
      refreshConfig,
    }),
    [workers, sups, regsHoy, cfg, ready, error, refreshWorkers, refreshSupervisores, refreshHistorialHoy, refreshConfig]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
