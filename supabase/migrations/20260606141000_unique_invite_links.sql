create table if not exists public.app_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  inviter_user_id uuid not null references public.users (id),
  invited_email text,
  invite_token text not null unique,
  invite_url text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_user_id uuid references public.users (id),
  expires_at timestamptz,
  revoked_at timestamptz
);

alter table public.groups
  add column if not exists invite_token text,
  add column if not exists invite_url text,
  add column if not exists invite_created_at timestamptz not null default now(),
  add column if not exists invite_expires_at timestamptz,
  add column if not exists invite_active boolean not null default true;

alter table public.group_invites
  add column if not exists invite_token text,
  add column if not exists invite_url text,
  add column if not exists invite_active boolean not null default true;

create or replace function public.normalize_invite_base_url(app_base_url text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(nullif(trim(app_base_url), ''), 'https://goldeouro.app'), '/+$', '');
$$;

create or replace function public.extract_invite_value(invite text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(split_part(trim(invite), '?', 1), '^.*/', ''));
$$;

create or replace function public.build_invite_url(invite_kind text, invite_token text, app_base_url text default null)
returns text
language sql
immutable
as $$
  select public.normalize_invite_base_url(app_base_url)
    || case
      when invite_kind = 'app' then '/invite/app/'
      else '/join/group/'
    end
    || invite_token;
$$;

create or replace function public.generate_invite_token()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := lower(encode(extensions.gen_random_bytes(18), 'hex'));
    exit when not exists (
      select 1 from public.groups where invite_token = candidate
      union all
      select 1 from public.group_invites where invite_token = candidate
      union all
      select 1 from public.app_invites where invite_token = candidate
    );
  end loop;
  return candidate;
end;
$$;

update public.groups
set
  invite_token = coalesce(invite_token, public.generate_invite_token()),
  invite_created_at = coalesce(invite_created_at, created_at, now()),
  invite_active = coalesce(invite_active, true)
where invite_token is null;

update public.groups
set invite_url = public.build_invite_url('group', invite_token)
where invite_url is null
  and invite_token is not null;

update public.group_invites
set
  invite_token = coalesce(invite_token, public.generate_invite_token()),
  invite_active = coalesce(invite_active, true)
where invite_token is null
   or invite_active is null;

update public.group_invites
set invite_url = public.build_invite_url('group', invite_token)
where invite_url is null
  and invite_token is not null;

alter table public.groups
  alter column invite_token set not null,
  alter column invite_url set not null;

create unique index if not exists groups_invite_token_unique_idx on public.groups (invite_token);
create unique index if not exists group_invites_invite_token_unique_idx on public.group_invites (invite_token) where invite_token is not null;
create index if not exists app_invites_inviter_idx on public.app_invites (inviter_user_id);
create index if not exists app_invites_status_idx on public.app_invites (status);

create or replace function public.set_group_invite_code()
returns trigger
language plpgsql
as $$
begin
  new.invite_code := coalesce(nullif(new.invite_code, ''), public.generate_invite_code());
  new.invite_token := coalesce(nullif(new.invite_token, ''), public.generate_invite_token());
  new.invite_url := coalesce(nullif(new.invite_url, ''), public.build_invite_url('group', new.invite_token));
  new.invite_created_at := coalesce(new.invite_created_at, now());
  new.invite_active := coalesce(new.invite_active, true);
  return new;
end;
$$;

drop function if exists public.create_group(text, uuid);
create or replace function public.create_group(group_name text, target_championship_id uuid, app_base_url text default null)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  created_group public.groups%rowtype;
  next_token text := public.generate_invite_token();
begin
  if not public.is_approved_user() then
    raise exception 'Usuario precisa estar aprovado para criar grupo.';
  end if;

  insert into public.groups (
    name,
    championship_id,
    owner_id,
    invite_code,
    invite_token,
    invite_url,
    invite_created_at,
    invite_active
  )
  values (
    trim(group_name),
    target_championship_id,
    auth.uid(),
    public.generate_invite_code(),
    next_token,
    public.build_invite_url('group', next_token, app_base_url),
    now(),
    true
  )
  returning * into created_group;

  insert into public.group_members (group_id, user_id, role)
  values (created_group.id, auth.uid(), 'owner');

  perform public.touch_user_activity(auth.uid());
  return created_group;
end;
$$;

create or replace function public.regenerate_group_invite(target_group_id uuid, app_base_url text default null)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group public.groups%rowtype;
  next_token text := public.generate_invite_token();
begin
  if not public.is_approved_user() then
    raise exception 'Usuario precisa estar aprovado.';
  end if;

  if not public.is_group_owner(target_group_id) and not public.is_admin() then
    raise exception 'Apenas o dono da liga pode regenerar o convite.';
  end if;

  update public.groups
  set
    invite_code = public.generate_invite_code(),
    invite_token = next_token,
    invite_url = public.build_invite_url('group', next_token, app_base_url),
    invite_created_at = now(),
    invite_active = true,
    invite_expires_at = null
  where id = target_group_id
    and deleted_at is null
  returning * into target_group;

  if not found then
    raise exception 'Liga nao encontrada.';
  end if;

  update public.group_invites
  set revoked_at = coalesce(revoked_at, now()), invite_active = false
  where group_id = target_group_id
    and revoked_at is null;

  perform public.touch_user_activity(auth.uid());
  return target_group;
