// ============================================================================
//  Edge Function: sync-matches  (Deno)
// ----------------------------------------------------------------------------
//  Sincroniza los partidos del Mundial. Estrategia híbrida:
//   · football-data.org -> ESTRUCTURA (equipos, fechas, fase, grupo, escudos).
//     NO toca el estado ni el marcador (su tier gratis no da datos en vivo).
//   · ESPN (no oficial, gratis) -> ESTADO + MARCADOR EN VIVO (esto sí funciona).
//
//  Además detecta EVENTOS y envía push (broadcast): inicio, gol, medio tiempo,
//  final y corrección de resultado. La puntuación la recalcula score-matches.
//
//  Secrets: FOOTBALL_DATA_TOKEN, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
//  Parámetros: ?clean_demo=true&silent=true
// ============================================================================
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const STAGE_TO_MATCHDAY: Record<string, number> = {
  LAST_32: 4, LAST_16: 5, QUARTER_FINALS: 6, SEMI_FINALS: 7, THIRD_PLACE: 8, FINAL: 9,
};

function mapStatus(api: string): 'pending' | 'in_progress' | 'finished' {
  if (api === 'IN_PLAY' || api === 'PAUSED') return 'in_progress';
  if (api === 'FINISHED') return 'finished';
  return 'pending';
}

// deno-lint-ignore no-explicit-any
function mapMatchday(m: any): number {
  if (m.stage === 'GROUP_STAGE' && m.matchday) return m.matchday;
  return STAGE_TO_MATCHDAY[m.stage] ?? m.matchday ?? 1;
}

