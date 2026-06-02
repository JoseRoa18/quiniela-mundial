import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useAllMatches } from '../hooks/useAllMatches';
import { formatKickoff } from '../lib/worldcup';
import type { Match } from '../types/database';

/** Orden y etiqueta de las rondas eliminatorias. */
const ROUNDS: Array<{ stage: string; label: string }> = [
  { stage: 'LAST_32', label: '16avos de Final' },
  { stage: 'LAST_16', label: 'Octavos de Final' },
  { stage: 'QUARTER_FINALS', label: 'Cuartos de Final' },
  { stage: 'SEMI_FINALS', label: 'Semifinales' },
  { stage: 'THIRD_PLACE', label: 'Tercer Puesto' },
  { stage: 'FINAL', label: 'Final' },
];

function TeamLine({
  name,
  logo,
  score,
  show,
  winner,
}: {
  name: string;
  logo: string | null;
  score: number | null;
  show: boolean;
  winner: boolean;
}) {
  const tbd = !name || name === 'Por definir';
  return (
    <div className={`flex items-center gap-2 ${winner ? 'opacity-100' : 'opacity-70'}`}>
      <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/5 ring-1 ring-white/10">
        {logo ? (
          <img src={logo} alt={name} className="h-4 w-4 object-contain" />
        ) : (
          <span className="text-[8px] font-bold text-white/40">{tbd ? '?' : name.slice(0, 3).toUpperCase()}</span>
        )}
      </div>
      <span className={`flex-1 truncate text-xs ${tbd ? 'italic text-white/30' : 'font-medium text-white/90'}`}>
        {tbd ? 'Por definir' : name}
      </span>
      {show && (
        <span className={`font-mono text-sm font-bold tabular-nums ${winner ? 'text-accent' : 'text-white/60'}`}>
          {score ?? 0}
        </span>
      )}
    </div>
  );
}

function TieCard({ match, index }: { match: Match; index: number }) {
  const decided = match.status === 'finished' && match.home_score != null && match.away_score != null;
  const showScore = decided || match.status === 'in_progress';
  const live = match.status === 'in_progress';
  const homeWins = decided && (match.home_score as number) > (match.away_score as number);
  const awayWins = decided && (match.away_score as number) > (match.home_score as number);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className="rounded-xl border border-white/10 bg-ink/60 p-3 backdrop-blur-xl"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] capitalize text-white/35">{formatKickoff(match.start_time)}</span>
        {live ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> EN VIVO
          </span>
        ) : decided ? (
          <span className="text-[10px] uppercase tracking-wider text-white/30">Final</span>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <TeamLine
          name={match.home_team}
          logo={match.home_team_logo}
          score={match.home_score}
          show={showScore}
          winner={homeWins}
        />
        <TeamLine
          name={match.away_team}
          logo={match.away_team_logo}
          score={match.away_score}
          show={showScore}
          winner={awayWins}
        />
      </div>
    </motion.div>
  );
}

export default function Knockout() {
  const { matches, loading } = useAllMatches();

  const byRound = useMemo(() => {
    return ROUNDS.map((r) => ({
      ...r,
      ties: matches
        .filter((m) => m.stage === r.stage)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    })).filter((r) => r.ties.length > 0);
  }, [matches]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (byRound.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-white/40">
        El cuadro de eliminatorias aparecerá cuando se sincronicen las rondas finales.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {byRound.map((round) => (
        <section key={round.stage}>
          <div className="mb-3 flex items-center gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gold">{round.label}</h3>
            <div className="h-px flex-1 bg-gradient-to-r from-gold/40 to-transparent" />
            <span className="font-mono text-xs text-white/30">{round.ties.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {round.ties.map((m, i) => (
              <TieCard key={m.id} match={m} index={i} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
