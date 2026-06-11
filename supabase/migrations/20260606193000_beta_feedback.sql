-- BETA FEEDBACK SYSTEM
create table if not exists public.app_feedback (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null check (type in ('problem', 'suggestion')),
  description text not null check (
    char_length(trim(description)) >= 8
    and char_length(trim(description)) <= 2000
  ),
  app_version text,
  app_env text not null default 'beta',
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  admin_comment text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_feedback_user_idx on public.app_feedback (user_id, created_at desc);
create index if not exists app_feedback_status_idx on public.app_feedback (status, created_at desc);

drop trigger if exists app_feedback_touch_updated_at on public.app_feedback;
create trigger app_feedback_touch_updated_at
before update on public.app_feedback
for each row execute function public.touch_updated_at();

alter table public.app_feedback enable row level security;

drop policy if exists app_feedback_select_own_or_admin on public.app_feedback;
create policy app_feedback_select_own_or_admin
on public.app_feedback for select to authenticated
using (public.is_admin() or user_id = auth.uid());

drop policy if exists app_feedback_insert_own_approved on public.app_feedback;
create policy app_feedback_insert_own_approved
on public.app_feedback for insert to authenticated
with check (public.is_approved_user() and user_id = auth.uid());

drop policy if exists app_feedback_update_admin on public.app_feedback;
create policy app_feedback_update_admin
on public.app_feedback for update to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update on public.app_feedback to authenticated;

create or replace function public.log_app_feedback_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (
    new.user_id,
    'beta_feedback_created',
    'app_feedback',
    new.id,
    jsonb_build_object(
      'type', new.type,
      'status', new.status,
      'app_env', new.app_env,
      'app_version', new.app_version
    )
  );

  return new;
end;
$$;

drop trigger if exists app_feedback_audit_insert on public.app_feedback;
create trigger app_feedback_audit_insert
after insert on public.app_feedback
for each row execute function public.log_app_feedback_created();

do $$
begin
  alter publication supabase_realtime add table public.app_feedback;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
