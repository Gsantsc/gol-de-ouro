-- LEAGUE AUDIT
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'gbieldev@hotmail.com',
  extensions.crypt('123456', extensions.gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Administrador"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
)
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = now(),
  recovery_sent_at = now(),
  last_sign_in_at = now(),
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  extensions.gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  jsonb_build_object(
    'sub',
    '00000000-0000-0000-0000-000000000001',
    'email',
    'gbieldev@hotmail.com'
  ),
  'email',
  'gbieldev@hotmail.com',
  now(),
  now(),
  now()
)
on conflict (provider, provider_id) do update set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  last_sign_in_at = now(),
  updated_at = now();

insert into public.users (
  id,
  name,
  email,
  role,
  approval_status,
  status,
  blocked,
  approved_at,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000001',
  'Administrador',
  'gbieldev@hotmail.com',
  'admin',
  'approved',
  'approved',
  false,
  now(),
  now(),
  now()
)
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  role = 'admin',
  approval_status = 'approved',
  status = 'approved',
  blocked = false,
  approved_at = coalesce(public.users.approved_at, now()),
  rejection_reason = null,
  updated_at = now();

insert into public.rankings (user_id)
values ('00000000-0000-0000-0000-000000000001')
on conflict (user_id) do nothing;
-- LEAGUE AUDIT
-- REMOVE MOCK MATCH DATA - Commented out mock tournaments, using API-Football sync only
-- insert into public.tournaments (id, name, type, active)
-- values
--   ('10000000-0000-0000-0000-000000000001', 'Copa do Mundo', 'world_cup', true),
--   ('10000000-0000-0000-0000-000000000002', 'Champions League', 'champions_league', true),
--   ('10000000-0000-0000-0000-000000000003', 'Libertadores', 'libertadores', true),
--   ('10000000-0000-0000-0000-000000000004', 'Brasileirao', 'brasileirao', true)
-- on conflict (id) do update set
--   name = excluded.name,
--   type = excluded.type,
--   active = excluded.active;

-- REMOVE MOCK MATCH DATA - Commented out mock rankings refresh, no matches to refresh
-- select public.refresh_rankings();

-- REMOVE MOCK MATCH DATA - Commented out mock matches, using API-Football sync only
-- insert into public.matches (
--   id,
--   tournament_id,
--   home_team,
--   away_team,
--   home_team_logo_url,
--   away_team_logo_url,
--   home_score,
--   away_score,
--   start_time,
--   prediction_open_at,
--   prediction_close_at,
--   status
-- )
-- values
--   (
--     '20000000-0000-0000-0000-000000000001',
--     '10000000-0000-0000-0000-000000000001',
--     'Brasil',
--     'Argentina',
--     'https://flagcdn.com/w80/br.png',
--     'https://flagcdn.com/w80/ar.png',
--     0,
--     0,
--     now() + interval '2 hours',
--     now() + interval '2 hours' - interval '24 hours',
--     now() + interval '2 hours' - interval '1 hour',
--     'aberto'
--   ),
--   (
--     '20000000-0000-0000-0000-000000000002',
--     '10000000-0000-0000-0000-000000000001',
--     'Franca',
--     'Alemanha',
--     'https://flagcdn.com/w80/fr.png',
--     'https://flagcdn.com/w80/de.png',
--     0,
--     0,
--     now() + interval '28 hours',
--     now() + interval '28 hours' - interval '24 hours',
--     now() + interval '28 hours' - interval '1 hour',
--     'fechado'
--   ),
--   (
--     '20000000-0000-0000-0000-000000000003',
--     '10000000-0000-0000-0000-000000000001',
--     'Espanha',
--     'Inglaterra',
--     'https://flagcdn.com/w80/es.png',
--     'https://flagcdn.com/w80/gb-eng.png',
--     2,
--     1,
--     now() - interval '3 hours',
--     now() - interval '3 hours' - interval '24 hours',
--     now() - interval '3 hours' - interval '1 hour',
--     'encerrado'
--   )
-- on conflict (id) do update set
--   home_score = excluded.home_score,
--   away_score = excluded.away_score,
--   start_time = excluded.start_time,
--   status = excluded.status;

-- REMOVE MOCK MATCH DATA - Commented out mock statistics, using API-Football sync only
-- insert into public.match_statistics (
--   match_id,
--   possession_home,
--   possession_away,
--   shots_home,
--   shots_away,
--   shots_on_goal_home,
--   shots_on_goal_away,
--   corners_home,
--   corners_away,
--   fouls_home,
--   fouls_away,
--   yellow_cards_home,
--   yellow_cards_away,
--   red_cards_home,
--   red_cards_away,
--   xg_home,
--   xg_away
-- )
-- values
--   ('20000000-0000-0000-0000-000000000001', 54, 46, 8, 6, 3, 2, 4, 3, 7, 8, 1, 1, 0, 0, 1.20, 0.80),
--   ('20000000-0000-0000-0000-000000000002', 49, 51, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
--   ('20000000-0000-0000-0000-000000000003', 58, 42, 14, 9, 6, 3, 7, 4, 11, 13, 2, 3, 0, 0, 2.30, 1.10)
-- on conflict (match_id) do update set
--   possession_home = excluded.possession_home,
--   possession_away = excluded.possession_away,
--   shots_home = excluded.shots_home,
--   shots_away = excluded.shots_away,
--   shots_on_goal_home = excluded.shots_on_goal_home,
--   shots_on_goal_away = excluded.shots_on_goal_away,
--   corners_home = excluded.corners_home,
--   corners_away = excluded.corners_away,
--   fouls_home = excluded.fouls_home,
--   fouls_away = excluded.fouls_away,
--   yellow_cards_home = excluded.yellow_cards_home,
--   yellow_cards_away = excluded.yellow_cards_away,
--   red_cards_home = excluded.red_cards_home,
--   red_cards_away = excluded.red_cards_away,
--   xg_home = excluded.xg_home,
--   xg_away = excluded.xg_away,
--   updated_at = now();

-- REMOVE MOCK MATCH DATA - Commented out mock events, using API-Football sync only
-- insert into public.match_events (match_id, minute, type, description)
-- values
--   ('20000000-0000-0000-0000-000000000003', 17, 'goal', 'Gol Espanha'),
--   ('20000000-0000-0000-0000-000000000003', 43, 'yellow_card', 'Cartao amarelo Inglaterra'),
--   ('20000000-0000-0000-0000-000000000003', 67, 'substitution', 'Substituicao Espanha'),
--   ('20000000-0000-0000-0000-000000000003', 89, 'goal', 'Gol Inglaterra')
-- on conflict do nothing;
