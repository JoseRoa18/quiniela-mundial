import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Match } from '../types/database';

/**
 * Trae TODOS los partidos del torneo (no filtra por jornada) y se mantiene
 * al día vía Realtime. Lo usan las vistas de Grupos y Eliminatorias, que
 * necesitan el cuadro completo para calcular posiciones y dibujar la llave.
 */
export function useAllMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase
        .from('matches')
        .select('*')
        .order('start_time', { ascending: true });
      if (active) {
        setMatches((data as Match[]) ?? []);
        setLoading(false);
      }
    }
    void load();

    const channel = supabase
      .channel('all-matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => void load())
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  return { matches, loading };
}
