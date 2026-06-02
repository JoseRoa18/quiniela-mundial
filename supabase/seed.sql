-- ============================================================================
--  Datos de ejemplo (jornada 1) para probar la app sin esperar a un cron.
--  Ejecutar DESPUÉS de schema.sql.
--  Tiempos relativos a now() para cubrir todos los estados del UI.
-- ============================================================================
insert into public.matches
  (matchday, home_team, away_team, home_team_logo, away_team_logo, start_time, status, home_score, away_score, is_featured_match)
values
  -- Destacado, abierto (faltan 2 días) -> resplandor + countdown
  (1, 'Real Madrid', 'Barcelona',
     'https://api.iconify.design/twemoji:soccer-ball.svg',
     'https://api.iconify.design/twemoji:soccer-ball.svg',
     now() + interval '2 days', 'pending', null, null, true),

  -- Abierto (faltan 5 horas)
  (1, 'Manchester City', 'Liverpool',
     'https://api.iconify.design/twemoji:soccer-ball.svg',
     'https://api.iconify.design/twemoji:soccer-ball.svg',
     now() + interval '5 hours', 'pending', null, null, false),

  -- A 20 min del inicio -> BLOQUEADO (regla de 30 min)
  (1, 'Bayern Múnich', 'Dortmund',
     'https://api.iconify.design/twemoji:soccer-ball.svg',
     'https://api.iconify.design/twemoji:soccer-ball.svg',
     now() + interval '20 minutes', 'pending', null, null, false),

  -- En juego
  (1, 'PSG', 'Marsella',
     'https://api.iconify.design/twemoji:soccer-ball.svg',
     'https://api.iconify.design/twemoji:soccer-ball.svg',
     now() - interval '20 minutes', 'in_progress', 1, 0, false),

  -- Finalizado con marcador
  (1, 'Juventus', 'Inter',
     'https://api.iconify.design/twemoji:soccer-ball.svg',
     'https://api.iconify.design/twemoji:soccer-ball.svg',
     now() - interval '3 hours', 'finished', 2, 1, false);
