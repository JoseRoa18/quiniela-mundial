import { useState } from 'react';
import { motion } from 'framer-motion';
import Leaderboard from './Leaderboard';
import MyPredictions from './MyPredictions';
import MatchdaySummary from './MatchdaySummary';

type View = 'table' | 'mine' | 'summary';

const SEGMENTS: Array<{ id: View; label: string }> = [
  { id: 'table', label: 'Tabla' },
  { id: 'mine', label: 'Mis pron.' },
  { id: 'summary', label: 'Resumen' },
];

export default function RankingTab({ userId, username }: { userId: string; username: string }) {
  const [view, setView] = useState<View>('table');

  return (
    <div>
      {/* Segmentado */}
      <div className="mb-4 flex rounded-2xl bg-white/[0.04] p-1 ring-1 ring-white/10">
        {SEGMENTS.map((s) => {
          const active = view === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setView(s.id)}
              className="relative flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
            >
              {active && (
                <motion.span
                  layoutId="ranking-segment"
                  className="absolute inset-0 rounded-xl bg-accent/15 ring-1 ring-accent/40"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <span className={`relative z-10 ${active ? 'text-accent' : 'text-white/50'}`}>{s.label}</span>
            </button>
          );
        })}
      </div>

      {view === 'table' && <Leaderboard currentUserId={userId} matchday={null} />}
      {view === 'mine' && <MyPredictions userId={userId} />}
      {view === 'summary' && <MatchdaySummary username={username} />}
    </div>
  );
}
