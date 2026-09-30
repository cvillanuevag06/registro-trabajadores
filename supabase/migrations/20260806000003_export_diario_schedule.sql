-- Programa la ejecución diaria de la función export-diario (genera y guarda en
-- Storage una copia de ambos Excels del día: Lista Eventuales y Por Supervisor).
-- Corre todos los días a las 23:00 hora de Ciudad de México (05:00 UTC), después
-- de que termina la jornada, para capturar todas las entradas del día.
--
-- La clave service_role se lee desde Supabase Vault (secreto
-- 'export_diario_service_role_key', ya creado manualmente) para no dejarla en
-- texto plano en este archivo. Si el secreto no existe todavía en un ambiente
-- nuevo, hay que crearlo antes con:
--   select vault.create_secret('<service_role_key>', 'export_diario_service_role_key');
select cron.schedule(
  'export-diario-9pm-cdmx',
  '0 5 * * *',
  $$
  select net.http_post(
    url := 'https://fasmhbrumwqwjsduohkw.supabase.co/functions/v1/export-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'export_diario_service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
