import { useMemo, useState } from 'react';
import { Crown, Sparkles } from 'lucide-react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useAllMatches } from '../hooks/useAllMatches';
import { stageForMatchday } from '../lib/worldcup';
import MatchdaySelector from './MatchdaySelector';
import { useMatchDetail } from './MatchDetail';
import ErrorState from './ErrorState';
import type { Match } from '../types/database';

const MEDAL: Record<number, string> = { 1: '#FFC83D', 2: '#C9D3E0', 3: '#E08B4F' };

function ResultRow({ m, onClick }: { m: Match; onClick: () => void }) {
  const played = m.status === 'finished' || m.status === 'in_progress';
  const live = m.status === 'in_progress';
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-white/[0.03]">
      <span className="flex-1 truncate text-right font-medium text-white/80">{m.home_team}</span>
      <span className="w-12 shrink-0 text-center font-mono font-bold">
        {played ? (
          <span className={live ? 'text-red-400' : 'text-white'}>
            {m.home_score ?? 0}-{m.away_score ?? 0}
          </span>
        ) : (
          <span className="text-white/25">vs</span>
        )}
      </span>
      <span className="flex-1 truncate text-left font-medium text-white/80">{m.away_team}</span>
    </button>
  );
}

export default function MatchdaySummary({ username }: { username: string }) {
  const [matchday, setMatchday] = useState(1);
  const { rows, loading, error, reload } = useLeaderboard(matchday);
  const { matches } = useAllMatches();
  const { open } = useMatchDetail();

  const mdMatches = useMemo(
    () => matches.filter((m) => m.matchday === matchday).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [matches, matchday],
  );
  const participants = useMemo(() => rows.filter((r) => r.predictions_count > 0), [rows]);
  const me = useMemo(() => rows.find((r) => r.username === username), [rows, username]);
  const totalPlenos = participants.reduce((s, r) => s + r.plenos, 0);
  const finishedCount = mdMatches.filter((m) => m.status === 'finished').length;
  const stage = stageForMatchday(matchday);

  if (error) return <ErrorState onRetry={reload} />;

  return (
    <div className="space-y-4">
      <MatchdaySelector value={matchday} onChange={setMatchday} layoutId="md-pill-resumen" />

      <p className="text-center text-sm font-bold text-gold">{stage.label}</p>

      {/* Tu jornada */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-accent/10 px-3 py-3 text-center ring-1 ring-accent/30">
          <p className="font-mono text-xl font-bold text-accent">{me?.points ?? 0}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/40">Tus puntos</p>
        </div>
        <div className="rounded-2xl bg-white/[0.03] px-3 py-3 text-center ring-1 ring-white/10">
          <p className="font-mono text-xl font-bold text-white">{me?.plenos ?? 0}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/40">Tus plenos</p>
        </div>
        <div className="rounded-2xl bg-white/[0.03] px-3 py-3 text-center ring-1 ring-white/10">
          <p className="font-mono text-xl font-bold text-white">{me && me.predictions_count > 0 ? `#${me.rank}` : '—'}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/40">Tu puesto</p>
        </div>
      </div>

      {/* Top de la jornada */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gold/80">Mejores de la jornada</h3>
          <span className="flex items-center gap-1 text-[11px] text-white/40">
            <Sparkles className="h-3 w-3" /> {totalPlenos} plenos
          </span>
        </div>
        {loading ? (
          <div className="h-20 animate-pulse rounded-2xl bg-white/5" />
        ) : participants.length === 0 ? (
          <p className="rounded-2xl bg-white/[0.03] py-6 text-center text-xs text-white/40 ring-1 ring-white/10">
            Nadie ha pronosticado esta jornada todavía.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {participants.slice(0, 5).map((r) => {
              const isMe = r.username === username;
              return (
                <li
                  key={r.user_id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 ring-1 ${
                    isMe ? 'bg-accent/10 ring-accent/40' : 'bg-white/[0.03] ring-white/10'
                  }`}
                >
                  <span className="flex w-5 justify-center">
                    {r.rank <= 3 ? (
                      <Crown className="h-4 w-4" style={{ color: MEDAL[r.rank] }} />
                    ) : (
                      <span className="font-mono text-xs text-white/40">{r.rank}</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/90">
                    {r.username}
                    {isMe && <span className="text-accent"> · tú</span>}
                  </span>
                  <span className="font-mono text-sm font-bold text-accent">{r.points}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Resultados */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gold/80">Resultados</h3>
          <span className="text-[11px] text-white/40">{finishedCount}/{mdMatches.length} jugados</span>
        </div>
        {mdMatches.length === 0 ? (
          <p className="py-6 text-center text-xs text-white/40">No hay partidos en esta jornada.</p>
        ) : (
          <div className="divide-y divide-white/5 overflow-hidden rounded-2xl bg-ink/60 ring-1 ring-white/10">
            {mdMatches.map((m) => (
              <ResultRow key={m.id} m={m} onClick={() => open(m)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
