-- Fix ambiguous group_id references in accept_group_invite after Beta invite rollout.

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
  from public.groups g
  where g.id = resolved.group_id
    and g.deleted_at is null
    and g.closed_at is null;

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

grant execute on function public.accept_group_invite(text) to authenticated;
