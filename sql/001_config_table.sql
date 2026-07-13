-- Tabla de configuración global (sueldos base). Fila única (id fijo).
create table if not exists config (
  id smallint primary key default 1,
  sueldo_obra numeric not null default 500,
  sueldo_fabrica numeric not null default 400,
  updated_at timestamptz not null default now(),
  constraint config_singleton check (id = 1)
);

insert into config (id, sueldo_obra, sueldo_fabrica)
values (1, 500, 400)
on conflict (id) do nothing;
