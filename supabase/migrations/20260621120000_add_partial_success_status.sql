-- SYNC STATUS CLASSIFICATION - Add partial_success status to match_provider_runs
alter table public.match_provider_runs
  drop constraint if exists match_provider_runs_status_check;

alter table public.match_provider_runs
  add constraint match_provider_runs_status_check
  check (status in ('success', 'partial_success', 'failed'));
