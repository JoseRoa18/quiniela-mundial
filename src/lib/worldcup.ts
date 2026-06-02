/**
 * ============================================================================
 *  Utilidades de la Copa Mundial 2026
 * ----------------------------------------------------------------------------
 *  La app agrupa los partidos por `matchday` (entero). Aquí traducimos ese
 *  número a la fase real del torneo (lo mapea el sync en STAGE_TO_MATCHDAY):
 *    1-3 → Fase de grupos · 4 → 1/16 · 5 → Octavos · 6 → Cuartos
 *    7 → Semifinales · 8 → Tercer puesto · 9 → Final
 * ============================================================================
 */

export interface StageInfo {
  /** Etiqueta larga, p. ej. "Fase de Grupos · Jornada 1". */
  label: string;
  /** Etiqueta corta para chips, p. ej. "Grupos · J1". */
  short: string;
  /** True en eliminatorias (para acentos especiales). */
  knockout: boolean;
}

export function stageForMatchday(md: number): StageInfo {
  switch (md) {
    case 1:
      return { label: 'Fase de Grupos · Jornada 1', short: 'Grupos · J1', knockout: false };
    case 2:
      return { label: 'Fase de Grupos · Jornada 2', short: 'Grupos · J2', knockout: false };
    case 3:
      return { label: 'Fase de Grupos · Jornada 3', short: 'Grupos · J3', knockout: false };
    case 4:
      return { label: 'Dieciseisavos de Final', short: '1/16', knockout: true };
    case 5:
      return { label: 'Octavos de Final', short: 'Octavos', knockout: true };
    case 6:
      return { label: 'Cuartos de Final', short: 'Cuartos', knockout: true };
    case 7:
      return { label: 'Semifinales', short: 'Semifinal', knockout: true };
    case 8:
      return { label: 'Partido por el Tercer Puesto', short: '3er Puesto', knockout: true };
    case 9:
      return { label: 'Gran Final', short: 'Final', knockout: true };
    default:
      return { label: `Jornada ${md}`, short: `J${md}`, knockout: false };
  }
}

/** "mié 11 jun · 21:00" en la zona horaria del usuario. */
export function formatKickoff(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const date = d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

/** Banderas de los países anfitriones del Mundial 2026. */
export const HOST_FLAGS = '🇨🇦 🇺🇸 🇲🇽';
