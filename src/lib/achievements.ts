/**
 * ============================================================================
 *  Logros / Insignias · se calculan a partir de los pronósticos del usuario.
 * ============================================================================
 */
import type { Prediction } from '../types/database';

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string; // emoji
  earned: boolean;
}

export function computeAchievements(preds: Prediction[]): Achievement[] {
  const total = preds.length;
  const plenos = preds.filter((p) => p.result_type === 'pleno').length;
  const tendencias = preds.filter((p) => p.result_type === 'tendencia').length;
  const hits = plenos + tendencias;
  const points = preds.reduce((s, p) => s + (p.points_earned ?? 0), 0);
  const wildcardWins = preds.filter(
    (p) => p.used_wildcard && (p.result_type === 'pleno' || p.result_type === 'tendencia'),
  ).length;

  // Agrupar por jornada
  const byMd = new Map<number, Prediction[]>();
  for (const p of preds) {
    if (p.matchday == null) continue;
    if (!byMd.has(p.matchday)) byMd.set(p.matchday, []);
    byMd.get(p.matchday)!.push(p);
  }
  const distinctMatchdays = byMd.size;
  const perfectMatchday = [...byMd.values()].some(
    (list) => list.length >= 2 && list.every((p) => p.result_type === 'pleno'),
  );

  const defs: Array<Omit<Achievement, 'earned'> & { earned: boolean }> = [
    { id: 'debut', icon: '⚽', name: 'Debut', desc: 'Hiciste tu primer pronóstico', earned: total >= 1 },
    { id: 'first_pleno', icon: '🎯', name: 'Primer Pleno', desc: 'Acertaste un marcador exacto', earned: plenos >= 1 },
    { id: 'doblete', icon: '🥈', name: 'Doblete', desc: 'Lograste 2 plenos', earned: plenos >= 2 },
    { id: 'triplete', icon: '🎩', name: 'Triplete', desc: 'Lograste 3 plenos', earned: plenos >= 3 },
    { id: 'oraculo', icon: '🔮', name: 'Oráculo', desc: 'Lograste 5 plenos', earned: plenos >= 5 },
    { id: 'vidente', icon: '👁️', name: 'Vidente', desc: 'Lograste 8 plenos', earned: plenos >= 8 },
    { id: 'perfecta', icon: '💎', name: 'Jornada Perfecta', desc: 'Pleno en todos los partidos de una jornada', earned: perfectMatchday },
    { id: 'valiente', icon: '✨', name: 'Valiente', desc: 'Ganaste puntos usando el comodín', earned: wildcardWins >= 1 },
    { id: 'comodin_maestro', icon: '🃏', name: 'Comodín Maestro', desc: 'Ganaste 3 veces con el comodín', earned: wildcardWins >= 3 },
    { id: 'tendencioso', icon: '📈', name: 'Tendencioso', desc: 'Acertaste 10 tendencias', earned: tendencias >= 10 },
    { id: 'sabio', icon: '🧠', name: 'Sabio', desc: 'Acumulaste 10 aciertos', earned: hits >= 10 },
    { id: 'intuicion', icon: '🧭', name: 'Intuición', desc: 'Acumulaste 25 aciertos', earned: hits >= 25 },
    { id: 'constante', icon: '📆', name: 'Constante', desc: 'Pronosticaste en 3 jornadas distintas', earned: distinctMatchdays >= 3 },
    { id: 'quinielero', icon: '📋', name: 'Quinielero', desc: 'Hiciste 20 pronósticos', earned: total >= 20 },
    { id: 'veterano', icon: '🎖️', name: 'Veterano', desc: 'Hiciste 50 pronósticos', earned: total >= 50 },
    { id: 'centurion', icon: '🏆', name: 'Centurión', desc: 'Alcanzaste 50 puntos', earned: points >= 50 },
    { id: 'leyenda', icon: '👑', name: 'Leyenda', desc: 'Alcanzaste 100 puntos', earned: points >= 100 },
  ];

  return defs;
}
