import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Trophy } from 'lucide-react';
import { HOST_FLAGS } from '../lib/worldcup';

interface AuthProps {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
}

export default function Auth({ signIn, signUp }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        await signUp(email.trim(), password, username.trim() || email.split('@')[0]);
        setInfo('Cuenta creada. Si tu proyecto exige confirmación por email, revísalo; si no, ya puedes entrar.');
        setMode('login');
      } else {
        await signIn(email.trim(), password);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Algo salió mal');
    } finally {
      setBusy(false);
    }
  };

  const input =
    'w-full rounded-xl bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-accent/70 transition';

  return (
    <div className="flex min-h-full items-center justify-center px-5 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="glass w-full max-w-sm rounded-3xl p-7 shadow-2xl"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/15 text-gold shadow-goldGlow">
            <Trophy className="h-7 w-7" />
          </div>
          <span className="mb-1 inline-flex items-center gap-2 rounded-full bg-gold/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-gold ring-1 ring-gold/30">
            Copa Mundial 2026
          </span>
          <h1 className="text-2xl font-bold text-white">Quiniela Mundial</h1>
          <p className="mt-1 text-sm text-white/40">
            {mode === 'login' ? 'Entra y sigue sumando puntos' : 'Crea tu cuenta para competir'}
          </p>
          <p className="mt-2 text-base" aria-label="Anfitriones: Canadá, EE. UU. y México">
            {HOST_FLAGS}
          </p>
        </div>

        <div className="space-y-3">
          {mode === 'signup' && (
            <input
              className={input}
              placeholder="Nombre de usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          )}
          <input
            className={input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className={input}
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        {info && <p className="mt-3 text-xs text-accent">{info}</p>}

        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={submit}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-ink disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </motion.button>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === 'login' ? 'signup' : 'login'));
            setError(null);
            setInfo(null);
          }}
          className="mt-4 w-full text-center text-xs text-white/40 hover:text-white/70"
        >
          {mode === 'login'
            ? '¿No tienes cuenta? Regístrate'
            : '¿Ya tienes cuenta? Entra'}
        </button>
      </motion.div>
    </div>
  );
}
