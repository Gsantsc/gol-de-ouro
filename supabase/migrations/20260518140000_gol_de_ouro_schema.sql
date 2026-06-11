create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create type public.user_role as enum ('admin', 'user');
create type public.approval_status as enum ('pending', 'approved', 'rejected');
create type public.tournament_type as enum (
  'world_cup',
  'champions_league',
  'libertadores',
  'brasileirao'
);
create type public.match_status as enum (
  'aberto',
  'fechado',
  'ao_vivo',
  'encerrado'
);
create type public.match_event_type as enum (
  'goal',
  'yellow_card',
  'red_card',
  'substitution'
);

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  email extensions.citext not null unique,
  role public.user_role not null default 'user',
  approval_status public.approval_status not null default 'pending',
  blocked boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.tournaments (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  type public.tournament_type not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.matches (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id),
  home_team text not null,
  away_team text not null,
  home_team_logo_url text,
  away_team_logo_url text,
  home_score integer not null default 0 check (home_score >= 0),
  away_score integer not null default 0 check (away_score >= 0),
  start_time timestamptz not null,
  prediction_open_at timestamptz not null,
  prediction_close_at timestamptz not null,
  status public.match_status not null default 'fechado',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint prediction_window_order check (prediction_open_at < prediction_close_at),
  constraint prediction_close_before_start check (prediction_close_at <= start_time)
);

create table public.match_statistics (
  id uuid primary key default extensions.gen_random_uuid(),
  match_id uuid not null unique references public.matches (id) on delete cascade,
  possession_home integer not null default 50 check (possession_home between 0 and 100),
  possession_away integer not null default 50 check (possession_away between 0 and 100),
  shots_home integer not null default 0 check (shots_home >= 0),
  shots_away integer not null default 0 check (shots_away >= 0),
  shots_on_goal_home integer not null default 0 check (shots_on_goal_home >= 0),
  shots_on_goal_away integer not null default 0 check (shots_on_goal_away >= 0),
  corners_home integer not null default 0 check (corners_home >= 0),
  corners_away integer not null default 0 check (corners_away >= 0),
  fouls_home integer not null default 0 check (fouls_home >= 0),
  fouls_away integer not null default 0 check (fouls_away >= 0),
  yellow_cards_home integer not null default 0 check (yellow_cards_home >= 0),
  yellow_cards_away integer not null default 0 check (yellow_cards_away >= 0),
  red_cards_home integer not null default 0 check (red_cards_home >= 0),
  red_cards_away integer not null default 0 check (red_cards_away >= 0),
  xg_home numeric(4, 2) not null default 0 check (xg_home >= 0),
  xg_away numeric(4, 2) not null default 0 check (xg_away >= 0),
  updated_at timestamptz not null default now()
);

create table public.predictions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users (id),
  match_id uuid not null references public.matches (id),
  predicted_home_score integer not null check (predicted_home_score between 0 and 30),
  predicted_away_score integer not null check (predicted_away_score between 0 and 30),
  locked boolean not null default true,
  submitted_at timestamptz not null default now(),
  points integer not null default 0 check (points >= 0),
  constraint one_prediction_per_match unique (user_id, match_id),
  constraint predictions_are_permanently_locked check (locked = true)
);

