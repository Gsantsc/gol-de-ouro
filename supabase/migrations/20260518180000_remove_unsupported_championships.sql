-- LEAGUE AUDIT
-- SUPPORTED CHAMPIONSHIPS
-- MATCH CLEANUP - Controlled cleanup of unsupported championships and mock data
-- This migration removes tournaments and their associated data for championships not in SUPPORTED_CHAMPIONSHIPS
-- Also removes matches with provider_name null or championship null (mock data)

-- Supported championships: world_cup_2026, libertadores, sul_americana, brasileirao_a, copa_do_brasil, champions_league

-- Step 1: Soft-delete matches with provider_name null (mock data)
update public.matches
set deleted_at = now()
where provider_name is null
and deleted_at is null;

-- Step 2: Soft-delete matches with championship null (mock data)
update public.matches
set deleted_at = now()
where championship is null
and deleted_at is null;

-- Step 3: Identify and soft-delete unsupported tournaments
update public.tournaments
set deleted_at = now(), active = false
where slug not in (
  'world_cup_2026',
  'libertadores',
  'sul_americana',
  'brasileirao_a',
  'copa_do_brasil',
  'champions_league'
)
and deleted_at is null;

-- Step 4: Soft-delete matches belonging to unsupported tournaments
update public.matches
set deleted_at = now()
where tournament_id in (
  select id from public.tournaments
  where deleted_at is not null
)
and deleted_at is null;

-- Step 5: Soft-delete groups linked to unsupported tournaments
update public.groups
set deleted_at = now(), closed_at = now()
where championship_id in (
  select id from public.tournaments
  where deleted_at is not null
)
and deleted_at is null;

-- Step 6: Soft-delete group members for deleted groups
update public.group_members
set deleted_at = now()
where group_id in (
  select id from public.groups
  where deleted_at is not null
)
and deleted_at is null;

-- Step 7: Log the cleanup
insert into public.admin_logs (admin_id, action, entity)
select
  u.id,
  'Removed unsupported championships and mock data',
  'tournaments'
from public.users u
where u.email = 'gbieldev@hotmail.com'
on conflict do nothing;

-- Verification query (commented out - for manual verification)
-- select slug, name, deleted_at from public.tournaments order by deleted_at desc nulls last;
-- select id, home_team, away_team, provider_name, championship, deleted_at from public.matches order by deleted_at desc nulls last;
