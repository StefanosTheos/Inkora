-- =====================================================================
-- One-off cleanup: remove conversations that have no messages (the empty
-- "No messages yet" chats left behind when someone opened a chat but never
-- sent anything). Participants cascade-delete; any booking request link is
-- set null (but requests always post a message, so their chats aren't empty).
-- =====================================================================
set search_path = public, extensions;

delete from public.conversations c
where not exists (select 1 from public.messages m where m.conversation_id = c.id);
