alter table public.standings
  add column if not exists group_code text;

create index if not exists idx_standings_group
  on public.standings (tournament_id, group_code, position)
  where deleted_at is null;

notify pgrst, 'reload schema';
