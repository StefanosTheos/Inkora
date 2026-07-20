-- =====================================================================
-- 0052  NO CLIENT DOUBLE-BOOKING (symmetric to the artist guard #38)
-- ---------------------------------------------------------------------
-- appointments_no_overlap only stops an ARTIST being double-booked, and
-- respond_offer only pre-checked the artist — so a client could accept two
-- overlapping offers from different artists and end up booked twice at once.
-- Add the symmetric client-side exclusion constraint + a friendly client-overlap
-- pre-check in respond_offer.
--
-- The constraint can't be added while overlaps already exist (the demo seed
-- gives one client several bookings at the same time across artists), so we
-- first auto-cancel the later booking of each overlapping pair, keeping the
-- earliest per client. tstzrange is '[)' so back-to-back stays allowed.
-- =====================================================================
set search_path = public, extensions;

create extension if not exists btree_gist with schema extensions;

-- 1) Resolve pre-existing client overlaps: cancel any active booking that
--    overlaps an EARLIER active booking of the same client (keep the earliest).
update public.appointments a
set status = 'cancelled', cancelled_at = now(),
    cancellation_reason = coalesce(a.cancellation_reason, 'Auto-resolved: overlapping booking'),
    reschedule_status = 'none', reschedule_start = null, reschedule_end = null, reschedule_by = null
where a.status in ('scheduled', 'rescheduled')
  and exists (
    select 1 from public.appointments b
    where b.client_id = a.client_id
      and b.id <> a.id
      and b.status in ('scheduled', 'rescheduled')
      and tstzrange(b.scheduled_start, b.scheduled_end) && tstzrange(a.scheduled_start, a.scheduled_end)
      and (b.created_at < a.created_at or (b.created_at = a.created_at and b.id < a.id))
  );

-- 2) Symmetric exclusion constraint on the client (active bookings only).
do $$ begin
  alter table public.appointments
    add constraint appointments_client_no_overlap
    exclude using gist (
      client_id with =,
      tstzrange(scheduled_start, scheduled_end) with &&
    ) where (status in ('scheduled', 'rescheduled'));
exception when duplicate_object then null; -- already added
end $$;

-- 3) respond_offer: add a friendly client-overlap pre-check (mirrors the artist
--    one); the exclusion constraint remains the race-proof backstop for both.
create or replace function public.respond_offer(p_offer_id uuid, p_accept boolean)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_offer public.offers%rowtype;
  v_req   public.appointment_requests%rowtype;
  v_appt  uuid;
begin
  select * into v_offer from public.offers where id = p_offer_id;
  if not found then raise exception 'offer_not_found'; end if;
  select * into v_req from public.appointment_requests where id = v_offer.request_id;
  if v_req.client_id <> auth.uid() then raise exception 'not_authorized'; end if;
  if v_offer.status <> 'pending' then raise exception 'offer_not_pending'; end if;
  if v_offer.expires_at is not null and v_offer.expires_at < now() then
    update public.offers set status = 'expired' where id = p_offer_id;
    raise exception 'offer_expired';
  end if;

  if not p_accept then
    update public.offers set status = 'declined' where id = p_offer_id;
    perform public.push_notification(v_offer.artist_id, 'booking_update', 'Offer declined',
      'A client declined your offer', 'appointment_request', v_req.id,
      jsonb_build_object('requestId', v_req.id::text));
    return null;
  end if;

  if v_offer.proposed_start is null or v_offer.proposed_end is null then
    raise exception 'offer_missing_time';
  end if;

  -- Friendly guard: the artist already has an overlapping active booking.
  if exists (
    select 1 from public.appointments a
    where a.artist_id = v_offer.artist_id
      and a.status in ('scheduled', 'rescheduled')
      and tstzrange(a.scheduled_start, a.scheduled_end) && tstzrange(v_offer.proposed_start, v_offer.proposed_end)
  ) then
    raise exception 'That time was just booked. Ask the artist to propose another slot.';
  end if;

  -- Friendly guard: YOU already have an overlapping active booking (accepting a
  -- second artist's offer for the same slot).
  if exists (
    select 1 from public.appointments a
    where a.client_id = v_req.client_id
      and a.status in ('scheduled', 'rescheduled')
      and tstzrange(a.scheduled_start, a.scheduled_end) && tstzrange(v_offer.proposed_start, v_offer.proposed_end)
  ) then
    raise exception 'You already have a booking at that time. Decline it first or pick another slot.';
  end if;

  begin
    insert into public.appointments (
      request_id, offer_id, client_id, artist_id, studio_id,
      scheduled_start, scheduled_end, price_amount, deposit_amount)
    values (
      v_req.id, v_offer.id, v_req.client_id, v_offer.artist_id, v_req.studio_id,
      v_offer.proposed_start, v_offer.proposed_end, v_offer.price_amount, v_offer.deposit_amount)
    returning id into v_appt;
  exception when exclusion_violation then
    -- Lost a race (either party) with a simultaneous accept for the same slot.
    raise exception 'That time overlaps an existing booking — pick another slot.';
  end;

  update public.offers set status = 'accepted' where id = p_offer_id;
  update public.offers set status = 'declined'
    where request_id = v_req.id and id <> p_offer_id and status = 'pending';
  update public.appointment_requests set status = 'converted' where id = v_req.id;
  return v_appt;
end $$;
grant execute on function public.respond_offer(uuid, boolean) to authenticated;
