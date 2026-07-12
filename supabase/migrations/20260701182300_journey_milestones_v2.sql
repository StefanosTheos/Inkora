-- =====================================================================
-- 0059  Journey milestones -> Post-session / 1 Week / 1 Month
-- =====================================================================
-- Replace the three healing milestones (week/month/year, +7/+30/+365 days)
-- with (post_session/week/month, +0/+7/+30 days): week and month keep their
-- offsets; year is dropped and a new post_session (day-of) milestone is added.
set search_path = public, extensions;

-- 1) Drop the removed 'year' milestones before swapping the constraint
--    (week/month stay valid and unchanged).
alter table public.journey_milestones drop constraint if exists journey_milestones_kind_check;
delete from public.journey_milestones where kind = 'year';
alter table public.journey_milestones
  add constraint journey_milestones_kind_check check (kind in ('post_session', 'week', 'month'));

-- 2) Create the three milestones on completion with the new kinds/offsets.
create or replace function public.trg_create_journey_milestones() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_date date;
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    v_date := coalesce(new.completed_at, now())::date;
    insert into public.journey_milestones (appointment_id, profile_id, kind, due_at)
    values
      (new.id, new.client_id, 'post_session', v_date),
      (new.id, new.client_id, 'week',         v_date + 7),
      (new.id, new.client_id, 'month',        v_date + 30)
    on conflict (appointment_id, kind) do nothing;
  end if;
  return new;
end $$;

-- 3) Order completed photos post_session -> week -> month when mirroring
--    them onto the review.
create or replace function public.sync_journey_completion(p_appointment_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid       uuid;
  v_review_id uuid;
  v_photos    text[];
  v_done      int;
begin
  select client_id into v_uid from public.appointments where id = p_appointment_id;
  if v_uid is null then return; end if;

  select id into v_review_id from public.reviews where appointment_id = p_appointment_id;

  select array_agg(photo_path order by case kind when 'post_session' then 1 when 'week' then 2 else 3 end)
    into v_photos
    from public.journey_milestones
   where appointment_id = p_appointment_id and completed_at is not null and photo_path is not null;

  if v_review_id is not null and v_photos is not null then
    update public.reviews set photo_paths = v_photos where id = v_review_id;
  end if;

  select count(*) into v_done from public.journey_milestones
   where appointment_id = p_appointment_id and completed_at is not null;
  if v_done >= 3 and v_review_id is not null then
    perform public.award_points(v_uid, 'journey_completed', 100, 'appointment', p_appointment_id,
      'journey_completed:' || p_appointment_id::text);
  end if;
end $$;

-- 4) Reminder wording for the new milestones.
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
    v_label := case r.kind when 'post_session' then 'post-session' when 'week' then '1-week' else '1-month' end;
    perform public.push_notification(
      r.profile_id, 'journey', 'Add your ' || v_label || ' photo',
      'Add a progress photo to your tattoo journey and earn points.',
      'appointment', r.appointment_id,
      jsonb_build_object('kind', r.kind, 'milestoneId', r.id::text));
    update public.journey_milestones set reminded_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke execute on function public.notify_journey_milestones() from public, anon, authenticated;

-- 5) Backfill any missing milestones (notably post_session) for completed
--    appointments.
insert into public.journey_milestones (appointment_id, profile_id, kind, due_at)
select a.id, a.client_id, k.kind, (coalesce(a.completed_at, a.scheduled_end)::date + k.days)
from public.appointments a
cross join (values ('post_session', 0), ('week', 7), ('month', 30)) as k(kind, days)
where a.status = 'completed'
on conflict (appointment_id, kind) do nothing;
