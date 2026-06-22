-- Create RPC function for submitting predictions
-- This ensures validation is executed correctly on the backend
-- The function uses upsert to handle both create and update scenarios

create or replace function public.submit_prediction(
  p_match_id uuid,
  p_predicted_home_score integer,
  p_predicted_away_score integer,
  p_predicted_winner text default null,
  p_predicted_first_scorer_id uuid default null,
  p_predicted_first_scorer text default null,
  p_predicted_first_goal_no_goals boolean default false,
  p_predicted_man_of_match_id uuid default null,
  p_predicted_man_of_match text default null,
  p_predicted_both_teams_score boolean default null,
  p_predicted_red_card boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.predictions%rowtype;
  error_message text;
begin
  -- Insert or update prediction
  insert into public.predictions (
    user_id,
    match_id,
    predicted_home_score,
    predicted_away_score,
    predicted_winner,
    predicted_first_scorer_id,
    predicted_first_scorer,
    predicted_first_goal_no_goals,
    predicted_man_of_match_id,
    predicted_man_of_match,
    predicted_both_teams_score,
    predicted_red_card
  )
  values (
    auth.uid(),
    p_match_id,
    p_predicted_home_score,
    p_predicted_away_score,
    p_predicted_winner,
    p_predicted_first_scorer_id,
    p_predicted_first_scorer,
    p_predicted_first_goal_no_goals,
    p_predicted_man_of_match_id,
    p_predicted_man_of_match,
    p_predicted_both_teams_score,
    p_predicted_red_card
  )
  on conflict (user_id, match_id) do update set
    predicted_home_score = excluded.predicted_home_score,
    predicted_away_score = excluded.predicted_away_score,
    predicted_winner = excluded.predicted_winner,
    predicted_first_scorer_id = excluded.predicted_first_scorer_id,
    predicted_first_scorer = excluded.predicted_first_scorer,
    predicted_first_goal_no_goals = excluded.predicted_first_goal_no_goals,
    predicted_man_of_match_id = excluded.predicted_man_of_match_id,
    predicted_man_of_match = excluded.predicted_man_of_match,
    predicted_both_teams_score = excluded.predicted_both_teams_score,
    predicted_red_card = excluded.predicted_red_card
  returning * into result;

  return jsonb_build_object(
    'success', true,
    'prediction_id', result.id,
    'message', 'Palpite enviado com sucesso.'
  );

exception
  when others then
    error_message := sqlerrm;
    return jsonb_build_object(
      'success', false,
      'error', error_message
    );
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.submit_prediction to authenticated;
