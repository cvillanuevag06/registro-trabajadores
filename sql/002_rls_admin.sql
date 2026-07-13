-- RLS: el panel Admin deja de depender de un password en el JS.
-- Cualquier escritura "de admin" (supervisores, sueldos) requiere sesión real de Supabase Auth.
-- Los flujos de Entrada/Salida/Supervisor (trabajadores, historial) siguen abiertos a anon
-- porque los usa el propio trabajador/supervisor en planta, sin login.

alter table trabajadores enable row level security;
alter table historial enable row level security;
alter table supervisores enable row level security;
alter table config enable row level security;

-- trabajadores: lectura/escritura abierta (flujo de entrada sin login)
drop policy if exists trabajadores_all on trabajadores;
create policy trabajadores_all on trabajadores for all
  using (true) with check (true);

-- historial: lectura/escritura abierta (entrada/salida/supervisor sin login)
drop policy if exists historial_all on historial;
create policy historial_all on historial for all
  using (true) with check (true);

-- supervisores: cualquiera puede leer (identificar supervisor por cara, ver lista/colores)
drop policy if exists supervisores_select on supervisores;
create policy supervisores_select on supervisores for select
  using (true);

-- supervisores: solo un usuario autenticado (admin) puede crear/editar/borrar
drop policy if exists supervisores_write on supervisores;
create policy supervisores_write on supervisores for insert
  with check (auth.role() = 'authenticated');
drop policy if exists supervisores_update on supervisores;
create policy supervisores_update on supervisores for update
  using (auth.role() = 'authenticated');
drop policy if exists supervisores_delete on supervisores;
create policy supervisores_delete on supervisores for delete
  using (auth.role() = 'authenticated');

-- config (sueldos): cualquiera puede leer (se usa al asignar sueldo en tab Supervisor)
drop policy if exists config_select on config;
create policy config_select on config for select
  using (true);

-- config: solo admin autenticado puede cambiar los sueldos base
drop policy if exists config_update on config;
create policy config_update on config for update
  using (auth.role() = 'authenticated');
