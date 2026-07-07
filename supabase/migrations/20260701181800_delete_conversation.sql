-- =====================================================================
-- 0054  Delete a conversation (participant-initiated)
-- =====================================================================
-- Lets a participant delete a chat. Messages + participants cascade; any
-- appointment_requests.conversation_id is set null (bookings/requests stay
-- valid). No RLS delete policy on conversations, so this SECURITY DEFINER
-- RPC does the participant check.
set search_path = public, extensions;

create or replace function public.delete_conversation(p_conversation_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_conversation_participant(p_conversation_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  delete from public.conversations where id = p_conversation_id;
end $$;

grant execute on function public.delete_conversation(uuid) to authenticated;
