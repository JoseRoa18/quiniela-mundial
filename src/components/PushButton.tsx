import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import { getPushState, subscribeToPush, unsubscribeFromPush, type PushState } from '../lib/push';

/** Botón de la cabecera para activar/desactivar las notificaciones push. */
export default function PushButton({ userId }: { userId: string }) {
  const [state, setState] = useState<PushState>('default');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getPushState().then(setState);
  }, []);

  if (state === 'unsupported') return null;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (state === 'subscribed') {
        await unsubscribeFromPush();
        setState('default');
      } else {
        await subscribeToPush(userId);
        setState('subscribed');
        // Aviso local de confirmación vía el service worker (en móvil NO se
        // permite `new Notification(...)`, hay que usar showNotification).
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification('Quiniela Mundial 🏆', {
          body: '¡Notificaciones activadas!',
          icon: '/icon.svg',
          badge: '/icon.svg',
        });
      }
    } catch (e) {
      setState(await getPushState());
      alert(e instanceof Error ? e.message : 'No se pudieron activar las notificaciones.');
    } finally {
      setBusy(false);
    }
  };

  const subscribed = state === 'subscribed';
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || state === 'denied'}
      aria-label={subscribed ? 'Desactivar notificaciones' : 'Activar notificaciones'}
      title={
        state === 'denied'
          ? 'Permiso bloqueado en el navegador'
          : subscribed
            ? 'Notificaciones activadas'
            : 'Activar notificaciones'
      }
      className={`flex h-10 w-10 items-center justify-center rounded-2xl ring-1 disabled:opacity-50 ${
        subscribed ? 'bg-accent/15 text-accent ring-accent/40' : 'bg-white/5 text-white/60 ring-white/10 hover:text-white'
      }`}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : subscribed ? (
        <BellRing className="h-4 w-4" />
      ) : state === 'denied' ? (
        <BellOff className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
    </button>
  );
}
