/**
 * ============================================================================
 *  <MatchCard /> · Tarjeta de partido (Quiniela Deportiva)
 * ----------------------------------------------------------------------------
 *  Dependencias del proyecto:
 *    npm i framer-motion lucide-react
 *  Tailwind: requiere darkMode 'class' y, opcionalmente, una fuente mono
 *  (sugerencia: "Geist Mono" / "JetBrains Mono") mapeada a la clase font-mono.
 *
 *  Estética: "sports-tech terminal" — vidrio ahumado, azul eléctrico + verde
 *  neón, numerales monoespaciados. Respeta prefers-reduced-motion.
 * ============================================================================
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  motion,
  AnimatePresence,
} from 'framer-motion';
import { Check, Info, Loader2, Lock, Minus, Pencil, Plus, Sparkles, Zap } from 'lucide-react';
import { stageForMatchday, formatKickoff } from '../lib/worldcup';

/* -------------------------------- Tipos ---------------------------------- */
export interface Team {
  name: string;
  logoUrl?: string;
}

export interface MatchPrediction {
  home: number;
  away: number;
  usedWildcard: boolean;
}

export interface MatchCardProps {
  matchId: string;
  matchday?: number;
  home: Team;
  away: Team;
  startTime: string | Date;
  status: 'pending' | 'in_progress' | 'finished';
  isFeatured?: boolean;
  homeScore?: number | null;
  awayScore?: number | null;
  initialPrediction?: MatchPrediction | null;
  /** ¿El usuario todavía tiene comodín disponible en esta jornada? */
  wildcardAvailable?: boolean;
  /** Minutos antes del inicio en que se bloquea (default 30). */
  lockMinutesBefore?: number;
  /** Abre el detalle del partido. */
  onInfo?: () => void;
  onSave?: (data: {
    matchId: string;
    predictedHome: number;
    predictedAway: number;
    usedWildcard: boolean;
  }) => Promise<void>;
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

/* ----------------------------- Utilidades -------------------------------- */
const ACCENT = '#00E5A0'; // verde neón
const ELECTRIC = '#2D7BFF'; // azul eléctrico
const GOLD = '#FFC83D'; // dorado de la copa

/** Vibración háptica real en móviles compatibles (no falla en desktop). */
function haptic(ms = 8) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(ms);
  }
}

interface TimeLeft {
  total: number;
  d: number;
  h: number;
  m: number;
  s: number;
}

function diff(target: number): TimeLeft {
  const total = Math.max(0, target - Date.now());
  const sec = Math.floor(total / 1000);
  return {
    total,
    d: Math.floor(sec / 86400),
    h: Math.floor((sec % 86400) / 3600),
    m: Math.floor((sec % 3600) / 60),
    s: sec % 60,
  };
}

/* =============================== Subcomponentes =========================== */

/** Un dígito de tiempo que se anima verticalmente al cambiar de valor. */
function TimeUnit({
  value,
  label,
  urgent,
}: {
  value: number;
  label: string;
  urgent: boolean;
}) {
  const padded = String(value).padStart(2, '0');
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-9 w-12 overflow-hidden rounded-lg bg-white/5 backdrop-blur-sm ring-1 ring-white/10">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={padded}
            initial={{ y: '-100%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex items-center justify-center font-mono text-lg font-semibold tabular-nums"
            style={{ color: urgent ? '#FF5470' : '#E7ECF3' }}
          >
            {padded}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="mt-1 text-[10px] uppercase tracking-widest text-white/40">
        {label}
      </span>
    </div>
  );
}

/** Escudo del equipo con fallback a iniciales. */
function Crest({ team }: { team: Team }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
      {team.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.logoUrl}
          alt={team.name}
          className="h-8 w-8 object-contain"
        />
      ) : (
        <span className="text-base font-bold text-white/70">
          {team.name.slice(0, 3).toUpperCase()}
        </span>
      )}
    </div>
  );
}

