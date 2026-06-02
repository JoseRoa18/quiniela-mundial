# 🏆 Quiniela Deportiva (PWA)

App web progresiva para pronosticar partidos, sumar puntos y competir en una tabla en tiempo real.

**Stack:** React + TypeScript · Vite · Tailwind CSS (dark mode) · Framer Motion · Supabase (PostgreSQL, Auth, Realtime, Edge Functions) · PWA.

---

## ✨ Lo que incluye

- **Auth** con email + contraseña (perfil creado automáticamente al registrarse).
- **Dashboard de partidos** con tarjetas glassmorphism, escudos, contador regresivo animado y resplandor en el partido destacado.
- **Input de pronóstico** con steppers +/-, feedback háptico y botón Guardar con spinner → check verde.
- **Comodín** (1 por jornada) y **partido destacado** (×2), validados también en el backend.
- **Bloqueo de 30 min** antes del inicio, forzado por un trigger en PostgreSQL (no solo en el UI).
- **Leaderboard en tiempo real** con *layout animations* (las filas se reordenan solas) y el desempate exacto pedido.
- **Confeti** automático cuando aciertas un pleno (vía Supabase Realtime).
- **Edge Function** que calcula los puntos de los partidos finalizados + cron.

---

## 📁 Estructura

```
quiniela-deportiva/
├── src/
│   ├── components/      MatchCard, MatchList, Leaderboard, Auth
│   ├── hooks/           useAuth, useMatches, usePredictions, useLeaderboard, useCelebration
│   ├── lib/             supabase (cliente), calculatePoints (puntuación), confetti
│   ├── types/           database.ts (tipos del esquema)
│   ├── App.tsx          shell + navegación
│   └── main.tsx
├── supabase/
│   ├── schema.sql       👈 esquema completo (tablas, RLS, triggers, RPC)
│   ├── seed.sql         datos de ejemplo (jornada 1)
│   └── functions/
│       ├── _shared/scoring.ts        lógica de puntuación (idéntica al front)
│       └── score-matches/index.ts    Edge Function de cálculo
├── .env.example
└── vite.config.ts       (incluye configuración PWA)
```

---

## 🚀 Instalación paso a paso

