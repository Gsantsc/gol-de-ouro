-- LEAGUE AUDIT
alter table public.users
  add column if not exists status text not null default 'pending',
  add column if not exists last_activity_at timestamptz,
  add constraint users_status_check check (status in ('pending', 'approved', 'rejected', 'suspended'));

update public.users
set status = case
  when blocked = true then 'suspended'
  else approval_status::text
end,
last_activity_at = coalesce(last_activity_at, created_at);

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
  elsif new.status = 'rejected' then
    new.approval_status := 'rejected';
    new.blocked := false;
  elsif new.status = 'pending' then
    new.approval_status := 'pending';
    new.blocked := false;
  elsif new.blocked = true then
    new.status := 'suspended';
  else
    new.status := new.approval_status::text;
  end if;

  new.last_activity_at := coalesce(new.last_activity_at, now());
  return new;
end;
$$;

drop trigger if exists users_sync_status_fields on public.users;
create trigger users_sync_status_fields
before insert or update of status, approval_status, blocked on public.users
for each row execute function public.sync_user_status_fields();

create or replace function public.enforce_single_admin_account()
returns trigger
language plpgsql
as $$
begin
  if new.role = 'admin' and lower(new.email::text) <> 'gbieldev@hotmail.com' then
    new.role := 'user';
  end if;

  if lower(new.email::text) = 'gbieldev@hotmail.com' then
    new.role := 'admin';
    new.status := 'approved';
    new.approval_status := 'approved';
    new.blocked := false;
  end if;

  return new;
end;
$$;

drop trigger if exists users_enforce_single_admin on public.users;
create trigger users_enforce_single_admin
before insert or update of role, email, status, approval_status, blocked on public.users
for each row execute function public.enforce_single_admin_account();

alter table public.matches
  add column if not exists championship text,
  add column if not exists stadium text,
  add column if not exists round text,
  add column if not exists provider_name text,
  add column if not exists provider_external_id text,
  add column if not exists live_score jsonb not null default '{"home":0,"away":0}'::jsonb,
  add column if not exists stats jsonb not null default '{}'::jsonb,
  add column if not exists last_synced_at timestamptz;

alter table public.tournaments
  add column if not exists slug text;

update public.tournaments
set slug = case name
  when 'Copa do Mundo' then 'world_cup'
  when 'Champions League' then 'champions_league'
  when 'Libertadores' then 'libertadores'
  when 'Brasileirao' then 'brasileirao_a'
  else coalesce(slug, lower(regexp_replace(name, '[^a-zA-Z0-9]+', '_', 'g')))
end
where slug is null;

create unique index if not exists tournaments_slug_unique_idx
  on public.tournaments (slug)
  where slug is not null and deleted_at is null;

create unique index if not exists matches_provider_external_idx
  on public.matches (provider_name, provider_external_id)
  where provider_name is not null and provider_external_id is not null;

