import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAllPredictions } from '../hooks/useAllPredictions';
import { computeAchievements, type Achievement } from '../lib/achievements';
import { celebrateAchievement, celebratePleno } from '../lib/confetti';

/**
 * Vigila los logros y plenos del usuario. Cuando un logro pasa de bloqueado a
 * conseguido —en vivo o mientras la app estuvo cerrada— lanza confeti y muestra
 * un cartel. Lo mismo con los plenos nuevos (confeti grande).
 * La siembra silenciosa (marcar como visto sin celebrar) solo ocurre la primera
 * vez que el usuario usa la app en este dispositivo.
 */
export default function AchievementWatcher({ userId }: { userId: string }) {
  const { predictions, loading } = useAllPredictions(userId);
  const achievements = useMemo(() => computeAchievements(predictions), [predictions]);
  const [queue, setQueue] = useState<Achievement[]>([]);

  // Detectar logros nuevos (incluye los ganados con la app cerrada)
  useEffect(() => {
    if (loading) return;
    // v2: se reinició tras limpiar la BD (las marcas viejas ya no aplican).
    const key = 'ach_seen_v2_' + userId;
    const stored = localStorage.getItem(key);
    const earnedIds = achievements.filter((a) => a.earned).map((a) => a.id);

    // Primera vez en este dispositivo: sembrar silenciosamente (no celebrar
    // de golpe todo el historial de un usuario que ya venía jugando).
    if (stored === null) {
      localStorage.setItem(key, JSON.stringify(earnedIds));
      return;
    }

    let seen: string[] = [];
    try {
      seen = JSON.parse(stored);
    } catch {
      seen = [];
    }
    const seenSet = new Set(seen);
    const newly = achievements.filter((a) => a.earned && !seenSet.has(a.id));
    if (newly.length > 0) {
      setQueue((q) => [...q, ...newly]);
      localStorage.setItem(key, JSON.stringify([...new Set([...seen, ...newly.map((a) => a.id)])]));
    }
  }, [achievements, loading, userId]);

  // Detectar plenos nuevos: confeti grande, en vivo o al reabrir la app.
  useEffect(() => {
    if (loading) return;
    const key = 'plenos_seen_v1_' + userId;
    const stored = localStorage.getItem(key);
    const plenoIds = predictions.filter((p) => p.result_type === 'pleno').map((p) => p.id);

    if (stored === null) {
      localStorage.setItem(key, JSON.stringify(plenoIds));
      return;
    }

    let seen: string[] = [];
    try {
      seen = JSON.parse(stored);
    } catch {
      seen = [];
    }
    const seenSet = new Set(seen);
    const newly = plenoIds.filter((id) => !seenSet.has(id));
    if (newly.length > 0) {
      celebratePleno();
      localStorage.setItem(key, JSON.stringify([...new Set([...seen, ...newly])]));
    }
  }, [predictions, loading, userId]);

  // Mostrar uno a uno con confeti
  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    celebrateAchievement();
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 4500);
    return () => clearTimeout(t);
  }, [current]);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: -40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          className="fixed inset-x-0 top-6 z-[70] flex justify-center px-4"
        >
          <button
            type="button"
            onClick={() => setQueue((q) => q.slice(1))}
            className="glass flex w-full max-w-sm items-center gap-3 rounded-2xl border border-gold/40 px-4 py-3 text-left shadow-goldGlow"
          >
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}
              className="text-3xl"
            >
              {current.icon}
            </motion.span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">¡Logro desbloqueado!</p>
              <p className="truncate text-sm font-bold text-white">{current.name}</p>
              <p className="truncate text-xs text-white/50">{current.desc}</p>
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
