-- =====================================================================
-- 0029  CHAT READ RECEIPTS — realtime on conversation_participants
--   so the sender sees "Seen" the moment the other reads (last_read_at update).
-- =====================================================================
do $$ begin
  alter publication supabase_realtime add table public.conversation_participants;
exception when duplicate_object then null; end $$;
