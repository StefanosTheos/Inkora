-- =====================================================================
-- 0028  CHAT — metadata, conversation bump trigger, start-conversation RPC,
--             realtime enablement
-- =====================================================================

-- Structured payload for non-text messages (voice duration/path, quote/consult details).
-- message.type stays in its enum; metadata.kind refines rendering (voice|quote|consultation).
alter table public.messages add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Keep the conversation row fresh (drives the list + ordering). SECURITY DEFINER:
-- a participant may insert a message but has no update policy on conversations.
create or replace function public.bump_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update conversations
    set last_message_at = new.created_at, last_message_preview = left(coalesce(new.body, ''), 140)
    where id = new.conversation_id;
  return null;
end $$;
drop trigger if exists trg_messages_bump on public.messages;
create trigger trg_messages_bump after insert on public.messages
  for each row execute function public.bump_conversation();

-- Start (or reuse) a 1:1 direct conversation. conversation_participants has no client
-- insert policy, so this SECURITY DEFINER function is the sanctioned entry point.
create or replace function public.start_direct_conversation(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_conv uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if v_uid = p_other then raise exception 'cannot message self'; end if;

  select c.id into v_conv
  from conversations c
  join conversation_participants p1 on p1.conversation_id = c.id and p1.profile_id = v_uid
  join conversation_participants p2 on p2.conversation_id = c.id and p2.profile_id = p_other
  where c.type = 'direct'
  limit 1;
  if v_conv is not null then return v_conv; end if;

  insert into conversations (type, created_by) values ('direct', v_uid) returning id into v_conv;
  insert into conversation_participants (conversation_id, profile_id) values (v_conv, v_uid), (v_conv, p_other);
  return v_conv;
end $$;

-- Enable realtime (postgres_changes) on messages; RLS still gates who receives them.
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;