// Fila de ESTRUCTURA desde football-data (sin estado/marcador).
// deno-lint-ignore no-explicit-any
function toStructureRow(m: any) {
  return {
    external_id: m.id,
    matchday: mapMatchday(m),
    home_team: m.homeTeam?.name ?? m.homeTeam?.shortName ?? 'Por definir',
    away_team: m.awayTeam?.name ?? m.awayTeam?.shortName ?? 'Por definir',
    home_team_logo: m.homeTeam?.crest ?? null,
    away_team_logo: m.awayTeam?.crest ?? null,
    start_time: m.utcDate,
    stage: m.stage ?? null,
    group_name: m.group ?? null,
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

// ---------- ESPN helpers ----------
function normTeam(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}
// deno-lint-ignore no-explicit-any
function espnApiStatus(type: any): string {
  const state = type?.state;
  if (state === 'pre') return 'TIMED';
  if (state === 'post') return 'FINISHED';
  return type?.name === 'STATUS_HALFTIME' ? 'PAUSED' : 'IN_PLAY';
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

interface DbRow {
  id: string; start_time: string; home_team: string; away_team: string;
  status: string; api_status: string | null; home_score: number | null; away_score: number | null;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const cleanDemo = url.searchParams.get('clean_demo') === 'true';
  const silent = url.searchParams.get('silent') === 'true';

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  if (cleanDemo) await supabase.from('matches').delete().is('external_id', null);

  // ----- 1) ESTRUCTURA desde football-data (no toca estado/marcador) -----
  const token = Deno.env.get('FOOTBALL_DATA_TOKEN');
  let structureCount = 0;
  if (token) {
    try {
      const fd = await fetch('https://api.football-data.org/v4/competitions/WC/matches?season=2026', {
        headers: { 'X-Auth-Token': token },
      });
      if (fd.ok) {
        // deno-lint-ignore no-explicit-any
        const fdMatches = ((await fd.json()).matches ?? []) as any[];
        if (fdMatches.length > 0) {
          const rows = fdMatches.map(toStructureRow);
          await supabase.from('matches').upsert(rows, { onConflict: 'external_id' });
          structureCount = rows.length;
        }
      }
    } catch (_e) { /* la estructura ya está cargada; no bloquear por esto */ }
  }

  // ----- 2) Estado anterior de la base (para matching + detección de eventos) -----
  const { data: dbRows } = await supabase
    .from('matches')
    .select('id, start_time, home_team, away_team, status, api_status, home_score, away_score');
  const byTime = new Map<number, DbRow[]>();
  for (const r of (dbRows ?? []) as DbRow[]) {
    const t = Date.parse(r.start_time);
    if (!byTime.has(t)) byTime.set(t, []);
    byTime.get(t)!.push(r);
  }

  // ----- 3) ESTADO + MARCADOR EN VIVO desde ESPN -----
  const now = Date.now();
  const dates = [ymd(new Date(now - 86400000)), ymd(new Date(now)), ymd(new Date(now + 86400000))];
  const PRE = ['SCHEDULED', 'TIMED'];
  const PLAY = ['IN_PLAY', 'PAUSED'];
  const events: Array<{ title: string; body: string }> = [];
  const correctedIds: string[] = [];
  let updated = 0;

  for (const date of dates) {
    // deno-lint-ignore no-explicit-any
    let evs: any[] = [];
    try {
      const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${date}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (r.ok) evs = (await r.json()).events ?? [];
    } catch (_e) { continue; }

    for (const e of evs) {
      const comp = e.competitions?.[0];
      if (!comp) continue;
      // deno-lint-ignore no-explicit-any
      const cs: Record<string, any> = {};
      for (const c of comp.competitors ?? []) cs[c.homeAway] = c;
      if (!cs.home || !cs.away) continue;

      const t = Date.parse(e.date);
      const cands = byTime.get(t) ?? [];
      let m: DbRow | undefined;
      if (cands.length === 1) {
        m = cands[0];
      } else if (cands.length > 1) {
        const eh = normTeam(cs.home.team?.displayName);
        const ea = normTeam(cs.away.team?.displayName);
        m = cands.find((c) => normTeam(c.home_team) === eh && normTeam(c.away_team) === ea)
          ?? cands.find((c) => {
            const s = new Set([normTeam(c.home_team), normTeam(c.away_team)]);
            return s.has(eh) && s.has(ea);
          });
      }
      if (!m) continue;

      const apiName = espnApiStatus(e.status?.type);
      const ns = mapStatus(apiName);
      const hp = parseInt(cs.home.score ?? '', 10);
      const ap = parseInt(cs.away.score ?? '', 10);
      const nh = Number.isFinite(hp) ? hp : null;
      const naw = Number.isFinite(ap) ? ap : null;

      const pa = m.api_status;
      const home = m.home_team;
      const away = m.away_team;
      const marker = `${home} ${nh ?? 0}-${naw ?? 0} ${away}`;
      const scoreChanged = nh !== m.home_score || naw !== m.away_score;
      const statusChanged = apiName !== pa;

      // Eventos
      if (pa && PRE.includes(pa) && apiName === 'IN_PLAY') {
        events.push({ title: '⚽ ¡Comienza el partido!', body: `${home} vs ${away}` });
      } else if (pa === 'IN_PLAY' && apiName === 'PAUSED') {
        events.push({ title: '⏸️ Medio tiempo', body: marker });
      } else if (pa && PLAY.includes(pa) && apiName === 'FINISHED') {
        events.push({ title: '🏁 Final del partido', body: marker });
      }
      if (pa && PLAY.includes(pa) && PLAY.includes(apiName) && scoreChanged) {
        events.push({ title: '🥅 ¡GOOOL!', body: marker });
      }
      if (pa === 'FINISHED' && scoreChanged) {
        correctedIds.push(m.id);
        events.push({ title: '🔄 Resultado corregido', body: `${marker} · puntos actualizados` });
      }

      // Actualizar solo si cambió algo
      if (statusChanged || scoreChanged) {
        await supabase
          .from('matches')
          .update({ status: ns, home_score: nh, away_score: naw, api_status: apiName })
          .eq('id', m.id);
        updated++;
      }
    }
  }

  // ----- Re-cálculo por corrección -----
  if (correctedIds.length > 0) {
    await supabase.from('predictions').update({ points_earned: null, result_type: 'pending' }).in('match_id', correctedIds);
  }

  // ----- Broadcast -----
  if (!silent) {
    for (const e of events) await broadcast(supabase, e.title, e.body);
  }

  return json({ ok: true, structure: structureCount, updated, corrected: correctedIds.length, events: events.length });
});
