-- Knockout bracket metadata for resolved and future participants.

alter table public.matches
  add column if not exists match_number integer,
  add column if not exists match_code text,
  add column if not exists home_team_code text,
  add column if not exists away_team_code text,
  add column if not exists bracket_phase text,
  add column if not exists bracket_order integer,
  add column if not exists home_seed text,
  add column if not exists away_seed text,
  add column if not exists home_source_match_number integer,
  add column if not exists away_source_match_number integer,
  add column if not exists home_source_result text,
  add column if not exists away_source_result text,
  add column if not exists home_original_placeholder text,
  add column if not exists away_original_placeholder text,
  add column if not exists is_bracket_validated boolean not null default false,
  add column if not exists bracket_validation_error text,
  add column if not exists winner_team text,
  add column if not exists winner_team_code text,
  add column if not exists penalty_home_score integer,
  add column if not exists penalty_away_score integer,
  add column if not exists final_status text;

update public.matches
set match_number = nullif(stats ->> 'match_number', '')::integer
where match_number is null
  and stats ? 'match_number'
  and (stats ->> 'match_number') ~ '^[0-9]+$';

update public.matches
set
  home_original_placeholder = coalesce(home_original_placeholder, stats ->> 'source_home_team'),
  away_original_placeholder = coalesce(away_original_placeholder, stats ->> 'source_away_team')
where championship = 'world_cup_2026'
  and deleted_at is null;

alter table public.matches
  drop constraint if exists matches_home_source_result_check,
  add constraint matches_home_source_result_check
    check (home_source_result is null or home_source_result in ('winner', 'loser', 'fixed_team'));

alter table public.matches
  drop constraint if exists matches_away_source_result_check,
  add constraint matches_away_source_result_check
    check (away_source_result is null or away_source_result in ('winner', 'loser', 'fixed_team'));

alter table public.matches
  drop constraint if exists matches_bracket_phase_check,
  add constraint matches_bracket_phase_check
    check (
      bracket_phase is null
      or bracket_phase in (
        'group_stage',
        'round_of_32',
        'round_of_16',
        'quarter_final',
        'semi_final',
        'third_place',
        'final',
        'unknown'
      )
    );

create index if not exists idx_matches_championship_match_number
  on public.matches (championship, match_number)
  where deleted_at is null and match_number is not null;

create index if not exists idx_matches_bracket_phase
  on public.matches (championship, bracket_phase, bracket_order)
  where deleted_at is null and bracket_phase is not null;

create index if not exists idx_matches_bracket_sources
  on public.matches (championship, home_source_match_number, away_source_match_number)
  where deleted_at is null;