create table public.rankings (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null unique references public.users (id),
  total_points integer not null default 0,
  correct_results integer not null default 0,
  exact_scores integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.match_events (
  id uuid primary key default extensions.gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  minute integer not null check (minute between 0 and 130),
  type public.match_event_type not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table public.admin_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  admin_id uuid not null references public.users (id),
  action text not null,
  entity text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);

create table public.prediction_audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  prediction_id uuid not null references public.predictions (id),
  user_id uuid not null references public.users (id),
  match_id uuid not null references public.matches (id),
  action text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index users_approval_status_idx on public.users (approval_status) where deleted_at is null;
create index users_role_idx on public.users (role) where deleted_at is null;
create index tournaments_active_idx on public.tournaments (active) where deleted_at is null;
create index matches_tournament_idx on public.matches (tournament_id) where deleted_at is null;
create index matches_status_start_idx on public.matches (status, start_time) where deleted_at is null;
create index predictions_match_idx on public.predictions (match_id);
create index predictions_user_idx on public.predictions (user_id);
create index rankings_points_idx on public.rankings (total_points desc, exact_scores desc);
create index match_events_match_minute_idx on public.match_events (match_id, minute);
create unique index match_events_unique_event_idx on public.match_events (match_id, minute, type, description);
create index admin_logs_created_idx on public.admin_logs (created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger matches_touch_updated_at
before update on public.matches
for each row execute function public.touch_updated_at();

create or replace function public.set_prediction_window()
returns trigger
language plpgsql
as $$
begin
  new.prediction_open_at = new.start_time - interval '24 hours';
  new.prediction_close_at = new.start_time - interval '1 hour';
  return new;
end;
$$;

create trigger matches_prediction_window
before insert or update of start_time on public.matches
for each row execute function public.set_prediction_window();

create or replace function public.create_empty_match_statistics()
returns trigger
language plpgsql
as $$
begin
  insert into public.match_statistics (match_id)
  values (new.id)
  on conflict (match_id) do nothing;
  return new;
end;
$$;

create trigger matches_create_statistics
after insert on public.matches
for each row execute function public.create_empty_match_statistics();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(coalesce(new.email, ''));
  display_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'name', '')), '');
  initial_role public.user_role := 'user';
  initial_status public.approval_status := 'pending';
begin
  if normalized_email = 'gbieldev@hotmail.com' then
    initial_role := 'admin';
    initial_status := 'approved';
  end if;

  insert into public.users (
    id,
    name,
    email,
    role,
    approval_status,
    blocked
  )
  values (
    new.id,
    coalesce(display_name, split_part(normalized_email, '@', 1), 'Usuario'),
    normalized_email,
    initial_role,
    initial_status,
    false
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(nullif(public.users.name, ''), excluded.name),
    role = case
      when excluded.email = 'gbieldev@hotmail.com' then 'admin'::public.user_role
      else public.users.role
    end,
    approval_status = case
      when excluded.email = 'gbieldev@hotmail.com' then 'approved'::public.approval_status
      else public.users.approval_status
    end;

  insert into public.rankings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'admin'
      and approval_status = 'approved'
      and blocked = false
      and deleted_at is null
  );
$$;

create or replace function public.is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and approval_status = 'approved'
      and blocked = false
      and deleted_at is null
  );
$$;

