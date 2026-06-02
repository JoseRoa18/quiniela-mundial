import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Sparkles } from 'lucide-react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import type { LeaderboardRow } from '../types/database';

interface LeaderboardProps {
  currentUserId: string;
  matchday?: number | null;
}

const rankColor = (rank: number) => {
  if (rank === 1) return '#FFD166';
  if (rank === 2) return '#C9D3E0';
  if (rank === 3) return '#E08B4F';
  return 'rgba(255,255,255,0.35)';
};

function Row({ row, isMe }: { row: LeaderboardRow; isMe: boolean }) {
  const initials = row.username.slice(0, 2).toUpperCase();
  return (
    <motion.li
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 ring-1 ${
        isMe ? 'bg-accent/10 ring-accent/40' : 'bg-white/[0.03] ring-white/10'
      }`}
    >
      {/* Posición */}
      <div className="flex w-7 shrink-0 items-center justify-center">
        {row.rank <= 3 ? (
          <Crown className="h-5 w-5" style={{ color: rankColor(row.rank) }} />
        ) : (
          <span className="font-mono text-sm font-semibold text-white/40">{row.rank}</span>
        )}
      </div>

      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
        {row.avatar_url ? (
          <img src={row.avatar_url} alt={row.username} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-bold text-white/70">{initials}</span>
        )}
      </div>

      {/* Nombre + plenos */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white/90">
          {row.username} {isMe && <span className="text-accent">· tú</span>}
        </p>
        <p className="flex items-center gap-1 text-[11px] text-white/40">
          <Sparkles className="h-3 w-3" /> {row.plenos} plenos · {row.predictions_count} pron.
        </p>
      </div>

      {/* Puntos (animados al cambiar) */}
      <div className="relative h-7 overflow-hidden text-right">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={row.points}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="block font-mono text-lg font-bold text-accent tabular-nums"
          >
            {row.points}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.li>
  );
}

export default function Leaderboard({ currentUserId, matchday = null }: LeaderboardProps) {
  const { rows, loading } = useLeaderboard(matchday);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="py-16 text-center text-sm text-white/40">Aún no hay jugadores en la tabla.</p>;
  }

  return (
    <motion.ul layout className="space-y-2">
      <AnimatePresence>
        {rows.map((row) => (
          <Row key={row.user_id} row={row} isMe={row.user_id === currentUserId} />
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}
