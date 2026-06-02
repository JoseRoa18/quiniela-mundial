import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useAllMatches } from '../hooks/useAllMatches';
import { computeGroupStandings, groupLabel, type TeamStanding } from '../lib/standings';

/** Color del borde según posición: 1-2 clasifican, 3 mejor tercero, 4 fuera. */
function posAccent(rank: number): string {
  if (rank <= 2) return '#00E5A0'; // clasifica directo
  if (rank === 3) return '#FFC83D'; // posible mejor tercero
  return 'transparent';
}

function StandingRow({ row, rank }: { row: TeamStanding; rank: number }) {
  const initials = row.team.slice(0, 3).toUpperCase();
  return (
    <tr className="border-t border-white/5">
      <td className="py-2 pl-3 pr-1">
        <span
          className="inline-block h-4 w-1 rounded-full align-middle"
          style={{ background: posAccent(rank) }}
        />
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

function GroupCard({ name, rows, index }: { name: string; rows: TeamStanding[]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-ink/60 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between px-4 py-2.5">
        <h3 className="text-sm font-bold text-white">{groupLabel(name)}</h3>
        <span className="text-[10px] uppercase tracking-wider text-gold/70">Mundial 2026</span>
      </div>
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
    </motion.div>
  );
}

export default function Groups() {
  const { matches, loading } = useAllMatches();

  const groups = useMemo(() => {
    const map = computeGroupStandings(matches);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [matches]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-white/40">
        Aún no hay grupos disponibles. Se mostrarán al sincronizar la fase de grupos.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Leyenda */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-white/40">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" /> Clasifican
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-gold" /> Mejor 3.º
        </span>
      </div>

      {groups.map(([name, rows], i) => (
        <GroupCard key={name} name={name} rows={rows} index={i} />
      ))}
    </div>
  );
}
