create table if not exists public.competition_rankings (
  id uuid primary key default gen_random_uuid(),
  championship text not null,
  user_id uuid not null,
  total_points integer not null default 0,
  correct_results integer not null default 0,
  exact_scores integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint competition_rankings_championship_user_unique unique (championship, user_id)
);

create index if not exists competition_rankings_championship_idx
  on public.competition_rankings (championship);

create index if not exists competition_rankings_user_id_idx
  on public.competition_rankings (user_id);

create index if not exists competition_rankings_championship_points_idx
  on public.competition_rankings (championship, total_points desc, exact_scores desc);

alter table public.competition_rankings enable row level security;

drop policy if exists "competition_rankings_select_authenticated" on public.competition_rankings;

create policy "competition_rankings_select_authenticated"
  on public.competition_rankings
  for select
  to authenticated
  using (true);
