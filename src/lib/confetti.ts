import confetti from 'canvas-confetti';

const ACCENT = '#00E5A0';
const ELECTRIC = '#2D7BFF';
const GOLD = '#FFC83D';

/** Respeta la preferencia de movimiento reducido del sistema. */
function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Lanza una celebración de confeti (al hacer pleno). Doble ráfaga desde los
 * laterales para un efecto más "premium".
 */
export function celebratePleno(): void {
  if (reducedMotion()) return;
  const colors = [ACCENT, ELECTRIC, GOLD, '#FFFFFF'];
  const end = Date.now() + 900;

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.7 },
      colors,
      scalar: 0.9,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.7 },
      colors,
      scalar: 0.9,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();

  // Estallido central
  confetti({
    particleCount: 120,
    spread: 100,
    startVelocity: 45,
    origin: { y: 0.6 },
    colors,
  });
}

/**
 * Celebración dorada para el desbloqueo de un logro: una lluvia desde arriba
 * con tonos de oro (efecto trofeo).
 */
export function celebrateAchievement(): void {
  if (reducedMotion()) return;
  const colors = [GOLD, '#FFE7A0', ACCENT, '#FFFFFF'];
  confetti({
    particleCount: 80,
    spread: 70,
    startVelocity: 40,
    origin: { y: 0.25 },
    colors,
    scalar: 1.1,
  });
  setTimeout(() => {
    confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.35 }, colors });
    confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.35 }, colors });
  }, 150);
}
