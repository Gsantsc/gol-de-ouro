-- Harden auth/profile recovery, admin approvals and current scoring rules.

alter table public.users
  add column if not exists status text not null default 'pending',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.users (id),
  add column if not exists rejection_reason text,
  add column if not exists last_login_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists signup_ip text,
  add column if not exists signup_device text;

-- 1. Adicionar novo valor ao ENUM
alter type public.user_role add value if not exists 'player';

-- 2. Convert role column to text to safely handle the new player value
-- Drop trigger before altering the column, otherwise PostgreSQL blocks the change.
drop trigger if exists users_enforce_single_admin on public.users;
alter table public.users
  alter column role drop default,
  alter column role type text using role::text,
  alter column role set default 'player';

-- 3. Remover constraint antiga (se existir)
alter table public.users
  drop constraint if exists users_role_text_check;

update public.users
set
  role = case when lower(email::text) = 'gbieldev@hotmail.com' then 'admin' else 'player' end,
  status = case
    when lower(email::text) = 'gbieldev@hotmail.com' then 'approved'
    when blocked = true then 'suspended'
    else approval_status::text
  end,
  approved_at = case
    when lower(email::text) = 'gbieldev@hotmail.com' then coalesce(approved_at, now())
    else approved_at
  end,
  updated_at = coalesce(updated_at, now());

create index if not exists users_email_idx on public.users (email) where deleted_at is null;
create index if not exists users_status_idx on public.users (status) where deleted_at is null;

drop trigger if exists users_touch_updated_at on public.users;
create trigger users_touch_updated_at
before update on public.users
for each row execute function public.touch_updated_at();

create or replace function public.sync_user_status_fields()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
    and old.blocked = true
    and new.blocked = false
    and new.status = old.status then
    new.status := new.approval_status::text;
  end if;

  if new.status = 'suspended' then
    new.blocked := true;
    if new.approval_status = 'pending' then
      new.approval_status := 'approved';
    end if;
  elsif new.status = 'approved' then
    new.approval_status := 'approved';
    new.blocked := false;
    new.rejection_reason := null;
    new.approved_at := coalesce(new.approved_at, now());
  elsif new.status = 'rejected' then
    new.approval_status := 'rejected';
    new.blocked := false;
  elsif new.status = 'pending' then
    new.approval_status := 'pending';
    new.blocked := false;
    new.approved_at := null;
    new.approved_by := null;
  elsif new.blocked = true then
    new.status := 'suspended';
  else
    new.status := new.approval_status::text;
  end if;

  new.last_activity_at := coalesce(new.last_activity_at, now());
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists users_sync_status_fields on public.users;
create trigger users_sync_status_fields
before insert or update of status, approval_status, blocked, approved_at, approved_by, rejection_reason on public.users
for each row execute function public.sync_user_status_fields();

create or replace function public.enforce_single_admin_account()
returns trigger
language plpgsql
as $$
begin
  if lower(new.email::text) = 'gbieldev@hotmail.com' then
    new.role := 'admin';
    new.status := 'approved';
    new.approval_status := 'approved';
    new.blocked := false;
    new.approved_at := coalesce(new.approved_at, now());
    new.rejection_reason := null;
    return new;
  end if;

  if new.role = 'admin' or new.role is null or new.role = 'user' then
    new.role := 'player';
  end if;

  return new;
end;
$$;

drop trigger if exists users_enforce_single_admin on public.users;
create trigger users_enforce_single_admin
before insert or update of role, email, status, approval_status, blocked on public.users
for each row execute function public.enforce_single_admin_account();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(coalesce(new.email, ''));
  display_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'name', '')), '');
  signup_device_value text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'signup_device', '')), '');
  signup_ip_value text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'signup_ip', '')), '');
  initial_role text := 'player';
  initial_status text := 'pending';
  initial_approval_status public.approval_status := 'pending';
