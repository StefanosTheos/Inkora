-- =====================================================================
-- 0040  EXPIRE stale offers & requests
-- ---------------------------------------------------------------------
-- Two dead-ends this fixes:
--   * An offer stayed 'pending' (and "Accept"-able) forever — even after its
--     proposed slot had passed. `respond_offer` already refuses an expired
--     offer, but nothing ever flipped the status, so the client kept seeing a
--     live Accept button on a dead offer.
--   * A request the artist never answered left the seeker stuck on "Pending"
--     with no timeout and no nudge to try someone else.
--
-- New offers carry an `expires_at` (set client-side: 7 days, capped at the
-- proposed start). These sweepers make the transition real and notify the
-- affected parties. Legacy offers with a null expires_at are still expired once
-- their proposed slot passes.
-- =====================================================================
set search_path = public, extensions;

-- Pending offers past their expiry (or whose proposed slot has passed) → expired.
create or replace function public.expire_stale_offers()
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  for r in
    update public.offers
      set status = 'expired'
      where status = 'pending'
        and (
          (expires_at is not null and expires_at < now())
          or (proposed_start is not null and proposed_start < now())
        )
      returning id, request_id, artist_id
  loop
    -- Artist: your offer lapsed — re-offer if you still want the booking.
    perform public.push_notification(
      r.artist_id, 'booking_update', 'Offer expired',
      'Your offer lapsed before the client responded', 'appointment_request', r.request_id,
      jsonb_build_object('requestId', r.request_id::text, 'offerId', r.id::text));
    -- Client: an offer they were sitting on is gone.
    perform public.push_notification(
      (select client_id from public.appointment_requests where id = r.request_id),
      'booking_update', 'Offer expired', 'An offer you received has expired',
      'appointment_request', r.request_id,
      jsonb_build_object('requestId', r.request_id::text, 'offerId', r.id::text));
  end loop;
end $$;

-- Requests the artist never answered within a week → expired, nudge the seeker.
create or replace function public.expire_stale_requests()
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  for r in
    update public.appointment_requests
      set status = 'expired'
      where status in ('pending', 'reviewing')
        and created_at < now() - interval '7 days'
      returning id, client_id
  loop
    perform public.push_notification(
      r.client_id, 'booking_update', 'Request expired',
      'No response yet — try another artist for this idea', 'appointment_request', r.id,
      jsonb_build_object('requestId', r.id::text));
  end loop;
end $$;

create or replace function public.run_booking_expiry()
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.expire_stale_offers();
  perform public.expire_stale_requests();
end $$;

-- Hourly (offset from the auto-complete job). If pg_cron isn't enabled yet,
-- apply the functions above first, enable the extension, then run this.
select cron.schedule('expire-offers-requests', '15 * * * *',
  $$ select public.run_booking_expiry(); $$);
