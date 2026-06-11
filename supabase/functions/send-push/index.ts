// ============================================================================
//  Edge Function: send-push  (Deno)
// ----------------------------------------------------------------------------
//  Envía una notificación Web Push a las suscripciones guardadas.
//  Body JSON: { title, body, url?, user_id? }
//    · Sin user_id  -> a TODOS los suscritos (broadcast).
//    · Con user_id  -> solo a ese usuario.
//  Limpia automáticamente las suscripciones caducadas (404/410).
//
//  Secrets necesarios (Edge Function -> Secrets):
//    VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ej: mailto:tu@correo.com)
//    (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.)
//
//  Despliegue: pegar en el editor del dashboard como función "send-push".
//  Prueba: curl -X POST .../functions/v1/send-push -H "Authorization: Bearer <ANON>"
//          -H "Content-Type: application/json" -d '{"title":"Hola","body":"Prueba"}'
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Autoriza solo al service_role (servidor/crons), NO a la anon key (pública).
// Acepta coincidencia exacta con el secret o, de forma robusta, que el JWT
// tenga el claim role === 'service_role' (la plataforma ya valida la firma).
function isServiceRole(req: Request): boolean {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return true;
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(part));
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async (req: Request) => {
  // Seguridad: solo el service_role (servidor/crons), no la anon key (pública).
  if (!isServiceRole(req)) {
    return json({ error: 'No autorizado' }, 401);
  }

  const pub = Deno.env.get('VAPID_PUBLIC_KEY');
  const priv = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@quiniela.app';
  if (!pub || !priv) return json({ error: 'Faltan los secrets VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY' }, 500);

  let payloadIn: { title?: string; body?: string; url?: string; user_id?: string; tag?: string } = {};
  try {
    payloadIn = await req.json();
  } catch {
    payloadIn = {};
  }

  webpush.setVapidDetails(subject, pub, priv);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let query = supabase.from('push_subscriptions').select('endpoint, p256dh, auth');
  if (payloadIn.user_id) query = query.eq('user_id', payloadIn.user_id);
  const { data: subs, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const payload = JSON.stringify({
    title: payloadIn.title ?? 'Quiniela Mundial',
    body: payloadIn.body ?? '',
    url: payloadIn.url ?? '/',
    tag: payloadIn.tag,
  });

  let sent = 0;
  let removed = 0;
  for (const s of (subs ?? []) as SubRow[]) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        removed++;
      }
    }
  }

  return json({ ok: true, sent, removed, total: subs?.length ?? 0 });
});
