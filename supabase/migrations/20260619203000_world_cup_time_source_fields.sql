-- MATCH TIMEZONE NORMALIZATION

alter table public.matches
  add column if not exists source_timezone text,
  add column if not exists kickoff_source text,
  add column if not exists kickoff_verified_at timestamptz;

update public.matches
set
  start_time_utc = coalesce(start_time_utc, start_time),
  source_timezone = coalesce(source_timezone, venue_timezone, timezone_source, 'UTC'),
  kickoff_source = coalesce(kickoff_source, nullif(stats ->> 'source', ''), provider_name, 'unknown'),
  kickoff_verified_at = coalesce(kickoff_verified_at, last_synced_at, now()),
  display_time_br = coalesce(display_time_br, to_char(coalesce(start_time_utc, start_time) at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI'))
where championship = 'world_cup_2026'
  and deleted_at is null;
