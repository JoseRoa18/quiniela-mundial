import { motion } from 'framer-motion';

interface MatchdaySelectorProps {
  value: number;
  onChange: (matchday: number) => void;
  /** Identificador único de la "píldora" animada. Debe ser distinto en cada
   *  pestaña donde se use, o AnimatePresence(mode="wait") se bloquea al navegar. */
  layoutId?: string;
}

/** Las 9 "jornadas" del Mundial, con etiqueta corta para los chips. */
const ROUNDS: Array<{ md: number; label: string }> = [
  { md: 1, label: 'Grupos · J1' },
  { md: 2, label: 'Grupos · J2' },
  { md: 3, label: 'Grupos · J3' },
  { md: 4, label: '16avos' },
  { md: 5, label: 'Octavos' },
  { md: 6, label: 'Cuartos' },
  { md: 7, label: 'Semis' },
  { md: 8, label: '3.º Puesto' },
  { md: 9, label: 'Final' },
];

export default function MatchdaySelector({ value, onChange, layoutId = 'md-pill' }: MatchdaySelectorProps) {
  return (
    <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 py-1.5">
      {ROUNDS.map(({ md, label }) => {
        const active = md === value;
        return (
          <button
            key={md}
            type="button"
            onClick={() => onChange(md)}
            aria-pressed={active}
            className="relative flex min-h-[40px] shrink-0 items-center rounded-full px-3.5 text-xs font-semibold transition-colors"
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-accent/15 ring-1 ring-accent/40"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <span className={`relative z-10 ${active ? 'text-accent' : 'text-white/60'}`}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
