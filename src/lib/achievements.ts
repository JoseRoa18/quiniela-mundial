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
  const hits = preds.filter((p) => p.result_type === 'pleno' || p.result_type === 'tendencia').length;
  const points = preds.reduce((s, p) => s + (p.points_earned ?? 0), 0);
  const wildcardWins = preds.filter(
    (p) => p.used_wildcard && (p.result_type === 'pleno' || p.result_type === 'tendencia'),
  ).length;

  // ¿Alguna jornada con TODOS los pronósticos en pleno? (mín. 2 partidos)
  const byMd = new Map<number, Prediction[]>();
  for (const p of preds) {
    if (p.matchday == null) continue;
    if (!byMd.has(p.matchday)) byMd.set(p.matchday, []);
    byMd.get(p.matchday)!.push(p);
  }
  const perfectMatchday = [...byMd.values()].some(
    (list) => list.length >= 2 && list.every((p) => p.result_type === 'pleno'),
  );

  const defs: Array<Omit<Achievement, 'earned'> & { earned: boolean }> = [
    { id: 'debut', icon: '⚽', name: 'Debut', desc: 'Hiciste tu primer pronóstico', earned: total >= 1 },
    { id: 'first_pleno', icon: '🎯', name: 'Primer Pleno', desc: 'Acertaste un marcador exacto', earned: plenos >= 1 },
    { id: 'triplete', icon: '🎩', name: 'Triplete', desc: 'Lograste 3 plenos', earned: plenos >= 3 },
    { id: 'oraculo', icon: '🔮', name: 'Oráculo', desc: 'Lograste 5 plenos', earned: plenos >= 5 },
    { id: 'valiente', icon: '✨', name: 'Valiente', desc: 'Ganaste puntos usando el comodín', earned: wildcardWins >= 1 },
    { id: 'perfecta', icon: '💎', name: 'Jornada Perfecta', desc: 'Pleno en todos los partidos de una jornada', earned: perfectMatchday },
    { id: 'sabio', icon: '🧠', name: 'Sabio', desc: 'Acumulaste 10 aciertos', earned: hits >= 10 },
    { id: 'quinielero', icon: '📋', name: 'Quinielero', desc: 'Hiciste 20 pronósticos', earned: total >= 20 },
    { id: 'centurion', icon: '🏆', name: 'Centurión', desc: 'Alcanzaste 50 puntos', earned: points >= 50 },
  ];

  return defs;
}
