-- ============================================================================
--  QUINIELA DEPORTIVA · Esquema Supabase / PostgreSQL
--  Ejecutar en el SQL Editor de Supabase (o vía migración).
--  Notas de diseño (decisiones senior):
--   · La tabla de perfiles se llama `profiles` (idioma Supabase) y NO `users`,
--     para no colisionar con `auth.users`. Conceptualmente es tu "users".
--   · Se añadió `matchday` (jornada): tus reglas de "1 comodín por jornada" y
--     "1 partido destacado por jornada" lo requieren obligatoriamente.
--   · Se añadió `result_type` en predictions: con multiplicadores un pleno puede
--     valer 3, 6 o 12 pts, así que NO se puede contar plenos por el valor de
--     puntos. Guardamos el tipo de acierto explícitamente para el desempate.
-- ============================================================================

-- ---------- Extensiones ----------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------- Tipos enumerados ----------
do $$ begin
  create type match_status as enum ('pending', 'in_progress', 'finished');
exception when duplicate_object then null; end $$;

do $$ begin
  -- 'pending' = todavía no calculado / partido no finalizado
  create type prediction_result as enum ('pending', 'pleno', 'tendencia', 'miss');
exception when duplicate_object then null; end $$;


-- ============================================================================
--  TABLA: profiles  (perfil público del usuario)
-- ============================================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text unique not null,
  avatar_url    text,
  total_points  integer not null default 0,   -- caché denormalizado (lo mantiene un trigger)
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Todos pueden leer perfiles (necesario para el leaderboard)
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

-- Solo el dueño puede editar su perfil
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Crear perfil automáticamente al registrarse un usuario en auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;   -- TODO: si el username choca, añade sufijo aleatorio
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================================
--  TABLA: matches  (partidos de la jornada)
-- ============================================================================
create table if not exists public.matches (
  id                 uuid primary key default gen_random_uuid(),
  matchday           integer not null,                 -- jornada (clave para reglas especiales)
  home_team          text not null,
  away_team          text not null,
  home_team_logo     text,                             -- escudo (URL)
  away_team_logo     text,
  start_time         timestamptz not null,
  status             match_status not null default 'pending',
  home_score         integer check (home_score >= 0),
  away_score         integer check (away_score >= 0),
  is_featured_match  boolean not null default false,   -- doble de puntos
  created_at         timestamptz not null default now()
);

create index if not exists idx_matches_matchday   on public.matches (matchday);
create index if not exists idx_matches_start_time  on public.matches (start_time);

alter table public.matches enable row level security;

-- Todos leen los partidos
create policy "matches_select_all"
  on public.matches for select
  using (true);
-- (Las escrituras quedan reservadas al service_role / panel admin, que omite RLS)


-- ============================================================================
--  TABLA: predictions  (pronósticos)
-- ============================================================================
create table if not exists public.predictions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  match_id        uuid not null references public.matches (id)  on delete cascade,
  matchday        integer,                              -- denormalizado desde matches (trigger)
  predicted_home  integer not null check (predicted_home between 0 and 99),
  predicted_away  integer not null check (predicted_away between 0 and 99),
  points_earned   integer,                              -- null = aún no calculado
  result_type     prediction_result not null default 'pending',
  used_wildcard   boolean not null default false,       -- comodín
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Un pronóstico por usuario y partido
create unique index if not exists uniq_prediction_user_match
  on public.predictions (user_id, match_id);

-- REGLA: máximo 1 comodín por usuario por jornada (índice único parcial)
create unique index if not exists uniq_one_wildcard_per_matchday
  on public.predictions (user_id, matchday)
  where used_wildcard = true;

create index if not exists idx_predictions_user_id  on public.predictions (user_id);
create index if not exists idx_predictions_match_id on public.predictions (match_id);
create index if not exists idx_predictions_matchday on public.predictions (matchday);

alter table public.predictions enable row level security;

-- El usuario solo ve / crea / edita SUS pronósticos
create policy "predictions_select_own"
  on public.predictions for select
  using (auth.uid() = user_id);

create policy "predictions_insert_own"
  on public.predictions for insert
  with check (auth.uid() = user_id);

create policy "predictions_update_own"
  on public.predictions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
--  Trigger: copiar matchday desde el partido al pronóstico
-- ---------------------------------------------------------------------------
create or replace function public.set_prediction_matchday()
returns trigger language plpgsql as $$
begin
  select matchday into new.matchday from public.matches where id = new.match_id;
  return new;
end;
$$;

