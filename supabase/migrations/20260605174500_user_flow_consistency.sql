-- USER FLOW CONSISTENCY
-- Editable predictions while the prediction window is open.
-- Automatic status, scoring, ranking, achievements and notifications.

alter table public.predictions
  drop constraint if exists predictions_are_permanently_locked;

alter table public.predictions
  alter column locked set default false;

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
  score_changed boolean;
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

  score_changed :=
    old.predicted_home_score is distinct from new.predicted_home_score
    or old.predicted_away_score is distinct from new.predicted_away_score;

  if score_changed then
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

drop policy if exists predictions_update_own_open on public.predictions;
create policy predictions_update_own_open
on public.predictions
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_approved_user()
)
with check (
  user_id = auth.uid()
  and public.is_approved_user()
);

grant update on public.predictions to authenticated;

create or replace function public.refresh_rankings()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.rankings (
    user_id,
    total_points,
    correct_results,
    exact_scores,
    updated_at
  )
  select
    u.id,
    coalesce(sum(p.points) filter (where m.status = 'encerrado'), 0)::integer,
    count(p.id) filter (
      where m.status = 'encerrado'
        and p.points > 0
    )::integer,
    count(p.id) filter (
      where m.status = 'encerrado'
        and p.predicted_home_score = m.home_score
        and p.predicted_away_score = m.away_score
    )::integer,
    now()
  from public.users u
  left join public.predictions p on p.user_id = u.id
  left join public.matches m on m.id = p.match_id
  where u.deleted_at is null
    and u.status = 'approved'
    and u.blocked = false
  group by u.id
  on conflict (user_id) do update set
    total_points = excluded.total_points,
    correct_results = excluded.correct_results,
    exact_scores = excluded.exact_scores,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.evaluate_user_achievements(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prediction_count integer := 0;
  correct_count integer := 0;
  weekly_points integer := 0;
  weekly_position integer;
  world_cup_points integer := 0;
begin
  select count(*)::integer
  into prediction_count
  from public.predictions
  where user_id = target_user_id;

  select coalesce(correct_results, 0)
  into correct_count
  from public.rankings
  where user_id = target_user_id;

  correct_count := coalesce(correct_count, 0);

  with weekly_scores as (
    select
      u.id as user_id,
      coalesce(sum(p.points) filter (
        where m.status = 'encerrado'
          and m.start_time >= date_trunc('week', now())
          and m.start_time < date_trunc('week', now()) + interval '7 days'
      ), 0)::integer as points
    from public.users u
    left join public.predictions p on p.user_id = u.id
    left join public.matches m on m.id = p.match_id
    where u.deleted_at is null
      and u.status = 'approved'
      and u.blocked = false
    group by u.id
  ),
  positioned as (
    select
      user_id,
      points,
      row_number() over (order by points desc, user_id) as position
    from weekly_scores
  )
  select points, case when points > 0 then position::integer end
  into weekly_points, weekly_position
  from positioned
  where user_id = target_user_id;

  select coalesce(sum(p.points), 0)::integer
  into world_cup_points
  from public.predictions p
  join public.matches m on m.id = p.match_id
  left join public.tournaments t on t.id = m.tournament_id
  where p.user_id = target_user_id
    and m.status = 'encerrado'
    and (
      m.championship = 'world_cup_2026'
      or t.type = 'world_cup'
    );

  insert into public.achievements (
    user_id,
    badge,
    icon,
    description,
    progress,
    goal,
    unlocked_at
  )
  values
    (
      target_user_id,
      'Primeiro Palpite',
      'send',
      'Enviou o primeiro palpite.',
      least(prediction_count, 1),
      1,
      case when prediction_count >= 1 then now() end
    ),
    (
      target_user_id,
      'Acertou 10 resultados',
      'target',
      'Pontuou em 10 resultados.',
      least(correct_count, 10),
      10,
      case when correct_count >= 10 then now() end
    ),
    (
      target_user_id,
      'Top 10 da Semana',
      'trophy',
      'Terminou entre os 10 melhores da semana com pontuação.',
      case when weekly_points > 0 and weekly_position between 1 and 10 then 1 else 0 end,
      1,
      case when weekly_points > 0 and weekly_position between 1 and 10 then now() end
    ),
    (
      target_user_id,
      'Especialista em Copa',
      'medal',
      'Somou 50 pontos em jogos da Copa do Mundo.',
      least(world_cup_points, 50),
      50,
      case when world_cup_points >= 50 then now() end
    )
  on conflict (user_id, badge) do update set
    icon = excluded.icon,
    description = excluded.description,
    progress = excluded.progress,
    goal = excluded.goal,
    unlocked_at = case
      when public.achievements.unlocked_at is not null then public.achievements.unlocked_at
      else excluded.unlocked_at
    end,
    updated_at = now();
end;
$$;

delete from public.achievements
where badge not in (
  'Primeiro Palpite',
  'Acertou 10 resultados',
  'Top 10 da Semana',
  'Especialista em Copa'
);

create or replace function public.evaluate_achievements_after_ranking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.evaluate_user_achievements(new.user_id);
  return new;
end;
$$;

drop trigger if exists rankings_evaluate_achievements on public.rankings;
create trigger rankings_evaluate_achievements
after insert or update on public.rankings
for each row execute function public.evaluate_achievements_after_ranking();

create or replace function public.notify_prediction_change()
returns trigger
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
  where id = new.match_id;

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
  elsif old.predicted_home_score is distinct from new.predicted_home_score
    or old.predicted_away_score is distinct from new.predicted_away_score then
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

drop trigger if exists predictions_notify_change on public.predictions;
create trigger predictions_notify_change
after insert or update on public.predictions
for each row execute function public.notify_prediction_change();

drop policy if exists notifications_own_or_admin on public.notifications;
drop policy if exists notifications_select_own_global_or_admin on public.notifications;
drop policy if exists notifications_update_own_or_admin on public.notifications;

create policy notifications_select_own_global_or_admin
on public.notifications
for select
to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or (user_id is null and public.is_approved_user())
);

