-- ============================================================================
--  Migración 0007 · Guardar el estado CRUDO de la API para detectar eventos
--  (inicio, gol, medio tiempo, final). Ejecutar en el SQL Editor.
-- ----------------------------------------------------------------------------
--  football-data usa: SCHEDULED, TIMED, IN_PLAY, PAUSED, FINISHED, ...
--  Nuestro enum match_status colapsa PAUSED en 'in_progress', por eso
--  guardamos el estado original aparte para distinguir el medio tiempo.
-- ============================================================================
alter table public.matches
  add column if not exists api_status text;
