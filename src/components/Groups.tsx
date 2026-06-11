import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useAllMatches } from '../hooks/useAllMatches';
import { useProgressive } from '../hooks/useProgressive';
import ErrorState from './ErrorState';
import { computeGroupStandings, groupLabel, type TeamStanding } from '../lib/standings';
import { formatKickoff } from '../lib/worldcup';
import { useMatchDetail } from './MatchDetail';
import type { Match } from '../types/database';

/** Color del borde según posición: 1-2 clasifican, 3 mejor tercero, 4 fuera. */
function posAccent(rank: number): string {
  if (rank <= 2) return '#00E5A0';
  if (rank === 3) return '#FFC83D';
  return 'transparent';
}

function StandingRow({ row, rank }: { row: TeamStanding; rank: number }) {
  const initials = row.team.slice(0, 3).toUpperCase();
  return (
    <tr className="border-t border-white/5">
      <td className="py-2 pl-3 pr-1">
        <span className="inline-block h-4 w-1 rounded-full align-middle" style={{ background: posAccent(rank) }} />
        <span className="ml-2 font-mono text-xs text-white/50">{rank}</span>
      </td>
      <td className="py-2 pr-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/5 ring-1 ring-white/10">
            {row.logo ? (
              <img src={row.logo} alt={row.team} className="h-4 w-4 object-contain" />
            ) : (
              <span className="text-[8px] font-bold text-white/60">{initials}</span>
            )}
          </div>
          <span className="truncate text-xs font-medium text-white/90">{row.team}</span>
        </div>
      </td>
      <td className="py-2 text-center font-mono text-xs text-white/50">{row.played}</td>
      <td className="py-2 text-center font-mono text-xs text-white/50">
        {row.gd > 0 ? `+${row.gd}` : row.gd}
      </td>
      <td className="py-2 pr-3 text-center font-mono text-sm font-bold text-accent">{row.points}</td>
    </tr>
  );
}

function FixtureRow({ m }: { m: Match }) {
  const { open } = useMatchDetail();
  const played = m.status === 'finished' || m.status === 'in_progress';
  const live = m.status === 'in_progress';
  return (
    <button type="button" onClick={() => open(m)} className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-white/[0.03]">
      <span className="w-24 shrink-0 truncate capitalize text-white/35">{formatKickoff(m.start_time)}</span>
      <span className="flex-1 truncate text-right font-medium text-white/80">{m.home_team}</span>
      <span className="w-12 shrink-0 text-center font-mono font-bold text-white">
        {played ? (
          <span className={live ? 'text-red-400' : ''}>
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

function GroupCard({
  name,
  rows,
  fixtures,
  open,
  onToggle,
  index,
}: {
  name: string;
  rows: TeamStanding[];
  fixtures: Match[];
  open: boolean;
  onToggle: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-ink/60 backdrop-blur-xl"
    >
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between px-4 py-2.5">
        <h3 className="text-sm font-bold text-white">{groupLabel(name)}</h3>
        <ChevronDown
          className={`h-4 w-4 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-white/30">
            <th className="pb-1 pl-3 text-left font-medium">#</th>
            <th className="pb-1 text-left font-medium">Equipo</th>
            <th className="pb-1 text-center font-medium">PJ</th>
            <th className="pb-1 text-center font-medium">DG</th>
            <th className="pb-1 pr-3 text-center font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <StandingRow key={row.team} row={row} rank={i + 1} />
          ))}
        </tbody>
      </table>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-white/5 bg-black/20"
          >
            <p className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-gold/60">
              Partidos del grupo
            </p>
            <div className="divide-y divide-white/5 pb-2">
              {fixtures.map((m) => (
                <FixtureRow key={m.id} m={m} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Groups() {
  const { matches, loading, error, reload } = useAllMatches();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = computeGroupStandings(matches);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [matches]);

  const fixturesByGroup = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      if (m.stage !== 'GROUP_STAGE' || !m.group_name) continue;
      if (!map.has(m.group_name)) map.set(m.group_name, []);
      map.get(m.group_name)!.push(m);
    }
    for (const list of map.values()) list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return map;
  }, [matches]);

  const { visible, sentinelRef, hasMore } = useProgressive(groups.length, 4);

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (error) return <ErrorState onRetry={reload} />;

  if (groups.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-white/40">
        Aún no hay grupos disponibles. Se mostrarán al sincronizar la fase de grupos.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-4 text-[10px] text-white/40">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" /> Clasifican
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-gold" /> Mejor 3.º
        </span>
        <span className="text-white/25">· toca un grupo para ver sus partidos</span>
      </div>

      {groups.slice(0, visible).map(([name, rows], i) => (
        <GroupCard
          key={name}
          name={name}
          rows={rows}
          fixtures={fixturesByGroup.get(name) ?? []}
          open={openGroup === name}
          onToggle={() => setOpenGroup((cur) => (cur === name ? null : name))}
          index={i}
        />
      ))}

      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center gap-2 py-4 text-xs text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando más grupos… ({Math.min(visible, groups.length)}/{groups.length})
        </div>
      )}
    </div>
  );
}
