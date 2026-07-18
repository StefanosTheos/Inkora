-- =====================================================================
-- 0047  NO DOUBLE-BOOKING at accept time
-- ---------------------------------------------------------------------
-- An artist can send offers to several clients for the same/overlapping slot.
-- respond_offer minted the appointment with no overlap check, so two clients
-- accepting overlapping offers both booked the artist at once. Two layers:
--   1. An exclusion constraint on appointments — race-proof: two concurrent
--      accepts can't both commit an overlapping active booking (the 2nd fails).
--   2. A friendly pre-check in respond_offer for the common sequential case, so
--      the client gets a clear "slot taken" message instead of a raw constraint
--      error.
--
-- Only ACTIVE bookings (scheduled/rescheduled) are constrained; cancelled /
-- completed / no-show don't block a slot. tstzrange is '[)' so back-to-back
-- appointments (end == next start) are allowed. If applying this errors on
-- existing overlapping ACTIVE appointments, cancel/reschedule one and re-run.
-- =====================================================================
set search_path = public, extensions;

create extension if not exists btree_gist with schema extensions;

do $$ begin
  alter table public.appointments
    add constraint appointments_no_overlap
    exclude using gist (
      artist_id with =,
      tstzrange(scheduled_start, scheduled_end) with &&
    ) where (status in ('scheduled', 'rescheduled'));
exception when duplicate_object then null; -- already added
end $$;

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

  -- Friendly guard: the artist may already have an active booking overlapping
  -- this slot (another client accepted first). The exclusion constraint below is
  -- the race-proof backstop; this gives a clean message in the common case.
  if exists (
    select 1 from public.appointments a
    where a.artist_id = v_offer.artist_id
      and a.status in ('scheduled', 'rescheduled')
      and tstzrange(a.scheduled_start, a.scheduled_end) && tstzrange(v_offer.proposed_start, v_offer.proposed_end)
  ) then
    raise exception 'That time was just booked. Ask the artist to propose another slot.';
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
    -- Lost a race with a simultaneous accept for the same slot.
    raise exception 'That time was just booked. Ask the artist to propose another slot.';
  end;

  update public.offers set status = 'accepted' where id = p_offer_id;
  update public.offers set status = 'declined'
    where request_id = v_req.id and id <> p_offer_id and status = 'pending';
  update public.appointment_requests set status = 'converted' where id = v_req.id;
  return v_appt;
end $$;
grant execute on function public.respond_offer(uuid, boolean) to authenticated;