create table if not exists public.groups (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  championship_id uuid not null references public.tournaments (id),
  owner_id uuid not null references public.users (id),
  invite_code text not null unique,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.group_members (
  id uuid primary key default extensions.gen_random_uuid(),
  group_id uuid not null references public.groups (id),
  user_id uuid not null references public.users (id),
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists group_members_active_unique_idx
  on public.group_members (group_id, user_id)
  where deleted_at is null;

create table if not exists public.group_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  group_id uuid not null references public.groups (id),
  code text not null unique,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

create table if not exists public.achievements (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users (id),
  badge text not null,
  icon text not null,
  description text not null,
  progress integer not null default 0,
  goal integer not null default 1,
  unlocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, badge)
);

create table if not exists public.competitions (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  owner_id uuid not null references public.users (id),
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.competition_groups (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions (id),
  group_id uuid not null references public.groups (id),
  created_at timestamptz not null default now(),
  unique (competition_id, group_id)
);

create table if not exists public.match_provider_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_name text not null,
  status text not null default 'success' check (status in ('success', 'failed')),
  message text,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists groups_championship_idx on public.groups (championship_id) where deleted_at is null;
create index if not exists groups_owner_idx on public.groups (owner_id) where deleted_at is null;
create index if not exists group_members_user_idx on public.group_members (user_id) where deleted_at is null;
create index if not exists group_invites_group_idx on public.group_invites (group_id) where revoked_at is null;
create index if not exists achievements_user_idx on public.achievements (user_id);
create index if not exists competitions_owner_idx on public.competitions (owner_id) where deleted_at is null;

create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
    exit when not exists (
      select 1 from public.groups where invite_code = candidate
      union all
      select 1 from public.group_invites where code = candidate
    );
  end loop;
  return candidate;
end;
$$;

create or replace function public.set_group_invite_code()
returns trigger
language plpgsql
as $$
begin
  new.invite_code := coalesce(nullif(new.invite_code, ''), public.generate_invite_code());
  return new;
end;
$$;

drop trigger if exists groups_set_invite_code on public.groups;
create trigger groups_set_invite_code
before insert on public.groups
for each row execute function public.set_group_invite_code();

create or replace function public.touch_user_activity(target_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.users
  set last_activity_at = now()
  where id = target_user_id;
$$;

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
      and gm.deleted_at is null
  );
$$;

create or replace function public.is_group_owner(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = target_group_id
      and g.owner_id = auth.uid()
      and g.deleted_at is null
  );
$$;

create or replace function public.is_competition_owner(target_competition_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.competitions c
    where c.id = target_competition_id
      and c.owner_id = auth.uid()
      and c.deleted_at is null
  );
$$;

create or replace function public.create_group(group_name text, target_championship_id uuid)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  created_group public.groups%rowtype;
begin
  if not public.is_approved_user() then
    raise exception 'Usuario precisa estar aprovado para criar grupo.';
  end if;

  insert into public.groups (name, championship_id, owner_id, invite_code)
  values (trim(group_name), target_championship_id, auth.uid(), public.generate_invite_code())
  returning * into created_group;

  insert into public.group_members (group_id, user_id, role)
  values (created_group.id, auth.uid(), 'owner');

  perform public.touch_user_activity(auth.uid());
  return created_group;
end;
$$;

create or replace function public.create_group_invite(target_group_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  invite text;
begin
  if not public.is_approved_user() then
    raise exception 'Usuario precisa estar aprovado.';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
      and gm.deleted_at is null
  ) and not public.is_admin() then
    raise exception 'Apenas membros podem gerar convite.';
  end if;

  invite := public.generate_invite_code();

  insert into public.group_invites (group_id, code, created_by)
  values (target_group_id, invite, auth.uid());

  perform public.touch_user_activity(auth.uid());
  return invite;
end;
$$;

create or replace function public.join_group_by_invite(invite text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group public.groups%rowtype;
begin
  if not public.is_approved_user() then
    raise exception 'Usuario precisa estar aprovado para entrar em grupos.';
  end if;

  select g.*
  into target_group
  from public.groups g
  left join public.group_invites gi on gi.group_id = g.id
  where g.deleted_at is null
    and g.closed_at is null
    and (
      upper(g.invite_code) = upper(invite)
      or (
        upper(gi.code) = upper(invite)
        and gi.revoked_at is null
        and (gi.expires_at is null or gi.expires_at > now())
      )
    )
  order by gi.created_at desc nulls last
  limit 1;

  if not found then
    raise exception 'Convite invalido ou expirado.';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (target_group.id, auth.uid(), 'member')
  on conflict (group_id, user_id) where deleted_at is null do nothing;

  perform public.touch_user_activity(auth.uid());
  perform public.evaluate_user_achievements(auth.uid());
  return target_group;
end;
$$;

create or replace function public.leave_group(target_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.group_members
  set deleted_at = now()
  where group_id = target_group_id
    and user_id = auth.uid()
    and role <> 'owner'
    and deleted_at is null;

  perform public.touch_user_activity(auth.uid());
end;
$$;

create or replace function public.close_group(target_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and not exists (
    select 1 from public.groups
    where id = target_group_id
      and owner_id = auth.uid()
      and deleted_at is null
  ) then
    raise exception 'Apenas o criador do grupo pode fechar.';
  end if;

  update public.groups
  set closed_at = now()
  where id = target_group_id;
end;
$$;

create or replace function public.remove_group_member(target_group_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and not exists (
    select 1 from public.groups
    where id = target_group_id
      and owner_id = auth.uid()
      and deleted_at is null
  ) then
    raise exception 'Apenas o criador do grupo pode remover participantes.';
  end if;

  update public.group_members
  set deleted_at = now()
  where group_id = target_group_id
    and user_id = target_user_id
    and role <> 'owner'
    and deleted_at is null;
end;
$$;

create or replace function public.create_competition(competition_name text, target_group_ids uuid[])
returns public.competitions
language plpgsql
security definer
set search_path = public
as $$
declare
  created_competition public.competitions%rowtype;
  group_id uuid;
begin
  if not public.is_approved_user() then
    raise exception 'Usuario precisa estar aprovado para criar competicao.';
  end if;

  insert into public.competitions (name, owner_id)
  values (trim(competition_name), auth.uid())
  returning * into created_competition;

  foreach group_id in array target_group_ids loop
    if public.is_admin() or exists (
      select 1 from public.groups g
      where g.id = group_id
        and g.owner_id = auth.uid()
        and g.deleted_at is null
    ) then
      insert into public.competition_groups (competition_id, group_id)
      values (created_competition.id, group_id)
      on conflict do nothing;
    end if;
  end loop;

  perform public.touch_user_activity(auth.uid());
  return created_competition;
end;
$$;

create or replace function public.evaluate_user_achievements(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prediction_count integer;
  correct_count integer;
  exact_count integer;
  group_count integer;
  general_position integer;
begin
  select count(*)::integer into prediction_count
  from public.predictions where user_id = target_user_id;

  select coalesce(correct_results, 0), coalesce(exact_scores, 0)
  into correct_count, exact_count
  from public.rankings where user_id = target_user_id;

  correct_count := coalesce(correct_count, 0);
  exact_count := coalesce(exact_count, 0);

  select count(*)::integer into group_count
  from public.group_members
  where user_id = target_user_id and deleted_at is null;

  select position into general_position
  from (
    select user_id, row_number() over (order by total_points desc, exact_scores desc, updated_at asc) as position
    from public.rankings
  ) ranked
  where user_id = target_user_id;

  insert into public.achievements (user_id, badge, icon, description, progress, goal, unlocked_at)
  values
    (target_user_id, 'Primeiro Palpite', 'send', 'Enviou o primeiro palpite travado.', least(prediction_count, 1), 1, case when prediction_count >= 1 then now() end),
    (target_user_id, '3 Acertos Seguidos', 'flame', 'Alcancou 3 palpites pontuados.', least(correct_count, 3), 3, case when correct_count >= 3 then now() end),
    (target_user_id, '5 Acertos Seguidos', 'zap', 'Alcancou 5 palpites pontuados.', least(correct_count, 5), 5, case when correct_count >= 5 then now() end),
    (target_user_id, 'Rei dos Placares Exatos', 'crown', 'Chegou a 5 placares exatos.', least(exact_count, 5), 5, case when exact_count >= 5 then now() end),
    (target_user_id, 'Entrou em 1 grupo', 'users', 'Participa de pelo menos 1 grupo.', least(group_count, 1), 1, case when group_count >= 1 then now() end),
    (target_user_id, 'Entrou em 5 grupos', 'network', 'Participa de 5 grupos.', least(group_count, 5), 5, case when group_count >= 5 then now() end),
    (target_user_id, 'Top 1 geral', 'trophy', 'Assumiu o topo do ranking geral.', case when general_position = 1 then 1 else 0 end, 1, case when general_position = 1 then now() end),
    (target_user_id, 'Top 3 geral', 'medal', 'Entrou no top 3 do ranking geral.', case when general_position between 1 and 3 then 1 else 0 end, 1, case when general_position between 1 and 3 then now() end)
  on conflict (user_id, badge) do update set
    progress = greatest(public.achievements.progress, excluded.progress),
    unlocked_at = coalesce(public.achievements.unlocked_at, excluded.unlocked_at),
    updated_at = now();
end;
$$;

create or replace function public.evaluate_achievements_after_prediction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.touch_user_activity(coalesce(new.user_id, old.user_id));
  perform public.evaluate_user_achievements(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists predictions_evaluate_achievements on public.predictions;
create trigger predictions_evaluate_achievements
after insert or update on public.predictions
for each row execute function public.evaluate_achievements_after_prediction();

create or replace function public.evaluate_achievements_after_group_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.touch_user_activity(coalesce(new.user_id, old.user_id));
  perform public.evaluate_user_achievements(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists group_members_evaluate_achievements on public.group_members;
create trigger group_members_evaluate_achievements
after insert or update on public.group_members
for each row execute function public.evaluate_achievements_after_group_member();

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
  set status = 'suspended'
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
  set status = 'approved'
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
  set deleted_at = now(),
      status = 'suspended'
  where id = target_user_id
    and lower(email::text) <> 'gbieldev@hotmail.com'
    and deleted_at is null;

  perform public.write_admin_log('admin removeu usuario com soft delete', 'users', target_user_id);
end;
$$;

create or replace function public.admin_user_overview()
returns table (
  id uuid,
  name text,
  email extensions.citext,
  role public.user_role,
  approval_status public.approval_status,
  status text,
  blocked boolean,
  created_at timestamptz,
  deleted_at timestamptz,
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

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.achievements enable row level security;
alter table public.competitions enable row level security;
alter table public.competition_groups enable row level security;
alter table public.match_provider_runs enable row level security;

drop policy if exists groups_select_member_or_admin on public.groups;
create policy groups_select_member_or_admin
on public.groups for select to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_user()
    and deleted_at is null
    and public.is_group_member(groups.id)
  )
);

drop policy if exists groups_insert_approved on public.groups;
create policy groups_insert_approved
on public.groups for insert to authenticated
with check (public.is_approved_user() and owner_id = auth.uid());

drop policy if exists groups_update_owner_or_admin on public.groups;
create policy groups_update_owner_or_admin
on public.groups for update to authenticated
using (public.is_admin() or owner_id = auth.uid())
with check (public.is_admin() or owner_id = auth.uid());

drop policy if exists group_members_select_peer_or_admin on public.group_members;
create policy group_members_select_peer_or_admin
on public.group_members for select to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_user()
    and public.is_group_member(group_members.group_id)
  )
);

drop policy if exists group_members_insert_self on public.group_members;
create policy group_members_insert_self
on public.group_members for insert to authenticated
with check (public.is_approved_user() and user_id = auth.uid());

drop policy if exists group_members_update_owner_self_or_admin on public.group_members;
create policy group_members_update_owner_self_or_admin
on public.group_members for update to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or public.is_group_owner(group_members.group_id)
)
with check (
  public.is_admin()
  or user_id = auth.uid()
  or public.is_group_owner(group_members.group_id)
);

drop policy if exists group_invites_select_member_or_admin on public.group_invites;
create policy group_invites_select_member_or_admin
on public.group_invites for select to authenticated
using (
  public.is_admin()
  or public.is_group_member(group_invites.group_id)
);

drop policy if exists group_invites_insert_member_or_admin on public.group_invites;
create policy group_invites_insert_member_or_admin
on public.group_invites for insert to authenticated
with check (
  public.is_admin()
  or public.is_group_member(group_invites.group_id)
);

drop policy if exists achievements_select_own_or_admin on public.achievements;
create policy achievements_select_own_or_admin
on public.achievements for select to authenticated
using (public.is_admin() or user_id = auth.uid());

drop policy if exists competitions_select_member_or_admin on public.competitions;
create policy competitions_select_member_or_admin
on public.competitions for select to authenticated
using (
  public.is_admin()
  or owner_id = auth.uid()
  or exists (
    select 1
    from public.competition_groups cg
    join public.group_members gm on gm.group_id = cg.group_id
    where cg.competition_id = competitions.id
      and gm.user_id = auth.uid()
      and gm.deleted_at is null
  )
);

drop policy if exists competitions_insert_approved on public.competitions;
create policy competitions_insert_approved
on public.competitions for insert to authenticated
with check (public.is_approved_user() and owner_id = auth.uid());

drop policy if exists competitions_update_owner_or_admin on public.competitions;
create policy competitions_update_owner_or_admin
on public.competitions for update to authenticated
using (public.is_admin() or owner_id = auth.uid())
with check (public.is_admin() or owner_id = auth.uid());

drop policy if exists competition_groups_select_member_or_admin on public.competition_groups;
create policy competition_groups_select_member_or_admin
on public.competition_groups for select to authenticated
using (
  public.is_admin()
  or public.is_competition_owner(competition_groups.competition_id)
  or exists (
    select 1
    from public.group_members gm
    where gm.group_id = competition_groups.group_id
      and gm.user_id = auth.uid()
      and gm.deleted_at is null
  )
);

drop policy if exists competition_groups_insert_owner_or_admin on public.competition_groups;
create policy competition_groups_insert_owner_or_admin
on public.competition_groups for insert to authenticated
with check (
  public.is_admin()
  or public.is_competition_owner(competition_groups.competition_id)
);

drop policy if exists match_provider_runs_admin_all on public.match_provider_runs;
create policy match_provider_runs_admin_all
on public.match_provider_runs for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update on public.groups to authenticated;
grant select, insert, update on public.group_members to authenticated;
grant select, insert, update on public.group_invites to authenticated;
grant select on public.achievements to authenticated;
grant select, insert, update on public.competitions to authenticated;
grant select, insert, update on public.competition_groups to authenticated;
grant select, insert on public.match_provider_runs to authenticated;

grant execute on function public.create_group(text, uuid) to authenticated;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;
grant execute on function public.create_group_invite(uuid) to authenticated;
grant execute on function public.join_group_by_invite(text) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.close_group(uuid) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.create_competition(text, uuid[]) to authenticated;
grant execute on function public.suspend_user(uuid) to authenticated;
grant execute on function public.reactivate_user(uuid) to authenticated;
grant execute on function public.soft_remove_user(uuid) to authenticated;
grant execute on function public.admin_user_overview() to authenticated;

alter table public.groups replica identity full;
alter table public.group_members replica identity full;
alter table public.group_invites replica identity full;
alter table public.achievements replica identity full;
alter table public.competitions replica identity full;
alter table public.competition_groups replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.groups;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.group_members;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.group_invites;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.achievements;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.competitions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.competition_groups;
exception when duplicate_object then null;
end $$;
-- LEAGUE AUDIT
-- SUPPORTED CHAMPIONSHIPS

insert into public.tournaments (name, type, slug, active)
values
  ('Copa do Mundo 2026', 'world_cup', 'world_cup_2026', true),
  ('Libertadores da América', 'libertadores', 'libertadores', true),
  ('Copa Sul-Americana', 'libertadores', 'sul_americana', true),
  ('Campeonato Brasileiro Série A', 'brasileirao', 'brasileirao_a', true),
  ('Copa do Brasil', 'brasileirao', 'copa_do_brasil', true),
  ('UEFA Champions League', 'champions_league', 'champions_league', true)
on conflict do nothing;
