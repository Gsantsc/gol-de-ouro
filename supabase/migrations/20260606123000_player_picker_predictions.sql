create table if not exists public.players (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  team_code text not null,
  team_name text not null,
  position text,
  shirt_number integer check (shirt_number is null or shirt_number between 1 and 99),
  active boolean not null default true,
  source text not null default 'seed',
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (team_code, name)
);

create index if not exists players_team_code_idx on public.players (team_code) where deleted_at is null;
create index if not exists players_team_name_idx on public.players (team_name) where deleted_at is null;
create index if not exists players_active_idx on public.players (active) where deleted_at is null;

create or replace function public.update_players_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists players_touch_updated_at on public.players;
create trigger players_touch_updated_at
before update on public.players
for each row execute function public.update_players_updated_at();

alter table public.predictions
  add column if not exists predicted_first_scorer_id uuid references public.players (id) on delete set null,
  add column if not exists predicted_man_of_match_id uuid references public.players (id) on delete set null,
  add column if not exists predicted_first_goal_no_goals boolean not null default false;

alter table public.matches
  add column if not exists first_goal_scorer_id uuid references public.players (id) on delete set null,
  add column if not exists man_of_match_id uuid references public.players (id) on delete set null,
  add column if not exists first_goal_no_goals boolean not null default false;

create index if not exists predictions_first_scorer_player_idx on public.predictions (predicted_first_scorer_id);
create index if not exists predictions_man_of_match_player_idx on public.predictions (predicted_man_of_match_id);
create index if not exists matches_first_scorer_player_idx on public.matches (first_goal_scorer_id);
create index if not exists matches_man_of_match_player_idx on public.matches (man_of_match_id);

alter table public.players enable row level security;

drop policy if exists players_select_approved_or_admin on public.players;
create policy players_select_approved_or_admin
on public.players for select to authenticated
using (
  public.is_admin()
  or (public.is_approved_user() and active = true and deleted_at is null)
);

drop policy if exists players_admin_write on public.players;
create policy players_admin_write
on public.players for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.players to authenticated;
grant insert, update on public.players to authenticated;

create or replace function public.player_market_name(player_id uuid, fallback text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.name from public.players p where p.id = player_id and p.deleted_at is null),
    nullif(trim(coalesce(fallback, '')), '')
  );
$$;

create or replace function public.ensure_prediction_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_match public.matches%rowtype;
begin
  if new.user_id <> auth.uid() then
    raise exception 'O palpite deve pertencer ao usuario autenticado.';
  end if;

  if not public.is_approved_user() then
    raise exception 'Usuario ainda nao aprovado ou bloqueado.';
  end if;

  select *
  into target_match
  from public.matches
  where id = new.match_id
    and deleted_at is null;

  if not found then
    raise exception 'Partida nao encontrada.';
  end if;

  if target_match.status in ('ao_vivo', 'encerrado') then
    raise exception 'Este jogo ja nao aceita novos palpites.';
  end if;

  if now() < target_match.prediction_open_at then
    raise exception 'Palpites abrem 24h antes do jogo.';
  end if;

  if now() >= target_match.prediction_close_at then
    raise exception 'Palpites encerram 1h antes do jogo.';
  end if;

  if new.predicted_first_goal_no_goals then
    new.predicted_first_scorer_id := null;
    new.predicted_first_scorer := null;
  elsif new.predicted_first_scorer_id is not null then
    new.predicted_first_scorer := public.player_market_name(new.predicted_first_scorer_id, null);
  else
    new.predicted_first_scorer := nullif(trim(coalesce(new.predicted_first_scorer, '')), '');
  end if;

  if new.predicted_man_of_match_id is not null then
    new.predicted_man_of_match := public.player_market_name(new.predicted_man_of_match_id, null);
  else
    new.predicted_man_of_match := nullif(trim(coalesce(new.predicted_man_of_match, '')), '');
  end if;

  new.predicted_winner := coalesce(
    new.predicted_winner,
    public.score_outcome(new.predicted_home_score, new.predicted_away_score)
  );
  new.locked := false;
  new.submitted_at := now();
  new.points := 0;
  return new;
