-- =====================================================================
-- 0030  BOOKING FLOW  (offer response RPC, open-slot computation,
--                      booking-event notifications, realtime)
-- =====================================================================
-- The booking tables (0008) already exist. This migration adds the
-- server-side glue the end-to-end flow needs:
--   * respond_offer()  — client accepts/declines an offer (privileged:
--     appointments have no client INSERT policy; offers no client write).
--   * artist_day_slots() — free start-times for a given day, derived from
--     weekly availability minus booked appointments / blocked dates.
--   * notification triggers for every booking state change.
--   * realtime on the booking + notification tables.
set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- generic in-app notification writer (bypasses RLS to notify others)
-- ---------------------------------------------------------------------
create or replace function public.push_notification(
  p_recipient   uuid,
  p_type        notification_type,
  p_title       text,
  p_body        text,
  p_entity_type text,
  p_entity_id   uuid,
  p_data        jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (recipient_id, type, title, body, entity_type, entity_id, data)
  values (p_recipient, p_type, p_title, p_body, p_entity_type, p_entity_id, coalesce(p_data, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------
-- appointment_requests → notify the artist on a new request
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_request_new() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_client text;
begin
  select display_name into v_client from public.profiles where id = new.client_id;
  perform public.push_notification(
    new.artist_id, 'booking_request', 'New booking request',
    coalesce(v_client, 'Someone') || ' requested: ' || new.title,
    'appointment_request', new.id,
    jsonb_build_object('requestId', new.id::text));
  return new;
end $$;

create or replace function public.trg_notify_request_update() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare actor uuid := auth.uid();
begin
  if new.status is distinct from old.status and new.status = 'declined' then
    if actor is distinct from new.client_id then
      perform public.push_notification(
        new.client_id, 'booking_update', 'Request declined',
        'An artist can''t take this on right now', 'appointment_request', new.id,
        jsonb_build_object('requestId', new.id::text));
    end if;
  end if;
  return new;
end $$;

drop trigger if exists notify_request_new on public.appointment_requests;
create trigger notify_request_new after insert on public.appointment_requests
  for each row execute function public.trg_notify_request_new();
drop trigger if exists notify_request_update on public.appointment_requests;
create trigger notify_request_update after update on public.appointment_requests
  for each row execute function public.trg_notify_request_update();

-- ---------------------------------------------------------------------
-- offers → notify the client when an artist sends one
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_offer_new() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_client uuid; v_artist text;
begin
  select client_id into v_client from public.appointment_requests where id = new.request_id;
  select display_name into v_artist from public.profiles where id = new.artist_id;
  perform public.push_notification(
    v_client, 'offer', 'You received an offer',
    coalesce(v_artist, 'An artist') || ' proposed a time and price',
    'offer', new.id,
    jsonb_build_object('requestId', new.request_id::text, 'offerId', new.id::text));
  return new;
end $$;

drop trigger if exists notify_offer_new on public.offers;
create trigger notify_offer_new after insert on public.offers
  for each row execute function public.trg_notify_offer_new();

-- ---------------------------------------------------------------------
-- appointments → notify the non-acting party on booking / status change
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_appt_new() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare actor uuid := auth.uid();
begin
  if actor is distinct from new.artist_id then
    perform public.push_notification(new.artist_id, 'booking_update', 'Appointment booked',
      'A new appointment is on your calendar', 'appointment', new.id,
      jsonb_build_object('appointmentId', new.id::text));
  end if;
  if actor is distinct from new.client_id then
    perform public.push_notification(new.client_id, 'booking_update', 'Appointment confirmed',
      'Your appointment is confirmed', 'appointment', new.id,
      jsonb_build_object('appointmentId', new.id::text));
  end if;
  return new;
end $$;

create or replace function public.trg_notify_appt_update() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  actor uuid := auth.uid();
  v_title text;
  v_body  text;
begin
  if new.status is not distinct from old.status then return new; end if;
  v_title := case new.status
    when 'cancelled'   then 'Appointment cancelled'
    when 'rescheduled' then 'Appointment rescheduled'
    when 'completed'   then 'Appointment completed'
    when 'no_show'     then 'Marked as no-show'
    else 'Appointment updated' end;
  v_body := coalesce(new.cancellation_reason, 'Open your bookings for details');
  if actor is distinct from new.client_id then
    perform public.push_notification(new.client_id, 'booking_update', v_title, v_body,
      'appointment', new.id, jsonb_build_object('appointmentId', new.id::text));
  end if;
  if actor is distinct from new.artist_id then
    perform public.push_notification(new.artist_id, 'booking_update', v_title, v_body,
      'appointment', new.id, jsonb_build_object('appointmentId', new.id::text));
  end if;
  return new;
end $$;

drop trigger if exists notify_appt_new on public.appointments;
create trigger notify_appt_new after insert on public.appointments
  for each row execute function public.trg_notify_appt_new();
drop trigger if exists notify_appt_update on public.appointments;
create trigger notify_appt_update after update on public.appointments
  for each row execute function public.trg_notify_appt_update();

-- ---------------------------------------------------------------------
-- respond_offer — client accepts/declines. Accepting mints the
-- appointment (privileged) and converts the request; declines siblings.
-- Returns the new appointment id on accept, null on decline.
-- ---------------------------------------------------------------------
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
  return v_appt;
end $$;
grant execute on function public.respond_offer(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- artist_day_slots — bookable start-times for one day.
-- ---------------------------------------------------------------------
create or replace function public.artist_day_slots(
  p_artist uuid, p_date date, p_slot_minutes int default 60)
returns setof timestamptz
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_dow  int := extract(dow from p_date);
  r      record;
  v_tz   text;
  v_win_start timestamptz;
  v_win_end   timestamptz;
  v_slot timestamptz;
  v_dur  interval := make_interval(mins => greatest(p_slot_minutes, 15));
begin
  for r in
    select start_time, end_time, timezone
    from public.artist_availability
    where artist_id = p_artist and is_active and day_of_week = v_dow
    order by start_time
  loop
    v_tz := coalesce(r.timezone, 'UTC');
    v_win_start := (p_date::text || ' ' || r.start_time::text)::timestamp at time zone v_tz;
    v_win_end   := (p_date::text || ' ' || r.end_time::text)::timestamp at time zone v_tz;
    v_slot := v_win_start;
    while v_slot + v_dur <= v_win_end loop
      if v_slot > now()
        and not exists (
          select 1 from public.appointments a
          where a.artist_id = p_artist
            and a.status in ('scheduled', 'rescheduled')
            and tstzrange(a.scheduled_start, a.scheduled_end) && tstzrange(v_slot, v_slot + v_dur))
        and not exists (
          select 1 from public.artist_unavailable_dates u
          where u.artist_id = p_artist
            and u.during && tsrange((v_slot at time zone v_tz), ((v_slot + v_dur) at time zone v_tz)))
      then
        return next v_slot;
      end if;
      v_slot := v_slot + v_dur;
    end loop;
  end loop;
end $$;
grant execute on function public.artist_day_slots(uuid, date, int) to authenticated;

-- ---------------------------------------------------------------------
-- realtime: booking tables + notification inbox
-- ---------------------------------------------------------------------
do $$ begin alter publication supabase_realtime add table public.notifications;         exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.appointment_requests;  exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.offers;                exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.appointments;          exception when duplicate_object then null; end $$;
