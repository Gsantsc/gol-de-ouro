create table if not exists public.match_sync_queue (
  id uuid primary key default extensions.gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  provider text not null,
  last_sync_at timestamptz,
  sync_status text not null default 'pending' check (sync_status in ('pending', 'idle', 'syncing', 'success', 'failed', 'disabled')),
  next_sync_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, provider)
);

create index if not exists match_sync_queue_due_idx
  on public.match_sync_queue (provider, sync_status, next_sync_at);

create index if not exists match_sync_queue_match_idx
  on public.match_sync_queue (match_id);

drop trigger if exists match_sync_queue_touch_updated_at on public.match_sync_queue;
create trigger match_sync_queue_touch_updated_at
before update on public.match_sync_queue
for each row execute function public.touch_updated_at();

alter table public.match_sync_queue enable row level security;

drop policy if exists "Admins can read match sync queue" on public.match_sync_queue;
create policy "Admins can read match sync queue"
  on public.match_sync_queue
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can write match sync queue" on public.match_sync_queue;
create policy "Admins can write match sync queue"
  on public.match_sync_queue
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
