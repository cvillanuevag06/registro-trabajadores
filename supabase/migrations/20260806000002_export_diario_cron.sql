-- Habilita pg_cron y pg_net para poder invocar automáticamente, todos los días,
-- la función export-diario (que genera y guarda en Storage una copia de ambos
-- Excels del día: Lista Eventuales y Por Supervisor).
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

grant usage on schema cron to postgres;
grant all on all tables in schema cron to postgres;
