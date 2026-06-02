/**
 * ============================================================================
 *  Sistema de puntuación · Quiniela Deportiva
 * ============================================================================
 *
 *  Reglas base
 *   · Pleno     (goles exactos en local y visitante) ............ 3 pts
 *   · Tendencia (acierta ganador/empate, falla los goles) ....... 1 pt
 *   · Fallo     (falla el resultado 1X2) ........................ 0 pts
 *
 *  Multiplicadores (se aplican SOBRE los puntos base)
 *   · Partido destacado (isFeaturedMatch) -> ×2
 *   · Comodín (usedWildcard):
 *        - si ACIERTA (pleno o tendencia) -> ×2 adicional
 *        - si FALLA                       -> los puntos pasan a -1 (penalización fija)
 *
 *  Orden de operaciones (decisión explícita — cámbialo si tu regla difiere):
 *   1. Puntos base según el tipo de acierto.
 *   2. Si es FALLO + comodín  -> resultado = -1 (el destacado NO duplica la
 *      penalización; "los puntos obtenidos son -1" se interpreta como valor fijo).
 *   3. Si ACIERTA -> base × (destacado ? 2 : 1) × (comodín ? 2 : 1).
 *
 *  Tabla de resultados posibles:
 *   Pleno: 3 | destacado 6 | comodín 6 | destacado+comodín 12
 *   Tend.: 1 | destacado 2 | comodín 2 | destacado+comodín 4
 *   Fallo: 0 | con comodín -1 (en cualquier caso)
 * ============================================================================
 */

export type Outcome = 'pleno' | 'tendencia' | 'miss';

export interface ScoringInput {
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
  isFeaturedMatch?: boolean;
  usedWildcard?: boolean;
}

export interface ScoringResult {
  /** Puntos finales que recibe el usuario (puede ser negativo por el comodín). */
  points: number;
  /** Tipo de acierto, mapeable a predictions.result_type. */
  outcome: Outcome;
  /** Puntos base antes de multiplicadores (3 / 1 / 0). */
  basePoints: number;
  /** Multiplicador efectivo aplicado a los aciertos (1, 2 o 4). */
  multiplier: number;
  /** True si el destacado afectó el cálculo. */
  featuredApplied: boolean;
  /** True si el comodín afectó el cálculo (acierto duplicado o penalización). */
  wildcardApplied: boolean;
}

/** Devuelve el signo del resultado: 'H' local gana, 'A' visitante gana, 'D' empate. */
function outcomeSign(home: number, away: number): 'H' | 'D' | 'A' {
  if (home > away) return 'H';
  if (home < away) return 'A';
  return 'D';
}

/**
 * Calcula los puntos de un pronóstico. Función pura: misma entrada → misma salida.
 * Pensada para usarse tanto en la Edge Function de cálculo como en la UI (preview).
 */
export function calculatePoints(input: ScoringInput): ScoringResult {
  const {
    predictedHome,
    predictedAway,
    actualHome,
    actualAway,
    isFeaturedMatch = false,
    usedWildcard = false,
  } = input;

  // --- 1. Determinar el tipo de acierto ---
  const exact =
    predictedHome === actualHome && predictedAway === actualAway;
  const sameTrend =
    outcomeSign(predictedHome, predictedAway) ===
    outcomeSign(actualHome, actualAway);

  let outcome: Outcome;
  let basePoints: number;

  if (exact) {
    outcome = 'pleno';
    basePoints = 3;
  } else if (sameTrend) {
    outcome = 'tendencia';
    basePoints = 1;
  } else {
    outcome = 'miss';
    basePoints = 0;
  }

  const hit = outcome === 'pleno' || outcome === 'tendencia';

  // --- 2. Fallo con comodín => penalización fija de -1 ---
  if (!hit && usedWildcard) {
    return {
      points: -1,
      outcome,
      basePoints,
      multiplier: 1,
      featuredApplied: false, // el destacado no duplica la penalización
      wildcardApplied: true,
    };
  }

  // --- 3. Aplicar multiplicadores a los aciertos ---
  const featuredMult = isFeaturedMatch ? 2 : 1;
  const wildcardMult = hit && usedWildcard ? 2 : 1;
  const multiplier = featuredMult * wildcardMult;

  return {
    points: basePoints * multiplier,
    outcome,
    basePoints,
    multiplier,
    featuredApplied: isFeaturedMatch && basePoints > 0,
    wildcardApplied: hit && usedWildcard,
  };
}
