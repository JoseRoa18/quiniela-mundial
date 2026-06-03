// ============================================================================
//  Edge Function: score-matches  (Deno)
// ----------------------------------------------------------------------------
//  Qué hace:
//   1) (por defecto) Recorre los partidos 'finished' y calcula los puntos de
//      todos los pronósticos aún sin calcular (points_earned IS NULL),
//      escribiendo points_earned + result_type. El trigger sync_total_points
//      actualiza profiles.total_points automáticamente.
//   2) (?task=featured&matchday=N) Llama a set_random_featured_match(N) para
//      elegir el partido destacado de la jornada.
//
//  Despliegue:
//    supabase functions deploy score-matches
//    supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...   (URL ya viene dada)
//
//  Invocación (cron / manual):
//    curl -X POST "https://<ref>.functions.supabase.co/score-matches" \
//         -H "Authorization: Bearer <ANON_O_SERVICE_KEY>"
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ----------------------------------------------------------------------------
//  Lógica de puntuación (autocontenida, idéntica a src/lib/calculatePoints.ts):
//   Pleno 3 / Tendencia 1 / Fallo 0 · Destacado ×2 · Comodín ×2 si acierta,
//   o -1 fijo si falla. Los multiplicadores se apilan.
// ----------------------------------------------------------------------------
function outcomeSign(home: number, away: number): 'H' | 'D' | 'A' {
  if (home > away) return 'H';
  if (home < away) return 'A';
  return 'D';
}

function calculatePoints(input: {
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
  isFeaturedMatch?: boolean;
  usedWildcard?: boolean;
}): { points: number; outcome: 'pleno' | 'tendencia' | 'miss' } {
  const { predictedHome, predictedAway, actualHome, actualAway } = input;
  const isFeaturedMatch = input.isFeaturedMatch ?? false;
  const usedWildcard = input.usedWildcard ?? false;

  const exact = predictedHome === actualHome && predictedAway === actualAway;
  const sameTrend = outcomeSign(predictedHome, predictedAway) === outcomeSign(actualHome, actualAway);

  let outcome: 'pleno' | 'tendencia' | 'miss';
  let basePoints: number;
  if (exact) { outcome = 'pleno'; basePoints = 3; }
  else if (sameTrend) { outcome = 'tendencia'; basePoints = 1; }
  else { outcome = 'miss'; basePoints = 0; }

  const hit = outcome === 'pleno' || outcome === 'tendencia';
  if (!hit && usedWildcard) return { points: -1, outcome };

  const featuredMult = isFeaturedMatch ? 2 : 1;
  const wildcardMult = hit && usedWildcard ? 2 : 1;
  return { points: basePoints * featuredMult * wildcardMult, outcome };
}

interface MatchRow {
  id: string;
  home_score: number | null;
  away_score: number | null;
  is_featured_match: boolean;
}

interface PredictionRow {
  id: string;
  predicted_home: number;
  predicted_away: number;
  used_wildcard: boolean;
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const url = new URL(req.url);
  const task = url.searchParams.get('task');

  // ----- Tarea opcional: elegir partido destacado de una jornada -----
  if (task === 'featured') {
    const matchday = Number(url.searchParams.get('matchday'));
    if (!Number.isFinite(matchday)) {
      return json({ error: 'matchday inválido' }, 400);
    }
    const { data, error } = await supabase.rpc('set_random_featured_match', {
      p_matchday: matchday,
    });
    if (error) return json({ error: error.message }, 500);
    return json({ featured_match_id: data, matchday });
  }

  // ----- Tarea por defecto: calcular puntos de partidos finalizados -----
  const { data: matches, error: matchErr } = await supabase
    .from('matches')
    .select('id, home_score, away_score, is_featured_match')
    .eq('status', 'finished')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);

  if (matchErr) return json({ error: matchErr.message }, 500);

  let scoredCount = 0;
  const details: Array<Record<string, unknown>> = [];

  for (const match of (matches ?? []) as MatchRow[]) {
    // Solo pronósticos aún sin calcular para este partido
    const { data: preds, error: predErr } = await supabase
      .from('predictions')
      .select('id, predicted_home, predicted_away, used_wildcard')
      .eq('match_id', match.id)
      .is('points_earned', null);

    if (predErr) return json({ error: predErr.message }, 500);

    for (const p of (preds ?? []) as PredictionRow[]) {
      const result = calculatePoints({
        predictedHome: p.predicted_home,
        predictedAway: p.predicted_away,
        actualHome: match.home_score!,
        actualAway: match.away_score!,
        isFeaturedMatch: match.is_featured_match,
        usedWildcard: p.used_wildcard,
      });

      const { error: upErr } = await supabase
        .from('predictions')
        .update({
          points_earned: result.points,
          result_type: result.outcome, // 'pleno' | 'tendencia' | 'miss'
        })
        .eq('id', p.id);

      if (upErr) return json({ error: upErr.message }, 500);

      scoredCount++;
      details.push({ prediction: p.id, points: result.points, outcome: result.outcome });
    }
  }

  return json({ ok: true, scored: scoredCount, details });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
