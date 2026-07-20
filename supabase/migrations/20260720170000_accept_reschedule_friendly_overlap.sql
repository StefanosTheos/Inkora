-- =====================================================================
-- 0053  RESCHEDULE: friendly error when the new time is no longer free
-- ---------------------------------------------------------------------
-- accept_reschedule moves scheduled_start/end to the proposed time, which can
-- collide with an overlap exclusion constraint if the artist (or, since #45, the
-- client) was booked into that slot meanwhile. Unlike respond_offer there was no
-- catch, so the awaited party saw a raw `exclusion_violation`. Wrap the move in a
-- handler that raises a clean message. Otherwise identical to migration
-- 20260720120000 (keeps the terminal-status close guard + status -> 'rescheduled').
-- =====================================================================
set search_path = public, extensions;

create or replace function public.accept_reschedule(p_appointment_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  a     public.appointments;
begin
  select * into a from appointments where id = p_appointment_id;
  if not found then raise exception 'appointment not found'; end if;
  if a.status in ('cancelled', 'completed', 'no_show') then
    raise exception 'appointment is closed' using errcode = 'check_violation';
  end if;
  if a.reschedule_status = 'none' then
    raise exception 'no pending reschedule' using errcode = 'check_violation';
  end if;
  if (a.reschedule_status = 'pending_client' and v_uid <> a.client_id)
     or (a.reschedule_status = 'pending_artist' and v_uid <> a.artist_id) then
    raise exception 'not your turn to respond' using errcode = 'check_violation';
  end if;

  begin
    update appointments set
      status            = 'rescheduled',
      scheduled_start   = a.reschedule_start,
      scheduled_end     = a.reschedule_end,
      reschedule_status = 'none',
      reschedule_start  = null,
      reschedule_end    = null,
      reschedule_by     = null
    where id = p_appointment_id;
  exception when exclusion_violation then
    raise exception 'That time is no longer free — one of you was booked into it. Propose another slot.'
      using errcode = 'check_violation';
  end;

  perform public.push_notification(
    a.reschedule_by, 'booking_update', 'Reschedule accepted',
    'Your proposed new time was confirmed.',
    'appointment', p_appointment_id,
    jsonb_build_object('appointmentId', p_appointment_id::text, 'kind', 'reschedule_accepted'));
end;
$$;
grant execute on function public.accept_reschedule(uuid) to authenticated;
