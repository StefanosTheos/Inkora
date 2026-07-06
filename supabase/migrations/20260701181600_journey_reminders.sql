-- =====================================================================
-- 0052  Journey milestone reminders (daily)
-- =====================================================================
-- Notify seekers when a healing milestone is due (1 week / 1 month / 1 year
-- after the session) so they add their progress photo and earn points. Each
-- milestone is reminded once. The 'journey' notification lights the bell, the
-- profile-tab dot and the "Your tattoo journey" section badge.
set search_path = public, extensions;

create or replace function public.notify_journey_milestones()
returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_count int := 0;
  r record;
  v_label text;
begin
  for r in
    select m.id, m.appointment_id, m.profile_id, m.kind
    from public.journey_milestones m
    where m.completed_at is null and m.reminded_at is null and m.due_at <= current_date
  loop
    v_label := case r.kind when 'week' then '1 week' when 'month' then '1 month' else '1 year' end;
    perform public.push_notification(
      r.profile_id, 'journey', 'Add your ' || v_label || ' photo',
      'Your tattoo has been healing for ' || v_label || '. Add a progress photo to your review and earn points.',
      'appointment', r.appointment_id,
      jsonb_build_object('kind', r.kind, 'milestoneId', r.id::text));
    update public.journey_milestones set reminded_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

revoke execute on function public.notify_journey_milestones() from public, anon, authenticated;

create extension if not exists pg_cron;
do $$
begin
  perform cron.unschedule('journey-milestone-reminders');
exception when others then
  null;
end $$;
select cron.schedule(
  'journey-milestone-reminders',
  '0 9 * * *',
  $cron$ select public.notify_journey_milestones(); $cron$
);
