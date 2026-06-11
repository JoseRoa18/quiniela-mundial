import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Match } from '../types/database';

// Nombres de canal únicos (evita colisiones si el hook se usa en varios sitios).
let channelSeq = 0;

/**
 * Trae TODOS los partidos del torneo (no filtra por jornada) y se mantiene
 * al día vía Realtime. Lo usan las vistas de Grupos y Eliminatorias, que
 * necesitan el cuadro completo para calcular posiciones y dibujar la llave.
 */
export function useAllMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from('matches')
        .select('*')
        .order('start_time', { ascending: true });
      if (err) throw err;
      setMatches((data as Match[]) ?? []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const channel = supabase
      .channel(`all-matches-${++channelSeq}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => void load())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const reload = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  return { matches, loading, error, reload };
}
