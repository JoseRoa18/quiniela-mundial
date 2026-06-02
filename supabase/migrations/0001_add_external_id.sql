-- ============================================================================
--  Migración 0001 · Soporte para sincronización con API externa (football-data.org)
--  Ejecutar en el SQL Editor de Supabase DESPUÉS de schema.sql.
-- ============================================================================

-- ID del partido en la API externa. Permite hacer UPSERT sin duplicar partidos
-- cada vez que el script de sync vuelve a traer la lista.
alter table public.matches
  add column if not exists external_id bigint;

-- Índice único NO parcial (necesario para que el UPSERT use ON CONFLICT (external_id)).
-- En Postgres los NULL se consideran distintos entre sí, así que varios partidos
-- manuales/demo con external_id = NULL siguen permitidos sin colisionar.
drop index if exists public.uniq_matches_external_id;
create unique index if not exists uniq_matches_external_id
  on public.matches (external_id);
