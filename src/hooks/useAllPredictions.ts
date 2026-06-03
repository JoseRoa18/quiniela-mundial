import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Prediction } from '../types/database';

/**
 * Trae TODOS los pronósticos del usuario (todas las jornadas) con Realtime.
 * Lo usa la vista "Mis pronósticos".
 */
export function useAllPredictions(userId: string | undefined) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    async function load() {
      const { data } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (active) {
        setPredictions((data as Prediction[]) ?? []);
        setLoading(false);
      }
    }
    void load();

    const channel = supabase
      .channel('all-my-predictions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'predictions', filter: `user_id=eq.${userId}` },
        () => void load(),
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return { predictions, loading };
}
