import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { LeaderboardRow } from '../types/database';

// Nombres de canal únicos (evita colisiones entre instancias del hook).
let channelSeq = 0;

export function useLeaderboard(matchday: number | null = null) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error: err } = await supabase.rpc('get_leaderboard', { p_matchday: matchday });
      if (err) throw err;
      setRows((data as LeaderboardRow[]) ?? []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [matchday]);

  useEffect(() => {
    void load();

    // Realtime: cualquier cambio en puntos o pronósticos recalcula la tabla.
    const channel = supabase
      .channel(`leaderboard-${++channelSeq}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () => void load())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const reload = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  return { rows, loading, error, reload };
}
