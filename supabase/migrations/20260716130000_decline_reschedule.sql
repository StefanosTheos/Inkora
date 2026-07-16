-- =====================================================================
-- 0040  DECLINE a reschedule WITHOUT cancelling the appointment
-- ---------------------------------------------------------------------
-- Previously the only way to reject a proposed new time was to cancel the
-- whole appointment (the UI's "Decline" mapped to cancel_appointment) — a
-- foot-gun: a user who merely disliked the *new* time lost the *original*
-- booking. This clears the pending reschedule and KEEPS the original time.
--
-- Callable by EITHER participant: the awaited party "declines" the proposal,
-- or the proposer "withdraws" it — both just clear the pending fields and
-- notify the other party. The scheduled time and status are untouched.
-- =====================================================================
create or replace function public.decline_reschedule(p_appointment_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  a       public.appointments;
  v_other uuid;
begin
  select * into a from appointments where id = p_appointment_id;
  if not found then raise exception 'appointment not found'; end if;
  if v_uid <> a.client_id and v_uid <> a.artist_id then
    raise exception 'not a participant' using errcode = 'check_violation';
  end if;
  if a.reschedule_status = 'none' then
    raise exception 'no pending reschedule' using errcode = 'check_violation';
  end if;

  v_other := case when v_uid = a.client_id then a.artist_id else a.client_id end;

  update appointments set
    reschedule_status = 'none',
    reschedule_start  = null,
    reschedule_end    = null,
    reschedule_by     = null
  where id = p_appointment_id;

  perform public.push_notification(
    v_other, 'booking_update', 'Reschedule declined',
    'The proposed new time was declined — the original time stands.',
    'appointment', p_appointment_id,
    jsonb_build_object('appointmentId', p_appointment_id::text, 'kind', 'reschedule_declined'));
end;
$$;
grant execute on function public.decline_reschedule(uuid) to authenticated;
