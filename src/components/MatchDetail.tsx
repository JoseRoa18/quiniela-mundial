import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock, Sparkles, X, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { stageForMatchday, formatKickoff } from '../lib/worldcup';
import { groupLabel } from '../lib/standings';
import { RESULT_META } from '../lib/results';
import type { Match, PredictionResult } from '../types/database';

/* --------------------------- Contexto / Provider ------------------------- */
interface Ctx {
  open: (m: Match) => void;
}
const MatchDetailCtx = createContext<Ctx>({ open: () => {} });
export const useMatchDetail = () => useContext(MatchDetailCtx);

export function MatchDetailProvider({ username, children }: { username: string; children: ReactNode }) {
  const [match, setMatch] = useState<Match | null>(null);
  return (
    <MatchDetailCtx.Provider value={{ open: setMatch }}>
      {children}
      <MatchDetailModal match={match} username={username} onClose={() => setMatch(null)} />
    </MatchDetailCtx.Provider>
  );
}

/* ------------------------------ Datos RPC -------------------------------- */
interface MatchPrediction {
  username: string;
  avatar_url: string | null;
  predicted_home: number;
  predicted_away: number;
  used_wildcard: boolean;
  points_earned: number | null;
  result_type: PredictionResult;
}

function Crest({ name, logo }: { name: string; logo: string | null }) {
  return (
    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
      {logo ? (
        <img src={logo} alt={name} className="h-11 w-11 object-contain" />
      ) : (
        <span className="text-sm font-bold text-white/70">{name.slice(0, 3).toUpperCase()}</span>
      )}
    </div>
  );
}

/* ------------------------------- Modal ----------------------------------- */
function MatchDetailModal({
  match,
  username,
  onClose,
}: {
  match: Match | null;
  username: string;
  onClose: () => void;
}) {
  const [preds, setPreds] = useState<MatchPrediction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!match) return;
    let active = true;
    setLoading(true);
    supabase.rpc('get_match_predictions', { p_match_id: match.id }).then(({ data }) => {
      if (active) {
        setPreds((data as MatchPrediction[]) ?? []);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [match]);

  const live = match?.status === 'in_progress';
  const finished = match?.status === 'finished';
  const played = live || finished;
  const stage = match ? stageForMatchday(match.matchday) : null;
  // Los pronósticos ajenos se revelan al cerrarse (30 min antes) o si ya empezó.
  const revealed =
    !!match && (match.status !== 'pending' || Date.now() >= new Date(match.start_time).getTime() - 30 * 60_000);

  return (
    <AnimatePresence>
      {match && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="glass relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl"
          >
            {/* Cabecera */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
                <span className="text-gold">{stage?.short}</span>
                {match.group_name && <span className="text-white/30">· {groupLabel(match.group_name)}</span>}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/60 ring-1 ring-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Marcador / equipos */}
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <Crest name={match.home_team} logo={match.home_team_logo} />
                <span className="line-clamp-2 w-full break-words text-center text-sm font-semibold text-white/90">
                  {match.home_team}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                {played ? (
                  <div className="font-mono text-4xl font-bold text-white">
                    {match.home_score ?? 0}<span className="px-1 text-white/30">:</span>{match.away_score ?? 0}
                  </div>
                ) : (
                  <div className="font-mono text-2xl font-bold text-white/30">VS</div>
                )}
                {live ? (
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-red-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> EN VIVO
                  </span>
                ) : finished ? (
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Final</span>
                ) : (
                  <span className="text-[11px] text-white/40">Por jugar</span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <Crest name={match.away_team} logo={match.away_team_logo} />
                <span className="line-clamp-2 w-full break-words text-center text-sm font-semibold text-white/90">
                  {match.away_team}
                </span>
              </div>
            </div>

            {/* Meta */}
            <div className="mb-5 mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-white/40">
              <span className="capitalize">{formatKickoff(match.start_time)}</span>
              {match.is_featured_match && (
                <span className="inline-flex items-center gap-1 font-semibold text-gold">
                  <Zap className="h-3 w-3" /> Destacado ×2
                </span>
              )}
            </div>

            {/* Pronósticos de los jugadores */}
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold/80">
              Pronósticos de los jugadores
            </h3>

            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />
                ))}
              </div>
            ) : preds.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/[0.03] py-8 text-center ring-1 ring-white/10">
                <Lock className="h-6 w-6 text-white/25" />
                <p className="px-6 text-xs text-white/40">
                  {revealed
                    ? 'Nadie pronosticó este partido.'
                    : 'Los pronósticos se revelan cuando se cierran (30 min antes del inicio).'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {preds.map((p, i) => {
                  const meta = RESULT_META[p.result_type];
                  const isMe = p.username === username;
                  return (
                    <div
                      key={p.username + i}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ${
                        isMe ? 'bg-accent/10 ring-accent/40' : 'bg-white/[0.03] ring-white/10'
                      }`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt={p.username} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-bold text-white/70">{p.username.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/90">
                        {p.username}
                        {isMe && <span className="text-accent"> · tú</span>}
                        {p.used_wildcard && <Sparkles className="ml-1 inline h-3 w-3 text-electric" />}
                      </span>
                      <span className="font-mono text-sm font-bold text-white">
                        {p.predicted_home}-{p.predicted_away}
                      </span>
                      <span
                        className="w-14 shrink-0 text-right font-mono text-sm font-bold"
                        style={{ color: meta.color }}
                      >
                        {p.points_earned != null ? (p.points_earned > 0 ? `+${p.points_earned}` : p.points_earned) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
