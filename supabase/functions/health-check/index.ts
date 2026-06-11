// ============================================================================
//  Edge Function: health-check  (Deno)
// ----------------------------------------------------------------------------
//  Monitoreo: compara la API con la base y detecta si algo dejó de funcionar.
//  Envía un push al ADMIN con el resumen (diario por cron, o manual).
//
//  Detecta:
//   · API/token de football-data caídos.
//   · Sync atrasado (la API dice "en juego/finalizado" pero la base sigue pendiente).
//   · Cálculo atrasado (partidos finalizados con pronósticos sin puntuar hace rato).
//
//  Secrets: FOOTBALL_DATA_TOKEN, VAPID_*, ADMIN_USER_ID (id del admin a notificar).
//  Despliegue: pegar en el editor como función "health-check".
// ============================================================================
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

// Por defecto el admin es Perpetrador; se puede sobreescribir con el secret ADMIN_USER_ID.
const DEFAULT_ADMIN = '7d812459-84f5-4a81-918f-2c264891e0b8';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function mapStatus(s: string): 'pending' | 'in_progress' | 'finished' {
  if (s === 'IN_PLAY' || s === 'PAUSED') return 'in_progress';
  if (s === 'FINISHED' || s === 'AWARDED') return 'finished';
  return 'pending';
}

let vapidReady = false;
function ensureVapid(): boolean {
  if (vapidReady) return true;
  const pub = Deno.env.get('VAPID_PUBLIC_KEY');
  const priv = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!pub || !priv) return false;
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@quiniela.app', pub, priv);
  vapidReady = true;
  return true;
}

async function notifyAdmin(supabase: SupabaseClient, userId: string, title: string, body: string) {
  if (!ensureVapid()) return;
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);
  const payload = JSON.stringify({ title, body, url: '/' });
  for (const s of subs ?? []) {
    try {
      // deno-lint-ignore no-explicit-any
      await webpush.sendNotification({ endpoint: (s as any).endpoint, keys: { p256dh: (s as any).p256dh, auth: (s as any).auth } }, payload);
    } catch (_e) { /* ignorar */ }
  }
}

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const adminId = Deno.env.get('ADMIN_USER_ID') ?? DEFAULT_ADMIN;
  const token = Deno.env.get('FOOTBALL_DATA_TOKEN');
  const problems: string[] = [];
  let apiCount = 0;

  // 1) API de football-data
  try {
    const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
      headers: { 'X-Auth-Token': token ?? '' },
    });
    if (!res.ok) {
      problems.push(`API football-data error ${res.status}`);
    } else {
      const data = await res.json();
      // deno-lint-ignore no-explicit-any
      const apiMatches = (data.matches ?? []) as any[];
      apiCount = apiMatches.length;

      // 2) Sync atrasado: la API dice en juego/finalizado pero la base sigue pendiente
      const { data: db } = await supabase.from('matches').select('external_id, status');
      const dbByExt = new Map<number, string>();
      for (const r of db ?? []) dbByExt.set(r.external_id as number, r.status as string);
      let mismatches = 0;
      for (const m of apiMatches) {
        const apiSt = mapStatus(m.status);
        const dbSt = dbByExt.get(m.id);
        if (apiSt !== 'pending' && dbSt && dbSt !== apiSt) mismatches++;
      }
      if (mismatches > 3) problems.push(`${mismatches} partidos desincronizados (sync atrasado)`);
    }
  } catch (e) {
    problems.push(`No se pudo consultar la API: ${(e as Error).message}`);
  }

  // 3) Cálculo atrasado: pronósticos sin puntuar de partidos finalizados hace > 3 h
  const threeHrsAgo = new Date(Date.now() - 3 * 3600_000).toISOString();
  const { data: staleP } = await supabase
    .from('predictions')
    .select('id, matches!inner(status, start_time)')
    .is('points_earned', null)
    .eq('matches.status', 'finished')
    .lt('matches.start_time', threeHrsAgo);
  const staleCount = staleP?.length ?? 0;
  if (staleCount > 0) problems.push(`${staleCount} pronósticos sin puntuar (cálculo atrasado)`);

  // Resumen + push al admin
  const ok = problems.length === 0;
  const title = ok ? '✅ Quiniela: todo OK' : '⚠️ Quiniela: revisar';
  const body = ok ? `Sync al día · ${apiCount} partidos en la API` : problems.join(' · ');
  await notifyAdmin(supabase, adminId, title, body);

  return json({ ok, problems, apiCount, staleCount });
});
