/**
 * ============================================================================
 *  sync-matches.mjs · Sincroniza partidos desde football-data.org → Supabase
 * ----------------------------------------------------------------------------
 *  Trae los partidos de una competición (por defecto el Mundial, WC) y los
 *  hace UPSERT en la tabla `matches` usando el external_id, de modo que se
 *  pueden refrescar marcadores y estados EN VIVO sin duplicar filas.
 *
 *  Requisitos previos:
 *    1. Haber ejecutado supabase/migrations/0001_add_external_id.sql
 *    2. Variables de entorno (en .env):
 *         VITE_SUPABASE_URL            (ya la tienes)
 *         SUPABASE_SERVICE_ROLE_KEY    (Settings → API → service_role · SECRETA)
 *         FOOTBALL_DATA_TOKEN          (token gratis de football-data.org)
 *         FD_COMPETITION=WC            (opcional; WC = FIFA World Cup)
 *         FD_SEASON=2026               (opcional; año de la temporada)
 *         CLEAN_DEMO=true              (opcional; borra los partidos demo, external_id NULL)
 *
 *  Uso:
 *    node --env-file=.env scripts/sync-matches.mjs            # una pasada
 *    node --env-file=.env scripts/sync-matches.mjs --watch=30 # refresca cada 30s
 * ============================================================================
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOKEN = process.env.FOOTBALL_DATA_TOKEN;
const COMPETITION = process.env.FD_COMPETITION || 'WC';
const SEASON = process.env.FD_SEASON || '';
const CLEAN_DEMO = process.env.CLEAN_DEMO === 'true';

// --- Validación de configuración -------------------------------------------
function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}
if (!SUPABASE_URL) fail('Falta VITE_SUPABASE_URL en .env');
if (!SERVICE_ROLE) fail('Falta SUPABASE_SERVICE_ROLE_KEY en .env (Settings → API → service_role)');
if (!TOKEN) fail('Falta FOOTBALL_DATA_TOKEN en .env (regístrate gratis en football-data.org)');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- Mapeos football-data.org → esquema de la quiniela ----------------------

// Estado del partido → enum match_status ('pending' | 'in_progress' | 'finished')
function mapStatus(s) {
  if (s === 'IN_PLAY' || s === 'PAUSED') return 'in_progress';
  if (s === 'FINISHED' || s === 'AWARDED') return 'finished';
  return 'pending'; // SCHEDULED, TIMED, POSTPONED, SUSPENDED, CANCELLED...
}

// Fase del Mundial → "jornada" (entero) que usa la app para agrupar.
// Grupos: usamos la matchday de la API (1, 2, 3). Eliminatorias: números fijos.
// (El Mundial 2026 tiene 48 equipos → incluye dieciseisavos / LAST_32.)
const STAGE_TO_MATCHDAY = {
  LAST_32: 4,
  LAST_16: 5,
  QUARTER_FINALS: 6,
  SEMI_FINALS: 7,
  THIRD_PLACE: 8,
  FINAL: 9,
};
function mapMatchday(m) {
  if (m.stage === 'GROUP_STAGE' && m.matchday) return m.matchday;
  return STAGE_TO_MATCHDAY[m.stage] ?? m.matchday ?? 1;
}

function toRow(m) {
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
    // OJO: NO incluimos is_featured_match a propósito. Al omitirlo, el upsert
    // preserva el destacado que haya elegido set_random_featured_match().
  };
}

// --- Llamada a la API -------------------------------------------------------
async function fetchMatches() {
  const url = new URL(`https://api.football-data.org/v4/competitions/${COMPETITION}/matches`);
  if (SEASON) url.searchParams.set('season', SEASON);

  const res = await fetch(url, { headers: { 'X-Auth-Token': TOKEN } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`football-data.org respondió ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.matches ?? [];
}

// --- Una pasada de sincronización ------------------------------------------
async function syncOnce() {
  const stamp = new Date().toISOString().slice(11, 19);
  const matches = await fetchMatches();

  if (matches.length === 0) {
    console.log(`[${stamp}] La API no devolvió partidos para ${COMPETITION}${SEASON ? ' ' + SEASON : ''}.`);
    return;
  }

  const rows = matches.map(toRow);
  const { error } = await supabase
    .from('matches')
    .upsert(rows, { onConflict: 'external_id' });
  if (error) throw new Error(`Supabase upsert falló: ${error.message}`);

  const live = rows.filter((r) => r.status === 'in_progress').length;
  const finished = rows.filter((r) => r.status === 'finished').length;
  const pending = rows.filter((r) => r.status === 'pending').length;
  console.log(
    `[${stamp}] ✅ ${rows.length} partidos sincronizados · ` +
      `${live} en juego · ${finished} finalizados · ${pending} pendientes`,
  );

  if (live > 0) {
    for (const r of rows.filter((x) => x.status === 'in_progress')) {
      console.log(`        🔴 EN VIVO  ${r.home_team} ${r.home_score ?? 0}-${r.away_score ?? 0} ${r.away_team}`);
    }
  }
}

// --- Limpieza opcional de los partidos demo --------------------------------
async function cleanDemo() {
  const { error, count } = await supabase
    .from('matches')
    .delete({ count: 'exact' })
    .is('external_id', null);
  if (error) throw new Error(`No se pudieron borrar los demos: ${error.message}`);
  console.log(`🧹 Borrados ${count ?? 0} partidos demo (external_id NULL).`);
}

// --- Main -------------------------------------------------------------------
const watchArg = process.argv.find((a) => a.startsWith('--watch'));
const watchSeconds = watchArg ? Number(watchArg.split('=')[1] || 30) : 0;

try {
  if (CLEAN_DEMO) await cleanDemo();
  await syncOnce();

  if (watchSeconds > 0) {
    console.log(`\n👀 Modo watch: refrescando cada ${watchSeconds}s. Ctrl+C para parar.\n`);
    setInterval(() => {
      syncOnce().catch((e) => console.error('⚠️  Error en refresco:', e.message));
    }, watchSeconds * 1000);
  }
} catch (e) {
  fail(e.message);
}
