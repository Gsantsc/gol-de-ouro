alter table public.players
  add column if not exists provider_external_id text,
  add column if not exists source text;

create index if not exists players_provider_external_id_idx
  on public.players (provider_external_id, source)
  where deleted_at is null and provider_external_id is not null;

create index if not exists players_team_code_idx
  on public.players (team_code)
  where deleted_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competition_rosters_championship_player_unique'
      and conrelid = 'public.competition_rosters'::regclass
  ) then
    if exists (
      select 1
      from public.competition_rosters
      group by championship, player_id
      having count(*) > 1
    ) then
      raise warning 'competition_rosters has duplicate championship/player_id rows; unique constraint was not added.';
    else
      alter table public.competition_rosters
        add constraint competition_rosters_championship_player_unique
        unique (championship, player_id);
    end if;
  end if;
end $$;
