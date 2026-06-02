import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { celebratePleno } from '../lib/confetti';
import type { Prediction } from '../types/database';

/**
 * Escucha los pronósticos del usuario en tiempo real. Cuando uno transiciona
 * a 'pleno' (gracias a replica identity full podemos comparar el valor antiguo),
 * lanza la celebración de confeti exactamente una vez.
 */
export function useCelebration(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('celebration')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'predictions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = payload.new as Prediction;
          const prev = payload.old as Partial<Prediction>;
          if (next.result_type === 'pleno' && prev.result_type !== 'pleno') {
            celebratePleno();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}
