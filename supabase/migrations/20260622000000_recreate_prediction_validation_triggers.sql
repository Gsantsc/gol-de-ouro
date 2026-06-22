-- Recreate prediction validation triggers to ensure they use the latest function versions
-- This fixes the issue where triggers were not updated after function changes

-- Drop existing triggers
drop trigger if exists predictions_validate_insert on public.predictions;
drop trigger if exists predictions_protect_update on public.predictions;
drop trigger if exists predictions_protect_delete on public.predictions;

-- Recreate triggers with latest function versions
create trigger predictions_validate_insert
before insert on public.predictions
for each row execute function public.ensure_prediction_submission();

create trigger predictions_protect_update
before update on public.predictions
for each row execute function public.protect_locked_prediction();

create trigger predictions_protect_delete
before delete on public.predictions
for each row execute function public.protect_locked_prediction();
