-- =====================================================================
-- 0039  AUTO-COMPLETE past appointments (unblocks reviews)
-- ---------------------------------------------------------------------
-- Previously an appointment only became 'completed' when the ARTIST tapped
-- "Mark completed". If they forgot, the booking stayed 'scheduled' forever:
-- it never left the seeker's Upcoming tab and the seeker could NEVER review
-- (review UI is gated on status = 'completed'). This flips past-due
-- appointments to 'completed' after a grace period.
--
-- The existing AFTER UPDATE trigger `trg_notify_appt_update` then fires with a
-- null actor (cron has no auth.uid()), so BOTH the client and the artist get an
-- "Appointment completed" notification deep-linked to the booking — prompting
-- each to leave their review. Reward / journey / style-affinity triggers fire
-- as they would for a manual completion.
-- =====================================================================

create or replace function public.auto_complete_appointments()
returns void
language sql
security definer
set search_path = public, extensions
as $$
  update public.appointments
  set status = 'completed', completed_at = now()
  where status in ('scheduled', 'rescheduled')
    and scheduled_end < now() - interval '12 hours';
$$;

-- Hourly so completions (and the review prompt) land promptly after a session.
-- If pg_cron isn't enabled yet, apply the function above first, enable the
-- pg_cron extension, then run this schedule statement.
select cron.schedule('auto-complete-appointments', '0 * * * *',
  $$ select public.auto_complete_appointments(); $$);
