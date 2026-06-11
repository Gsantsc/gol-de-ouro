-- Fix approval trigger to prevent status override during admin approval
-- The trigger was resetting status based on approval_status even when explicitly set by approve_user

create or replace function public.sync_user_status_fields()
returns trigger
language plpgsql
as $$
begin
  -- If status is explicitly being set to approved by admin action, preserve it
  if tg_op = 'UPDATE' and new.status = 'approved' and old.status <> 'approved' then
    new.approval_status := 'approved';
    new.blocked := false;
    new.rejection_reason := null;
    new.approved_at := coalesce(new.approved_at, now());
    new.last_activity_at := coalesce(new.last_activity_at, now());
    new.updated_at := now();
    return new;
  end if;

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
    new.rejection_reason := null;
    new.approved_at := coalesce(new.approved_at, now());
  elsif new.status = 'rejected' then
    new.approval_status := 'rejected';
    new.blocked := false;
  elsif new.status = 'pending' then
    new.approval_status := 'pending';
    new.blocked := false;
    new.approved_at := null;
    new.approved_by := null;
  elsif new.blocked = true then
    new.status := 'suspended';
  else
    new.status := new.approval_status::text;
  end if;

  new.last_activity_at := coalesce(new.last_activity_at, now());
  new.updated_at := now();
  return new;
end;
$$;
