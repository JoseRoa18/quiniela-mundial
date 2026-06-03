import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAllMatches } from '../hooks/useAllMatches';
import { formatKickoff } from '../lib/worldcup';
import { useMatchDetail } from './MatchDetail';
import type { Match } from '../types/database';

/** Rondas del cuadro principal, en orden. (El 3.º puesto va aparte, no conecta.) */
const BRACKET_ROUNDS: Array<{ stage: string; label: string }> = [
  { stage: 'LAST_32', label: '16avos' },
  { stage: 'LAST_16', label: 'Octavos' },
  { stage: 'QUARTER_FINALS', label: 'Cuartos' },
  { stage: 'SEMI_FINALS', label: 'Semis' },
  { stage: 'FINAL', label: 'Final' },
];

function TeamLine({ name, logo, score, show, winner }: {
  name: string;
  logo: string | null;
  score: number | null;
  show: boolean;
  winner: boolean;
}) {
  const tbd = !name || name === 'Por definir';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded bg-white/5 ring-1 ring-white/10">
        {logo ? (
          <img src={logo} alt={name} className="h-3.5 w-3.5 object-contain" />
        ) : (
          <span className="text-[7px] font-bold text-white/40">{tbd ? '?' : name.slice(0, 3).toUpperCase()}</span>
        )}
      </div>
      <span className={`flex-1 truncate text-[11px] ${tbd ? 'italic text-white/30' : winner ? 'font-bold text-white' : 'font-medium text-white/75'}`}>
        {tbd ? 'Por definir' : name}
      </span>
      {show && (
        <span className={`font-mono text-xs font-bold tabular-nums ${winner ? 'text-accent' : 'text-white/50'}`}>
          {score ?? 0}
        </span>
      )}
    </div>
  );
}

function TieCard({ match }: { match: Match }) {
  const { open } = useMatchDetail();
  const decided = match.status === 'finished' && match.home_score != null && match.away_score != null;
  const show = decided || match.status === 'in_progress';
  const live = match.status === 'in_progress';
  const homeWins = decided && (match.home_score as number) > (match.away_score as number);
  const awayWins = decided && (match.away_score as number) > (match.home_score as number);

  return (
    <button
      type="button"
      onClick={() => open(match)}
      className={`w-full space-y-1 rounded-lg border bg-ink/70 p-2 text-left ${
        live ? 'border-red-500/40' : 'border-white/10'
      }`}
    >
      <TeamLine name={match.home_team} logo={match.home_team_logo} score={match.home_score} show={show} winner={homeWins} />
      <TeamLine name={match.away_team} logo={match.away_team_logo} score={match.away_score} show={show} winner={awayWins} />
      {live && (
        <p className="flex items-center gap-1 pt-0.5 text-[8px] font-bold uppercase text-red-400">
          <span className="h-1 w-1 animate-pulse rounded-full bg-red-500" /> En vivo
        </p>
      )}
    </button>
  );
}

export default function Knockout() {
  const { matches, loading } = useAllMatches();

  const rounds = useMemo(
    () =>
      BRACKET_ROUNDS.map((r) => ({
        ...r,
        ties: matches.filter((m) => m.stage === r.stage).sort((a, b) => a.start_time.localeCompare(b.start_time)),
      })).filter((r) => r.ties.length > 0),
    [matches],
  );

  const thirdPlace = useMemo(() => matches.find((m) => m.stage === 'THIRD_PLACE'), [matches]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (rounds.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-white/40">
        El cuadro de eliminatorias aparecerá cuando se sincronicen las rondas finales.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-center text-[11px] text-white/30">Desliza horizontalmente para ver todo el cuadro →</p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-2"
      >
        <div className="kbracket">
          {rounds.map((round, ri) => (
            <div
              key={round.stage}
              className={`kround ${ri < rounds.length - 1 ? 'has-next' : ''} ${ri > 0 ? 'has-prev' : ''}`}
            >
              <div className="khead">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gold">{round.label}</span>
              </div>
              <div className="kties">
                {round.ties.map((m) => (
                  <div key={m.id} className="ktie">
                    <TieCard match={m} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Tercer puesto (no conecta con el cuadro) */}
      {thirdPlace && (
        <section>
          <div className="mb-2 flex items-center gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gold">Tercer Puesto</h3>
            <div className="h-px flex-1 bg-gradient-to-r from-gold/40 to-transparent" />
          </div>
          <div className="mx-auto max-w-[220px]">
            <TieCard match={thirdPlace} />
            <p className="mt-1 text-center text-[10px] capitalize text-white/30">
              {formatKickoff(thirdPlace.start_time)}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
