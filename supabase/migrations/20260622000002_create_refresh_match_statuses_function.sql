-- Create refresh_match_statuses RPC function
-- This function updates match statuses based on current time and match data

-- Drop existing function first to avoid return type conflict
drop function if exists public.refresh_match_statuses();

create function public.refresh_match_statuses()
returns table (
  updated_count bigint,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  match_record record;
  now_time timestamp with time zone;
  match_start timestamp with time zone;
  match_end timestamp with time zone;
  new_status text;
  updated_count bigint := 0;
begin
  now_time := now();
  
  for match_record in 
    select id, start_time, status, prediction_close_at
    from public.matches
    where deleted_at is null
      and status <> 'encerrado'
  loop
    match_start := match_record.start_time at time zone 'UTC';
    match_end := match_start + interval '180 minutes';
    
    -- Determine new status based on time and current status
    if match_record.status = 'ao_vivo' then
      -- Check if match is still within live window
      if now_time < match_start or now_time > match_end then
        -- Match is outside live window, change to aguardando
        update public.matches
        set status = 'aguardando'
        where id = match_record.id;
        updated_count := updated_count + 1;
      end if;
    elsif match_record.status = 'aguardando' or match_record.status = 'aberto' or match_record.status = 'fechado' then
      -- Check if match should be ao_vivo
      if now_time >= match_start and now_time <= match_end then
        update public.matches
        set status = 'ao_vivo'
        where id = match_record.id;
        updated_count := updated_count + 1;
      elsif now_time > match_end then
        -- Match is past live window, keep as aguardando
        update public.matches
        set status = 'aguardando'
        where id = match_record.id;
        updated_count := updated_count + 1;
      end if;
    end if;
  end loop;
  
  return query select updated_count, 'success'::text;
end;
$$;