/** Control +/- de goles con feedback táctil visual. */
function Stepper({
  value,
  onChange,
  disabled,
  accent,
}: {
  value: number;
  onChange: (next: number) => void;
  disabled: boolean;
  accent: string;
}) {
  const bump = (delta: number) => {
    if (disabled) return;
    const next = Math.min(99, Math.max(0, value + delta));
    if (next !== value) {
      haptic(8);
      onChange(next);
    }
  };

  const btn =
    'flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 text-white/80 disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className="flex shrink-0 items-center gap-2">
      <motion.button
        type="button"
        aria-label="Restar gol"
        whileTap={disabled ? undefined : { scale: 0.82 }}
        onClick={() => bump(-1)}
        disabled={disabled}
        className={btn}
      >
        <Minus className="h-4 w-4" />
      </motion.button>

      <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-black/30 ring-1 ring-white/10">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={{ y: '60%', opacity: 0, scale: 0.7 }}
            animate={{ y: '0%', opacity: 1, scale: 1 }}
            exit={{ y: '-60%', opacity: 0, scale: 0.7 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute inset-0 flex items-center justify-center font-mono text-2xl font-bold tabular-nums"
            style={{ color: accent }}
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </div>

      <motion.button
        type="button"
        aria-label="Sumar gol"
        whileTap={disabled ? undefined : { scale: 0.82 }}
        onClick={() => bump(1)}
        disabled={disabled}
        className={btn}
      >
        <Plus className="h-4 w-4" />
      </motion.button>
    </div>
  );
}

/* ================================ MatchCard =============================== */
export default function MatchCard({
  matchId,
  matchday,
  home,
  away,
  startTime,
  status,
  isFeatured = false,
  homeScore,
  awayScore,
  initialPrediction,
  wildcardAvailable = true,
  lockMinutesBefore = 30,
  onInfo,
  onSave,
}: MatchCardProps) {
  const lockAt = useMemo(() => {
    const start = new Date(startTime).getTime();
    return start - lockMinutesBefore * 60_000;
  }, [startTime, lockMinutesBefore]);

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => diff(lockAt));
  const [predHome, setPredHome] = useState(initialPrediction?.home ?? 0);
  const [predAway, setPredAway] = useState(initialPrediction?.away ?? 0);
  const [wildcard, setWildcard] = useState(initialPrediction?.usedWildcard ?? false);
  const [save, setSave] = useState<SaveStatus>('idle');
  const [predicted, setPredicted] = useState(!!initialPrediction);
  const dirty = useRef(false);

  // Tick del contador cada segundo
  useEffect(() => {
    const id = setInterval(() => setTimeLeft(diff(lockAt)), 1000);
    return () => clearInterval(id);
  }, [lockAt]);

  const finished = status === 'finished';
  const live = status === 'in_progress';
  const locked = finished || live || timeLeft.total <= 0;
  const urgent = !locked && timeLeft.total <= 5 * 60_000; // < 5 min
  const canUseWildcard = wildcardAvailable || initialPrediction?.usedWildcard;
  const stage = stageForMatchday(matchday ?? 1);
  // Partido ya pronosticado y aún editable -> se atenúa para distinguirlo.
  const dim = predicted && !finished && !live;

  const setH = (v: number) => { dirty.current = true; setSave('idle'); setPredHome(v); };
  const setA = (v: number) => { dirty.current = true; setSave('idle'); setPredAway(v); };
  const toggleWildcard = () => {
    if (locked || !canUseWildcard) return;
    haptic(14);
    dirty.current = true;
    setSave('idle');
    setWildcard((w) => !w);
  };

  const handleSave = async () => {
    if (locked || save === 'saving' || !onSave) return;
    setSave('saving');
    try {
      await onSave({
        matchId,
        predictedHome: predHome,
        predictedAway: predAway,
        usedWildcard: wildcard,
      });
      haptic([10, 30, 10] as unknown as number);
      setSave('success');
      setPredicted(true);
      dirty.current = false;
      setTimeout(() => setSave('idle'), 1800);
    } catch {
      setSave('error');
      setTimeout(() => setSave('idle'), 2200);
    }
  };

  return (
    <div className="relative">
      <motion.article
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={`relative overflow-hidden rounded-3xl border p-5 shadow-2xl backdrop-blur-xl transition-opacity ${
          isFeatured ? 'border-gold/50 bg-[#0B0F17]/85 shadow-goldGlow' : 'border-white/10 bg-[#0B0F17]/70'
        } ${dim ? 'opacity-60 hover:opacity-100 focus-within:opacity-100' : ''}`}
      >
        {/* Cabecera: fase del Mundial + fecha + badges de estado */}
        <header className="mb-5 flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={onInfo}
            className="flex min-w-0 flex-col items-start gap-0.5 text-left"
          >
            <span className="flex items-center gap-1 truncate text-[11px] font-bold uppercase tracking-wider text-gold/90">
              {stage.short} <Info className="h-3 w-3 opacity-60" />
            </span>
            <span className="truncate text-[11px] capitalize text-white/40">
              {formatKickoff(startTime)}
            </span>
          </button>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {isFeatured && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
                style={{ background: `${GOLD}1F`, color: GOLD }}
              >
                <Zap className="h-3.5 w-3.5" /> ×2 Destacado
              </span>
            )}
            {live ? (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-red-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                EN VIVO
              </span>
            ) : finished ? (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                Finalizado
              </span>
            ) : predicted ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: `${ACCENT}1A`, color: ACCENT }}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} /> Pronosticado
              </span>
            ) : null}
          </div>
        </header>

        {/* Equipos + marcador/predicción · una fila por equipo (cabe en móvil) */}
        <div className="space-y-3">
          {/* Local */}
          <div className="flex items-center gap-3">
            <Crest team={home} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white/90">
              {home.name}
            </span>
            {finished || live ? (
              <span className="w-12 text-center font-mono text-3xl font-bold tabular-nums text-white">
                {homeScore ?? 0}
              </span>
            ) : (
              <Stepper value={predHome} onChange={setH} disabled={locked} accent={ACCENT} />
            )}
          </div>

          {/* Visitante */}
          <div className="flex items-center gap-3">
            <Crest team={away} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white/90">
              {away.name}
            </span>
            {finished || live ? (
              <span className="w-12 text-center font-mono text-3xl font-bold tabular-nums text-white">
                {awayScore ?? 0}
              </span>
            ) : (
              <Stepper value={predAway} onChange={setA} disabled={locked} accent={ELECTRIC} />
            )}
          </div>
        </div>

        {/* Contador regresivo / estado de bloqueo */}
        <div className="mt-5 flex items-center justify-center">
          {finished ? (
            <span className="text-xs font-medium text-white/40">
              Resultado oficial
            </span>
          ) : locked ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/60 ring-1 ring-white/10">
              <Lock className="h-3.5 w-3.5" /> Pronóstico cerrado
            </span>
          ) : (
            <div className="flex items-center gap-2">
              {timeLeft.d > 0 && <TimeUnit value={timeLeft.d} label="días" urgent={urgent} />}
              <TimeUnit value={timeLeft.h} label="hrs" urgent={urgent} />
              <TimeUnit value={timeLeft.m} label="min" urgent={urgent} />
              <TimeUnit value={timeLeft.s} label="seg" urgent={urgent} />
            </div>
          )}
        </div>

        {/* Comodín + Guardar (solo si se puede pronosticar) */}
        {!finished && !live && (
          <div className="mt-5 flex items-center gap-3">
            <motion.button
              type="button"
              whileTap={locked || !canUseWildcard ? undefined : { scale: 0.94 }}
              onClick={toggleWildcard}
              disabled={locked || !canUseWildcard}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ring-1 transition-colors disabled:opacity-30"
              style={{
                background: wildcard ? `${ELECTRIC}26` : 'rgba(255,255,255,0.04)',
                color: wildcard ? ELECTRIC : 'rgba(255,255,255,0.6)',
                boxShadow: wildcard ? `0 0 0 1px ${ELECTRIC}` : undefined,
                borderColor: 'transparent',
              }}
              title={canUseWildcard ? 'Comodín: duplica si aciertas, -1 si fallas' : 'Comodín ya usado esta jornada'}
            >
              <Sparkles className="h-4 w-4" />
              Comodín
            </motion.button>

            <motion.button
              type="button"
              whileTap={locked ? undefined : { scale: 0.97 }}
              onClick={handleSave}
              disabled={locked || save === 'saving'}
              className="relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
              style={
                predicted
                  ? { background: 'transparent', color: ACCENT, boxShadow: `inset 0 0 0 1.5px ${ACCENT}` }
                  : { background: ACCENT, color: '#04130D' }
              }
            >
              <AnimatePresence mode="wait" initial={false}>
                {save === 'saving' ? (
                  <motion.span
                    key="saving"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
                  </motion.span>
                ) : save === 'success' ? (
                  <motion.span
                    key="success"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                    className="flex items-center gap-2"
                  >
                    <Check className="h-5 w-5" strokeWidth={3} /> ¡Guardado!
                  </motion.span>
                ) : save === 'error' ? (
                  <motion.span
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    Reintentar
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    {predicted && <Pencil className="h-4 w-4" />}
                    {predicted ? 'Editar pronóstico' : 'Guardar pronóstico'}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        )}
      </motion.article>
    </div>
  );
}
