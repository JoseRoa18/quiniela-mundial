// ============================================================================
//  Edge Function: sync-matches  (Deno)
// ----------------------------------------------------------------------------
//  Sincroniza los partidos de football-data.org -> tabla `matches` (UPSERT por
//  external_id). Pensada para ejecutarse desde un cron (pg_cron) cada pocos
//  minutos, de modo que los marcadores y estados se actualicen EN VIVO sin
//  necesidad de tener nada corriendo en local.
//
//  Variables de entorno (Edge Function "secrets"):
//   · SUPABASE_URL                -> inyectada automáticamente por Supabase
//   · SUPABASE_SERVICE_ROLE_KEY   -> inyectada automáticamente por Supabase
//   · FOOTBALL_DATA_TOKEN         -> tu token de football-data.org (configúralo)
//   · FD_COMPETITION (opcional)   -> por defecto 'WC' (FIFA World Cup)
//   · FD_SEASON (opcional)        -> por defecto '2026'
//
//  Despliegue (opción CLI):
//    supabase functions deploy sync-matches
//    supabase secrets set FOOTBALL_DATA_TOKEN=tu-token
//
//  Invocación manual:
//    curl -X POST "https://<ref>.supabase.co/functions/v1/sync-matches" \
//         -H "Authorization: Bearer <ANON_KEY>"
//  Parámetros opcionales: ?competition=WC&season=2026&clean_demo=true
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    // is_featured_match se omite a propósito: el upsert preserva el destacado.
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const competition = url.searchParams.get('competition') ?? Deno.env.get('FD_COMPETITION') ?? 'WC';
  const season = url.searchParams.get('season') ?? Deno.env.get('FD_SEASON') ?? '2026';
  const cleanDemo = url.searchParams.get('clean_demo') === 'true';

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
  if (!res.ok) {
    return json({ error: `football-data.org ${res.status}`, detail: await res.text() }, 502);
  }
  const data = await res.json();
  const matches = (data.matches ?? []) as unknown[];
  if (matches.length === 0) return json({ ok: true, synced: 0, note: 'sin partidos' });

  // ----- (Opcional) limpiar partidos demo -----
  if (cleanDemo) {
    await supabase.from('matches').delete().is('external_id', null);
  }

  // ----- UPSERT -----
  const rows = matches.map(toRow);
  const { error } = await supabase.from('matches').upsert(rows, { onConflict: 'external_id' });
  if (error) return json({ error: error.message }, 500);

  const live = rows.filter((r) => r.status === 'in_progress').length;
  const finished = rows.filter((r) => r.status === 'finished').length;
  return json({ ok: true, synced: rows.length, live, finished, pending: rows.length - live - finished });
});
