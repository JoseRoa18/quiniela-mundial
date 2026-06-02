import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { LeaderboardRow } from '../types/database';

export function useLeaderboard(matchday: number | null = null) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_leaderboard', {
      p_matchday: matchday,
    });
    if (!error) setRows((data as LeaderboardRow[]) ?? []);
    setLoading(false);
  }, [matchday]);

  useEffect(() => {
    void load();

    // Realtime: cualquier cambio en puntos o pronósticos recalcula la tabla.
    const channel = supabase
      .channel('leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () => void load())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return { rows, loading, reload: load };
}
