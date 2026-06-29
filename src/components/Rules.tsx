import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Trophy, X, Zap } from 'lucide-react';

interface RulesProps {
  open: boolean;
  onClose: () => void;
}

function PointRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/10">
      <span className="text-sm text-white/80">{label}</span>
      <span className="font-mono text-sm font-bold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

export default function Rules({ open, onClose }: RulesProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Fondo */}
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Hoja */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="glass relative z-10 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 sm:rounded-3xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-gold">
                  <Trophy className="h-5 w-5" />
                </span>
                <h2 className="text-lg font-bold text-white">Cómo funciona</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/60 ring-1 ring-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-5 text-sm leading-relaxed text-white/60">
              Pronostica el marcador exacto de cada partido del Mundial. Cuanto más te acerques,
              más puntos sumas. ¡El que más puntos tenga al final, gana!
            </p>

            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gold/80">Puntuación</h3>
            <div className="mb-5 space-y-2">
              <PointRow label="Pleno (marcador exacto)" value="3 pts" color="#00E5A0" />
              <PointRow label="Tendencia (aciertas quién gana / empate)" value="1 pt" color="#2D7BFF" />
              <PointRow label="Fallo (te equivocas de resultado)" value="0 pts" color="#9AA6B2" />
            </div>

            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gold/80">Potenciadores</h3>
            <div className="mb-5 space-y-3">
              <div className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
                <Zap className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                <div>
                  <p className="text-sm font-semibold text-white">Partido destacado ×2</p>
                  <p className="text-xs text-white/50">
                    Cada jornada hay un partido marcado que vale el <b>doble</b> de puntos.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-electric" />
                <div>
                  <p className="text-sm font-semibold text-white">Comodín</p>
                  <p className="text-xs text-white/50">
                    1 por jornada. Si <b>aciertas</b>, duplica esos puntos; si <b>fallas</b>, te resta
                    <b> 1 punto</b>. Úsalo con cabeza.
                  </p>
                </div>
              </div>
            </div>

            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gold/80">Reglas clave</h3>
            <ul className="space-y-1.5 text-sm text-white/60">
              <li className="flex gap-2"><span className="text-accent">•</span> Los pronósticos se <b className="text-white/80">cierran 30 min antes</b> de cada partido.</li>
              <li className="flex gap-2"><span className="text-accent">•</span> Marcadores y puntos se actualizan <b className="text-white/80">en vivo</b> durante los partidos.</li>
              <li className="flex gap-2"><span className="text-accent">•</span> En eliminatorias cuenta el resultado <b className="text-white/80">hasta los 120'</b> (con prórroga). Los <b className="text-white/80">penales no cuentan</b>: un partido a penales se puntúa como empate.</li>
              <li className="flex gap-2"><span className="text-accent">•</span> Empates en la tabla se rompen por: más plenos, luego menos partidos jugados.</li>
            </ul>

            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-xl bg-accent py-3 text-sm font-bold text-ink"
            >
              ¡Entendido!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
