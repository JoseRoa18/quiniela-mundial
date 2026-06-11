// Broadcast manual de una notificación push a TODOS los suscritos.
// Lee las claves/credenciales de variables de entorno (no las hardcodea).
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SB_URL, SB_SERVICE_ROLE
// Uso: node scripts/broadcast.mjs "Titulo" "Cuerpo"
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const PUB = process.env.VAPID_PUBLIC_KEY;
const PRIV = process.env.VAPID_PRIVATE_KEY;
const URL = process.env.SB_URL;
const SR = process.env.SB_SERVICE_ROLE;
const title = process.argv[2] || 'Quiniela Mundial';
const body = process.argv[3] || '';

if (!PUB || !PRIV || !URL || !SR) {
  console.error('Faltan variables de entorno (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SB_URL, SB_SERVICE_ROLE)');
  process.exit(1);
}

webpush.setVapidDetails('mailto:pricing@stylishkb.com', PUB, PRIV);
const supabase = createClient(URL, SR, { auth: { persistSession: false } });
const { data: subs } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth');
const payload = JSON.stringify({ title, body, url: '/' });

let sent = 0, removed = 0;
for (const s of subs ?? []) {
  try {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
    sent++;
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      removed++;
    }
  }
}
console.log(`Enviadas: ${sent} · caducadas borradas: ${removed} · total suscripciones: ${subs?.length ?? 0}`);
