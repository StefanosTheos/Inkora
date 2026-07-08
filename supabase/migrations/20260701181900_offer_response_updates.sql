-- =====================================================================
-- 0055  Offer responses: close the request + notify the artist
-- =====================================================================
-- When a client responds to an artist's offer, the artist needs to see it
-- reflected on their Booking requests page and get a badge:
--   * Decline — move the request to 'declined' (so it leaves "Waiting on
--     client" and the card reads "Offer declined") and notify the artist.
--   * Accept  — also drop an offer-response notification on the request so the
--     Booking requests badge lights up (the appointment trigger already sends a
--     separate "Appointment booked" notification for the new appointment).
-- Both notifications use entity_type 'appointment_request' so the badge/clearing
-- logic can tell them apart from appointment updates.
set search_path = public, extensions;

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
    -- Close the request so the artist's page shows it as declined, not waiting.
    update public.appointment_requests set status = 'declined' where id = v_req.id;
    perform public.push_notification(v_offer.artist_id, 'booking_update', 'Offer declined',
      'A client declined your offer', 'appointment_request', v_req.id,
      jsonb_build_object('requestId', v_req.id::text));
    return null;
  end if;

  if v_offer.proposed_start is null or v_offer.proposed_end is null then
    raise exception 'offer_missing_time';
  end if;

  insert into public.appointments (
    request_id, offer_id, client_id, artist_id, studio_id,
    scheduled_start, scheduled_end, price_amount, deposit_amount)
  values (
    v_req.id, v_offer.id, v_req.client_id, v_offer.artist_id, v_req.studio_id,
    v_offer.proposed_start, v_offer.proposed_end, v_offer.price_amount, v_offer.deposit_amount)
  returning id into v_appt;

  update public.offers set status = 'accepted' where id = p_offer_id;
  update public.offers set status = 'declined'
    where request_id = v_req.id and id <> p_offer_id and status = 'pending';
  update public.appointment_requests set status = 'converted' where id = v_req.id;
  -- Light the artist's Booking requests badge on accept too (the appointment
  -- trigger separately notifies them about the new appointment).
  perform public.push_notification(v_offer.artist_id, 'booking_update', 'Offer accepted',
    'A client accepted your offer', 'appointment_request', v_req.id,
    jsonb_build_object('requestId', v_req.id::text));
  return v_appt;
end $$;
grant execute on function public.respond_offer(uuid, boolean) to authenticated;
