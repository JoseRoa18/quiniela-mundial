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
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function sendPush(serviceUrl: string, serviceKey: string, user_id: string, title: string, body: string) {
  try {
    await fetch(`${serviceUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ user_id, title, body, url: '/' }),
    });
  } catch (_e) { /* no romper el cron por un fallo de push */ }
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
        SUPABASE_URL,
        SERVICE_ROLE,
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
