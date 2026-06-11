-- OFFICIAL PREDICTION MARKETS
-- Adds the official Gol de Ouro prediction fields and additive scoring.

alter table public.predictions
  add column if not exists predicted_winner text,
  add column if not exists predicted_first_scorer text,
  add column if not exists predicted_both_teams_score boolean,
  add column if not exists predicted_man_of_match text,
  add column if not exists predicted_red_card boolean;

alter table public.predictions
  drop constraint if exists predictions_predicted_winner_check;

alter table public.predictions
  add constraint predictions_predicted_winner_check
  check (predicted_winner is null or predicted_winner in ('home', 'away', 'draw'));

alter table public.matches
  add column if not exists red_cards_home integer not null default 0 check (red_cards_home >= 0),
  add column if not exists red_cards_away integer not null default 0 check (red_cards_away >= 0),
  add column if not exists first_goal_scorer text,
  add column if not exists man_of_match text,
  add column if not exists red_card_happened boolean;

create or replace function public.score_outcome(home_score integer, away_score integer)
returns text
language sql
immutable
as $$
  select case
    when home_score > away_score then 'home'
    when away_score > home_score then 'away'
    else 'draw'
  end;
$$;

create or replace function public.normalize_prediction_market_text(value text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(coalesce(value, ''))), '');
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
    raise exception 'O palpite deve pertencer ao usuário autenticado.';
  end if;

  if not public.is_approved_user() then
    raise exception 'Usuário ainda não aprovado ou bloqueado.';
  end if;

  select *
  into target_match
  from public.matches
  where id = new.match_id
    and deleted_at is null;

  if not found then
    raise exception 'Partida não encontrada.';
  end if;

  if target_match.status in ('ao_vivo', 'encerrado') then
    raise exception 'Este jogo já não aceita novos palpites.';
  end if;

  if now() < target_match.prediction_open_at then
    raise exception 'Palpites abrem 24h antes do jogo.';
  end if;

  if now() >= target_match.prediction_close_at then
    raise exception 'Palpites encerram 1h antes do jogo.';
  end if;

  new.predicted_winner := coalesce(
    new.predicted_winner,
    public.score_outcome(new.predicted_home_score, new.predicted_away_score)
  );
  new.predicted_first_scorer := nullif(trim(coalesce(new.predicted_first_scorer, '')), '');
  new.predicted_man_of_match := nullif(trim(coalesce(new.predicted_man_of_match, '')), '');
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

    raise exception 'Palpites não podem ser excluídos.';
  end if;

  if old.user_id <> new.user_id or old.match_id <> new.match_id then
    raise exception 'Usuário e partida do palpite não podem ser alterados.';
  end if;

  prediction_changed :=
    old.predicted_home_score is distinct from new.predicted_home_score
    or old.predicted_away_score is distinct from new.predicted_away_score
    or old.predicted_winner is distinct from new.predicted_winner
    or old.predicted_first_scorer is distinct from new.predicted_first_scorer
    or old.predicted_both_teams_score is distinct from new.predicted_both_teams_score
    or old.predicted_man_of_match is distinct from new.predicted_man_of_match
    or old.predicted_red_card is distinct from new.predicted_red_card;

  if prediction_changed then
    if elevated then
      return new;
    end if;

    if old.user_id <> auth.uid() or not public.is_approved_user() then
      raise exception 'Apenas o dono aprovado pode editar o palpite.';
    end if;

    select *
    into target_match
    from public.matches
    where id = old.match_id
      and deleted_at is null;

    if not found
      or target_match.status in ('ao_vivo', 'encerrado')
      or now() < target_match.prediction_open_at
      or now() >= target_match.prediction_close_at then
      raise exception 'A janela de edição deste palpite está fechada.';
    end if;

    new.predicted_winner := coalesce(
      new.predicted_winner,
      public.score_outcome(new.predicted_home_score, new.predicted_away_score)
    );
    new.predicted_first_scorer := nullif(trim(coalesce(new.predicted_first_scorer, '')), '');
    new.predicted_man_of_match := nullif(trim(coalesce(new.predicted_man_of_match, '')), '');
    new.locked := false;
    new.submitted_at := now();
    new.points := 0;
    return new;
  end if;

  if old.points is distinct from new.points
    or old.locked is distinct from new.locked
    or old.submitted_at is distinct from new.submitted_at then
    if elevated then
      return new;
    end if;

    raise exception 'Campos internos do palpite não podem ser alterados.';
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
    raise exception 'Partida não encontrada.';
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
        + case when public.normalize_prediction_market_text(p.predicted_first_scorer) is not null
          and public.normalize_prediction_market_text(target_match.first_goal_scorer) is not null
          and public.normalize_prediction_market_text(p.predicted_first_scorer)
            = public.normalize_prediction_market_text(target_match.first_goal_scorer) then 8 else 0 end
        + case when p.predicted_both_teams_score is not null
          and p.predicted_both_teams_score = (target_match.home_score > 0 and target_match.away_score > 0) then 2 else 0 end
        + case when public.normalize_prediction_market_text(p.predicted_man_of_match) is not null
          and public.normalize_prediction_market_text(target_match.man_of_match) is not null
          and public.normalize_prediction_market_text(p.predicted_man_of_match)
            = public.normalize_prediction_market_text(target_match.man_of_match) then 6 else 0 end
        + case when p.predicted_red_card is not null
          and p.predicted_red_card = coalesce(
            target_match.red_card_happened,
            coalesce(target_match.red_cards_home, 0) + coalesce(target_match.red_cards_away, 0) > 0
          ) then 2 else 0 end
        + case when p.predicted_home_score = target_match.home_score
          and p.predicted_away_score = target_match.away_score
          and public.normalize_prediction_market_text(p.predicted_first_scorer) is not null
          and public.normalize_prediction_market_text(target_match.first_goal_scorer) is not null
          and public.normalize_prediction_market_text(p.predicted_first_scorer)
            = public.normalize_prediction_market_text(target_match.first_goal_scorer) then 10 else 0 end
        + case when p.predicted_home_score = target_match.home_score
          and p.predicted_away_score = target_match.away_score
          and coalesce(p.predicted_winner, public.score_outcome(p.predicted_home_score, p.predicted_away_score))
            = public.score_outcome(target_match.home_score, target_match.away_score)
          and (p.predicted_home_score - p.predicted_away_score)
            = (target_match.home_score - target_match.away_score)
          and public.normalize_prediction_market_text(p.predicted_first_scorer) is not null
          and public.normalize_prediction_market_text(target_match.first_goal_scorer) is not null
          and public.normalize_prediction_market_text(p.predicted_first_scorer)
            = public.normalize_prediction_market_text(target_match.first_goal_scorer)
          and p.predicted_both_teams_score is not null
          and p.predicted_both_teams_score = (target_match.home_score > 0 and target_match.away_score > 0)
          and public.normalize_prediction_market_text(p.predicted_man_of_match) is not null
          and public.normalize_prediction_market_text(target_match.man_of_match) is not null
          and public.normalize_prediction_market_text(p.predicted_man_of_match)
            = public.normalize_prediction_market_text(target_match.man_of_match)
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

  if tg_op = 'UPDATE' then
    prediction_changed :=
      old.predicted_home_score is distinct from new.predicted_home_score
      or old.predicted_away_score is distinct from new.predicted_away_score
      or old.predicted_winner is distinct from new.predicted_winner
      or old.predicted_first_scorer is distinct from new.predicted_first_scorer
      or old.predicted_both_teams_score is distinct from new.predicted_both_teams_score
      or old.predicted_man_of_match is distinct from new.predicted_man_of_match
      or old.predicted_red_card is distinct from new.predicted_red_card;
  end if;

  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, title, body, metadata)
    values (
      new.user_id,
      'Palpite registrado',
      format(
        '%s %s x %s %s',
        target_match.home_team,
        new.predicted_home_score,
        new.predicted_away_score,
        target_match.away_team
      ),
      jsonb_build_object(
        'event', 'prediction_created',
        'prediction_id', new.id,
        'match_id', new.match_id
      )
    );
  elsif prediction_changed then
    insert into public.notifications (user_id, title, body, metadata)
    values (
      new.user_id,
      'Palpite atualizado',
      format(
        '%s %s x %s %s',
        target_match.home_team,
        new.predicted_home_score,
        new.predicted_away_score,
        target_match.away_team
      ),
      jsonb_build_object(
        'event', 'prediction_updated',
        'prediction_id', new.id,
        'match_id', new.match_id
      )
    );
  elsif old.points is distinct from new.points then
    insert into public.notifications (user_id, title, body, metadata)
    values (
      new.user_id,
      'Pontuação calculada',
      format(
        'Você recebeu %s ponto(s) em %s x %s.',
        new.points,
        target_match.home_team,
        target_match.away_team
      ),
      jsonb_build_object(
        'event', 'prediction_scored',
        'prediction_id', new.id,
        'match_id', new.match_id,
        'points', new.points
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists matches_score_after_result on public.matches;
create trigger matches_score_after_result
after update of status, home_score, away_score, first_goal_scorer, man_of_match, red_card_happened on public.matches
for each row execute function public.score_match_after_result();
