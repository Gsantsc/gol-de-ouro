-- PWA RUNTIME CRASH FIX / REAL MATCH TIME NORMALIZATION / LEAGUE EXCLUSIVE INVITES

alter table public.matches
  add column if not exists start_time_utc timestamptz,
  add column if not exists timezone_source text not null default 'utc',
  add column if not exists venue_timezone text,
  add column if not exists display_time_br text;

update public.matches
set
  start_time_utc = start_time,
  timezone_source = coalesce(nullif(timezone_source, ''), 'utc'),
  display_time_br = to_char(start_time at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI')
where start_time_utc is null
  or display_time_br is null;

update public.matches
set
  start_time = '2026-06-11T19:00:00.000Z'::timestamptz,
  start_time_utc = '2026-06-11T19:00:00.000Z'::timestamptz,
  prediction_open_at = '2026-06-10T19:00:00.000Z'::timestamptz,
  prediction_close_at = '2026-06-11T18:00:00.000Z'::timestamptz,
  venue_timezone = 'America/Mexico_City',
  timezone_source = 'manual_verified',
  display_time_br = to_char('2026-06-11T19:00:00.000Z'::timestamptz at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI')
where provider_external_id = 'static-wc2026-mexico-south-africa'
  and provider_name = 'static-wc2026';

update public.matches
set
  start_time = '2026-06-12T02:00:00.000Z'::timestamptz,
  start_time_utc = '2026-06-12T02:00:00.000Z'::timestamptz,
  prediction_open_at = '2026-06-11T02:00:00.000Z'::timestamptz,
  prediction_close_at = '2026-06-12T01:00:00.000Z'::timestamptz,
  venue_timezone = 'America/Mexico_City',
  timezone_source = 'manual_verified',
  display_time_br = to_char('2026-06-12T02:00:00.000Z'::timestamptz at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI')
where provider_external_id = 'static-wc2026-korea-republic-czechia'
  and provider_name = 'static-wc2026';

alter table public.players
  add column if not exists team_id uuid references public.teams (id) on delete set null,
  add column if not exists source_updated_at timestamptz;

update public.players
set source_updated_at = coalesce(source_updated_at, updated_at, now())
where source_updated_at is null;

create index if not exists players_team_id_idx on public.players (team_id) where deleted_at is null and team_id is not null;
create index if not exists players_source_updated_at_idx on public.players (source_updated_at) where deleted_at is null;

alter table public.group_invites
  add column if not exists max_uses integer check (max_uses is null or max_uses > 0),
  add column if not exists used_count integer not null default 0;

create index if not exists group_invites_active_token_idx
  on public.group_invites (invite_token)
  where invite_active = true and revoked_at is null;

create or replace function public.join_group_by_invite(invite text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_group_id uuid;
  target_group public.groups%rowtype;
  target_invite_id uuid;
  candidate text := public.extract_invite_value(invite);
  raw_invite text := trim(invite);
  was_member_before boolean;
begin
  if not exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.deleted_at is null
      and coalesce(u.blocked, false) = false
      and u.approval_status in ('pending', 'approved')
      and coalesce(u.status, u.approval_status::text) in ('pending', 'approved')
  ) then
    raise exception 'Usuario precisa ter cadastro valido para entrar em grupos.';
  end if;

  select g.id, gi.id
  into matched_group_id, target_invite_id
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

  if not found then
    raise exception 'Convite invalido ou expirado.';
  end if;

  select *
  into target_group
  from public.groups
  where id = matched_group_id;

  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group.id
      and gm.user_id = auth.uid()
      and gm.deleted_at is null
  )
  into was_member_before;

  insert into public.group_members (group_id, user_id, role)
  values (target_group.id, auth.uid(), 'member')
  on conflict (group_id, user_id) where deleted_at is null do nothing;

  if target_invite_id is not null and not was_member_before then
    update public.group_invites
    set used_count = used_count + 1
    where id = target_invite_id;
  end if;

  perform public.touch_user_activity(auth.uid());
  perform public.evaluate_user_achievements(auth.uid());
  return target_group;
end;
$$;

grant execute on function public.join_group_by_invite(text) to authenticated;
