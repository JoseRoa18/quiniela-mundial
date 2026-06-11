import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Sparkles } from 'lucide-react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import ErrorState from './ErrorState';
import type { LeaderboardRow } from '../types/database';

interface LeaderboardProps {
  currentUserId: string;
  matchday?: number | null;
}

const PLACE_COLOR: Record<number, string> = { 1: '#FFC83D', 2: '#C9D3E0', 3: '#E08B4F' };

function Avatar({ row, size }: { row: LeaderboardRow; size: string }) {
  const initials = row.username.slice(0, 2).toUpperCase();
  return (
    <div className={`flex ${size} items-center justify-center overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10`}>
      {row.avatar_url ? (
        <img src={row.avatar_url} alt={row.username} className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-bold text-white/70">{initials}</span>
      )}
    </div>
  );
}

/* ----------------------------- Podio top 3 ------------------------------ */
function PodiumSpot({ row, place, isMe }: { row: LeaderboardRow; place: number; isMe: boolean }) {
  const color = PLACE_COLOR[place];
  const barH = place === 1 ? 'h-24' : place === 2 ? 'h-16' : 'h-12';
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay: (3 - place) * 0.08 }}
      className="flex flex-1 flex-col items-center"
    >
      <div className="relative">
        <div className="rounded-full p-0.5" style={{ boxShadow: `0 0 0 2px ${color}` }}>
          <Avatar row={row} size={place === 1 ? 'h-16 w-16' : 'h-12 w-12'} />
        </div>
        {place === 1 && <Crown className="absolute -top-4 left-1/2 h-5 w-5 -translate-x-1/2" style={{ color }} />}
      </div>
      <p className="mt-1.5 max-w-full truncate text-xs font-semibold text-white/90">
        {row.username}
        {isMe && <span className="text-accent"> ·tú</span>}
      </p>
      <p className="font-mono text-sm font-bold" style={{ color }}>
        {row.points}
      </p>
      <div
        className={`mt-1.5 flex ${barH} w-full max-w-[84px] items-start justify-center rounded-t-xl pt-1.5`}
        style={{ background: `linear-gradient(to bottom, ${color}33, ${color}0D)` }}
      >
        <span className="font-mono text-lg font-bold" style={{ color }}>{place}</span>
      </div>
    </motion.div>
  );
}

function Podium({ rows, currentUserId }: { rows: LeaderboardRow[]; currentUserId: string }) {
  const [first, second, third] = rows;
  return (
    <div className="mb-4 flex items-end justify-center gap-2 px-2">
      {second && <PodiumSpot row={second} place={2} isMe={second.user_id === currentUserId} />}
      {first && <PodiumSpot row={first} place={1} isMe={first.user_id === currentUserId} />}
      {third && <PodiumSpot row={third} place={3} isMe={third.user_id === currentUserId} />}
    </div>
  );
}

/* ------------------------------ Fila lista ------------------------------ */
function Row({ row, isMe }: { row: LeaderboardRow; isMe: boolean }) {
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
      <div className="flex w-7 shrink-0 items-center justify-center">
        <span className="font-mono text-sm font-semibold text-white/40">{row.rank}</span>
      </div>
      <Avatar row={row} size="h-10 w-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white/90">
          {row.username} {isMe && <span className="text-accent">· tú</span>}
        </p>
        <p className="flex items-center gap-1 text-[11px] text-white/40">
          <Sparkles className="h-3 w-3" /> {row.plenos} plenos · {row.predictions_count} pron.
        </p>
      </div>
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
  const { rows, loading, error, reload } = useLeaderboard(matchday);

  if (error) return <ErrorState onRetry={reload} />;

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

  const hasPodium = rows.length >= 3;
  const rest = hasPodium ? rows.slice(3) : rows;

  return (
    <div>
      {hasPodium && <Podium rows={rows} currentUserId={currentUserId} />}

      {rest.length > 0 && (
        <motion.ul layout className="space-y-2">
          <AnimatePresence>
            {rest.map((row) => (
              <Row key={row.user_id} row={row} isMe={row.user_id === currentUserId} />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
}
