-- =====================================================================
-- 0051  Tattoo journey milestones (1 week / 1 month / 1 year healing photos)
-- =====================================================================
-- Each completed appointment spawns three milestones. The seeker uploads a
-- healing photo at each; photos live in a public bucket and are mirrored onto
-- the appointment's review (public) so they show on the review. Completing a
-- milestone earns points; finishing all three with a review earns a bonus.
set search_path = public, extensions;

-- ---- public bucket for journey photos (mirrored onto public reviews) ------
insert into storage.buckets (id, name, public) values ('journey-photos', 'journey-photos', true)
on conflict (id) do nothing;

-- path convention: <profileId>/<appointmentId>/<file>. Owner writes; world reads.
drop policy if exists journey_photos_write  on storage.objects;
drop policy if exists journey_photos_modify on storage.objects;
drop policy if exists journey_photos_read   on storage.objects;
create policy journey_photos_read on storage.objects for select using (bucket_id = 'journey-photos');
create policy journey_photos_write on storage.objects for insert
  with check (bucket_id = 'journey-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy journey_photos_modify on storage.objects for update
  using (bucket_id = 'journey-photos' and owner = auth.uid());

-- ---- milestones table -----------------------------------------------------
create table if not exists public.journey_milestones (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  kind           text not null check (kind in ('week', 'month', 'year')),
  due_at         date not null,
  photo_path     text,
  completed_at   timestamptz,
  reminded_at    timestamptz,
  created_at     timestamptz not null default now(),
  unique (appointment_id, kind)
);
create index if not exists idx_journey_ms_due on public.journey_milestones (due_at) where completed_at is null;
create index if not exists idx_journey_ms_profile on public.journey_milestones (profile_id);

alter table public.journey_milestones enable row level security;
-- Owner reads their own; all writes flow through the SECURITY DEFINER RPCs.
drop policy if exists jm_owner_read on public.journey_milestones;
create policy jm_owner_read on public.journey_milestones for select using (profile_id = auth.uid());

-- ---- create 3 milestones when an appointment completes --------------------
create or replace function public.trg_create_journey_milestones() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_date date;
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    v_date := coalesce(new.completed_at, now())::date;
    insert into public.journey_milestones (appointment_id, profile_id, kind, due_at)
    values
      (new.id, new.client_id, 'week',  v_date + 7),
      (new.id, new.client_id, 'month', v_date + 30),
      (new.id, new.client_id, 'year',  v_date + 365)
    on conflict (appointment_id, kind) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists create_journey_milestones on public.appointments;
create trigger create_journey_milestones after insert or update on public.appointments
  for each row execute function public.trg_create_journey_milestones();

-- ---- mirror completed photos onto the review + award completion bonus ------
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

  -- completed milestone photos in healing order (week → month → year)
  select array_agg(photo_path order by case kind when 'week' then 1 when 'month' then 2 else 3 end)
    into v_photos
    from public.journey_milestones
   where appointment_id = p_appointment_id and completed_at is not null and photo_path is not null;

  if v_review_id is not null and v_photos is not null then
    update public.reviews set photo_paths = v_photos where id = v_review_id;
  end if;

  select count(*) into v_done from public.journey_milestones
   where appointment_id = p_appointment_id and completed_at is not null;
  -- full journey = all three healing photos AND a review (idempotent bonus)
  if v_done >= 3 and v_review_id is not null then
    perform public.award_points(v_uid, 'journey_completed', 100, 'appointment', p_appointment_id,
      'journey_completed:' || p_appointment_id::text);
  end if;
end $$;

-- ---- seeker uploads a milestone photo -------------------------------------
create or replace function public.complete_journey_milestone(
  p_appointment_id uuid, p_kind text, p_photo_path text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_milestone_id uuid;
begin
  select client_id into v_owner from public.appointments where id = p_appointment_id;
  if v_owner is null or v_owner is distinct from v_uid then
    raise exception 'Not your appointment' using errcode = '42501';
  end if;

  update public.journey_milestones
     set photo_path = p_photo_path, completed_at = coalesce(completed_at, now())
   where appointment_id = p_appointment_id and kind = p_kind and profile_id = v_uid
   returning id into v_milestone_id;
  if v_milestone_id is null then
    raise exception 'Milestone not found' using errcode = 'P0002';
  end if;

  -- points for the photo (idempotent per milestone)
  perform public.award_points(v_uid, 'journey_milestone', 20, 'journey_milestone', v_milestone_id,
    'journey_ms:' || v_milestone_id::text);

  -- clear this milestone's reminder badge
  update public.notifications set read_at = now()
   where recipient_id = v_uid and type = 'journey'
     and entity_type = 'appointment' and entity_id = p_appointment_id
     and (data->>'kind') = p_kind and read_at is null;

  perform public.sync_journey_completion(p_appointment_id);
end $$;

grant execute on function public.complete_journey_milestone(uuid, text, text) to authenticated;

-- ---- when a review is posted, mirror any already-uploaded photos + bonus ---
create or replace function public.trg_review_sync_journey() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.sync_journey_completion(new.appointment_id);
  return new;
end $$;
drop trigger if exists review_sync_journey on public.reviews;
create trigger review_sync_journey after insert on public.reviews
  for each row execute function public.trg_review_sync_journey();

-- Backfill milestones for appointments that are already completed.
insert into public.journey_milestones (appointment_id, profile_id, kind, due_at)
select a.id, a.client_id, k.kind, (coalesce(a.completed_at, a.scheduled_end)::date + k.days)
from public.appointments a
cross join (values ('week', 7), ('month', 30), ('year', 365)) as k(kind, days)
where a.status = 'completed'
on conflict (appointment_id, kind) do nothing;
