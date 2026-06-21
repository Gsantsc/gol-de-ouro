-- League invite preview, pending intent and clean /invite/:token URLs.

create or replace function public.normalize_invite_base_url(app_base_url text default null)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(nullif(trim(app_base_url), ''), 'https://gol-de-ouro-app.vercel.app'), '/+$', '');
$$;

create or replace function public.build_invite_url(invite_kind text, invite_token text, app_base_url text default null)
returns text
language sql
immutable
as $$
  select public.normalize_invite_base_url(app_base_url)
    || case
      when invite_kind = 'app' then '/invite/app/'
      else '/invite/'
    end
    || invite_token;
$$;

update public.groups
set invite_url = public.build_invite_url('group', invite_token)
where invite_token is not null
  and (
    invite_url is null
    or invite_url like '%/join/group/%'
    or invite_url like '%/invite/group/%'
  );

update public.group_invites
set invite_url = public.build_invite_url('group', invite_token)
where invite_token is not null
  and (
    invite_url is null
    or invite_url like '%/join/group/%'
    or invite_url like '%/invite/group/%'
  );

alter table public.group_invites
  add column if not exists max_uses integer check (max_uses is null or max_uses > 0),
  add column if not exists used_count integer not null default 0;

create table if not exists public.group_invite_intents (
  id uuid primary key default extensions.gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  invite_token text not null,
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'joined', 'blocked', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  deleted_at timestamptz
);

create unique index if not exists group_invite_intents_active_unique_idx
  on public.group_invite_intents (group_id, user_id)
  where deleted_at is null;

create index if not exists group_invite_intents_user_idx
  on public.group_invite_intents (user_id)
  where deleted_at is null;

alter table public.group_invite_intents enable row level security;

drop policy if exists group_invite_intents_select_own_or_admin on public.group_invite_intents;
create policy group_invite_intents_select_own_or_admin
on public.group_invite_intents for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists group_invite_intents_insert_own on public.group_invite_intents;
create policy group_invite_intents_insert_own
on public.group_invite_intents for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists group_invite_intents_update_own_or_admin on public.group_invite_intents;
create policy group_invite_intents_update_own_or_admin
on public.group_invite_intents for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

grant select, insert, update on public.group_invite_intents to authenticated;

