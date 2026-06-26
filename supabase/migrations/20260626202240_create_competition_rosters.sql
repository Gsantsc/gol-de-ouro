create table if not exists public.competition_rosters (
  id uuid primary key default gen_random_uuid(),
  championship text not null,
  player_id uuid not null references public.players (id) on delete cascade,
  team_code text,
  team_name text,
  is_official boolean not null default true,
  source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competition_rosters_championship_player_unique unique (championship, player_id)
);

create index if not exists competition_rosters_championship_idx
  on public.competition_rosters (championship);

create index if not exists competition_rosters_player_id_idx
  on public.competition_rosters (player_id);

create index if not exists competition_rosters_team_code_idx
  on public.competition_rosters (team_code);

create index if not exists competition_rosters_is_official_idx
  on public.competition_rosters (is_official);

drop trigger if exists competition_rosters_touch_updated_at on public.competition_rosters;
create trigger competition_rosters_touch_updated_at
before update on public.competition_rosters
for each row execute function public.touch_updated_at();

alter table public.competition_rosters enable row level security;

drop policy if exists competition_rosters_select_approved_or_admin on public.competition_rosters;
create policy competition_rosters_select_approved_or_admin
on public.competition_rosters
for select
to authenticated
using (
  public.is_admin()
  or public.is_approved_user()
);

drop policy if exists competition_rosters_admin_manage on public.competition_rosters;
create policy competition_rosters_admin_manage
on public.competition_rosters
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.competition_rosters to authenticated;
grant insert, update, delete on public.competition_rosters to authenticated;
