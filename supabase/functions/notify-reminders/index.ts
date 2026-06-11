// ============================================================================
//  Edge Function: notify-reminders  (Deno)
// ----------------------------------------------------------------------------
//  Recordatorio de cierre: busca partidos cuyo pronóstico cierra pronto
//  (el cierre es 30 min antes del inicio) y avisa por push a los usuarios que
//  AÚN no han pronosticado ese partido. Marca el partido (close_notified) para
//  no repetir el aviso.
//
//  Pensada para un cron cada ~10-15 min.
//  Reutiliza la Edge Function send-push (que tiene las claves VAPID).
//
//  Despliegue: pegar en el editor del dashboard como función "notify-reminders".
// ============================================================================
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Envío DIRECTO (web-push + VAPID), sin depender de la función send-push.
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

async function sendPush(supabase: SupabaseClient, user_id: string, title: string, body: string) {
  if (!ensureVapid()) return;
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user_id);
  const payload = JSON.stringify({ title, body, url: '/' });
  for (const s of subs ?? []) {
    try {
      // deno-lint-ignore no-explicit-any
      const ss = s as any;
      await webpush.sendNotification({ endpoint: ss.endpoint, keys: { p256dh: ss.p256dh, auth: ss.auth } }, payload);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await supabase.from('push_subscriptions').delete().eq('endpoint', (s as { endpoint: string }).endpoint);
    }
  }
}

Deno.serve(async () => {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Ventana: el cierre (inicio - 30 min) ocurre dentro de los próximos ~60 min.
  // Es decir, el inicio está entre ahora+30min y ahora+90min.
  const now = Date.now();
  const fromISO = new Date(now + 30 * 60_000).toISOString();
  const toISO = new Date(now + 90 * 60_000).toISOString();

  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, home_team, away_team')
    .eq('status', 'pending')
    .eq('close_notified', false)
    .gte('start_time', fromISO)
    .lte('start_time', toISO);

  if (error) return json({ error: error.message }, 500);
  if (!matches || matches.length === 0) return json({ ok: true, matches: 0, notified: 0 });

  // Todos los jugadores
  const { data: profiles } = await supabase.from('profiles').select('id');
  const allUserIds = (profiles ?? []).map((p) => p.id as string);

  const notifiedUsers = new Set<string>();
  for (const m of matches) {
    // Quiénes YA pronosticaron este partido
    const { data: preds } = await supabase.from('predictions').select('user_id').eq('match_id', m.id);
    const predicted = new Set((preds ?? []).map((p) => p.user_id as string));
    const missing = allUserIds.filter((uid) => !predicted.has(uid));

    for (const uid of missing) {
      // Un solo aviso por usuario aunque le falten varios partidos en esta ventana.
      if (notifiedUsers.has(uid)) continue;
      notifiedUsers.add(uid);
      await sendPush(
        supabase,
        uid,
        '⏰ ¡Cierran pronósticos!',
        'Te faltan partidos por pronosticar antes de que cierren. ¡No te quedes fuera!',
      );
    }
  }

  // Marcar los partidos como ya avisados
  const ids = matches.map((m) => m.id);
  await supabase.from('matches').update({ close_notified: true }).in('id', ids);

  return json({ ok: true, matches: matches.length, notified: notifiedUsers.size });
});
