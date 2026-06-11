-- API-FOOTBALL INTEGRATION
-- Criar tabelas para times, standings e lineups

-- Tabela de times (para armazenar logos e metadados)
create table if not exists public.teams (
  id uuid primary key default extensions.gen_random_uuid(),
  external_id text unique, -- ID da API-Football
  name text not null,
  logo_url text,
  country text,
  stadium text,
  founded_year integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Índice para busca por external_id
create index if not exists idx_teams_external_id on public.teams (external_id) where external_id is not null;

-- Índice para busca por nome
create index if not exists idx_teams_name on public.teams (name) where deleted_at is null;

-- Trigger para atualizar updated_at
create or replace function public.update_teams_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists teams_touch_updated_at on public.teams;
create trigger teams_touch_updated_at
  before update on public.teams
  for each row
  execute function public.update_teams_updated_at();

-- Tabela de standings (classificação)
create table if not exists public.standings (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  team_name text not null, -- fallback se team_id for null
  position integer not null,
  played integer not null default 0,
  won integer not null default 0,
  drawn integer not null default 0,
  lost integer not null default 0,
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  goal_difference integer not null default 0,
  points integer not null default 0,
  form text, -- Últimos 5 jogos: W, D, L
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tournament_id, team_id),
  unique (tournament_id, team_name)
);

-- Índice para busca por tournament
create index if not exists idx_standings_tournament on public.standings (tournament_id) where deleted_at is null;

-- Índice para busca por position
create index if not exists idx_standings_position on public.standings (tournament_id, position) where deleted_at is null;

-- Trigger para atualizar updated_at
create or replace function public.update_standings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists standings_touch_updated_at on public.standings;
create trigger standings_touch_updated_at
  before update on public.standings
  for each row
  execute function public.update_standings_updated_at();

-- Tabela de lineups (escalações)
create table if not exists public.match_lineups (
  id uuid primary key default extensions.gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  team_name text not null, -- fallback se team_id for null
  formation text,
  player_name text not null,
  player_number integer,
  is_starter boolean not null default true,
  is_captain boolean not null default false,
  created_at timestamptz not null default now(),
  unique (match_id, team_id, player_name)
);

-- Índice para busca por match
create index if not exists idx_match_lineups_match on public.match_lineups (match_id);

-- Índice para busca por team
create index if not exists idx_match_lineups_team on public.match_lineups (team_id) where team_id is not null;

-- Adicionar colunas na tabela matches para referenciar times
alter table public.matches
  add column if not exists home_team_id uuid references public.teams (id) on delete set null,
  add column if not exists away_team_id uuid references public.teams (id) on delete set null;

-- Índices para as novas colunas
create index if not exists idx_matches_home_team on public.matches (home_team_id) where home_team_id is not null;
create index if not exists idx_matches_away_team on public.matches (away_team_id) where away_team_id is not null;

-- RLS das tabelas auxiliares da API-Football.
alter table public.teams enable row level security;
alter table public.standings enable row level security;
alter table public.match_lineups enable row level security;

drop policy if exists teams_select_approved_or_admin on public.teams;
create policy teams_select_approved_or_admin
on public.teams for select to authenticated
using (
  public.is_admin()
  or (public.is_approved_user() and deleted_at is null)
);

drop policy if exists teams_admin_write on public.teams;
create policy teams_admin_write
on public.teams for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists standings_select_approved_or_admin on public.standings;
create policy standings_select_approved_or_admin
on public.standings for select to authenticated
using (
  public.is_admin()
  or (public.is_approved_user() and deleted_at is null)
);

drop policy if exists standings_admin_write on public.standings;
create policy standings_admin_write
on public.standings for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists match_lineups_select_approved_or_admin on public.match_lineups;
create policy match_lineups_select_approved_or_admin
on public.match_lineups for select to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_user()
    and exists (
      select 1
      from public.matches m
      where m.id = match_lineups.match_id
        and m.deleted_at is null
    )
  )
);

drop policy if exists match_lineups_admin_write on public.match_lineups;
create policy match_lineups_admin_write
on public.match_lineups for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.teams, public.standings, public.match_lineups to authenticated;
grant insert, update, delete on public.teams, public.standings, public.match_lineups to authenticated;
