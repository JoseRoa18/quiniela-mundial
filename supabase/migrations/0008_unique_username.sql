-- ============================================================================
--  Migración 0008 · Evitar que el registro falle si el username está repetido
--  PROBLEMA: si dos usuarios eligen el mismo nombre, el segundo no podía
--  registrarse (violación de la constraint única en profiles.username).
--  FIX: handle_new_user añade un sufijo numérico hasta encontrar uno libre.
--  Ejecutar en el SQL Editor de Supabase.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base      text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
                              split_part(new.email, '@', 1),
                              'jugador');
  candidate text := base;
  n         int  := 0;
begin
  loop
    begin
      insert into public.profiles (id, username, avatar_url)
      values (new.id, candidate, new.raw_user_meta_data ->> 'avatar_url');
      return new;
    exception when unique_violation then
      -- Si el perfil ya existe (mismo id), no hay nada que hacer.
      if exists (select 1 from public.profiles where id = new.id) then
        return new;
      end if;
      -- Si el choque fue por el username, probar con un sufijo: Juan, Juan1, Juan2...
      n := n + 1;
      candidate := base || n::text;
    end;
  end loop;
end;
$$;
