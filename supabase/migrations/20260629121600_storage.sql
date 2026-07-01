-- =====================================================================
-- 0017  STORAGE BUCKETS & POLICIES
-- Path convention: first folder segment = owner uuid (or conversation id)
-- =====================================================================
insert into storage.buckets (id, name, public) values
  ('avatars',          'avatars',          true),
  ('portfolio',        'portfolio',        true),
  ('ideas',            'ideas',            true),
  ('chat-attachments', 'chat-attachments', false),
  ('journey',          'journey',          false),
  ('ai-previews',      'ai-previews',      false),
  ('saved-designs',    'saved-designs',    false)
on conflict (id) do nothing;

-- ---- PUBLIC buckets: world-readable, owner-writable ------------------
create policy avatars_read  on storage.objects for select using (bucket_id = 'avatars');
create policy avatars_write on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_modify on storage.objects for update
  using (bucket_id = 'avatars' and owner = auth.uid());
create policy avatars_delete on storage.objects for delete
  using (bucket_id = 'avatars' and owner = auth.uid());

create policy portfolio_read  on storage.objects for select using (bucket_id = 'portfolio');
create policy portfolio_write on storage.objects for insert
  with check (bucket_id = 'portfolio'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.has_role('artist'));
create policy portfolio_modify on storage.objects for update
  using (bucket_id = 'portfolio' and owner = auth.uid());
create policy portfolio_delete on storage.objects for delete
  using (bucket_id = 'portfolio' and owner = auth.uid());

create policy ideas_read  on storage.objects for select using (bucket_id = 'ideas');
create policy ideas_write on storage.objects for insert
  with check (bucket_id = 'ideas' and (storage.foldername(name))[1] = auth.uid()::text);
create policy ideas_delete on storage.objects for delete
  using (bucket_id = 'ideas' and owner = auth.uid());

-- ---- PRIVATE owner-only buckets (served via signed URLs) -------------
create policy private_owner_all on storage.objects for all
  using (bucket_id in ('journey','ai-previews','saved-designs')
         and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('journey','ai-previews','saved-designs')
         and (storage.foldername(name))[1] = auth.uid()::text);

-- ---- CHAT ATTACHMENTS: participants only (path = conversation_id/...) -
create policy chat_read on storage.objects for select
  using (bucket_id = 'chat-attachments'
         and public.is_conversation_participant(((storage.foldername(name))[1])::uuid));
create policy chat_write on storage.objects for insert
  with check (bucket_id = 'chat-attachments'
         and public.is_conversation_participant(((storage.foldername(name))[1])::uuid));
