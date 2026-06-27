import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { MatchStatus } from '../types/database';

// Nombres de canal únicos: el hook se usa en varios sitios a la vez (App y
// MatchdaySummary). Dos canales con el mismo nombre suscritos rompen Realtime.
let channelSeq = 0;

interface MdRow {
  matchday: number;
  status: MatchStatus;
  start_time: string;
}

/**
 * La jornada "actual": la del primer partido que aún no ha terminado
 * (en juego o por jugar), ordenando por hora de inicio. Si ya terminaron
 * todos, devuelve la última jornada con partidos.
 *
 * Función pura para poder probarla sin tocar la red.
 */
export function currentMatchdayFrom(rows: MdRow[]): number | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const next = sorted.find((r) => r.status !== 'finished');
  if (next) return next.matchday;
  return sorted[sorted.length - 1].matchday;
}

/**
 * Hook que resuelve la jornada actual desde la base de datos y se mantiene al
 * día vía Realtime. Devuelve `null` mientras carga (para que quien lo use pueda
 * mantener un valor por defecto hasta entonces).
 */
export function useCurrentMatchday(): number | null {
  const [matchday, setMatchday] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase.from('matches').select('matchday, status, start_time');
      if (active && data) setMatchday(currentMatchdayFrom(data as MdRow[]));
    }
    void load();

    const channel = supabase
      .channel(`current-matchday-${++channelSeq}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => void load())
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  return matchday;
}
