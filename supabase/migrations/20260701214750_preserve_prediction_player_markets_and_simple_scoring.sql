create extension if not exists unaccent with schema extensions;

create or replace function public.normalize_prediction_market_text(value text)
returns text
language sql
stable
as $$
  select nullif(
    regexp_replace(
      extensions.unaccent(lower(trim(coalesce(value, '')))),
      '\s+',
      ' ',
      'g'
    ),
    ''
  );
$$;

create or replace function public.clear_prediction_player_market_text()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.predicted_first_goal_no_goals, false) then
    new.predicted_first_scorer_id := null;
    new.predicted_first_scorer := null;
  elsif new.predicted_first_scorer_id is not null then
    new.predicted_first_scorer := public.player_market_name(
      new.predicted_first_scorer_id,
      nullif(trim(coalesce(new.predicted_first_scorer, '')), '')
    );
  else
    new.predicted_first_scorer := nullif(trim(coalesce(new.predicted_first_scorer, '')), '');
  end if;

  if new.predicted_man_of_match_id is not null then
    new.predicted_man_of_match := public.player_market_name(
      new.predicted_man_of_match_id,
      nullif(trim(coalesce(new.predicted_man_of_match, '')), '')
    );
  else
    new.predicted_man_of_match := nullif(trim(coalesce(new.predicted_man_of_match, '')), '');
  end if;

  return new;
end;
$$;

create or replace function public.clear_match_player_market_text()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.first_goal_no_goals, false) then
    new.first_goal_scorer_id := null;
    new.first_goal_scorer := null;
  elsif new.first_goal_scorer_id is not null then
    new.first_goal_scorer := public.player_market_name(
      new.first_goal_scorer_id,
      nullif(trim(coalesce(new.first_goal_scorer, '')), '')
    );
  else
    new.first_goal_scorer := nullif(trim(coalesce(new.first_goal_scorer, '')), '');
  end if;

  if new.man_of_match_id is not null then
    new.man_of_match := public.player_market_name(
      new.man_of_match_id,
      nullif(trim(coalesce(new.man_of_match, '')), '')
    );
  else
    new.man_of_match := nullif(trim(coalesce(new.man_of_match, '')), '');
  end if;

  return new;
end;
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

  if now() >= public.prediction_deadline(target_match) then
    raise exception 'Palpites encerrados para esta partida.';
  end if;

  new.predicted_winner := coalesce(
    new.predicted_winner,
    public.score_outcome(new.predicted_home_score, new.predicted_away_score)
  );

  if coalesce(new.predicted_first_goal_no_goals, false) then
    new.predicted_first_scorer_id := null;
    new.predicted_first_scorer := null;
  elsif new.predicted_first_scorer_id is not null then
    new.predicted_first_scorer := public.player_market_name(
      new.predicted_first_scorer_id,
      nullif(trim(coalesce(new.predicted_first_scorer, '')), '')
    );
  else
    new.predicted_first_scorer := nullif(trim(coalesce(new.predicted_first_scorer, '')), '');
  end if;

  if new.predicted_man_of_match_id is not null then
    new.predicted_man_of_match := public.player_market_name(
      new.predicted_man_of_match_id,
      nullif(trim(coalesce(new.predicted_man_of_match, '')), '')
    );
  else
    new.predicted_man_of_match := nullif(trim(coalesce(new.predicted_man_of_match, '')), '');
  end if;

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
    or current_user in ('postgres', 'supabase_admin')
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
    if old.points is distinct from new.points
      or old.locked is distinct from new.locked
      or old.submitted_at is distinct from new.submitted_at then
      if not elevated then
        raise exception 'Campos internos do palpite nao podem ser alterados.';
      end if;
    end if;

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
      or now() >= public.prediction_deadline(target_match) then
      raise exception 'Palpites encerrados para esta partida.';
    end if;

    new.predicted_winner := coalesce(
      new.predicted_winner,
      public.score_outcome(new.predicted_home_score, new.predicted_away_score)
    );

    if coalesce(new.predicted_first_goal_no_goals, false) then
      new.predicted_first_scorer_id := null;
      new.predicted_first_scorer := null;
    elsif new.predicted_first_scorer_id is not null then
      new.predicted_first_scorer := public.player_market_name(
        new.predicted_first_scorer_id,
        nullif(trim(coalesce(new.predicted_first_scorer, '')), '')
      );
    else
      new.predicted_first_scorer := nullif(trim(coalesce(new.predicted_first_scorer, '')), '');
    end if;

    if new.predicted_man_of_match_id is not null then
      new.predicted_man_of_match := public.player_market_name(
        new.predicted_man_of_match_id,
        nullif(trim(coalesce(new.predicted_man_of_match, '')), '')
      );
    else
      new.predicted_man_of_match := nullif(trim(coalesce(new.predicted_man_of_match, '')), '');
    end if;

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
        + case when target_match.home_score = 0 and target_match.away_score = 0 then 0
            when p.predicted_first_scorer_id is not null
              and target_match.first_goal_scorer_id is not null
              and p.predicted_first_scorer_id = target_match.first_goal_scorer_id then 5
            when (
              p.predicted_first_scorer_id is null
              or target_match.first_goal_scorer_id is null
            )
              and public.normalize_prediction_market_text(
                public.player_market_name(p.predicted_first_scorer_id, p.predicted_first_scorer)
              ) is not null
              and public.normalize_prediction_market_text(
                public.player_market_name(target_match.first_goal_scorer_id, target_match.first_goal_scorer)
              ) is not null
              and public.normalize_prediction_market_text(
                public.player_market_name(p.predicted_first_scorer_id, p.predicted_first_scorer)
              )
                = public.normalize_prediction_market_text(
                  public.player_market_name(target_match.first_goal_scorer_id, target_match.first_goal_scorer)
                ) then 5
            else 0
          end
        + case when p.predicted_both_teams_score is not null
          and p.predicted_both_teams_score = (target_match.home_score > 0 and target_match.away_score > 0) then 2 else 0 end
        + case when p.predicted_man_of_match_id is not null
              and target_match.man_of_match_id is not null
              and p.predicted_man_of_match_id = target_match.man_of_match_id then 3
            when (
              p.predicted_man_of_match_id is null
              or target_match.man_of_match_id is null
            )
              and public.normalize_prediction_market_text(
                public.player_market_name(p.predicted_man_of_match_id, p.predicted_man_of_match)
              ) is not null
              and public.normalize_prediction_market_text(
                public.player_market_name(target_match.man_of_match_id, target_match.man_of_match)
              ) is not null
              and public.normalize_prediction_market_text(
                public.player_market_name(p.predicted_man_of_match_id, p.predicted_man_of_match)
              )
                = public.normalize_prediction_market_text(
                  public.player_market_name(target_match.man_of_match_id, target_match.man_of_match)
                ) then 3
            else 0
          end
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