create policy notifications_update_own_or_admin
on public.notifications
for update
to authenticated
using (public.is_admin() or user_id = auth.uid())
with check (public.is_admin() or user_id = auth.uid());

create or replace function public.score_match_after_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  if new.status <> 'encerrado' then
    return new;
  end if;

  if old.status is not distinct from new.status
    and old.home_score is not distinct from new.home_score
    and old.away_score is not distinct from new.away_score then
    return new;
  end if;

  perform public.recalculate_match_points(new.id);
  perform public.refresh_rankings();

  for target_user_id in
    select distinct user_id
    from public.predictions
    where match_id = new.id
  loop
    perform public.evaluate_user_achievements(target_user_id);
  end loop;

  return new;
end;
$$;

drop trigger if exists matches_score_after_result on public.matches;
create trigger matches_score_after_result
after update of status, home_score, away_score on public.matches
for each row execute function public.score_match_after_result();

create or replace function public.refresh_match_statuses()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and current_user not in ('postgres', 'supabase_admin')
    and not public.is_admin() then
    raise exception 'Apenas administradores podem atualizar status das partidas.';
  end if;

  update public.matches
  set
    prediction_open_at = start_time - interval '24 hours',
    prediction_close_at = start_time - interval '1 hour',
    status = case
      when now() < start_time - interval '24 hours' then 'fechado'::public.match_status
      when now() < start_time - interval '1 hour' then 'aberto'::public.match_status
      else 'ao_vivo'::public.match_status
    end
  where deleted_at is null
    and status <> 'encerrado'
    and (
      prediction_open_at is distinct from start_time - interval '24 hours'
      or prediction_close_at is distinct from start_time - interval '1 hour'
      or status is distinct from case
        when now() < start_time - interval '24 hours' then 'fechado'::public.match_status
        when now() < start_time - interval '1 hour' then 'aberto'::public.match_status
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
      or now() >= m.prediction_close_at
    );

  return updated_count;
end;
$$;

grant execute on function public.refresh_match_statuses() to authenticated, service_role;

create extension if not exists pg_cron with schema extensions;

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname = 'gol-de-ouro-match-statuses'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  perform cron.schedule(
    'gol-de-ouro-match-statuses',
    '* * * * *',
    'select public.refresh_match_statuses();'
  );
exception
  when others then
    raise notice 'Não foi possível agendar refresh_match_statuses: %', sqlerrm;
end;
$$;

do $$
declare
  target_user_id uuid;
begin
  perform public.refresh_rankings();

  for target_user_id in
    select id
    from public.users
    where deleted_at is null
      and status = 'approved'
      and blocked = false
  loop
    perform public.evaluate_user_achievements(target_user_id);
  end loop;
end;
$$;
