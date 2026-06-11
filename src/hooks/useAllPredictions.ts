import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Prediction } from '../types/database';

// Contador para nombres de canal únicos (evita colisiones cuando el hook se
// usa en varios componentes a la vez, p. ej. el watcher de logros + Mis pron.).
let channelSeq = 0;

/**
 * Trae TODOS los pronósticos del usuario (todas las jornadas) con Realtime.
 * Lo usa la vista "Mis pronósticos".
 */
export function useAllPredictions(userId: string | undefined) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    async function load() {
      try {
        const { data, error: err } = await supabase
          .from('predictions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (err) throw err;
        if (active) {
          setPredictions((data as Prediction[]) ?? []);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();

    const channel = supabase
      .channel(`all-my-predictions-${++channelSeq}`)
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

  return { predictions, loading, error };
}
