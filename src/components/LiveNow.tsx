import { motion } from 'framer-motion';
import { useAllMatches } from '../hooks/useAllMatches';
import { useMatchDetail } from './MatchDetail';
import type { Match } from '../types/database';

function MiniTeam({ name, logo, score }: { name: string; logo: string | null; score: number | null }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded bg-white/5">
        {logo ? (
          <img src={logo} alt={name} className="h-3 w-3 object-contain" />
        ) : (
          <span className="text-[7px] font-bold text-white/50">{name.slice(0, 3).toUpperCase()}</span>
        )}
      </div>
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-white/85">{name}</span>
      <span className="font-mono text-sm font-bold text-white">{score ?? 0}</span>
    </div>
  );
}

function LiveChip({ m, onClick }: { m: Match; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-[160px] shrink-0 space-y-1 rounded-2xl border border-red-500/30 bg-ink/70 p-2.5 text-left backdrop-blur-xl"
    >
      <MiniTeam name={m.home_team} logo={m.home_team_logo} score={m.home_score} />
      <MiniTeam name={m.away_team} logo={m.away_team_logo} score={m.away_score} />
    </motion.button>
  );
}

/** Tira compacta con los partidos que se juegan en este momento. */
export default function LiveNow() {
  const { matches } = useAllMatches();
  const { open } = useMatchDetail();
  const live = matches.filter((m) => m.status === 'in_progress');

  if (live.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-red-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        En vivo ahora · {live.length}
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {live.map((m) => (
          <LiveChip key={m.id} m={m} onClick={() => open(m)} />
        ))}
      </div>
    </div>
  );
}
