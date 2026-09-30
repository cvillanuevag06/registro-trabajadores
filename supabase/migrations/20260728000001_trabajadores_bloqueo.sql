-- Permite marcar trabajadores como "prohibidos" (gente no deseada que ya no debe
-- volver a entrar) y guardar un motivo opcional. Se revisa al registrar la entrada.
alter table trabajadores
  add column if not exists bloqueado boolean default false,
  add column if not exists motivo_bloqueo text;
