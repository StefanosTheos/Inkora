-- =====================================================================
-- 0047  Reschedule/cancel deadline reminders
-- =====================================================================
-- Seekers can reschedule or cancel free of charge up to 4 days before an
-- appointment. On the last free day (i.e. when the booking is exactly 4 days
-- away) we drop an in-app notification reminding them. A daily pg_cron job
-- scans for appointments 4 days out and notifies each client once.
set search_path = public, extensions;

-- Insert one reminder per appointment that is exactly 4 days away and still
-- active. Idempotent: skips any appointment that already has a reminder, so
-- re-running the same day never double-notifies.
create or replace function public.notify_reschedule_deadlines()
returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_count int := 0;
  r record;
begin
  for r in
    select a.id, a.client_id
    from public.appointments a
    where a.status in ('scheduled', 'rescheduled')
      and a.scheduled_start::date = current_date + 4
      and not exists (
        select 1 from public.notifications n
        where n.entity_type = 'appointment'
          and n.entity_id = a.id
          and n.data->>'kind' = 'reschedule_deadline'
      )
  loop
    perform public.push_notification(
      r.client_id, 'booking_update',
      'Free reschedule ends today',
      'Your booking is in 4 days. If you want to reschedule or cancel your appointment without paying a fee, do it today.',
      'appointment', r.id,
      jsonb_build_object('kind', 'reschedule_deadline', 'appointmentId', r.id::text));
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Privileged only: runs from cron (as the function owner), never from clients.
revoke execute on function public.notify_reschedule_deadlines() from public, anon, authenticated;

-- Schedule it daily. pg_cron runs in UTC; 08:00 UTC is a reasonable morning
-- reminder across EU timezones.
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('reschedule-deadline-reminders');
exception when others then
  null; -- not scheduled yet
end $$;

select cron.schedule(
  'reschedule-deadline-reminders',
  '0 8 * * *',
  $cron$ select public.notify_reschedule_deadlines(); $cron$
);
