-- =====================================================================
-- 0048  RESCHEDULE: don't let a pending reschedule un-complete a booking
-- ---------------------------------------------------------------------
-- A pending reschedule lives on reschedule_* until accepted, but nothing cleared
-- it when the appointment reached a terminal state (completed / cancelled /
-- no_show), and accept_reschedule never checked the status. So a booking that
-- completed (incl. via the auto-complete cron) with a reschedule still pending
-- could be "accepted", flipping status back to 'rescheduled' and jumping a
-- finished/reviewed session to a future time.
--
-- Fixes, defence-in-depth across every write path:
--   1. A BEFORE-UPDATE trigger clears reschedule_* whenever the row transitions
--      to a terminal status — covers the RPCs, direct client updates AND the cron.
--   2. accept_reschedule additionally refuses a closed appointment (like
--      propose_reschedule already does).
--   3. One-time backfill clears reschedule_* on already-terminal rows.
-- =====================================================================
set search_path = public, extensions;

-- 1) Clear any pending reschedule the moment an appointment closes.
create or replace function public.clear_reschedule_on_close() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status in ('cancelled', 'completed', 'no_show') and new.reschedule_status <> 'none' then
    new.reschedule_status := 'none';
    new.reschedule_start  := null;
    new.reschedule_end    := null;
    new.reschedule_by     := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_clear_reschedule_on_close on public.appointments;
create trigger trg_clear_reschedule_on_close
  before update on public.appointments
  for each row execute function public.clear_reschedule_on_close();

-- 2) accept_reschedule: refuse a closed appointment (belt-and-suspenders; the
--    trigger already ensures closed rows carry no pending reschedule). Otherwise
--    unchanged from migration 20260716220000 (still flips status -> 'rescheduled').
create or replace function public.accept_reschedule(p_appointment_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  a     public.appointments;
begin
  select * into a from appointments where id = p_appointment_id;
  if not found then raise exception 'appointment not found'; end if;
  if a.status in ('cancelled', 'completed', 'no_show') then
    raise exception 'appointment is closed' using errcode = 'check_violation';
  end if;
  if a.reschedule_status = 'none' then
    raise exception 'no pending reschedule' using errcode = 'check_violation';
  end if;
  if (a.reschedule_status = 'pending_client' and v_uid <> a.client_id)
     or (a.reschedule_status = 'pending_artist' and v_uid <> a.artist_id) then
    raise exception 'not your turn to respond' using errcode = 'check_violation';
  end if;

  update appointments set
    status            = 'rescheduled',
    scheduled_start   = a.reschedule_start,
    scheduled_end     = a.reschedule_end,
    reschedule_status = 'none',
    reschedule_start  = null,
    reschedule_end    = null,
    reschedule_by     = null
  where id = p_appointment_id;

  perform public.push_notification(
    a.reschedule_by, 'booking_update', 'Reschedule accepted',
    'Your proposed new time was confirmed.',
    'appointment', p_appointment_id,
    jsonb_build_object('appointmentId', p_appointment_id::text, 'kind', 'reschedule_accepted'));
end;
$$;
grant execute on function public.accept_reschedule(uuid) to authenticated;

-- 3) Backfill: clear stale pending reschedules on already-closed appointments.
update public.appointments
  set reschedule_status = 'none', reschedule_start = null, reschedule_end = null, reschedule_by = null
  where status in ('cancelled', 'completed', 'no_show') and reschedule_status <> 'none';