end;
$$;

create or replace function public.protect_locked_prediction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_match public.matches%rowtype;
  elevated boolean :=
    coalesce(auth.role(), '') = 'service_role'
    or public.is_admin();
  prediction_changed boolean;
begin
  if tg_op = 'DELETE' then
    if elevated then
      return old;
    end if;

    raise exception 'Palpites nao podem ser excluidos.';
  end if;

  if old.user_id <> new.user_id or old.match_id <> new.match_id then
    raise exception 'Usuario e partida do palpite nao podem ser alterados.';
  end if;

  prediction_changed :=
    old.predicted_home_score is distinct from new.predicted_home_score
    or old.predicted_away_score is distinct from new.predicted_away_score
    or old.predicted_winner is distinct from new.predicted_winner
    or old.predicted_first_scorer is distinct from new.predicted_first_scorer
    or old.predicted_first_scorer_id is distinct from new.predicted_first_scorer_id
    or old.predicted_first_goal_no_goals is distinct from new.predicted_first_goal_no_goals
    or old.predicted_both_teams_score is distinct from new.predicted_both_teams_score
    or old.predicted_man_of_match is distinct from new.predicted_man_of_match
    or old.predicted_man_of_match_id is distinct from new.predicted_man_of_match_id
    or old.predicted_red_card is distinct from new.predicted_red_card;

  if prediction_changed then
    if old.user_id <> auth.uid() or not public.is_approved_user() then
      raise exception 'Apenas o dono aprovado pode editar o palpite.';
    end if;

    select *
    into target_match
    from public.matches
    where id = new.match_id
      and deleted_at is null;

    if not found
      or target_match.status in ('ao_vivo', 'encerrado')
      or now() < target_match.prediction_open_at
      or now() >= target_match.prediction_close_at then
      raise exception 'Palpites encerram 1h antes do jogo.';
    end if;

    new.predicted_winner := coalesce(
      new.predicted_winner,
      public.score_outcome(new.predicted_home_score, new.predicted_away_score)
    );

    if new.predicted_first_goal_no_goals then
      new.predicted_first_scorer_id := null;
      new.predicted_first_scorer := null;
    elsif new.predicted_first_scorer_id is not null then
      new.predicted_first_scorer := public.player_market_name(new.predicted_first_scorer_id, null);
    else
      new.predicted_first_scorer := nullif(trim(coalesce(new.predicted_first_scorer, '')), '');
    end if;

    if new.predicted_man_of_match_id is not null then
      new.predicted_man_of_match := public.player_market_name(new.predicted_man_of_match_id, null);
    else
      new.predicted_man_of_match := nullif(trim(coalesce(new.predicted_man_of_match, '')), '');
    end if;

    new.locked := false;
    new.submitted_at := now();
    new.points := 0;
  end if;

  if old.points is distinct from new.points
    or old.locked is distinct from new.locked
    or old.submitted_at is distinct from new.submitted_at then
    if elevated then
      return new;
    end if;

    raise exception 'Campos internos do palpite nao podem ser alterados.';
  end if;

  return new;
end;
$$;

