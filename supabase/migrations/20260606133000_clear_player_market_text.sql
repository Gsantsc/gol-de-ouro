create or replace function public.clear_prediction_player_market_text()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.predicted_first_goal_no_goals, false)
    or new.predicted_first_scorer_id is not null then
    new.predicted_first_scorer := null;
  else
    new.predicted_first_scorer := nullif(trim(coalesce(new.predicted_first_scorer, '')), '');
  end if;

  if new.predicted_man_of_match_id is not null then
    new.predicted_man_of_match := null;
  else
    new.predicted_man_of_match := nullif(trim(coalesce(new.predicted_man_of_match, '')), '');
  end if;

  return new;
end;
$$;

drop trigger if exists zz_predictions_clear_player_market_text on public.predictions;
create trigger zz_predictions_clear_player_market_text
before insert or update on public.predictions
for each row execute function public.clear_prediction_player_market_text();

create or replace function public.clear_match_player_market_text()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.first_goal_no_goals, false)
    or new.first_goal_scorer_id is not null then
    new.first_goal_scorer := null;
  else
    new.first_goal_scorer := nullif(trim(coalesce(new.first_goal_scorer, '')), '');
  end if;

  if new.man_of_match_id is not null then
    new.man_of_match := null;
  else
    new.man_of_match := nullif(trim(coalesce(new.man_of_match, '')), '');
  end if;

  return new;
end;
$$;

drop trigger if exists zz_matches_clear_player_market_text on public.matches;
create trigger zz_matches_clear_player_market_text
before insert or update on public.matches
for each row execute function public.clear_match_player_market_text();
