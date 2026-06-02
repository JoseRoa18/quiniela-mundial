/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Clash Display"', 'system-ui', 'sans-serif'],
        sans: ['Satoshi', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: '#0B0F17',
        accent: '#00E5A0', // verde neón (césped)
        electric: '#2D7BFF', // azul eléctrico
        gold: '#FFC83D', // dorado de la copa (acento mundialista)
      },
      boxShadow: {
        glow: '0 0 24px rgba(0,229,160,0.35)',
        goldGlow: '0 0 28px rgba(255,200,61,0.40)',
      },
    },
  },
  plugins: [],
};
