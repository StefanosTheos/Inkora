-- =====================================================================
-- 0058  Close notification gaps so both parties hear about every change
-- =====================================================================
-- Already covered elsewhere: new request -> artist; offer sent -> client;
-- offer accepted/declined -> artist; request declined -> client; every
-- appointment change (booked/confirmed/rescheduled/cancelled/completed) ->
-- the non-acting party. The two remaining gaps:
--   * Artist withdraws an offer  -> notify the client.
--   * Client cancels a request   -> notify the artist.
set search_path = public, extensions;

-- Request status changes: notify the client on decline (existing) AND the
-- artist on cancellation (new).
create or replace function public.trg_notify_request_update() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare actor uuid := auth.uid();
begin
  if new.status is distinct from old.status then
    if new.status = 'declined' and actor is distinct from new.client_id then
      perform public.push_notification(
        new.client_id, 'booking_update', 'Request declined',
        'An artist can''t take this on right now', 'appointment_request', new.id,
        jsonb_build_object('requestId', new.id::text));
    elsif new.status = 'cancelled' and actor is distinct from new.artist_id then
      perform public.push_notification(
        new.artist_id, 'booking_update', 'Request cancelled',
        'A client cancelled their booking request', 'appointment_request', new.id,
        jsonb_build_object('requestId', new.id::text));
    end if;
  end if;
  return new;
end $$;

-- Offer status changes: notify the client when the artist withdraws an offer.
-- (Accept/decline set 'accepted'/'declined' and are notified by respond_offer,
--  so only 'withdrawn' fires here.)
create or replace function public.trg_notify_offer_update() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_client uuid;
begin
  if new.status is distinct from old.status and new.status = 'withdrawn' then
    select client_id into v_client from public.appointment_requests where id = new.request_id;
    if v_client is not null and auth.uid() is distinct from v_client then
      perform public.push_notification(
        v_client, 'booking_update', 'Offer withdrawn',
        'The artist withdrew their offer', 'appointment_request', new.request_id,
        jsonb_build_object('requestId', new.request_id::text));
    end if;
  end if;
  return new;
end $$;

drop trigger if exists notify_offer_update on public.offers;
create trigger notify_offer_update after update on public.offers
  for each row execute function public.trg_notify_offer_update();
