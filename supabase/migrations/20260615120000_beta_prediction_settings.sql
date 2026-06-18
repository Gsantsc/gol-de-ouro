-- BETA 1.0 PREDICTION SETTINGS
-- Keeps the prediction lock window configurable without deploy and enforced server-side.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users (id)
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_select_approved_or_admin on public.app_settings;
create policy app_settings_select_approved_or_admin
on public.app_settings
for select
to authenticated
using (public.is_admin() or public.is_approved_user());

grant select on public.app_settings to authenticated;

insert into public.app_settings (key, value)
values ('prediction_lock_minutes', to_jsonb(60))
on conflict (key) do nothing;

create or replace function public.normalize_prediction_lock_minutes(value integer)
returns integer
language sql
immutable
as $$
  select case when value in (60, 90, 120, 180) then value else 60 end;
$$;

create or replace function public.get_prediction_lock_minutes()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select public.normalize_prediction_lock_minutes(
    coalesce(
      nullif((select s.value #>> '{}' from public.app_settings s where s.key = 'prediction_lock_minutes'), '')::integer,
      60
    )
  );
$$;

create or replace function public.get_app_settings()
returns table (
  prediction_lock_minutes integer
)
language sql
stable
security definer
set search_path = public
as $$
  select public.get_prediction_lock_minutes();
$$;

grant execute on function public.get_app_settings() to authenticated, service_role;
grant execute on function public.get_prediction_lock_minutes() to authenticated, service_role;

create or replace function public.prediction_deadline(target_match public.matches)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select target_match.start_time - make_interval(mins => public.get_prediction_lock_minutes());
$$;

grant execute on function public.prediction_deadline(public.matches) to authenticated, service_role;

create or replace function public.set_prediction_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.prediction_open_at := new.start_time - interval '24 hours';
  new.prediction_close_at := new.start_time - make_interval(mins => public.get_prediction_lock_minutes());
  return new;
end;
$$;

create or replace function public.refresh_match_statuses()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
  lock_minutes integer := public.get_prediction_lock_minutes();
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and current_user not in ('postgres', 'supabase_admin')
    and not public.is_admin() then
    raise exception 'Apenas administradores podem atualizar status das partidas.';
  end if;

  update public.matches
  set
    prediction_open_at = start_time - interval '24 hours',
    prediction_close_at = start_time - make_interval(mins => lock_minutes),
    status = case
      when now() < start_time - interval '24 hours' then 'fechado'::public.match_status
      when now() < start_time - make_interval(mins => lock_minutes) then 'aberto'::public.match_status
      when now() < start_time then 'fechado'::public.match_status
      else 'ao_vivo'::public.match_status
    end
  where deleted_at is null
    and status <> 'encerrado'
    and (
      prediction_open_at is distinct from start_time - interval '24 hours'
      or prediction_close_at is distinct from start_time - make_interval(mins => lock_minutes)
      or status is distinct from case
        when now() < start_time - interval '24 hours' then 'fechado'::public.match_status
        when now() < start_time - make_interval(mins => lock_minutes) then 'aberto'::public.match_status
        when now() < start_time then 'fechado'::public.match_status
        else 'ao_vivo'::public.match_status
      end
    );

  get diagnostics updated_count = row_count;

  update public.predictions p
  set locked = true
  from public.matches m
  where p.match_id = m.id
    and p.locked = false
    and (
      m.status in ('ao_vivo', 'encerrado')
      or now() >= public.prediction_deadline(m)
    );

  return updated_count;
end;
$$;

grant execute on function public.refresh_match_statuses() to authenticated, service_role;

create or replace function public.set_prediction_lock_minutes(target_minutes integer)
returns table (
  prediction_lock_minutes integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_minutes integer := public.normalize_prediction_lock_minutes(target_minutes);
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem alterar configuracoes do bolao.';
  end if;

  if target_minutes <> normalized_minutes then
    raise exception 'Janela invalida. Use 60, 90, 120 ou 180 minutos.';
  end if;

  insert into public.app_settings (key, value, updated_by, updated_at)
  values ('prediction_lock_minutes', to_jsonb(normalized_minutes), auth.uid(), now())
  on conflict (key) do update set
    value = excluded.value,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  perform public.refresh_match_statuses();

  insert into public.admin_logs (admin_id, action, entity, entity_id)
  values (auth.uid(), 'settings.prediction_lock_minutes.updated', 'app_settings', null);

  return query select normalized_minutes;
end;
$$;

grant execute on function public.set_prediction_lock_minutes(integer) to authenticated;

drop policy if exists predictions_select_own_revealed_or_admin on public.predictions;
create policy predictions_select_own_revealed_or_admin
on public.predictions
for select
to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or (
    public.is_approved_user()
    and exists (
      select 1
      from public.matches m
      where m.id = predictions.match_id
        and (
          m.status in ('ao_vivo', 'encerrado')
          or now() >= public.prediction_deadline(m)
        )
    )
  )
);

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
    raise exception 'Palpites encerrados para esta partida.';
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

create or replace function public.submit_prediction(
  target_match_id uuid,
  home_score_value integer,
  away_score_value integer,
  predicted_winner_value text default null,
  first_scorer_id_value uuid default null,
  first_goal_no_goals_value boolean default false,
  both_teams_score_value boolean default false,
  man_of_match_id_value uuid default null,
  red_card_value boolean default false
)
returns public.predictions
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_prediction public.predictions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sessao expirada. Entre novamente.';
  end if;

  if home_score_value is null or away_score_value is null
    or home_score_value < 0 or home_score_value > 30
    or away_score_value < 0 or away_score_value > 30 then
    raise exception 'Placar invalido.';
  end if;

  if predicted_winner_value is not null and predicted_winner_value not in ('home', 'away', 'draw') then
    raise exception 'Vencedor invalido.';
  end if;

  insert into public.predictions (
    user_id,
    match_id,
    predicted_home_score,
    predicted_away_score,
    predicted_winner,
    predicted_first_scorer,
    predicted_first_scorer_id,
    predicted_first_goal_no_goals,
    predicted_both_teams_score,
    predicted_man_of_match,
    predicted_man_of_match_id,
    predicted_red_card
  )
  values (
    auth.uid(),
    target_match_id,
    home_score_value,
    away_score_value,
    coalesce(predicted_winner_value, public.score_outcome(home_score_value, away_score_value)),
    null,
    first_scorer_id_value,
    coalesce(first_goal_no_goals_value, false),
    both_teams_score_value,
    null,
    man_of_match_id_value,
    red_card_value
  )
  on conflict (user_id, match_id) do update set
    predicted_home_score = excluded.predicted_home_score,
    predicted_away_score = excluded.predicted_away_score,
    predicted_winner = excluded.predicted_winner,
    predicted_first_scorer = excluded.predicted_first_scorer,
    predicted_first_scorer_id = excluded.predicted_first_scorer_id,
    predicted_first_goal_no_goals = excluded.predicted_first_goal_no_goals,
    predicted_both_teams_score = excluded.predicted_both_teams_score,
    predicted_man_of_match = excluded.predicted_man_of_match,
    predicted_man_of_match_id = excluded.predicted_man_of_match_id,
    predicted_red_card = excluded.predicted_red_card
  where public.predictions.user_id = auth.uid()
  returning * into saved_prediction;

  if not found then
    raise exception 'Nao foi possivel salvar o palpite.';
  end if;

  return saved_prediction;
end;
$$;

grant execute on function public.submit_prediction(
  uuid,
  integer,
  integer,
  text,
  uuid,
  boolean,
  boolean,
  uuid,
  boolean
) to authenticated;

update public.matches
set
  prediction_open_at = start_time - interval '24 hours',
  prediction_close_at = start_time - make_interval(mins => public.get_prediction_lock_minutes())
where deleted_at is null
  and status <> 'encerrado';

select public.refresh_match_statuses();
