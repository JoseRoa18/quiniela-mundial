import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Target } from 'lucide-react';
import { useAllPredictions } from '../hooks/useAllPredictions';
import { useAllMatches } from '../hooks/useAllMatches';
import { stageForMatchday, formatKickoff } from '../lib/worldcup';
import { RESULT_META } from '../lib/results';
import { useMatchDetail } from './MatchDetail';
import Achievements from './Achievements';
import ErrorState from './ErrorState';
import type { Match, Prediction } from '../types/database';

function PredictionRow({ pred, match, index }: { pred: Prediction; match: Match | undefined; index: number }) {
  const { open } = useMatchDetail();
  const meta = RESULT_META[pred.result_type];
  const played = match && (match.status === 'finished' || match.status === 'in_progress');

  return (
    <motion.button
      type="button"
      onClick={() => match && open(match)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className="block w-full rounded-2xl border border-white/10 bg-ink/60 p-3.5 text-left backdrop-blur-xl"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gold/70">
          {pred.matchday ? stageForMatchday(pred.matchday).short : 'Mundial'}
          {match && <span className="ml-2 font-normal capitalize text-white/30">{formatKickoff(match.start_time)}</span>}
        </span>
        {pred.used_wildcard && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-electric">
            <Sparkles className="h-3 w-3" /> Comodín
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Equipos */}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium text-white/90">{match?.home_team ?? '—'}</p>
          <p className="truncate text-sm font-medium text-white/90">{match?.away_team ?? '—'}</p>
        </div>

        {/* Tu pronóstico */}
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-wider text-white/30">Tú</p>
          <p className="font-mono text-base font-bold leading-tight text-white">
            {pred.predicted_home}-{pred.predicted_away}
          </p>
        </div>

        {/* Resultado real */}
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-wider text-white/30">Real</p>
          <p className="font-mono text-base font-bold leading-tight text-white/70">
            {played ? `${match!.home_score ?? 0}-${match!.away_score ?? 0}` : '—'}
          </p>
        </div>

        {/* Puntos / estado */}
        <div className="w-16 shrink-0 text-right">
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ color: meta.color, background: meta.bg }}
          >
            {meta.label}
          </span>
          {pred.points_earned != null && (
            <p className="mt-1 font-mono text-sm font-bold" style={{ color: meta.color }}>
              {pred.points_earned > 0 ? `+${pred.points_earned}` : pred.points_earned}
            </p>
          )}
        </div>
      </div>
    </motion.button>
  );
}

export default function MyPredictions({ userId }: { userId: string }) {
  const { predictions, loading, error } = useAllPredictions(userId);
  const { matches } = useAllMatches();

  const matchById = useMemo(() => {
    const m = new Map<string, Match>();
    for (const match of matches) m.set(match.id, match);
    return m;
  }, [matches]);

  const stats = useMemo(() => {
    const plenos = predictions.filter((p) => p.result_type === 'pleno').length;
    const tendencias = predictions.filter((p) => p.result_type === 'tendencia').length;
    const points = predictions.reduce((sum, p) => sum + (p.points_earned ?? 0), 0);
    return { total: predictions.length, plenos, tendencias, points };
  }, [predictions]);

  if (error) return <ErrorState />;

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="py-16 text-center">
        <Target className="mx-auto mb-3 h-10 w-10 text-white/20" />
        <p className="text-sm text-white/40">Aún no has hecho ningún pronóstico.</p>
        <p className="mt-1 text-xs text-white/30">Ve a “Partidos” y empieza a jugar. ⚽</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-accent/10 px-3 py-3 text-center ring-1 ring-accent/30">
          <p className="font-mono text-xl font-bold text-accent">{stats.points}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/40">Puntos</p>
        </div>
        <div className="rounded-2xl bg-white/[0.03] px-3 py-3 text-center ring-1 ring-white/10">
          <p className="font-mono text-xl font-bold text-white">{stats.plenos}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/40">Plenos</p>
        </div>
        <div className="rounded-2xl bg-white/[0.03] px-3 py-3 text-center ring-1 ring-white/10">
          <p className="font-mono text-xl font-bold text-white">{stats.total}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/40">Pronósticos</p>
        </div>
      </div>

      {/* Logros */}
      <Achievements predictions={predictions} />

      {/* Lista */}
      <div className="space-y-2.5">
        {predictions.map((pred, i) => (
          <PredictionRow key={pred.id} pred={pred} match={matchById.get(pred.match_id)} index={i} />
        ))}
      </div>
    </div>
  );
}
