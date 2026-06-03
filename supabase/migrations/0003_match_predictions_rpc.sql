-- ============================================================================
--  Migración 0003 · RPC para ver las predicciones de TODOS en un partido
--  (con RLS, cada usuario solo ve las suyas; esta función SECURITY DEFINER
--   las revela, pero SOLO cuando el partido ya está bloqueado o en juego,
--   para que nadie copie pronósticos antes del cierre).
--  Ejecutar en el SQL Editor de Supabase.
-- ============================================================================
create or replace function public.get_match_predictions(p_match_id uuid)
returns table (
  username       text,
  avatar_url     text,
  predicted_home integer,
  predicted_away integer,
  used_wildcard  boolean,
  points_earned  integer,
  result_type    prediction_result
)
language sql
security definer
set search_path = public
as $$
  select
    p.username,
    p.avatar_url,
    pr.predicted_home,
    pr.predicted_away,
    pr.used_wildcard,
    pr.points_earned,
    pr.result_type
  from public.predictions pr
  join public.profiles p on p.id = pr.user_id
  join public.matches  m on m.id = pr.match_id
  where pr.match_id = p_match_id
    -- Revelar solo si el partido ya empezó/terminó, o si ya pasó el cierre (30 min antes)
    and (m.status <> 'pending' or now() >= m.start_time - interval '30 minutes')
  order by pr.points_earned desc nulls last, p.username asc;
$$;

grant execute on function public.get_match_predictions(uuid) to authenticated, anon;
