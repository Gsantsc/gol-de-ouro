-- MATCH STATUS ENGINE
-- PREDICTION ACCESS GUARD
-- SCORING ENGINE
-- SCORING IDEMPOTENCY

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

  if target_match.status = 'encerrado' then
    raise exception 'Este jogo já não aceita novos palpites.';
  end if;

  if now() < target_match.prediction_open_at then
    raise exception 'Palpites abrem 24h antes do jogo.';
  end if;

  if now() >= target_match.prediction_close_at or target_match.status = 'ao_vivo' then
    raise exception 'Palpites encerram 1h antes do jogo.';
  end if;

  new.locked := true;
  new.submitted_at := now();
  new.points := 0;
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

  if target_match.status <> 'encerrado'
    or target_match.home_score is null
    or target_match.away_score is null then
    return;
  end if;

  with scored as (
    select
      p.id,
      (
        (
          case
            when p.predicted_home_score = target_match.home_score
              and p.predicted_away_score = target_match.away_score then 5
            when (
              (p.predicted_home_score > p.predicted_away_score and target_match.home_score > target_match.away_score)
              or (p.predicted_home_score < p.predicted_away_score and target_match.home_score < target_match.away_score)
              or (p.predicted_home_score = p.predicted_away_score and target_match.home_score = target_match.away_score)
            ) then 3
            when (p.predicted_home_score - p.predicted_away_score) = (target_match.home_score - target_match.away_score) then 2
            else 0
          end
          + case
              when target_match.is_upset = true and (
                (p.predicted_home_score > p.predicted_away_score and target_match.home_score > target_match.away_score)
                or (p.predicted_home_score < p.predicted_away_score and target_match.home_score < target_match.away_score)
                or (p.predicted_home_score = p.predicted_away_score and target_match.home_score = target_match.away_score)
              ) then 2
              else 0
            end
          + case
              when target_match.home_score = 0
                and target_match.away_score = 0
                and p.predicted_home_score = 0
                and p.predicted_away_score = 0 then 1
              else 0
            end
        )
        * case when target_match.is_golden_match = true then 2 else 1 end
      ) as calculated_points
    from public.predictions p
    where p.match_id = target_match_id
  )
  update public.predictions p
  set points = scored.calculated_points
  from scored
  where p.id = scored.id
    and p.points is distinct from scored.calculated_points;
end;
$$;