begin
  if normalized_email = 'gbieldev@hotmail.com' then
    initial_role := 'admin';
    initial_status := 'approved';
    initial_approval_status := 'approved';
  end if;

  insert into public.users (
    id,
    name,
    email,
    role,
    approval_status,
    status,
    blocked,
    approved_at,
    signup_ip,
    signup_device
  )
  values (
    new.id,
    coalesce(display_name, split_part(normalized_email, '@', 1), 'Usuario'),
    normalized_email,
    initial_role,
    initial_approval_status,
    initial_status,
    false,
    case when initial_status = 'approved' then now() else null end,
    signup_ip_value,
    signup_device_value
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(nullif(public.users.name, ''), excluded.name),
    role = case
      when excluded.email = 'gbieldev@hotmail.com' then 'admin'
      when public.users.role = 'admin' then public.users.role
      else 'player'
    end,
    approval_status = case
      when excluded.email = 'gbieldev@hotmail.com' then 'approved'::public.approval_status
      else public.users.approval_status
    end,
    status = case
      when excluded.email = 'gbieldev@hotmail.com' then 'approved'
      else public.users.status
    end,
    blocked = case
      when excluded.email = 'gbieldev@hotmail.com' then false
      else public.users.blocked
    end,
    approved_at = case
      when excluded.email = 'gbieldev@hotmail.com' then coalesce(public.users.approved_at, now())
      else public.users.approved_at
    end,
    signup_ip = coalesce(public.users.signup_ip, excluded.signup_ip),
    signup_device = coalesce(public.users.signup_device, excluded.signup_device),
    updated_at = now();

  insert into public.rankings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.ensure_user_profile(
  display_name text default null,
  signup_device_value text default null,
  signup_ip_value text default null
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_email text;
  safe_name text := nullif(trim(coalesce(display_name, '')), '');
  ensured_user public.users%rowtype;
begin
  if current_user_id is null then
    raise exception 'Sessao nao encontrada.';
  end if;

  select lower(coalesce(au.email, auth.jwt() ->> 'email', ''))
  into normalized_email
  from auth.users au
  where au.id = current_user_id;

  normalized_email := lower(coalesce(normalized_email, auth.jwt() ->> 'email', ''));

  if normalized_email = '' then
    raise exception 'Email da sessao nao encontrado.';
  end if;

  insert into public.users (
    id,
    name,
    email,
    role,
    approval_status,
    status,
    blocked,
    approved_at,
    signup_ip,
    signup_device
  )
  values (
    current_user_id,
    coalesce(safe_name, split_part(normalized_email, '@', 1), 'Usuario'),
    normalized_email,
    case when normalized_email = 'gbieldev@hotmail.com' then 'admin' else 'player' end,
    case when normalized_email = 'gbieldev@hotmail.com' then 'approved'::public.approval_status else 'pending'::public.approval_status end,
    case when normalized_email = 'gbieldev@hotmail.com' then 'approved' else 'pending' end,
    false,
    case when normalized_email = 'gbieldev@hotmail.com' then now() else null end,
    nullif(trim(coalesce(signup_ip_value, '')), ''),
    nullif(trim(coalesce(signup_device_value, '')), '')
  )
  on conflict (id) do update set
    name = coalesce(safe_name, public.users.name),
    email = excluded.email,
    role = case
      when excluded.email = 'gbieldev@hotmail.com' then 'admin'
      when public.users.role = 'admin' then public.users.role
      else 'player'
    end,
    approval_status = case
      when excluded.email = 'gbieldev@hotmail.com' then 'approved'::public.approval_status
      else public.users.approval_status
    end,
    status = case
      when excluded.email = 'gbieldev@hotmail.com' then 'approved'
      else public.users.status
    end,
    blocked = case
      when excluded.email = 'gbieldev@hotmail.com' then false
      else public.users.blocked
    end,
    approved_at = case
      when excluded.email = 'gbieldev@hotmail.com' then coalesce(public.users.approved_at, now())
      else public.users.approved_at
    end,
    signup_ip = coalesce(public.users.signup_ip, excluded.signup_ip),
    signup_device = coalesce(public.users.signup_device, excluded.signup_device),
    updated_at = now()
  returning * into ensured_user;

  insert into public.rankings (user_id)
  values (current_user_id)
  on conflict (user_id) do nothing;

  return ensured_user;
end;
$$;

create or replace function public.record_user_login()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sessao nao encontrada.';
  end if;

  update public.users
  set
    last_login_at = now(),
    last_activity_at = now(),
    updated_at = now()
  where id = auth.uid();
end;
$$;

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
      and status = 'approved'
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
      and status = 'approved'
      and approval_status = 'approved'
      and blocked = false
      and deleted_at is null
  );
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
  set
    status = 'approved',
    approval_status = 'approved',
    blocked = false,
    approved_at = now(),
    approved_by = auth.uid(),
    rejection_reason = null
  where id = target_user_id
    and lower(email::text) <> 'gbieldev@hotmail.com'
    and deleted_at is null;

  insert into public.rankings (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;

  perform public.write_admin_log('admin aprovou usuario', 'users', target_user_id);
end;
$$;

drop function if exists public.reject_user(uuid);
create or replace function public.reject_user(target_user_id uuid, reason text default null)
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
  set
    status = 'rejected',
    approval_status = 'rejected',
    blocked = false,
    rejection_reason = nullif(trim(coalesce(reason, '')), '')
  where id = target_user_id
    and lower(email::text) <> 'gbieldev@hotmail.com'
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
  set
    blocked = true,
    status = 'suspended'
  where id = target_user_id
    and lower(email::text) <> 'gbieldev@hotmail.com'
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
  set
    blocked = false,
    status = approval_status::text
  where id = target_user_id
    and lower(email::text) <> 'gbieldev@hotmail.com'
    and deleted_at is null;

  perform public.write_admin_log('admin desbloqueou usuario', 'users', target_user_id);
end;
$$;

create or replace function public.suspend_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem suspender usuarios.';
  end if;

  update public.users
  set
    status = 'suspended',
    blocked = true
  where id = target_user_id
    and lower(email::text) <> 'gbieldev@hotmail.com'
    and deleted_at is null;

  perform public.write_admin_log('admin suspendeu usuario', 'users', target_user_id);
end;
$$;

create or replace function public.reactivate_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem reativar usuarios.';
  end if;

  update public.users
  set
    status = 'approved',
    approval_status = 'approved',
    blocked = false,
    approved_at = now(),
    approved_by = auth.uid(),
    rejection_reason = null
  where id = target_user_id
    and lower(email::text) <> 'gbieldev@hotmail.com'
    and deleted_at is null;

  insert into public.rankings (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;

  perform public.write_admin_log('admin reativou usuario', 'users', target_user_id);
end;
$$;

create or replace function public.soft_remove_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem remover usuarios.';
  end if;

  update public.users
  set
    deleted_at = now(),
    status = 'suspended',
    blocked = true
  where id = target_user_id
    and lower(email::text) <> 'gbieldev@hotmail.com'
    and deleted_at is null;

  perform public.write_admin_log('admin removeu usuario com soft delete', 'users', target_user_id);
end;
$$;

drop function if exists public.admin_user_overview();
create or replace function public.admin_user_overview()
returns table (
  id uuid,
  name text,
  email extensions.citext,
  role text,
  approval_status public.approval_status,
  status text,
  blocked boolean,
  created_at timestamptz,
  deleted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  rejection_reason text,
  last_login_at timestamptz,
  updated_at timestamptz,
  signup_ip text,
  signup_device text,
  groups_count bigint,
  predictions_count bigint,
  last_activity_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem visualizar usuarios.';
  end if;

  return query
  select
    u.id,
    u.name,
    u.email,
    u.role,
    u.approval_status,
    u.status,
    u.blocked,
    u.created_at,
    u.deleted_at,
    u.approved_at,
    u.approved_by,
    u.rejection_reason,
    u.last_login_at,
    u.updated_at,
    u.signup_ip,
    u.signup_device,
    count(distinct gm.group_id) filter (where gm.deleted_at is null) as groups_count,
    count(distinct p.id) as predictions_count,
    u.last_activity_at
  from public.users u
  left join public.group_members gm on gm.user_id = u.id
  left join public.predictions p on p.user_id = u.id
  where u.deleted_at is null
  group by u.id
  order by u.created_at desc;
end;
$$;

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
    (select count(*) from public.users where status = 'pending' and deleted_at is null),
    (select count(*) from public.users where status = 'approved' and deleted_at is null),
    (select count(*) from public.matches where status = 'aberto' and deleted_at is null),
    (select count(*) from public.matches where status = 'ao_vivo' and deleted_at is null),
    (select count(*) from public.matches where status = 'encerrado' and deleted_at is null),
    (select count(*) from public.predictions);
end;
$$;

alter table public.matches
  add column if not exists is_golden_match boolean not null default false,
  add column if not exists is_upset boolean not null default false;

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
  set points = (
    (
      case
        when p.predicted_home_score = target_match.home_score
          and p.predicted_away_score = target_match.away_score then 10
        when (
          (p.predicted_home_score > p.predicted_away_score and target_match.home_score > target_match.away_score)
          or (p.predicted_home_score < p.predicted_away_score and target_match.home_score < target_match.away_score)
          or (p.predicted_home_score = p.predicted_away_score and target_match.home_score = target_match.away_score)
        ) then 5
        when (p.predicted_home_score - p.predicted_away_score) = (target_match.home_score - target_match.away_score) then 3
        when p.predicted_home_score = target_match.home_score
          or p.predicted_away_score = target_match.away_score then 2
        else 0
      end
      + case
          when target_match.is_upset = true and (
            (p.predicted_home_score > p.predicted_away_score and target_match.home_score > target_match.away_score)
            or (p.predicted_home_score < p.predicted_away_score and target_match.home_score < target_match.away_score)
            or (p.predicted_home_score = p.predicted_away_score and target_match.home_score = target_match.away_score)
          ) then 3
          else 0
        end
      + case
          when abs(target_match.home_score - target_match.away_score) >= 3
            and (
              (p.predicted_home_score > p.predicted_away_score and target_match.home_score > target_match.away_score)
              or (p.predicted_home_score < p.predicted_away_score and target_match.home_score < target_match.away_score)
            ) then 2
          else 0
        end
      + case
          when target_match.home_score = 0
            and target_match.away_score = 0
            and p.predicted_home_score = 0
            and p.predicted_away_score = 0 then 2
          else 0
        end
    )
    * case when target_match.is_golden_match = true then 2 else 1 end
  )
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

create table if not exists public.lineup_predictions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users (id),
  match_id uuid references public.matches (id),
  formation text not null default '4-3-3',
  players jsonb not null default '[]'::jsonb,
  locked boolean not null default true,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create table if not exists public.lineup_points (
  id uuid primary key default extensions.gen_random_uuid(),
  lineup_prediction_id uuid not null references public.lineup_predictions (id) on delete cascade,
  user_id uuid not null references public.users (id),
  match_id uuid references public.matches (id),
  points integer not null default 0,
  breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lineup_prediction_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_id uuid references public.users (id),
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.consent_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users (id),
  consent_type text not null,
  accepted boolean not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid references public.users (id),
  title text not null,
  body text not null,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.error_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid references public.users (id),
  scope text not null,
  message text not null,
  stack text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lineup_predictions_user_idx on public.lineup_predictions (user_id);
create index if not exists lineup_points_user_idx on public.lineup_points (user_id);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists consent_logs_user_idx on public.consent_logs (user_id);
create index if not exists notifications_user_idx on public.notifications (user_id, read_at);
create index if not exists error_logs_created_idx on public.error_logs (created_at desc);

alter table public.lineup_predictions enable row level security;
alter table public.lineup_points enable row level security;
alter table public.audit_logs enable row level security;
alter table public.consent_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.error_logs enable row level security;

drop policy if exists lineup_predictions_select_own_or_admin on public.lineup_predictions;
create policy lineup_predictions_select_own_or_admin
on public.lineup_predictions for select to authenticated
using (public.is_admin() or user_id = auth.uid());

drop policy if exists lineup_predictions_insert_own_approved on public.lineup_predictions;
create policy lineup_predictions_insert_own_approved
on public.lineup_predictions for insert to authenticated
with check (public.is_approved_user() and user_id = auth.uid());

drop policy if exists lineup_points_select_own_or_admin on public.lineup_points;
create policy lineup_points_select_own_or_admin
on public.lineup_points for select to authenticated
using (public.is_admin() or user_id = auth.uid());

drop policy if exists audit_logs_admin_all on public.audit_logs;
create policy audit_logs_admin_all
on public.audit_logs for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists consent_logs_own_or_admin on public.consent_logs;
create policy consent_logs_own_or_admin
on public.consent_logs for all to authenticated
using (public.is_admin() or user_id = auth.uid())
with check (public.is_admin() or user_id = auth.uid());

drop policy if exists notifications_own_or_admin on public.notifications;
create policy notifications_own_or_admin
on public.notifications for all to authenticated
using (public.is_admin() or user_id = auth.uid())
with check (public.is_admin() or user_id = auth.uid());

drop policy if exists error_logs_admin_all on public.error_logs;
create policy error_logs_admin_all
on public.error_logs for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update on public.lineup_predictions to authenticated;
grant select, insert, update on public.lineup_points to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant select, insert on public.consent_logs to authenticated;
grant select, insert, update on public.notifications to authenticated;
grant select, insert on public.error_logs to authenticated;

grant execute on function public.ensure_user_profile(text, text, text) to authenticated;
grant execute on function public.record_user_login() to authenticated;
grant execute on function public.reject_user(uuid, text) to authenticated;
grant execute on function public.admin_user_overview() to authenticated;

alter table public.lineup_predictions replica identity full;
alter table public.lineup_points replica identity full;
alter table public.notifications replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.lineup_predictions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.lineup_points;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'gbieldev@hotmail.com',
  extensions.crypt('123456', extensions.gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Administrador"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
)
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = now(),
  recovery_sent_at = now(),
  last_sign_in_at = now(),
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  extensions.gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  jsonb_build_object(
    'sub',
    '00000000-0000-0000-0000-000000000001',
    'email',
    'gbieldev@hotmail.com'
  ),
  'email',
  'gbieldev@hotmail.com',
  now(),
  now(),
  now()
)
on conflict (provider, provider_id) do update set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  last_sign_in_at = now(),
  updated_at = now();

insert into public.users (
  id,
  name,
  email,
  role,
  approval_status,
  status,
  blocked,
  approved_at,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000001',
  'Administrador',
  'gbieldev@hotmail.com',
  'admin',
  'approved',
  'approved',
  false,
  now(),
  now(),
  now()
)
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  role = 'admin',
  approval_status = 'approved',
  status = 'approved',
  blocked = false,
  approved_at = coalesce(public.users.approved_at, now()),
  rejection_reason = null,
  updated_at = now();

insert into public.rankings (user_id)
values ('00000000-0000-0000-0000-000000000001')
on conflict (user_id) do nothing;

insert into public.tournaments (name, type, slug, active)
values
  ('Copa do Brasil', 'brasileirao', 'copa_do_brasil', true)
on conflict do nothing;
