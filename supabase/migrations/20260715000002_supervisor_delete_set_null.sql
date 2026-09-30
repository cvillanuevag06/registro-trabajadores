-- Borrar un supervisor fallaba porque historial.supervisor_id lo referencia sin
-- ON DELETE SET NULL. historial.supervisor_nombre ya guarda el nombre de forma
-- independiente (se usa en Historial/Excel), así que es seguro dejar el id en null.
alter table historial
  drop constraint if exists historial_supervisor_id_fkey,
  add constraint historial_supervisor_id_fkey
    foreign key (supervisor_id) references supervisores(id) on delete set null;
