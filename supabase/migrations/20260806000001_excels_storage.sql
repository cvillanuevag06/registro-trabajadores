-- Bucket para guardar automáticamente una copia de los Excels generados cada día
-- (Lista Eventuales y Por Supervisor), organizados por mes, para poder revisar
-- los registros pasados si hay algún problema. Solo la función programada
-- (con service_role) puede escribir; cualquiera puede leer/descargar (igual que
-- el resto de la app, que ya opera con la clave anon sin restricciones).
insert into storage.buckets (id, name, public)
values ('excels', 'excels', true)
on conflict (id) do nothing;

drop policy if exists "excels_public_read" on storage.objects;
create policy "excels_public_read"
on storage.objects for select
using (bucket_id = 'excels');
