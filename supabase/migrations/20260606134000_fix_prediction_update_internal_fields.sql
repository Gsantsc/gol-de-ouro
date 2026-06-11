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
      or now() >= target_match.prediction_close_at then
      raise exception 'Palpites encerram 1h antes do jogo.';
    end if;

    new.predicted_winner := coalesce(
      new.predicted_winner,
      public.score_outcome(new.predicted_home_score, new.predicted_away_score)
    );

    if coalesce(new.predicted_first_goal_no_goals, false) then
      new.predicted_first_scorer_id := null;
      new.predicted_first_scorer := null;
    elsif new.predicted_first_scorer_id is not null then
      new.predicted_first_scorer := null;
    else
      new.predicted_first_scorer := nullif(trim(coalesce(new.predicted_first_scorer, '')), '');
    end if;

    if new.predicted_man_of_match_id is not null then
      new.predicted_man_of_match := null;
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
