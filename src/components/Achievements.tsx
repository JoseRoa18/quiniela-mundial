import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { computeAchievements } from '../lib/achievements';
import type { Prediction } from '../types/database';

export default function Achievements({ predictions }: { predictions: Prediction[] }) {
  const achievements = useMemo(() => computeAchievements(predictions), [predictions]);
  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gold/80">Logros</h3>
        <span className="font-mono text-[11px] text-white/40">
          {earnedCount}/{achievements.length}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {achievements.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            title={a.desc}
            className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-center ring-1 ${
              a.earned ? 'bg-gold/10 ring-gold/30' : 'bg-white/[0.02] ring-white/10'
            }`}
          >
            <span className={`text-2xl ${a.earned ? '' : 'opacity-25 grayscale'}`}>{a.icon}</span>
            <span className={`text-[10px] font-semibold leading-tight ${a.earned ? 'text-white/90' : 'text-white/30'}`}>
              {a.name}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
