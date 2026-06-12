grant select, insert, update, delete on public.match_sync_queue to authenticated;
grant select, insert, update, delete on public.match_sync_queue to service_role;

notify pgrst, 'reload schema';
