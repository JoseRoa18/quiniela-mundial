import confetti from 'canvas-confetti';

const ACCENT = '#00E5A0';
const ELECTRIC = '#2D7BFF';
const GOLD = '#FFD166';

/**
 * Lanza una celebración de confeti (al hacer pleno). Doble ráfaga desde los
 * laterales para un efecto más "premium".
 */
export function celebratePleno(): void {
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