create or replace function public.write_admin_log(
  action text,
  entity text,
  entity_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem registrar auditoria administrativa.';
  end if;

  insert into public.admin_logs (admin_id, action, entity, entity_id)
  values (auth.uid(), action, entity, entity_id);
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

  if target_match.status <> 'aberto' then
    raise exception 'Palpites indisponiveis para esta partida.';
  end if;

  if now() < target_match.prediction_open_at then
    raise exception 'Palpites abrem 24 horas antes da partida.';
  end if;

  if now() >= target_match.prediction_close_at then
    raise exception 'Palpites fecham 1 hora antes da partida.';
  end if;

  new.locked := true;
  new.submitted_at := now();
  new.points := 0;
  return new;
end;
$$;

create trigger predictions_validate_insert
before insert on public.predictions
for each row execute function public.ensure_prediction_submission();

create or replace function public.protect_locked_prediction()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Palpites nao podem ser excluidos.';
  end if;

  if old.user_id <> new.user_id
    or old.match_id <> new.match_id
    or old.predicted_home_score <> new.predicted_home_score
    or old.predicted_away_score <> new.predicted_away_score
    or old.locked <> new.locked
    or old.submitted_at <> new.submitted_at then
    raise exception 'Palpite enviado nao pode ser alterado.';
  end if;

  return new;
end;
$$;

create trigger predictions_protect_update
before update on public.predictions
for each row execute function public.protect_locked_prediction();

create trigger predictions_protect_delete
before delete on public.predictions
for each row execute function public.protect_locked_prediction();

create or replace function public.audit_prediction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.prediction_audit_logs (
    prediction_id,
    user_id,
    match_id,
    action,
    old_value,
    new_value
  )
  values (
    coalesce(new.id, old.id),
    coalesce(new.user_id, old.user_id),
    coalesce(new.match_id, old.match_id),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

create trigger predictions_audit_insert
after insert on public.predictions
for each row execute function public.audit_prediction_change();

create trigger predictions_audit_update
after update on public.predictions
for each row execute function public.audit_prediction_change();

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

  update public.predictions p
  set points = case
    when p.predicted_home_score = target_match.home_score
      and p.predicted_away_score = target_match.away_score then 5
    when p.predicted_home_score > p.predicted_away_score
      and target_match.home_score > target_match.away_score then 3
    when p.predicted_home_score < p.predicted_away_score
      and target_match.home_score < target_match.away_score then 3
    when p.predicted_home_score = p.predicted_away_score
      and target_match.home_score = target_match.away_score then 3
    else 0
  end
  where p.match_id = target_match_id;
end;
$$;

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
    coalesce(sum(p.points), 0)::integer,
    count(p.id) filter (where p.points > 0)::integer,
    count(p.id) filter (where p.points = 5)::integer,
    now()
  from public.users u
  left join public.predictions p on p.user_id = u.id
  where u.deleted_at is null
    and u.approval_status = 'approved'
  group by u.id
  on conflict (user_id) do update set
    total_points = excluded.total_points,
    correct_results = excluded.correct_results,
    exact_scores = excluded.exact_scores,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.finish_match_and_score(target_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem encerrar partidas.';
  end if;

  update public.matches
  set status = 'encerrado'
  where id = target_match_id
    and deleted_at is null;

  perform public.recalculate_match_points(target_match_id);
  perform public.refresh_rankings();
  perform public.write_admin_log('admin encerrou partida e calculou pontos', 'matches', target_match_id);
end;
$$;

create or replace function public.force_refresh_rankings()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem recalcular ranking.';
  end if;

  perform public.refresh_rankings();
  perform public.write_admin_log('admin forçou recálculo do ranking', 'rankings', null);
end;
$$;

create or replace function public.approve_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem aprovar usuarios.';
  end if;

  update public.users
  set approval_status = 'approved', blocked = false
  where id = target_user_id
    and role <> 'admin'
    and deleted_at is null;

  insert into public.rankings (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;

  perform public.write_admin_log('admin aprovou usuario', 'users', target_user_id);
end;
$$;

create or replace function public.reject_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem rejeitar usuarios.';
  end if;

  update public.users
  set approval_status = 'rejected'
  where id = target_user_id
    and role <> 'admin'
    and deleted_at is null;

  perform public.write_admin_log('admin rejeitou usuario', 'users', target_user_id);
end;
$$;

create or replace function public.block_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem bloquear usuarios.';
  end if;

  update public.users
  set blocked = true
  where id = target_user_id
    and role <> 'admin'
    and deleted_at is null;

  perform public.write_admin_log('admin bloqueou usuario', 'users', target_user_id);
end;
$$;

create or replace function public.unblock_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem desbloquear usuarios.';
  end if;

  update public.users
  set blocked = false
  where id = target_user_id
    and role <> 'admin'
    and deleted_at is null;

  perform public.write_admin_log('admin desbloqueou usuario', 'users', target_user_id);
end;
$$;

create or replace function public.log_match_admin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    if tg_op = 'INSERT' then
      perform public.write_admin_log('admin criou partida', 'matches', new.id);
    elsif tg_op = 'UPDATE' and (
      old.home_score <> new.home_score
      or old.away_score <> new.away_score
      or old.status <> new.status
      or old.start_time <> new.start_time
    ) then
      perform public.write_admin_log('admin alterou partida ou resultado', 'matches', new.id);
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger matches_admin_log_insert
after insert on public.matches
for each row execute function public.log_match_admin_change();

create trigger matches_admin_log_update
after update on public.matches
for each row execute function public.log_match_admin_change();

create or replace function public.admin_dashboard_metrics()
returns table (
  total_users bigint,
  pending_users bigint,
  approved_users bigint,
  open_matches bigint,
  live_matches bigint,
  finished_matches bigint,
  total_predictions bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem visualizar metricas.';
  end if;

  return query
  select
    (select count(*) from public.users where deleted_at is null),
    (select count(*) from public.users where approval_status = 'pending' and deleted_at is null),
    (select count(*) from public.users where approval_status = 'approved' and deleted_at is null),
    (select count(*) from public.matches where status = 'aberto' and deleted_at is null),
    (select count(*) from public.matches where status = 'ao_vivo' and deleted_at is null),
    (select count(*) from public.matches where status = 'encerrado' and deleted_at is null),
    (select count(*) from public.predictions);
end;
$$;

alter table public.users enable row level security;
alter table public.tournaments enable row level security;
alter table public.matches enable row level security;
alter table public.match_statistics enable row level security;
alter table public.predictions enable row level security;
alter table public.rankings enable row level security;
alter table public.match_events enable row level security;
alter table public.admin_logs enable row level security;
alter table public.prediction_audit_logs enable row level security;

create policy users_select_self_or_admin
on public.users
for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy users_admin_update
on public.users
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy tournaments_select_approved_or_admin
on public.tournaments
for select
to authenticated
using (
  public.is_admin()
  or (public.is_approved_user() and active = true and deleted_at is null)
);

create policy tournaments_admin_manage
on public.tournaments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy matches_select_approved_or_admin
on public.matches
for select
to authenticated
using (
  public.is_admin()
  or (public.is_approved_user() and deleted_at is null)
);

create policy matches_admin_manage
on public.matches
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy match_statistics_select_approved_or_admin
on public.match_statistics
for select
to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_user()
    and exists (
      select 1
      from public.matches m
      where m.id = match_statistics.match_id
        and m.deleted_at is null
    )
  )
);

create policy match_statistics_admin_manage
on public.match_statistics
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

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
        and m.status = 'encerrado'
        and m.deleted_at is null
    )
  )
);

