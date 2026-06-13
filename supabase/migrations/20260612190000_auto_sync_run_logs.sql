alter table public.match_provider_runs
  add column if not exists triggered_by text,
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz,
  add column if not exists checked_matches integer not null default 0,
  add column if not exists updated_matches integer not null default 0,
  add column if not exists live_matches integer not null default 0,
  add column if not exists finished_matches integer not null default 0,
  add column if not exists scored_predictions integer not null default 0,
  add column if not exists ranking_updated integer not null default 0,
  add column if not exists standings_updated integer not null default 0,
  add column if not exists knockout_updated integer not null default 0,
  add column if not exists error_message text;

create index if not exists match_provider_runs_created_provider_idx
  on public.match_provider_runs (created_at desc, provider_name);

grant select, insert on public.match_provider_runs to authenticated, service_role;

notify pgrst, 'reload schema';
