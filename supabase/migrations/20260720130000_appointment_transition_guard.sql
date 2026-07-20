-- =====================================================================
-- 0049  APPOINTMENT: enforce legal status transitions at the DB layer
-- ---------------------------------------------------------------------
-- The party-update RLS policy grants either participant a blanket `for update`
-- (RLS can't restrict columns), and the app's complete/cancel/no-show helpers
-- issued raw status updates with no current-status filter. So a terminal
-- booking could be moved again (cancel a completed one, complete a cancelled
-- one), and a client could PATCH `scheduled_start` directly, bypassing the
-- reschedule negotiation. This trigger enforces the invariants for EVERY write
-- path (RPC, direct client update, cron):
--   * terminal states (cancelled / completed / no_show) are final — no further
--     status change;
--   * the scheduled time can only move as part of a reschedule acceptance
--     (which sets status = 'rescheduled') — never a bare direct edit.
-- =====================================================================
set search_path = public, extensions;

create or replace function public.enforce_appointment_transition() returns trigger
language plpgsql set search_path = public as $$
begin
  -- Terminal states are final.
  if new.status is distinct from old.status
     and old.status in ('cancelled', 'completed', 'no_show') then
    raise exception 'This appointment is already %; its status can''t change.', old.status
      using errcode = 'check_violation';
  end if;

  -- Only a reschedule acceptance (status -> 'rescheduled') may move the time.
  if (new.scheduled_start is distinct from old.scheduled_start
      or new.scheduled_end is distinct from old.scheduled_end)
     and new.status is distinct from 'rescheduled' then
    raise exception 'The appointment time can only change through a reschedule.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists trg_enforce_appointment_transition on public.appointments;
create trigger trg_enforce_appointment_transition
  before update on public.appointments
  for each row execute function public.enforce_appointment_transition();
