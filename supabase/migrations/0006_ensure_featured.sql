-- ============================================================================
--  Migración 0006 · Elegir automáticamente el partido destacado (×2) por jornada
--  Ejecutar en el SQL Editor de Supabase.
-- ----------------------------------------------------------------------------
--  Recorre las jornadas y, si alguna NO tiene partido destacado, le asigna uno
--  al azar entre los pendientes. No reasigna si ya hay uno (para no cambiar el
--  ×2 a mitad de jornada). Usa set_random_featured_match() (ya existente).
-- ============================================================================
create or replace function public.ensure_featured_matches()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare md integer;
begin
  for md in (select distinct matchday from public.matches order by matchday) loop
    -- ¿Esta jornada ya tiene un destacado? (sin importar su estado)
    if not exists (
      select 1 from public.matches where matchday = md and is_featured_match = true
    ) then
      perform public.set_random_featured_match(md);
    end if;
  end loop;
end;
$$;

-- Ejecutar una vez ahora mismo (asigna destacado a las 9 jornadas).
select public.ensure_featured_matches();
