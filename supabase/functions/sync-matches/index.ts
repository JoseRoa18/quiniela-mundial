// ============================================================================
//  Edge Function: sync-matches  (Deno)
// ----------------------------------------------------------------------------
//  Sincroniza los partidos de football-data.org -> tabla `matches` (UPSERT por
//  external_id). Pensada para un cron cada pocos minutos.
//
//  Además detecta EVENTOS comparando con el estado anterior y envía push
//  (broadcast a todos los suscritos): inicio, gol, medio tiempo y final.
//
//  Secrets: FOOTBALL_DATA_TOKEN, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
//           VAPID_SUBJECT (opcional). SUPABASE_URL/SERVICE_ROLE_KEY van dados.
//  Parámetros opcionales: ?competition=WC&season=2026&clean_demo=true&silent=true
// ============================================================================
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const STAGE_TO_MATCHDAY: Record<string, number> = {
  LAST_32: 4,
  LAST_16: 5,
  QUARTER_FINALS: 6,
  SEMI_FINALS: 7,
  THIRD_PLACE: 8,
  FINAL: 9,
};

function mapStatus(s: string): 'pending' | 'in_progress' | 'finished' {
  if (s === 'IN_PLAY' || s === 'PAUSED') return 'in_progress';
  if (s === 'FINISHED' || s === 'AWARDED') return 'finished';
  return 'pending';
}

// deno-lint-ignore no-explicit-any
function mapMatchday(m: any): number {
  if (m.stage === 'GROUP_STAGE' && m.matchday) return m.matchday;
  return STAGE_TO_MATCHDAY[m.stage] ?? m.matchday ?? 1;
}

// deno-lint-ignore no-explicit-any
function toRow(m: any) {
  return {
    external_id: m.id,
    matchday: mapMatchday(m),
    home_team: m.homeTeam?.name ?? m.homeTeam?.shortName ?? 'Por definir',
    away_team: m.awayTeam?.name ?? m.awayTeam?.shortName ?? 'Por definir',
    home_team_logo: m.homeTeam?.crest ?? null,
    away_team_logo: m.awayTeam?.crest ?? null,
    start_time: m.utcDate,
    status: mapStatus(m.status),
    home_score: m.score?.fullTime?.home ?? null,
    away_score: m.score?.fullTime?.away ?? null,
    stage: m.stage ?? null,
    group_name: m.group ?? null,
    api_status: m.status ?? null,
    // is_featured_match se omite a propósito: el upsert preserva el destacado.
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// ---------- Push (broadcast directo con web-push) ----------
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

interface SubRow { endpoint: string; p256dh: string; auth: string; }

async function broadcast(supabase: SupabaseClient, title: string, body: string): Promise<void> {
  if (!ensureVapid()) return;
  const { data: subs } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth');
  const payload = JSON.stringify({ title, body, url: '/' });
  for (const s of (subs ?? []) as SubRow[]) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
    }
  }
}

