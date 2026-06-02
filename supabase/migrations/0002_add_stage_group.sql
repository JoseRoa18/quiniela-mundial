-- ============================================================================
--  Migración 0002 · Guardar la fase y el grupo de cada partido
--  Necesario para las vistas de Grupos (tabla de posiciones) y Eliminatorias.
--  Ejecutar en el SQL Editor de Supabase.
-- ============================================================================

-- Fase del torneo: GROUP_STAGE, LAST_32, LAST_16, QUARTER_FINALS,
--                  SEMI_FINALS, THIRD_PLACE, FINAL
alter table public.matches
  add column if not exists stage text;

-- Grupo (solo fase de grupos): GROUP_A, GROUP_B, ... GROUP_L
alter table public.matches
  add column if not exists group_name text;

create index if not exists idx_matches_stage on public.matches (stage);
create index if not exists idx_matches_group on public.matches (group_name);
