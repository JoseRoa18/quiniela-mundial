import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import MatchCard from './MatchCard';
import { useMatches } from '../hooks/useMatches';
import { usePredictions } from '../hooks/usePredictions';
import { useProgressive } from '../hooks/useProgressive';
import { useMatchDetail } from './MatchDetail';

interface MatchListProps {
  userId: string;
  matchday?: number;
}

export default function MatchList({ userId, matchday = 1 }: MatchListProps) {
  const { matches, loading } = useMatches(matchday);
  const { byMatch, wildcardUsed, savePrediction, loading: predsLoading } = usePredictions(userId, matchday);
  const { open } = useMatchDetail();
  const { visible, sentinelRef, hasMore } = useProgressive(matches.length, 5, matchday);

  if (loading || predsLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-3xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-white/40">
        No hay partidos en esta jornada todavía.
      </p>
    );
  }

  const shown = matches.slice(0, visible);

  return (
    <div className="space-y-4">
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
          Cargando más partidos… ({shown.length}/{matches.length})
        </div>
      )}
    </div>
  );
}
