-- QA FIX
-- SECURITY DEFINER makes current_user equal to the function owner, so user edits
-- must rely on JWT role/admin checks rather than current_user.

create or replace function public.protect_locked_prediction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_match public.matches%rowtype;
  elevated boolean :=
    coalesce(auth.role(), '') = 'service_role'
    or public.is_admin();
  score_changed boolean;
begin
  if tg_op = 'DELETE' then
    if elevated then
      return old;
    end if;

    raise exception 'Palpites não podem ser excluídos.';
  end if;

  if old.user_id <> new.user_id or old.match_id <> new.match_id then
    raise exception 'Usuário e partida do palpite não podem ser alterados.';
  end if;

  score_changed :=
    old.predicted_home_score is distinct from new.predicted_home_score
    or old.predicted_away_score is distinct from new.predicted_away_score;

  if score_changed then
    if elevated then
      return new;
    end if;

    if old.user_id <> auth.uid() or not public.is_approved_user() then
      raise exception 'Apenas o dono aprovado pode editar o palpite.';
    end if;

    select *
    into target_match
    from public.matches
    where id = old.match_id
      and deleted_at is null;

    if not found
      or target_match.status in ('ao_vivo', 'encerrado')
      or now() < target_match.prediction_open_at
      or now() >= target_match.prediction_close_at then
      raise exception 'A janela de edição deste palpite está fechada.';
    end if;

    new.locked := false;
    new.submitted_at := now();
    new.points := 0;
    return new;
  end if;

  if old.points is distinct from new.points
    or old.locked is distinct from new.locked
    or old.submitted_at is distinct from new.submitted_at then
    if elevated then
      return new;
    end if;

    raise exception 'Campos internos do palpite não podem ser alterados.';
  end if;

  return new;
end;
$$;

create or replace function public.refresh_match_statuses()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
  elevated boolean :=
    coalesce(auth.role(), '') = 'service_role'
    or current_user in ('postgres', 'supabase_admin')
    or public.is_admin();
begin
  if not elevated then
    raise exception 'Apenas administradores podem atualizar status das partidas.';
  end if;

  update public.matches
  set
    prediction_open_at = start_time - interval '24 hours',
    prediction_close_at = start_time - interval '1 hour',
    status = case
      when now() < start_time - interval '24 hours' then 'fechado'::public.match_status
      when now() < start_time - interval '1 hour' then 'aberto'::public.match_status
      else 'ao_vivo'::public.match_status
    end
  where deleted_at is null
    and status <> 'encerrado'
    and (
      prediction_open_at is distinct from start_time - interval '24 hours'
      or prediction_close_at is distinct from start_time - interval '1 hour'
      or status is distinct from case
        when now() < start_time - interval '24 hours' then 'fechado'::public.match_status
        when now() < start_time - interval '1 hour' then 'aberto'::public.match_status
        else 'ao_vivo'::public.match_status
      end
    );

  get diagnostics updated_count = row_count;

  if coalesce(auth.role(), '') = 'service_role' or public.is_admin() then
    update public.predictions p
    set locked = true
    from public.matches m
    where p.match_id = m.id
      and p.locked = false
      and (
        m.status in ('ao_vivo', 'encerrado')
        or now() >= m.prediction_close_at
      );
  end if;

  return updated_count;
end;
$$;