create policy predictions_insert_own_approved
on public.predictions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_approved_user()
);

create policy rankings_select_approved_or_admin
on public.rankings
for select
to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_user()
    and exists (
      select 1
      from public.users u
      where u.id = rankings.user_id
        and u.approval_status = 'approved'
        and u.blocked = false
        and u.deleted_at is null
    )
  )
);

create policy rankings_admin_manage
on public.rankings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy match_events_select_approved_or_admin
on public.match_events
for select
to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_user()
    and exists (
      select 1
      from public.matches m
      where m.id = match_events.match_id
        and m.deleted_at is null
    )
  )
);

create policy match_events_admin_manage
on public.match_events
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy admin_logs_admin_select
on public.admin_logs
for select
to authenticated
using (public.is_admin());

create policy admin_logs_admin_insert
on public.admin_logs
for insert
to authenticated
with check (public.is_admin());

create policy prediction_audit_logs_admin_select
on public.prediction_audit_logs
for select
to authenticated
using (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.users to authenticated;
grant select, insert, update on public.tournaments to authenticated;
grant select, insert, update on public.matches to authenticated;
grant select, insert, update on public.match_statistics to authenticated;
grant select, insert on public.predictions to authenticated;
grant select, insert, update on public.rankings to authenticated;
grant select, insert, update on public.match_events to authenticated;
grant select, insert on public.admin_logs to authenticated;
grant select on public.prediction_audit_logs to authenticated;

grant execute on function public.approve_user(uuid) to authenticated;
grant execute on function public.reject_user(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.finish_match_and_score(uuid) to authenticated;
grant execute on function public.force_refresh_rankings() to authenticated;
grant execute on function public.admin_dashboard_metrics() to authenticated;

alter table public.users replica identity full;
alter table public.tournaments replica identity full;
alter table public.matches replica identity full;
alter table public.match_statistics replica identity full;
alter table public.predictions replica identity full;
alter table public.rankings replica identity full;
alter table public.match_events replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.users;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.tournaments;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.matches;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.match_statistics;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.predictions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.rankings;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.match_events;
exception when duplicate_object then null;
end $$;
