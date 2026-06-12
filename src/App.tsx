import { useState } from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, LayoutGrid, ListChecks, LogOut, Swords, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { stageForMatchday, HOST_FLAGS } from './lib/worldcup';
import Auth from './components/Auth';
import MatchList from './components/MatchList';
import Groups from './components/Groups';
import Knockout from './components/Knockout';
import MatchdaySelector from './components/MatchdaySelector';
import RankingTab from './components/RankingTab';
import Rules from './components/Rules';
import { MatchDetailProvider } from './components/MatchDetail';
import AchievementWatcher from './components/AchievementWatcher';
import PushButton from './components/PushButton';
import LiveNow from './components/LiveNow';

type Tab = 'matches' | 'groups' | 'knockout' | 'leaderboard';

const TABS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: 'matches', label: 'Partidos', icon: ListChecks },
  { id: 'groups', label: 'Grupos', icon: LayoutGrid },
  { id: 'knockout', label: 'Llaves', icon: Swords },
  { id: 'leaderboard', label: 'Ranking', icon: Trophy },
];

export default function App() {
  const { user, profile, loading, signIn, signUp, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('matches');
  const [matchday, setMatchday] = useState(1);
  const [rulesOpen, setRulesOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-accent" />
      </div>
    );
  }

  if (!user) {
    return <Auth signIn={signIn} signUp={signUp} />;
  }

  const stage = stageForMatchday(matchday);

  return (
    <MatchDetailProvider username={profile?.username ?? ''}>
    <div className="mx-auto flex min-h-full max-w-md flex-col px-4 pb-28 pt-6">
      {/* Marca mundialista */}
      <div className="mb-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full bg-gold/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-gold ring-1 ring-gold/30">
          <Trophy className="h-3.5 w-3.5" /> Copa Mundial 2026
        </span>
        <span className="text-base leading-none" aria-label="Anfitriones: Canadá, EE. UU. y México">
          {HOST_FLAGS}
        </span>
      </div>

      {/* Cabecera */}
      <header className="mb-6 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-widest text-gold/80">{stage.label}</p>
          <h1 className="truncate text-xl font-bold text-white">
            Hola, {profile?.username ?? 'jugador'}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="rounded-2xl bg-accent/10 px-3 py-1.5 text-right ring-1 ring-accent/30">
            <p className="text-[10px] uppercase tracking-wider text-accent/70">Puntos</p>
            <p className="font-mono text-lg font-bold leading-none text-accent">
              {profile?.total_points ?? 0}
            </p>
          </div>
          <PushButton userId={user.id} />
          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            aria-label="Cómo funciona"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-white/60 ring-1 ring-white/10 hover:text-white"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={signOut}
            aria-label="Cerrar sesión"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-white/60 ring-1 ring-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Partidos en vivo ahora mismo (visible en todas las pestañas) */}
      <LiveNow />

      {/* Contenido con transición entre pestañas (sin mode="wait" para evitar
          el bloqueo de AnimatePresence al salir de pestañas con animaciones layout). */}
      <main className="flex-1">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {tab === 'matches' && (
            <>
              <MatchdaySelector value={matchday} onChange={setMatchday} />
              <MatchList userId={user.id} matchday={matchday} />
            </>
          )}
          {tab === 'groups' && <Groups />}
          {tab === 'knockout' && <Knockout />}
          {tab === 'leaderboard' && <RankingTab userId={user.id} username={profile?.username ?? ''} />}
        </motion.div>
      </main>

      <Rules open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <AchievementWatcher userId={user.id} />

      {/* Navegación inferior (glass) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md px-4 pb-5">
        <div className="glass flex items-center gap-1 rounded-2xl p-1.5 shadow-2xl">
          {TABS.map((t) => (
            <TabButton
              key={t.id}
              active={tab === t.id}
              onClick={() => setTab(t.id)}
              icon={<t.icon className="h-[18px] w-[18px]" />}
              label={t.label}
            />
          ))}
        </div>
      </nav>
    </div>
    </MatchDetailProvider>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className="relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold transition-colors"
    >
      {active && (
        <motion.span
          layoutId="tab-pill"
          className="absolute inset-0 rounded-xl bg-accent/15 ring-1 ring-accent/40"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}
      <span className={`relative z-10 ${active ? 'text-accent' : 'text-white/55'}`}>{icon}</span>
      <span className={`relative z-10 ${active ? 'text-accent' : 'text-white/55'}`}>{label}</span>
    </button>
  );
}
