import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Match } from '../types/database';

export function useMatches(matchday = 1) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase
        .from('matches')
        .select('*')
        .eq('matchday', matchday)
        .order('start_time', { ascending: true });
      if (active) {
        setMatches((data as Match[]) ?? []);
        setLoading(false);
      }
    }
    void load();

    // Realtime: refrescar cuando cambie cualquier partido de la jornada
    const channel = supabase
      .channel(`matches-md-${matchday}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `matchday=eq.${matchday}` },
        () => void load(),
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [matchday]);

  return { matches, loading };
}
