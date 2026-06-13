import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlarmClock, ChevronRight, Loader2 } from 'lucide-react';
import MatchCard from './MatchCard';
import { useMatches } from '../hooks/useMatches';
import { usePredictions } from '../hooks/usePredictions';
import { useProgressive } from '../hooks/useProgressive';
import { useMatchDetail } from './MatchDetail';
import ErrorState from './ErrorState';

interface MatchListProps {
  userId: string;
  matchday?: number;
}

type StatusFilter = 'todos' | 'porjugar' | 'sin' | 'vivo' | 'fin';

const CHIPS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'porjugar', label: 'Por jugar' },
  { key: 'sin', label: 'Sin pronosticar' },
  { key: 'vivo', label: 'En vivo' },
  { key: 'fin', label: 'Finalizados' },
];

const LOCK_MS = 30 * 60_000; // el pronóstico cierra 30 min antes del inicio

/** Texto del tiempo restante hasta el cierre, en español y resolución de minuto. */
function untilClose(ms: number): string {
  if (ms <= 0) return 'cierran ya';
  const totalMin = Math.floor(ms / 60_000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `cierra en ${d} d ${h} h`;
  if (h > 0) return `cierra en ${h} h ${m} min`;
  return `cierra en ${m} min`;
}

export default function MatchList({ userId, matchday = 1 }: MatchListProps) {
  const { matches, loading, error, reload } = useMatches(matchday);
  const { byMatch, wildcardUsed, savePrediction, loading: predsLoading } = usePredictions(userId, matchday);
  const { open } = useMatchDetail();
  const [filter, setFilter] = useState<StatusFilter>('todos');

  // Lista filtrada + conteo por estado (para las etiquetas de los chips).
  const { filtered, counts } = useMemo(() => {
    const counts = { todos: matches.length, porjugar: 0, sin: 0, vivo: 0, fin: 0 };
    for (const m of matches) {
      if (m.status === 'in_progress') counts.vivo++;
      else if (m.status === 'finished') counts.fin++;
      else if (m.status === 'pending') {
        counts.porjugar++;
        if (!byMatch.has(m.id)) counts.sin++;
      }
    }
    const filtered = matches.filter((m) => {
      switch (filter) {
        case 'porjugar':
          return m.status === 'pending';
        case 'sin':
          return m.status === 'pending' && !byMatch.has(m.id);
        case 'vivo':
          return m.status === 'in_progress';
        case 'fin':
          return m.status === 'finished';
        default:
          return true;
      }
    });
    return { filtered, counts };
  }, [matches, byMatch, filter]);

  // Si el filtro activo se queda sin partidos (p. ej. terminaste de pronosticar
  // o acabó el último partido en vivo), volver a "Todos".
  useEffect(() => {
    if (filter !== 'todos' && counts[filter] === 0) setFilter('todos');
  }, [filter, counts]);

  // Cierre más próximo entre los partidos que aún te faltan por pronosticar.
  const nextClose = useMemo(() => {
    let soonest: number | null = null;
    for (const m of matches) {
      if (m.status === 'pending' && !byMatch.has(m.id)) {
        const lock = new Date(m.start_time).getTime() - LOCK_MS;
        if (soonest === null || lock < soonest) soonest = lock;
      }
    }
    return soonest;
  }, [matches, byMatch]);

  // Tick a minuto para el contador del banner (solo si hay algo que avisar).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (counts.sin === 0) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [counts.sin]);

  // Reinicia la carga progresiva al cambiar de jornada o de filtro.
  const { visible, sentinelRef, hasMore } = useProgressive(filtered.length, 5, `${matchday}:${filter}`);

  if (loading || predsLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-3xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (error) return <ErrorState onRetry={reload} />;

  if (matches.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-white/40">
        No hay partidos en esta jornada todavía.
      </p>
    );
  }

  const shown = filtered.slice(0, visible);
  const showFilters = counts.porjugar > 0 || counts.vivo > 0 || counts.fin > 0;

  return (
    <div className="space-y-4">
      {counts.sin > 0 && (
        <button
          type="button"
          onClick={() => setFilter('sin')}
          className="flex w-full items-center gap-3 rounded-2xl bg-gold/10 px-4 py-3 text-left ring-1 ring-gold/30 transition-colors hover:bg-gold/15"
        >
          <AlarmClock className="h-5 w-5 shrink-0 text-gold" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gold">
              Te {counts.sin === 1 ? 'falta' : 'faltan'} {counts.sin}{' '}
              {counts.sin === 1 ? 'partido' : 'partidos'} por pronosticar
            </p>
            {nextClose !== null && (
              <p className="text-[11px] text-gold/70">El primero {untilClose(nextClose - now)}.</p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-gold/60" />
        </button>
      )}

      {showFilters && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-0.5">
          {CHIPS.map(({ key, label }) => {
            if (key !== 'todos' && counts[key] === 0) return null;
            const active = key === filter;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={active}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-colors ${
                  active
                    ? 'bg-accent/15 text-accent ring-accent/40'
                    : 'bg-white/[0.03] text-white/60 ring-white/10'
                }`}
              >
                {label}
                <span className={active ? 'text-accent/70' : 'text-white/35'}>{counts[key]}</span>
              </button>
            );
          })}
        </div>
      )}

      {shown.map((m) => {
        const pred = byMatch.get(m.id);
        return (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <MatchCard
              matchId={m.id}
              matchday={m.matchday}
              home={{ name: m.home_team, logoUrl: m.home_team_logo ?? undefined }}
              away={{ name: m.away_team, logoUrl: m.away_team_logo ?? undefined }}
              startTime={m.start_time}
              status={m.status}
              isFeatured={m.is_featured_match}
              homeScore={m.home_score}
              awayScore={m.away_score}
              initialPrediction={
                pred
                  ? {
                      home: pred.predicted_home,
                      away: pred.predicted_away,
                      usedWildcard: pred.used_wildcard,
                    }
                  : null
              }
              wildcardAvailable={!wildcardUsed || pred?.used_wildcard}
              onSave={savePrediction}
              onInfo={() => open(m)}
            />
          </motion.div>
        );
      })}

      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center gap-2 py-4 text-xs text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando más partidos… ({shown.length}/{filtered.length})
        </div>
      )}
    </div>
  );
}