create or replace function public.resolve_group_invite(invite text)
returns table (
  group_id uuid,
  group_invite_id uuid,
  invite_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text := public.extract_invite_value(invite);
  raw_invite text := trim(invite);
begin
  return query
  select
    g.id,
    case
      when
        gi.invite_active = true
        and gi.revoked_at is null
        and (gi.expires_at is null or gi.expires_at > now())
        and (gi.max_uses is null or gi.used_count < gi.max_uses)
        and (
          upper(gi.code) = candidate
          or upper(gi.invite_token) = candidate
          or upper(gi.invite_url) = upper(raw_invite)
        )
      then gi.id
      else null
    end,
    case
      when
        gi.invite_active = true
        and gi.revoked_at is null
        and (gi.expires_at is null or gi.expires_at > now())
        and (gi.max_uses is null or gi.used_count < gi.max_uses)
        and (
          upper(gi.code) = candidate
          or upper(gi.invite_token) = candidate
          or upper(gi.invite_url) = upper(raw_invite)
        )
      then gi.invite_token
      else coalesce(g.invite_token, g.invite_code)
    end
  from public.groups g
  left join public.group_invites gi on gi.group_id = g.id
  where g.deleted_at is null
    and g.closed_at is null
    and (
      (
        g.invite_active = true
        and (g.invite_expires_at is null or g.invite_expires_at > now())
        and (
          upper(g.invite_code) = candidate
          or upper(g.invite_token) = candidate
          or upper(g.invite_url) = upper(raw_invite)
        )
      )
      or (
        gi.invite_active = true
        and gi.revoked_at is null
        and (gi.expires_at is null or gi.expires_at > now())
        and (gi.max_uses is null or gi.used_count < gi.max_uses)
        and (
          upper(gi.code) = candidate
          or upper(gi.invite_token) = candidate
          or upper(gi.invite_url) = upper(raw_invite)
        )
      )
    )
  order by gi.created_at desc nulls last
  limit 1;
end;
$$;

create or replace function public.get_group_invite_preview(invite text)
returns table (
  group_id uuid,
  group_name text,
  championship_id uuid,
  championship_name text,
  participant_count integer,
  invite_token text,
  invite_url text,
  invite_active boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved record;
begin
  select *
  into resolved
  from public.resolve_group_invite(invite)
  limit 1;

  if not found then
    raise exception 'Convite invalido ou expirado.';
  end if;

  return query
  select
    g.id,
    g.name,
    g.championship_id,
    coalesce(t.name, 'Campeonato')::text,
    (
      select count(*)::integer
      from public.group_members gm
      where gm.group_id = g.id
        and gm.deleted_at is null
    ),
    resolved.invite_token,
    public.build_invite_url('group', resolved.invite_token),
    g.invite_active
  from public.groups g
  left join public.tournaments t on t.id = g.championship_id
  where g.id = resolved.group_id;
end;
$$;

create or replace function public.accept_group_invite(invite text)
returns table (
  status text,
  group_id uuid,
  group_name text,
  membership_created boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved record;
  target_group public.groups%rowtype;
  current_profile public.users%rowtype;
  was_member_before boolean := false;
  created_membership boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Entre ou cadastre-se para participar desta liga.';
  end if;

  select *
  into current_profile
  from public.users u
  where u.id = auth.uid()
    and u.deleted_at is null;

  if not found then
    raise exception 'Cadastro nao encontrado. Entre novamente.';
  end if;

  if coalesce(current_profile.blocked, false)
    or coalesce(current_profile.status, current_profile.approval_status::text) = 'suspended' then
    raise exception 'Sua conta foi suspensa. Entre em contato com o administrador.';
  end if;

  if current_profile.approval_status = 'rejected'
    or coalesce(current_profile.status, current_profile.approval_status::text) = 'rejected' then
    raise exception 'Seu cadastro foi rejeitado pelo administrador.';
  end if;

  select *
  into resolved
  from public.resolve_group_invite(invite)
  limit 1;

  if not found then
    raise exception 'Convite invalido ou expirado.';
  end if;

  select *
  into target_group
  from public.groups
  where id = resolved.group_id
    and deleted_at is null
    and closed_at is null;

  if not found then
    raise exception 'Liga nao encontrada.';
  end if;

  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group.id
      and gm.user_id = auth.uid()
      and gm.deleted_at is null
  )
  into was_member_before;

  if current_profile.approval_status = 'pending'
    or coalesce(current_profile.status, current_profile.approval_status::text) = 'pending' then
    update public.group_invite_intents
    set invite_token = resolved.invite_token,
        status = 'pending_approval',
        updated_at = now(),
        accepted_at = null
    where public.group_invite_intents.group_id = target_group.id
      and public.group_invite_intents.user_id = auth.uid()
      and public.group_invite_intents.deleted_at is null;

    if not found then
      begin
        insert into public.group_invite_intents (group_id, user_id, invite_token, status)
        values (target_group.id, auth.uid(), resolved.invite_token, 'pending_approval');
      exception when unique_violation then
        update public.group_invite_intents
        set invite_token = resolved.invite_token,
            status = 'pending_approval',
            updated_at = now(),
            accepted_at = null
        where public.group_invite_intents.group_id = target_group.id
          and public.group_invite_intents.user_id = auth.uid()
          and public.group_invite_intents.deleted_at is null;
      end;
    end if;

    return query select 'pending_approval'::text, target_group.id, target_group.name, false;
    return;
  end if;

  if current_profile.approval_status <> 'approved'
    or coalesce(current_profile.status, current_profile.approval_status::text) <> 'approved' then
    raise exception 'Seu cadastro ainda esta aguardando aprovacao.';
  end if;

  if not was_member_before then
    begin
      insert into public.group_members (group_id, user_id, role)
      values (target_group.id, auth.uid(), 'member');
      created_membership := true;
    exception when unique_violation then
      created_membership := false;
    end;
  end if;

  if resolved.group_invite_id is not null and created_membership then
    update public.group_invites
    set used_count = used_count + 1
    where id = resolved.group_invite_id;
  end if;

  update public.group_invite_intents
  set status = 'joined',
      updated_at = now(),
      accepted_at = coalesce(accepted_at, now())
  where public.group_invite_intents.group_id = target_group.id
    and public.group_invite_intents.user_id = auth.uid()
    and public.group_invite_intents.deleted_at is null;

  perform public.touch_user_activity(auth.uid());
  perform public.evaluate_user_achievements(auth.uid());

  return query
  select
    case when was_member_before or not created_membership then 'already_member' else 'joined' end::text,
    target_group.id,
    target_group.name,
    created_membership;
end;
$$;

create or replace function public.apply_pending_group_invites(target_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  intent record;
  applied_count integer := 0;
  matching_invite_id uuid;
  was_member_before boolean;
begin
  if auth.uid() is not null and auth.uid() <> target_user_id and not public.is_admin() then
    raise exception 'Nao autorizado a aplicar convites deste usuario.';
  end if;

  if not exists (
    select 1
    from public.users u
    where u.id = target_user_id
      and u.deleted_at is null
      and coalesce(u.blocked, false) = false
      and u.approval_status = 'approved'
      and coalesce(u.status, u.approval_status::text) = 'approved'
  ) then
    return 0;
  end if;

  for intent in
    select gii.*, g.closed_at, g.deleted_at as group_deleted_at
    from public.group_invite_intents gii
    join public.groups g on g.id = gii.group_id
    where gii.user_id = target_user_id
      and gii.status = 'pending_approval'
      and gii.deleted_at is null
  loop
    if intent.closed_at is not null or intent.group_deleted_at is not null then
      update public.group_invite_intents
      set status = 'expired', updated_at = now()
      where id = intent.id;
      continue;
    end if;

    select gi.id
    into matching_invite_id
    from public.group_invites gi
    where gi.group_id = intent.group_id
      and gi.invite_token = intent.invite_token
      and gi.invite_active = true
      and gi.revoked_at is null
      and (gi.expires_at is null or gi.expires_at > now())
      and (gi.max_uses is null or gi.used_count < gi.max_uses)
    order by gi.created_at desc
    limit 1;

    if matching_invite_id is null and not exists (
      select 1
      from public.groups g
      where g.id = intent.group_id
        and g.invite_active = true
        and (g.invite_expires_at is null or g.invite_expires_at > now())
        and g.invite_token = intent.invite_token
    ) then
      update public.group_invite_intents
      set status = 'expired', updated_at = now()
      where id = intent.id;
      continue;
    end if;

    select exists (
      select 1
      from public.group_members gm
      where gm.group_id = intent.group_id
        and gm.user_id = target_user_id
        and gm.deleted_at is null
    )
    into was_member_before;

    insert into public.group_members (group_id, user_id, role)
    values (intent.group_id, target_user_id, 'member')
    on conflict (group_id, user_id) where deleted_at is null do nothing;

    if matching_invite_id is not null and not was_member_before then
      update public.group_invites
      set used_count = used_count + 1
      where id = matching_invite_id;
    end if;

    update public.group_invite_intents
    set status = 'joined',
        updated_at = now(),
        accepted_at = coalesce(accepted_at, now())
    where id = intent.id;

    applied_count := applied_count + 1;
  end loop;

  if applied_count > 0 then
    perform public.touch_user_activity(target_user_id);
    perform public.evaluate_user_achievements(target_user_id);
  end if;

  return applied_count;
end;
$$;

create or replace function public.apply_group_invite_intents_on_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approval_status = 'approved'
    and coalesce(new.status, new.approval_status::text) = 'approved'
    and coalesce(new.blocked, false) = false
    and (
      old.approval_status is distinct from new.approval_status
      or old.status is distinct from new.status
      or old.blocked is distinct from new.blocked
    ) then
    perform public.apply_pending_group_invites(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists users_apply_group_invite_intents_on_approval on public.users;
create trigger users_apply_group_invite_intents_on_approval
after update of status, approval_status, blocked on public.users
for each row
execute function public.apply_group_invite_intents_on_approval();

create or replace function public.join_group_by_invite(invite text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted record;
  target_group public.groups%rowtype;
begin
  select *
  into accepted
  from public.accept_group_invite(invite)
  limit 1;

  select *
  into target_group
  from public.groups
  where id = accepted.group_id;

  return target_group;
end;
$$;

grant execute on function public.get_group_invite_preview(text) to anon, authenticated;
grant execute on function public.accept_group_invite(text) to authenticated;
grant execute on function public.join_group_by_invite(text) to authenticated;
grant execute on function public.apply_pending_group_invites(uuid) to authenticated;
revoke all on function public.resolve_group_invite(text) from public;
