-- ============================================================================
--  Migración 0004 · Suscripciones de notificaciones push (Web Push / VAPID)
--  Ejecutar en el SQL Editor de Supabase.
-- ============================================================================
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,        -- URL del push service del navegador
  p256dh     text not null,               -- clave pública del cliente
  auth       text not null,               -- secreto de autenticación del cliente
  created_at timestamptz not null default now()
);

create index if not exists idx_push_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Cada usuario gestiona solo sus propias suscripciones.
create policy "push_select_own"
  on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "push_insert_own"
  on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "push_update_own"
  on public.push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "push_delete_own"
  on public.push_subscriptions for delete using (auth.uid() = user_id);
-- (El envío lo hace la Edge Function con service_role, que omite RLS.)
