import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAllPredictions } from '../hooks/useAllPredictions';
import { computeAchievements, type Achievement } from '../lib/achievements';
import { celebrateAchievement } from '../lib/confetti';

/**
 * Vigila los logros del usuario. Cuando uno pasa de bloqueado a conseguido,
 * lanza confeti y muestra un cartel con el logro y por qué se ganó.
 * Usa localStorage para no recelebrar logros ya vistos.
 */
export default function AchievementWatcher({ userId }: { userId: string }) {
  const { predictions, loading } = useAllPredictions(userId);
  const achievements = useMemo(() => computeAchievements(predictions), [predictions]);
  const [queue, setQueue] = useState<Achievement[]>([]);
  const seeded = useRef(false);

  // Detectar logros nuevos
  useEffect(() => {
    if (loading) return;
    // v2: se reinició tras limpiar la BD (las marcas viejas ya no aplican).
    const key = 'ach_seen_v2_' + userId;
    let seen: string[] = [];
    try {
      seen = JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      seen = [];
    }
    const earnedIds = achievements.filter((a) => a.earned).map((a) => a.id);

    // Primera carga: sembrar silenciosamente lo ya conseguido (no recelebrar).
    if (!seeded.current) {
      seeded.current = true;
      localStorage.setItem(key, JSON.stringify([...new Set([...seen, ...earnedIds])]));
      return;
    }

    const seenSet = new Set(seen);
    const newly = achievements.filter((a) => a.earned && !seenSet.has(a.id));
    if (newly.length > 0) {
      setQueue((q) => [...q, ...newly]);
      localStorage.setItem(key, JSON.stringify([...new Set([...seen, ...newly.map((a) => a.id)])]));
    }
  }, [achievements, loading, userId]);

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
