-- =====================================================================
-- 0051  APPOINTMENT RESCHEDULE NEGOTIATION
--   Either party can propose a new time; the OTHER party must approve.
--   The proposed time is held on the appointment (reschedule_* columns)
--   until accepted — the scheduled time only moves on acceptance. Both
--   sides see a "reschedule pending" chip while a reply is outstanding.
--
--   Flow: propose_reschedule -> the awaited party accepts (accept_reschedule),
--   counters (propose_reschedule again, flipping the pending side), or
--   declines the appointment outright (normal cancel).
-- =====================================================================
set search_path = public, extensions;

alter table public.appointments
  add column if not exists reschedule_status text not null default 'none'
    check (reschedule_status in ('none', 'pending_client', 'pending_artist')),
  add column if not exists reschedule_start timestamptz,
  add column if not exists reschedule_end   timestamptz,
  add column if not exists reschedule_by    uuid references public.profiles(id) on delete set null;

-- ---- propose / counter a reschedule ---------------------------------
-- Either participant may call. Sets the pending side to the OTHER party and
-- notifies them. Does NOT move the scheduled time (that waits for acceptance).
create or replace function public.propose_reschedule(
  p_appointment_id uuid, p_start timestamptz, p_end timestamptz
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  a        public.appointments;
  v_status text;
  v_other  uuid;
begin
  select * into a from appointments where id = p_appointment_id;
  if not found then raise exception 'appointment not found'; end if;
  if v_uid <> a.client_id and v_uid <> a.artist_id then
    raise exception 'not a participant' using errcode = 'check_violation';
  end if;
  if a.status in ('cancelled', 'completed', 'no_show') then
    raise exception 'appointment is closed' using errcode = 'check_violation';
  end if;
  if p_end <= p_start then
    raise exception 'end must be after start' using errcode = 'check_violation';
  end if;

  if v_uid = a.artist_id then
    v_status := 'pending_client'; v_other := a.client_id;
  else
    v_status := 'pending_artist'; v_other := a.artist_id;
  end if;

  update appointments set
    reschedule_status = v_status,
    reschedule_start  = p_start,
    reschedule_end    = p_end,
    reschedule_by     = v_uid
  where id = p_appointment_id;

  perform public.push_notification(
    v_other, 'booking_update', 'Reschedule requested',
    'A new time was proposed — tap to review.',
    'appointment', p_appointment_id,
    jsonb_build_object('appointmentId', p_appointment_id::text, 'kind', 'reschedule_proposed'));
end;
$$;
grant execute on function public.propose_reschedule(uuid, timestamptz, timestamptz) to authenticated;

-- ---- accept the pending reschedule ----------------------------------
-- Only the awaited party may accept. Moves the scheduled time to the
-- proposed one and clears the pending state. Status is left unchanged so
-- the status-change trigger doesn't double-notify — we notify explicitly.
create or replace function public.accept_reschedule(p_appointment_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  a     public.appointments;
begin
  select * into a from appointments where id = p_appointment_id;
  if not found then raise exception 'appointment not found'; end if;
  if a.reschedule_status = 'none' then
    raise exception 'no pending reschedule' using errcode = 'check_violation';
  end if;
  if (a.reschedule_status = 'pending_client' and v_uid <> a.client_id)
     or (a.reschedule_status = 'pending_artist' and v_uid <> a.artist_id) then
    raise exception 'not your turn to respond' using errcode = 'check_violation';
  end if;

  update appointments set
    scheduled_start   = a.reschedule_start,
    scheduled_end     = a.reschedule_end,
    reschedule_status = 'none',
    reschedule_start  = null,
    reschedule_end    = null,
    reschedule_by     = null
  where id = p_appointment_id;

  perform public.push_notification(
    a.reschedule_by, 'booking_update', 'Reschedule accepted',
    'Your proposed new time was confirmed.',
    'appointment', p_appointment_id,
    jsonb_build_object('appointmentId', p_appointment_id::text, 'kind', 'reschedule_accepted'));
end;
$$;
grant execute on function public.accept_reschedule(uuid) to authenticated;

-- ---- tag appointment status-change notifications with a kind --------
-- So the client's decline-of-reschedule (a cancel) is distinguishable from a
-- brand-new booking notification and can drive the reschedule-reply badge.
-- Same behaviour as before, plus data->>'kind' = 'appt_<status>'.
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
      'appointment', new.id, jsonb_build_object('appointmentId', new.id::text, 'kind', 'appt_' || new.status));
  end if;
  if actor is distinct from new.artist_id then
    perform public.push_notification(new.artist_id, 'booking_update', v_title, v_body,
      'appointment', new.id, jsonb_build_object('appointmentId', new.id::text, 'kind', 'appt_' || new.status));
  end if;
  return new;
end $$;