interface PrevRow { id: string; external_id: number; api_status: string | null; home_score: number | null; away_score: number | null; }

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const competition = url.searchParams.get('competition') ?? Deno.env.get('FD_COMPETITION') ?? 'WC';
  const season = url.searchParams.get('season') ?? Deno.env.get('FD_SEASON') ?? '2026';
  const cleanDemo = url.searchParams.get('clean_demo') === 'true';
  const silent = url.searchParams.get('silent') === 'true'; // no enviar push (útil para sync inicial)

  const token = Deno.env.get('FOOTBALL_DATA_TOKEN');
  if (!token) return json({ error: 'Falta el secret FOOTBALL_DATA_TOKEN' }, 500);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // ----- Traer los partidos de la API -----
  const apiUrl = new URL(`https://api.football-data.org/v4/competitions/${competition}/matches`);
  if (season) apiUrl.searchParams.set('season', season);
  const res = await fetch(apiUrl, { headers: { 'X-Auth-Token': token } });
  if (!res.ok) return json({ error: `football-data.org ${res.status}`, detail: await res.text() }, 502);
  const data = await res.json();
  // deno-lint-ignore no-explicit-any
  const matches = (data.matches ?? []) as any[];
  if (matches.length === 0) return json({ ok: true, synced: 0, note: 'sin partidos' });

  if (cleanDemo) await supabase.from('matches').delete().is('external_id', null);

  // ----- Estado anterior (para detectar eventos) -----
  const extIds = matches.map((m) => m.id);
  const { data: prevRows } = await supabase
    .from('matches')
    .select('id, external_id, api_status, home_score, away_score')
    .in('external_id', extIds);
  const prev = new Map<number, PrevRow>();
  for (const r of (prevRows ?? []) as PrevRow[]) prev.set(r.external_id, r);

  // ----- Detectar eventos -----
  const PRE = ['SCHEDULED', 'TIMED'];
  const PLAY = ['IN_PLAY', 'PAUSED'];
  const events: Array<{ title: string; body: string }> = [];
  const correctedMatchIds: string[] = []; // partidos ya finalizados cuyo marcador cambió
  for (const m of matches) {
    const p = prev.get(m.id);
    if (!p) continue; // partido nuevo: sin evento
    const pa = p.api_status;
    const ns: string = m.status;
    const nh = m.score?.fullTime?.home ?? null;
    const naw = m.score?.fullTime?.away ?? null;
    const scoreChanged = nh !== p.home_score || naw !== p.away_score;
    const home = m.homeTeam?.name ?? 'Local';
    const away = m.awayTeam?.name ?? 'Visitante';
    const marker = `${home} ${nh ?? 0}-${naw ?? 0} ${away}`;

    if (pa && PRE.includes(pa) && ns === 'IN_PLAY') {
      events.push({ title: '⚽ ¡Comienza el partido!', body: `${home} vs ${away}` });
    } else if (pa === 'IN_PLAY' && ns === 'PAUSED') {
      events.push({ title: '⏸️ Medio tiempo', body: marker });
    } else if (pa && PLAY.includes(pa) && ns === 'FINISHED') {
      events.push({ title: '🏁 Final del partido', body: marker });
    }
    // Gol: cambió el marcador mientras se juega
    if (pa && PLAY.includes(pa) && PLAY.includes(ns) && scoreChanged) {
      events.push({ title: '🥅 ¡GOOOL!', body: marker });
    }
    // Corrección: el partido YA estaba finalizado y el marcador cambió -> recalcular.
    if (pa === 'FINISHED' && scoreChanged) {
      correctedMatchIds.push(p.id);
      events.push({ title: '🔄 Resultado corregido', body: `${marker} · puntos actualizados` });
    }
  }

  // ----- UPSERT -----
  const rows = matches.map(toRow);
  const { error } = await supabase.from('matches').upsert(rows, { onConflict: 'external_id' });
  if (error) return json({ error: error.message }, 500);

  // ----- Re-cálculo por corrección de resultado -----
  // Si un partido ya finalizado cambió de marcador, reseteamos sus pronósticos
  // (points_earned = null) para que score-matches los vuelva a calcular bien.
  if (correctedMatchIds.length > 0) {
    await supabase
      .from('predictions')
      .update({ points_earned: null, result_type: 'pending' })
      .in('match_id', correctedMatchIds);
  }

  // ----- Enviar eventos (broadcast) -----
  if (!silent) {
    for (const e of events) await broadcast(supabase, e.title, e.body);
  }

  const liveCount = rows.filter((r) => r.status === 'in_progress').length;
  const finishedCount = rows.filter((r) => r.status === 'finished').length;
  return json({
    ok: true,
    synced: rows.length,
    live: liveCount,
    finished: finishedCount,
    events: events.length,
    corrected: correctedMatchIds.length,
    notified: silent ? 0 : events.length,
  });
});