drop trigger if exists trg_set_prediction_matchday on public.predictions;
create trigger trg_set_prediction_matchday
  before insert or update of match_id on public.predictions
  for each row execute function public.set_prediction_matchday();


-- ---------------------------------------------------------------------------
--  Trigger: BLOQUEO de 30 minutos (el backend rechaza la escritura)
--  Solo se dispara al tocar el contenido del pronóstico, NO al calcular puntos.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_prediction_lock()
returns trigger language plpgsql as $$
declare
  v_start timestamptz;
begin
  select start_time into v_start from public.matches where id = new.match_id;
  if v_start is null then
    raise exception 'El partido % no existe', new.match_id;
  end if;
  if now() >= v_start - interval '30 minutes' then
    raise exception 'Pronóstico bloqueado: faltan menos de 30 minutos para el inicio del partido'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_prediction_lock on public.predictions;
create trigger trg_enforce_prediction_lock
  before insert or update of predicted_home, predicted_away, used_wildcard
  on public.predictions
  for each row execute function public.enforce_prediction_lock();


-- ---------------------------------------------------------------------------
--  Trigger: updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_predictions_updated_at on public.predictions;
create trigger trg_predictions_updated_at
  before update on public.predictions
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
--  Trigger: mantener profiles.total_points sincronizado
-- ---------------------------------------------------------------------------
create or replace function public.sync_total_points()
returns trigger language plpgsql
security definer set search_path = public as $$
declare v_user uuid;
begin
  v_user := coalesce(new.user_id, old.user_id);
  update public.profiles
     set total_points = (
       select coalesce(sum(points_earned), 0)
       from public.predictions
       where user_id = v_user
     )
   where id = v_user;
  return null;
end;
$$;

drop trigger if exists trg_sync_total_points on public.predictions;
create trigger trg_sync_total_points
  after insert or delete or update of points_earned on public.predictions
  for each row execute function public.sync_total_points();


-- ============================================================================
--  FUNCIÓN: get_leaderboard(matchday opcional)
--  Desempate: 1) puntos DESC  2) plenos DESC
--             3) menos partidos pronosticados ASC  4) primer pronóstico ASC
--  · matchday = null  -> ranking global (usa profiles.total_points)
--  · matchday = N     -> ranking de esa jornada (suma points_earned de la jornada)
-- ============================================================================
create or replace function public.get_leaderboard(p_matchday integer default null)
returns table (
  user_id             uuid,
  username            text,
  avatar_url          text,
  points              integer,
  plenos              integer,
  predictions_count   integer,
  first_prediction_at timestamptz,
  rank                integer
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.avatar_url,
    (case when p_matchday is null
          then p.total_points
          else coalesce(sum(pr.points_earned), 0)::int
     end) as points,
    count(pr.*) filter (where pr.result_type = 'pleno')::int as plenos,
    count(pr.*)::int as predictions_count,
    min(pr.created_at) as first_prediction_at,
    rank() over (
      order by
        (case when p_matchday is null
              then p.total_points
              else coalesce(sum(pr.points_earned), 0)::int end) desc,
        count(pr.*) filter (where pr.result_type = 'pleno') desc,
        count(pr.*) asc,
        min(pr.created_at) asc nulls last
    )::int as rank
  from public.profiles p
  left join public.predictions pr
         on pr.user_id = p.id
        and (p_matchday is null or pr.matchday = p_matchday)
  group by p.id, p.username, p.avatar_url, p.total_points
  order by rank;
$$;


-- ============================================================================
--  FUNCIÓN: set_random_featured_match(matchday)
--  Elige UN partido pendiente al azar de la jornada como destacado (x2).
--  Llamar desde un cron / Edge Function al abrir cada jornada.
-- ============================================================================
create or replace function public.set_random_featured_match(p_matchday integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_match_id uuid;
begin
  update public.matches set is_featured_match = false where matchday = p_matchday;

  select id into v_match_id
  from public.matches
  where matchday = p_matchday and status = 'pending'
  order by random()
  limit 1;

  if v_match_id is not null then
    update public.matches set is_featured_match = true where id = v_match_id;
  end if;

  return v_match_id;
end;
$$;

-- Permitir que usuarios autenticados invoquen el leaderboard
grant execute on function public.get_leaderboard(integer) to authenticated, anon;

-- ============================================================================
--  REALTIME: exponer cambios de tablas para Supabase Realtime
-- ============================================================================
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.predictions;
alter publication supabase_realtime add table public.profiles;

-- Necesario para que Realtime envíe los valores ANTIGUOS en los UPDATE
-- (así el front detecta la transición a 'pleno' y dispara el confeti una sola vez).
alter table public.predictions replica identity full;