end;
$$;

create or replace function public.deactivate_group_invite(target_group_id uuid)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group public.groups%rowtype;
begin
  if not public.is_approved_user() then
    raise exception 'Usuario precisa estar aprovado.';
  end if;

  if not public.is_group_owner(target_group_id) and not public.is_admin() then
    raise exception 'Apenas o dono da liga pode desativar o convite.';
  end if;

  update public.groups
  set invite_active = false
  where id = target_group_id
    and deleted_at is null
  returning * into target_group;

  if not found then
    raise exception 'Liga nao encontrada.';
  end if;

  update public.group_invites
  set revoked_at = coalesce(revoked_at, now()), invite_active = false
  where group_id = target_group_id
    and revoked_at is null;

  perform public.touch_user_activity(auth.uid());
  return target_group;
end;
$$;

drop function if exists public.create_group_invite(uuid);
create or replace function public.create_group_invite(target_group_id uuid, app_base_url text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  invite text;
  token text;
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
  token := public.generate_invite_token();

  insert into public.group_invites (group_id, code, invite_token, invite_url, created_by)
  values (target_group_id, invite, token, public.build_invite_url('group', token, app_base_url), auth.uid());

  perform public.touch_user_activity(auth.uid());
  return token;
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
  candidate text := public.extract_invite_value(invite);
  raw_invite text := trim(invite);
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
        and (
          upper(gi.code) = candidate
          or upper(gi.invite_token) = candidate
          or upper(gi.invite_url) = upper(raw_invite)
        )
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

create or replace function public.create_app_invite(invited_email text default null, app_base_url text default null)
returns public.app_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.app_invites%rowtype;
  next_token text := public.generate_invite_token();
begin
  if not public.is_approved_user() then
    raise exception 'Usuario precisa estar aprovado para convidar.';
  end if;

  insert into public.app_invites (
    inviter_user_id,
    invited_email,
    invite_token,
    invite_url,
    status
  )
  values (
    auth.uid(),
    nullif(trim(coalesce(invited_email, '')), ''),
    next_token,
    public.build_invite_url('app', next_token, app_base_url),
    'pending'
  )
  returning * into invite_row;

  perform public.touch_user_activity(auth.uid());
  return invite_row;
end;
$$;

create or replace function public.revoke_app_invite(target_invite_id uuid)
returns public.app_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.app_invites%rowtype;
begin
  update public.app_invites
  set status = 'revoked', revoked_at = now()
  where id = target_invite_id
    and status = 'pending'
    and (inviter_user_id = auth.uid() or public.is_admin())
  returning * into invite_row;

  if not found then
    raise exception 'Convite nao encontrado ou sem permissao.';
  end if;

  perform public.touch_user_activity(auth.uid());
  return invite_row;
end;
$$;

create or replace function public.accept_app_invite(invite text)
returns public.app_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.app_invites%rowtype;
  candidate text := public.extract_invite_value(invite);
begin
  if auth.uid() is null then
    raise exception 'Usuario precisa estar autenticado para aceitar convite.';
  end if;

  update public.app_invites
  set status = 'accepted', accepted_at = now(), accepted_user_id = auth.uid()
  where status = 'pending'
    and revoked_at is null
    and (expires_at is null or expires_at > now())
    and (
      upper(invite_token) = candidate
      or upper(invite_url) = upper(trim(invite))
    )
  returning * into invite_row;

  if not found then
    raise exception 'Convite do app invalido ou expirado.';
  end if;

  return invite_row;
end;
$$;

alter table public.app_invites enable row level security;

drop policy if exists app_invites_select_own_or_admin on public.app_invites;
create policy app_invites_select_own_or_admin
on public.app_invites for select to authenticated
using (inviter_user_id = auth.uid() or accepted_user_id = auth.uid() or public.is_admin());

drop policy if exists app_invites_update_own_or_admin on public.app_invites;
create policy app_invites_update_own_or_admin
on public.app_invites for update to authenticated
using (inviter_user_id = auth.uid() or public.is_admin())
with check (inviter_user_id = auth.uid() or public.is_admin());

grant select, insert, update on public.app_invites to authenticated;
grant execute on function public.create_group(text, uuid, text) to authenticated;
grant execute on function public.create_group_invite(uuid, text) to authenticated;
grant execute on function public.regenerate_group_invite(uuid, text) to authenticated;
grant execute on function public.deactivate_group_invite(uuid) to authenticated;
grant execute on function public.create_app_invite(text, text) to authenticated;
grant execute on function public.revoke_app_invite(uuid) to authenticated;
grant execute on function public.accept_app_invite(text) to authenticated;
