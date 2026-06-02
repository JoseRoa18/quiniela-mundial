import { motion } from 'framer-motion';
import MatchCard from './MatchCard';
import { useMatches } from '../hooks/useMatches';
import { usePredictions } from '../hooks/usePredictions';

interface MatchListProps {
  userId: string;
  matchday?: number;
}

export default function MatchList({ userId, matchday = 1 }: MatchListProps) {
  const { matches, loading } = useMatches(matchday);
  const { byMatch, wildcardUsed, savePrediction } = usePredictions(userId, matchday);

  if (loading) {
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

  return (
    <motion.div
      className="space-y-4"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
    >
      {matches.map((m) => {
        const pred = byMatch.get(m.id);
        return (
          <motion.div
            key={m.id}
            variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
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
            />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
