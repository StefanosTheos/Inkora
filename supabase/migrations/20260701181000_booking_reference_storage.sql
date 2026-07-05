-- =====================================================================
-- 0046  Booking reference photo storage access
-- =====================================================================
-- Booking reference photos are uploaded to the private 'chat-attachments'
-- bucket under 'requests/<uploaderId>/<file>'. Two problems this fixes:
--   1. The chat_write/chat_read policies hard-cast the first path segment to
--      uuid (path convention = '<conversationId>/...'). For a 'requests/...'
--      path that cast threw "invalid input syntax for type uuid: requests",
--      blocking the upload for everyone. We now parse it non-throwingly.
--   2. There was no policy granting read/write on booking reference objects.
set search_path = public, extensions;

-- Non-throwing uuid parse: returns null instead of erroring on bad text.
create or replace function public.try_uuid(t text) returns uuid
language plpgsql immutable as $$
begin
  return t::uuid;
exception when others then
  return null;
end $$;

-- Rewrite the chat-attachments policies to use the safe parse, so a
-- non-uuid first segment (e.g. 'requests') evaluates to false instead of
-- erroring the whole statement.
drop policy if exists chat_read  on storage.objects;
drop policy if exists chat_write on storage.objects;

create policy chat_read on storage.objects for select
  using (bucket_id = 'chat-attachments'
         and public.is_conversation_participant(public.try_uuid((storage.foldername(name))[1])));
create policy chat_write on storage.objects for insert
  with check (bucket_id = 'chat-attachments'
         and public.is_conversation_participant(public.try_uuid((storage.foldername(name))[1])));

-- Booking reference photos: 'requests/<uploaderId>/<file>'.
-- Uploader (the seeker) owns the folder; readable by them and by the artist
-- on any request whose reference_paths lists the file.
drop policy if exists booking_ref_write  on storage.objects;
drop policy if exists booking_ref_read   on storage.objects;
drop policy if exists booking_ref_delete on storage.objects;

create policy booking_ref_write on storage.objects for insert
  with check (bucket_id = 'chat-attachments'
             and (storage.foldername(name))[1] = 'requests'
             and (storage.foldername(name))[2] = auth.uid()::text);

create policy booking_ref_read on storage.objects for select
  using (bucket_id = 'chat-attachments'
         and (storage.foldername(name))[1] = 'requests'
         and ((storage.foldername(name))[2] = auth.uid()::text
              or exists (select 1 from public.appointment_requests r
                         where r.artist_id = auth.uid()
                           and storage.objects.name = any(r.reference_paths))));

create policy booking_ref_delete on storage.objects for delete
  using (bucket_id = 'chat-attachments'
         and (storage.foldername(name))[1] = 'requests'
         and (storage.foldername(name))[2] = auth.uid()::text);