create or replace function public.recalculate_match_points(target_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_match public.matches%rowtype;
begin
  select *
  into target_match
  from public.matches
  where id = target_match_id
    and deleted_at is null;

  if not found then
    raise exception 'Partida nao encontrada.';
  end if;

  if target_match.status <> 'encerrado' then
    return;
  end if;

  with scored as (
    select
      p.id,
      (
        case when p.predicted_home_score = target_match.home_score
          and p.predicted_away_score = target_match.away_score then 10 else 0 end
        + case when coalesce(p.predicted_winner, public.score_outcome(p.predicted_home_score, p.predicted_away_score))
          = public.score_outcome(target_match.home_score, target_match.away_score) then 5 else 0 end
        + case when (p.predicted_home_score - p.predicted_away_score)
          = (target_match.home_score - target_match.away_score) then 3 else 0 end
        + case when (
            (coalesce(p.predicted_first_goal_no_goals, false) and coalesce(target_match.first_goal_no_goals, false))
            or (
              p.predicted_first_scorer_id is not null
              and target_match.first_goal_scorer_id is not null
              and p.predicted_first_scorer_id = target_match.first_goal_scorer_id
            )
            or (
              p.predicted_first_scorer_id is null
              and target_match.first_goal_scorer_id is null
              and public.normalize_prediction_market_text(p.predicted_first_scorer) is not null
              and public.normalize_prediction_market_text(target_match.first_goal_scorer) is not null
              and public.normalize_prediction_market_text(p.predicted_first_scorer)
                = public.normalize_prediction_market_text(target_match.first_goal_scorer)
            )
          ) then 8 else 0 end
        + case when p.predicted_both_teams_score is not null
          and p.predicted_both_teams_score = (target_match.home_score > 0 and target_match.away_score > 0) then 2 else 0 end
        + case when (
            (
              p.predicted_man_of_match_id is not null
              and target_match.man_of_match_id is not null
              and p.predicted_man_of_match_id = target_match.man_of_match_id
            )
            or (
              p.predicted_man_of_match_id is null
              and target_match.man_of_match_id is null
              and public.normalize_prediction_market_text(p.predicted_man_of_match) is not null
              and public.normalize_prediction_market_text(target_match.man_of_match) is not null
              and public.normalize_prediction_market_text(p.predicted_man_of_match)
                = public.normalize_prediction_market_text(target_match.man_of_match)
            )
          ) then 6 else 0 end
        + case when p.predicted_red_card is not null
          and p.predicted_red_card = coalesce(
            target_match.red_card_happened,
            coalesce(target_match.red_cards_home, 0) + coalesce(target_match.red_cards_away, 0) > 0
          ) then 2 else 0 end
        + case when p.predicted_home_score = target_match.home_score
          and p.predicted_away_score = target_match.away_score
          and (
            (coalesce(p.predicted_first_goal_no_goals, false) and coalesce(target_match.first_goal_no_goals, false))
            or (
              p.predicted_first_scorer_id is not null
              and target_match.first_goal_scorer_id is not null
              and p.predicted_first_scorer_id = target_match.first_goal_scorer_id
            )
            or (
              p.predicted_first_scorer_id is null
              and target_match.first_goal_scorer_id is null
              and public.normalize_prediction_market_text(p.predicted_first_scorer) is not null
              and public.normalize_prediction_market_text(target_match.first_goal_scorer) is not null
              and public.normalize_prediction_market_text(p.predicted_first_scorer)
                = public.normalize_prediction_market_text(target_match.first_goal_scorer)
            )
          ) then 10 else 0 end
        + case when p.predicted_home_score = target_match.home_score
          and p.predicted_away_score = target_match.away_score
          and coalesce(p.predicted_winner, public.score_outcome(p.predicted_home_score, p.predicted_away_score))
            = public.score_outcome(target_match.home_score, target_match.away_score)
          and (p.predicted_home_score - p.predicted_away_score)
            = (target_match.home_score - target_match.away_score)
          and (
            (coalesce(p.predicted_first_goal_no_goals, false) and coalesce(target_match.first_goal_no_goals, false))
            or (
              p.predicted_first_scorer_id is not null
              and target_match.first_goal_scorer_id is not null
              and p.predicted_first_scorer_id = target_match.first_goal_scorer_id
            )
            or (
              p.predicted_first_scorer_id is null
              and target_match.first_goal_scorer_id is null
              and public.normalize_prediction_market_text(p.predicted_first_scorer) is not null
              and public.normalize_prediction_market_text(target_match.first_goal_scorer) is not null
              and public.normalize_prediction_market_text(p.predicted_first_scorer)
                = public.normalize_prediction_market_text(target_match.first_goal_scorer)
            )
          )
          and p.predicted_both_teams_score is not null
          and p.predicted_both_teams_score = (target_match.home_score > 0 and target_match.away_score > 0)
          and (
            (
              p.predicted_man_of_match_id is not null
              and target_match.man_of_match_id is not null
              and p.predicted_man_of_match_id = target_match.man_of_match_id
            )
            or (
              p.predicted_man_of_match_id is null
              and target_match.man_of_match_id is null
              and public.normalize_prediction_market_text(p.predicted_man_of_match) is not null
              and public.normalize_prediction_market_text(target_match.man_of_match) is not null
              and public.normalize_prediction_market_text(p.predicted_man_of_match)
                = public.normalize_prediction_market_text(target_match.man_of_match)
            )
          )
          and p.predicted_red_card is not null
          and p.predicted_red_card = coalesce(
            target_match.red_card_happened,
            coalesce(target_match.red_cards_home, 0) + coalesce(target_match.red_cards_away, 0) > 0
          ) then 20 else 0 end
      )::integer as calculated_points
    from public.predictions p
    where p.match_id = target_match.id
  )
  update public.predictions p
  set points = scored.calculated_points,
      locked = true
  from scored
  where p.id = scored.id
    and (
      p.points is distinct from scored.calculated_points
      or p.locked is distinct from true
    );
end;
$$;

create or replace function public.notify_prediction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_match public.matches%rowtype;
  prediction_changed boolean := false;
begin
  select *
  into target_match
  from public.matches
  where id = new.match_id;

  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, title, body, metadata)
    values (
      new.user_id,
      'Palpite registrado',
      format(
        'Seu palpite para %s x %s foi enviado.',
        coalesce(target_match.home_team, 'Time da casa'),
        coalesce(target_match.away_team, 'Visitante')
      ),
      jsonb_build_object(
        'event', 'prediction_created',
        'match_id', new.match_id,
        'prediction_id', new.id,
        'home_score', new.predicted_home_score,
        'away_score', new.predicted_away_score
      )
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    prediction_changed :=
      old.predicted_home_score is distinct from new.predicted_home_score
      or old.predicted_away_score is distinct from new.predicted_away_score
      or old.predicted_winner is distinct from new.predicted_winner
      or old.predicted_first_scorer is distinct from new.predicted_first_scorer
      or old.predicted_first_scorer_id is distinct from new.predicted_first_scorer_id
      or old.predicted_first_goal_no_goals is distinct from new.predicted_first_goal_no_goals
      or old.predicted_both_teams_score is distinct from new.predicted_both_teams_score
      or old.predicted_man_of_match is distinct from new.predicted_man_of_match
      or old.predicted_man_of_match_id is distinct from new.predicted_man_of_match_id
      or old.predicted_red_card is distinct from new.predicted_red_card;

    if prediction_changed then
      insert into public.notifications (user_id, title, body, metadata)
      values (
        new.user_id,
        'Palpite atualizado',
        format(
          'Seu palpite para %s x %s foi atualizado.',
          coalesce(target_match.home_team, 'Time da casa'),
          coalesce(target_match.away_team, 'Visitante')
        ),
        jsonb_build_object(
          'event', 'prediction_updated',
          'match_id', new.match_id,
          'prediction_id', new.id,
          'home_score', new.predicted_home_score,
          'away_score', new.predicted_away_score
        )
      );
    elsif old.points is distinct from new.points and new.locked then
      insert into public.notifications (user_id, title, body, metadata)
      values (
        new.user_id,
        'Pontuação calculada',
        format(
          'Seu palpite em %s x %s fez %s ponto(s).',
          coalesce(target_match.home_team, 'Time da casa'),
          coalesce(target_match.away_team, 'Visitante'),
          new.points
        ),
        jsonb_build_object(
          'event', 'prediction_scored',
          'match_id', new.match_id,
          'prediction_id', new.id,
          'points', new.points
        )
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists matches_score_after_result on public.matches;
create trigger matches_score_after_result
after update of status, home_score, away_score, first_goal_scorer, first_goal_scorer_id, first_goal_no_goals, man_of_match, man_of_match_id, red_card_happened on public.matches
for each row
when (new.status = 'encerrado')
execute function public.score_match_after_result();
