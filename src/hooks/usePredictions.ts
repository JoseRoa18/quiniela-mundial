import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Prediction } from '../types/database';

interface SaveArgs {
  matchId: string;
  predictedHome: number;
  predictedAway: number;
  usedWildcard: boolean;
}

export function usePredictions(userId: string | undefined, matchday = 1) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', userId)
      .eq('matchday', matchday);
    setPredictions((data as Prediction[]) ?? []);
    setLoading(false);
  }, [userId, matchday]);

  // Al cambiar de usuario/jornada, volver a estado "cargando" para que la lista
  // espere a tener los pronósticos antes de dibujar las tarjetas (evita que se
  // muestren vacías tras recargar).
  useEffect(() => {
    setLoading(true);
  }, [userId, matchday]);

  useEffect(() => {
    void load();
  }, [load]);

  // Mapa match_id -> pronóstico, para prellenar las tarjetas
  const byMatch = useMemo(() => {
    const m = new Map<string, Prediction>();
    for (const p of predictions) m.set(p.match_id, p);
    return m;
  }, [predictions]);

  // ¿El usuario aún tiene comodín en esta jornada?
  const wildcardUsed = predictions.some((p) => p.used_wildcard);

  const savePrediction = useCallback(
    async ({ matchId, predictedHome, predictedAway, usedWildcard }: SaveArgs) => {
      if (!userId) throw new Error('No autenticado');
      const { error } = await supabase.from('predictions').upsert(
        {
          user_id: userId,
          match_id: matchId,
          predicted_home: predictedHome,
          predicted_away: predictedAway,
          used_wildcard: usedWildcard,
        },
        { onConflict: 'user_id,match_id' },
      );
      // El trigger del backend lanza error si está bloqueado (<30 min) o si
      // se intenta un segundo comodín en la jornada: propagamos el error para
      // que la tarjeta muestre el estado "Reintentar".
      if (error) throw error;
      await load();
    },
    [userId, load],
  );

  return { predictions, byMatch, wildcardUsed, savePrediction, loading };
}
