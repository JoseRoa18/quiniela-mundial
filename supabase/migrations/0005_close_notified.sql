-- ============================================================================
--  Migración 0005 · Marca para no repetir el recordatorio de cierre de un partido
--  Ejecutar en el SQL Editor de Supabase.
-- ============================================================================
alter table public.matches
  add column if not exists close_notified boolean not null default false;