### Requisitos previos
- **Node.js 18+** y npm.
- Una cuenta gratuita en **[Supabase](https://supabase.com)**.

### 1) Instalar dependencias
```bash
npm install
```

### 2) Crear el proyecto en Supabase
1. Entra a [app.supabase.com](https://app.supabase.com) → **New project**.
2. Cuando esté listo, ve a **Project Settings → API** y copia:
   - **Project URL**
   - **anon public** key
   - **service_role** key (¡secreta! solo para la Edge Function).

### 3) Crear el esquema de la base de datos
En el dashboard, abre **SQL Editor → New query**, pega **todo** el contenido de
`supabase/schema.sql` y pulsa **Run**. Esto crea las tablas, los enums, las
políticas RLS, los triggers (bloqueo de 30 min, sincronización de puntos,
creación de perfil) y las funciones `get_leaderboard()` y `set_random_featured_match()`.

### 4) (Opcional) Cargar datos de ejemplo
Repite el paso anterior con `supabase/seed.sql`. Inserta 5 partidos en distintos
estados (destacado, abierto, bloqueado, en juego y finalizado) para que veas todo
el UI funcionando de inmediato.

### 5) Configurar variables de entorno
```bash
cp .env.example .env
```
Edita `.env` con tus datos del paso 2:
```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

> 💡 **Tip de pruebas:** en **Authentication → Providers → Email**, desactiva
> *"Confirm email"* mientras desarrollas para poder entrar al instante tras registrarte.

### 6) Arrancar en desarrollo
```bash
npm run dev
```
Abre la URL que indica la terminal (normalmente `http://localhost:5173`).
Regístrate, pronostica y prueba la app. 🎉

---

## ⚙️ Edge Function: cálculo de puntos (para "todo" el flujo)

La función `score-matches` recorre los partidos **finalizados** y calcula los puntos
de cada pronóstico (escribe `points_earned` y `result_type`). El trigger
`sync_total_points` actualiza los puntos del perfil automáticamente.

### Desplegarla
Necesitas la **[Supabase CLI](https://supabase.com/docs/guides/cli)**:
```bash
# 1. Login y enlazar tu proyecto (ref = el ID que aparece en la URL del dashboard)
supabase login
supabase link --project-ref TU-PROJECT-REF

# 2. Configurar el secreto del service role
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# 3. Desplegar
supabase functions deploy score-matches
```

### Probarla manualmente
1. En la tabla `matches`, pon un partido en `status = 'finished'` con su `home_score`/`away_score`.
2. Asegúrate de tener un pronóstico para ese partido.
3. Invoca la función:
```bash
curl -X POST "https://TU-PROJECT-REF.functions.supabase.co/score-matches" \
  -H "Authorization: Bearer TU-ANON-KEY"
```
Verás los puntos en el leaderboard al instante (Realtime) y, si fue **pleno**, ¡confeti! 🎊

### Elegir el partido destacado de una jornada
```bash
curl -X POST "https://TU-PROJECT-REF.functions.supabase.co/score-matches?task=featured&matchday=1" \
  -H "Authorization: Bearer TU-ANON-KEY"
```

---

## ⏰ Automatizar con cron (pg_cron)

En el **SQL Editor**, activa la extensión y programa las tareas:
```sql
create extension if not exists pg_cron;

-- Calcular puntos cada 5 minutos
select cron.schedule(
  'score-matches-cron',
  '*/5 * * * *',
  $$
    select net.http_post(
      url     := 'https://TU-PROJECT-REF.functions.supabase.co/score-matches',
      headers := jsonb_build_object('Authorization', 'Bearer TU-ANON-KEY')
    );
  $$
);

-- Alternativa sin Edge Function para el destacado: llamar la función SQL directamente.
-- (Ejecútalo al abrir cada jornada, ajustando el número.)
select public.set_random_featured_match(1);
```
> `net.http_post` viene de la extensión `pg_net` (disponible en Supabase). Si no
> está activa: `create extension if not exists pg_net;`

---

## 📦 Producción / PWA

```bash
npm run build      # genera dist/ con el service worker (PWA instalable)
npm run preview    # previsualiza el build localmente
```
Sube la carpeta `dist/` a cualquier hosting estático (**Vercel**, **Netlify**,
**Cloudflare Pages**...). Recuerda configurar las variables `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY` en el panel del hosting.

---

## 📐 Reglas de negocio (dónde viven)

| Regla | Implementación |
|------|----------------|
| Pleno 3 / Tendencia 1 / Fallo 0 | `src/lib/calculatePoints.ts` |
| Destacado ×2 | mismo archivo + `is_featured_match` |
| Comodín ×2 si acierta, **-1** si falla | mismo archivo (penalización fija) |
| 1 comodín por jornada | índice único parcial en `schema.sql` |
| 1 destacado aleatorio por jornada | `set_random_featured_match()` |
| Bloqueo 30 min (backend) | trigger `enforce_prediction_lock` |
| Bloqueo 30 min (UI) | contador en `MatchCard.tsx` |
| Desempate del ranking | `get_leaderboard()` (puntos ↓, plenos ↓, nº pron. ↑, 1er pronóstico ↑) |
| Sincronización de puntos | trigger `sync_total_points` |

> **Decisión a validar:** los multiplicadores se **apilan** (pleno destacado + comodín = 3×2×2 = **12**),
> y un fallo con comodín da **-1 fijo** (el destacado no duplica la penalización).
> Si quieres -2, es cambiar una línea en `calculatePoints.ts`.

---

## 🎨 Notas de diseño
- Tema oscuro `#0B0F17` con acentos **verde neón** `#00E5A0` y **azul eléctrico** `#2D7BFF`.
- Tipografías: *Clash Display* (títulos), *Satoshi* (texto), *JetBrains Mono* (números). Se cargan vía CDN en `index.html`.
- Respeta `prefers-reduced-motion`.
