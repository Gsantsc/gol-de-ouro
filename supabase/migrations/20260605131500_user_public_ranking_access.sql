drop policy if exists rankings_select_approved_or_admin on public.rankings;

create policy rankings_select_approved_or_admin
on public.rankings
for select
to authenticated
using (
  public.is_admin()
  or public.is_approved_user()
);

create or replace function public.list_public_user_profiles()
returns table (
  id uuid,
  name text
)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.name
  from public.users u
  where u.status = 'approved'
    and u.blocked = false
    and u.deleted_at is null
    and (public.is_admin() or public.is_approved_user())
  order by u.name;
$$;

revoke all on function public.list_public_user_profiles() from public;
grant execute on function public.list_public_user_profiles() to authenticated;
