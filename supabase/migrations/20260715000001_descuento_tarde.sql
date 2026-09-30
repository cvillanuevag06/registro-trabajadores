-- Columnas para el sistema de descuento por llegada tarde.
alter table historial
  add column if not exists min_tarde integer default 0,
  add column if not exists descuento_estado text default 'na',
  add column if not exists pago_final numeric;
