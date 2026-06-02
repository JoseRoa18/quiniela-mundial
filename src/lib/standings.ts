/**
 * ============================================================================
 *  Tabla de posiciones de la fase de grupos (cálculo puro)
 * ----------------------------------------------------------------------------
 *  A partir de los partidos (con marcador) calcula, por grupo, la clasificación
 *  con los criterios FIFA simplificados:
 *    1) Puntos (3 victoria / 1 empate / 0 derrota)
 *    2) Diferencia de goles
 *    3) Goles a favor
 *  (El desempate por enfrentamiento directo no se implementa; es poco frecuente
 *   y requiere lógica adicional.)
 * ============================================================================
 */
import type { Match } from '../types/database';

export interface TeamStanding {
  team: string;
  logo: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

/** ¿El partido aporta resultado a la tabla? (en juego o finalizado, con marcador) */
function hasResult(m: Match): boolean {
  return (
    (m.status === 'finished' || m.status === 'in_progress') &&
    m.home_score != null &&
    m.away_score != null
  );
}

function blank(team: string, logo: string | null): TeamStanding {
  return { team, logo, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
}

/**
 * Devuelve un mapa { 'GROUP_A': TeamStanding[] ordenado, ... } a partir de los
 * partidos de fase de grupos. Incluye a todos los equipos del grupo aunque aún
 * no hayan jugado (aparecen con todo en 0).
 */
export function computeGroupStandings(matches: Match[]): Map<string, TeamStanding[]> {
  const groups = new Map<string, Map<string, TeamStanding>>();

  const groupMatches = matches.filter(
    (m) => m.stage === 'GROUP_STAGE' && m.group_name,
  );

  // 1) Sembrar todos los equipos del grupo (para que salgan aunque no hayan jugado)
  for (const m of groupMatches) {
    const g = m.group_name as string;
    if (!groups.has(g)) groups.set(g, new Map());
    const table = groups.get(g)!;
    if (!table.has(m.home_team)) table.set(m.home_team, blank(m.home_team, m.home_team_logo));
    if (!table.has(m.away_team)) table.set(m.away_team, blank(m.away_team, m.away_team_logo));
  }

  // 2) Acumular resultados
  for (const m of groupMatches) {
    if (!hasResult(m)) continue;
    const table = groups.get(m.group_name as string)!;
    const home = table.get(m.home_team)!;
    const away = table.get(m.away_team)!;
    const hs = m.home_score as number;
    const as = m.away_score as number;

    home.played++; away.played++;
    home.gf += hs; home.ga += as;
    away.gf += as; away.ga += hs;

    if (hs > as) {
      home.won++; home.points += 3; away.lost++;
    } else if (hs < as) {
      away.won++; away.points += 3; home.lost++;
    } else {
      home.drawn++; away.drawn++; home.points++; away.points++;
    }
  }

  // 3) Diferencia de goles + ordenar
  const result = new Map<string, TeamStanding[]>();
  for (const [g, table] of groups) {
    const rows = [...table.values()];
    for (const r of rows) r.gd = r.gf - r.ga;
    rows.sort(
      (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team),
    );
    result.set(g, rows);
  }
  return result;
}

/** 'GROUP_A' → 'Grupo A' */
export function groupLabel(groupName: string): string {
  const letter = groupName.replace('GROUP_', '');
  return `Grupo ${letter}`;
}
