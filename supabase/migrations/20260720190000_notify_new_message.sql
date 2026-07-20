-- =====================================================================
-- 0055  CHAT: notify (and push) the recipient on a new message
-- ---------------------------------------------------------------------
-- Chat messages created no notifications row and no push — only the in-app
-- conversations badge updated via realtime, so a recipient with the app
-- backgrounded/closed never learned a message arrived. This trigger inserts a
-- 'message' notification for every other participant on each new message, which
-- (a) shows in their inbox and (b) drives a push via the notify-dispatch webhook.
--
-- To avoid flooding the inbox during an active back-and-forth it COALESCES:
-- each recipient keeps at most one unread 'message' notification per conversation
-- (the latest) — the delete+insert still fires the webhook per message, so push
-- is per-message while the inbox stays one-row-per-conversation. Structured
-- booking cards are skipped (they already push via their own triggers).
-- =====================================================================
set search_path = public, extensions;

create or replace function public.trg_notify_new_message() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_sender  text;
  v_preview text;
  r         record;
begin
  -- Booking cards (offer / request / appointment) already notify via their own
  -- triggers — don't double-push.
  if new.type = 'booking_card' then return new; end if;

  select display_name into v_sender from public.profiles where id = new.sender_id;
  v_preview := case
    when new.type = 'image' then '📷 Photo'
    when coalesce(new.body, '') <> '' then left(new.body, 140)
    else 'Sent you a message'
  end;

  for r in
    select profile_id from public.conversation_participants
    where conversation_id = new.conversation_id and profile_id <> new.sender_id
  loop
    -- Coalesce: drop the recipient's prior unread message notice for this chat.
    delete from public.notifications
      where recipient_id = r.profile_id and type = 'message'
        and entity_type = 'conversation' and entity_id = new.conversation_id
        and read_at is null;
    perform public.push_notification(
      r.profile_id, 'message', coalesce(v_sender, 'New message'), v_preview,
      'conversation', new.conversation_id,
      jsonb_build_object('conversationId', new.conversation_id::text));
  end loop;

  return new;
end $$;

drop trigger if exists trg_messages_notify on public.messages;
create trigger trg_messages_notify
  after insert on public.messages
  for each row execute function public.trg_notify_new_message();
