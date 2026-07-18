-- =====================================================================
-- 0046  ACTIVATE the 'rescheduled' appointment status
-- ---------------------------------------------------------------------
-- The enum had 'rescheduled' and the UI has a label + "Rescheduled" chip, but
-- accept_reschedule left status = 'scheduled', so the value was never set (dead).
-- Now accepting a reschedule flips the status to 'rescheduled', giving the chip
-- real meaning. Everywhere that gates on active bookings already checks
-- status in ('scheduled','rescheduled'), so nothing else changes behaviour.
--
-- accept_reschedule already sends an explicit "Reschedule accepted" push, so the
-- status-change trigger must NOT also fire for the transition to 'rescheduled'
-- (that would double-notify). Skip it there; every other transition is unchanged.
-- =====================================================================
set search_path = public, extensions;

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
    status            = 'rescheduled',
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

-- Skip the generic status-change notification for the transition TO 'rescheduled'
-- (accept_reschedule notifies explicitly). All other transitions are unchanged.
create or replace function public.trg_notify_appt_update() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  actor uuid := auth.uid();
  v_title text;
  v_body  text;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status = 'rescheduled' then return new; end if;
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
