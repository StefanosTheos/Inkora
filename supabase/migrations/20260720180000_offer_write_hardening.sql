-- =====================================================================
-- 0054  OFFERS: lock down who may create one (security)
-- ---------------------------------------------------------------------
-- offer_artist_write only checked `artist_id = auth.uid()` — no artist role and
-- no tie to the request's assigned artist. So ANY authenticated user could
-- directly insert an offer (as themselves) onto anyone's request and, if the
-- client accepted it, be minted as the appointment's artist. #44 routed the
-- app's createOffer through a guarded RPC, but the RLS still allowed a raw
-- insert. Two changes close it:
--   1. The insert policy now also requires the caller to hold the `artist` role
--      AND be the request's assigned artist (mirrors the create_offer RPC).
--   2. respond_offer refuses an offer whose artist_id doesn't match the request's
--      assigned artist — defence-in-depth for any pre-existing mismatched rows.
-- =====================================================================
set search_path = public, extensions;

-- 1) Tighten the direct-write policy. Artists can still read/withdraw their own
--    offers (using), but may only WRITE an offer on a request assigned to them.
drop policy if exists offer_artist_write on public.offers;
create policy offer_artist_write on public.offers for all
  using (artist_id = auth.uid())
  with check (
    artist_id = auth.uid()
    and public.has_role('artist')
    and exists (
      select 1 from public.appointment_requests r
      where r.id = request_id and r.artist_id = auth.uid()
    )
  );

-- 2) respond_offer: reject an artist/request mismatch (keeps every guard from
--    migration 20260720160000; adds the offer.artist_id = request.artist_id check).
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
  if v_offer.artist_id <> v_req.artist_id then raise exception 'offer_artist_mismatch'; end if;
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

  -- Friendly guard: YOU already have an overlapping active booking.
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
    raise exception 'That time overlaps an existing booking — pick another slot.';
  end;

  update public.offers set status = 'accepted' where id = p_offer_id;
  update public.offers set status = 'declined'
    where request_id = v_req.id and id <> p_offer_id and status = 'pending';
  update public.appointment_requests set status = 'converted' where id = v_req.id;
  return v_appt;
end $$;
grant execute on function public.respond_offer(uuid, boolean) to authenticated;
