import { useMemo } from 'react';
import { Crown, Flame, Sparkles, Target } from 'lucide-react';
import { stageForMatchday } from '../lib/worldcup';
import type { Match, Prediction } from '../types/database';

/**
 * Estadísticas personales del jugador (todas las jornadas): puntos, plenos,
 * % de acierto, mejor racha de plenos, mejor jornada y comodines.
 * Solo cuenta los pronósticos ya calificados (result_type !== 'pending').
 */
export default function PlayerStats({
  predictions,
  matchById,
}: {
  predictions: Prediction[];
  matchById: Map<string, Match>;
}) {
  const s = useMemo(() => {
    const graded = predictions.filter((p) => p.result_type !== 'pending');
    const plenos = graded.filter((p) => p.result_type === 'pleno').length;
    const tendencias = graded.filter((p) => p.result_type === 'tendencia').length;
    const played = graded.length;
    const aciertos = plenos + tendencias;
    const points = graded.reduce((sum, p) => sum + (p.points_earned ?? 0), 0);
    const accuracy = played ? Math.round((aciertos / played) * 100) : 0;

    // Mejor racha de plenos consecutivos, en orden cronológico del partido.
    const ordered = [...graded].sort((a, b) => {
      const ta = matchById.get(a.match_id)?.start_time ?? '';
      const tb = matchById.get(b.match_id)?.start_time ?? '';
      return ta.localeCompare(tb);
    });
    let bestStreak = 0;
    let run = 0;
    for (const p of ordered) {
      if (p.result_type === 'pleno') {
        run += 1;
        if (run > bestStreak) bestStreak = run;
      } else {
        run = 0;
      }
    }

    // Mejor jornada por puntos.
    const byMd = new Map<number, number>();
    for (const p of graded) {
      const md = p.matchday ?? 0;
      byMd.set(md, (byMd.get(md) ?? 0) + (p.points_earned ?? 0));
    }
    let bestMd: number | null = null;
    let bestMdPts = 0;
    for (const [md, pts] of byMd) {
      if (bestMd === null || pts > bestMdPts) {
        bestMd = md;
        bestMdPts = pts;
      }
    }

    // Comodines.
    const wildcards = predictions.filter((p) => p.used_wildcard);
    const wcUsed = wildcards.length;
    const wcHits = wildcards.filter((p) => p.result_type === 'pleno' || p.result_type === 'tendencia').length;

    return { plenos, played, aciertos, points, accuracy, bestStreak, bestMd, bestMdPts, wcUsed, wcHits };
  }, [predictions, matchById]);

  const rows: Array<{ icon: typeof Target; tint: string; label: string; value: string; sub?: string }> = [
    {
      icon: Target,
      tint: '#2D7BFF',
      label: '% de acierto',
      value: s.played ? `${s.accuracy}%` : '—',
      sub: s.played ? `${s.aciertos}/${s.played} jugados` : 'sin partidos jugados',
    },
    {
      icon: Flame,
      tint: '#FF7A1A',
      label: 'Racha de plenos',
      value: s.bestStreak > 0 ? `${s.bestStreak}` : '—',
      sub: s.bestStreak === 1 ? 'pleno seguido' : 'plenos seguidos',
    },
    {
      icon: Crown,
      tint: '#FFC83D',
      label: 'Mejor jornada',
      value: s.bestMd !== null ? stageForMatchday(s.bestMd).short : '—',
      sub: s.bestMd !== null ? `${s.bestMdPts} pts` : 'aún sin puntos',
    },
    {
      icon: Sparkles,
      tint: '#00E5A0',
      label: 'Comodines',
      value: s.wcUsed ? `${s.wcHits}/${s.wcUsed}` : '—',
      sub: s.wcUsed ? 'acertados' : 'sin usar',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Titulares */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-accent/10 px-3 py-3 text-center ring-1 ring-accent/30">
          <p className="font-mono text-xl font-bold text-accent">{s.points}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/40">Puntos</p>
        </div>
        <div className="rounded-2xl bg-white/[0.03] px-3 py-3 text-center ring-1 ring-white/10">
          <p className="font-mono text-xl font-bold text-white">{s.plenos}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/40">Plenos</p>
        </div>
        <div className="rounded-2xl bg-white/[0.03] px-3 py-3 text-center ring-1 ring-white/10">
          <p className="font-mono text-xl font-bold text-white">{predictions.length}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/40">Pronósticos</p>
        </div>
      </div>

      {/* Tus números */}
      <div className="grid grid-cols-2 gap-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center gap-2.5 rounded-2xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/10"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `${r.tint}1A` }}
            >
              <r.icon className="h-4 w-4" style={{ color: r.tint }} />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-base font-bold leading-none text-white">{r.value}</p>
              <p className="truncate text-[10px] uppercase tracking-wider text-white/40">{r.label}</p>
              {r.sub && <p className="truncate text-[10px] text-white/30">{r.sub}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
