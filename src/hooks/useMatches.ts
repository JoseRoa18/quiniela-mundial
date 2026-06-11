import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Match } from '../types/database';

export function useMatches(matchday = 1) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from('matches')
        .select('*')
        .eq('matchday', matchday)
        .order('start_time', { ascending: true });
      if (err) throw err;
      setMatches((data as Match[]) ?? []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [matchday]);

  useEffect(() => {
    setLoading(true);
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
      void supabase.removeChannel(channel);
    };
  }, [matchday, load]);

  const reload = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  return { matches, loading, error, reload };
}
