-- =====================================================================
-- 0035  Studio conversations
-- =====================================================================
-- Messaging a studio should open a conversation that represents the STUDIO
-- (its name + logo), kept separate from any personal DM with the studio's
-- owner. Tag conversations with an optional studio_id and add an RPC that
-- starts/opens the studio conversation with the studio owner.
set search_path = public, extensions;

alter table public.conversations
  add column if not exists studio_id uuid references public.studios(id) on delete set null;

create or replace function public.start_studio_conversation(p_studio uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_conv uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  select owner_id into v_owner from public.studios where id = p_studio;
  if v_owner is null then raise exception 'studio_not_found'; end if;
  if v_uid = v_owner then raise exception 'cannot message self'; end if;

  -- reuse an existing conversation tagged with this studio
  select c.id into v_conv
  from public.conversations c
  join public.conversation_participants p1 on p1.conversation_id = c.id and p1.profile_id = v_uid
  join public.conversation_participants p2 on p2.conversation_id = c.id and p2.profile_id = v_owner
  where c.type = 'direct' and c.studio_id = p_studio
  limit 1;
  if v_conv is not null then return v_conv; end if;

  insert into public.conversations (type, created_by, studio_id)
  values ('direct', v_uid, p_studio)
  returning id into v_conv;
  insert into public.conversation_participants (conversation_id, profile_id)
  values (v_conv, v_uid), (v_conv, v_owner);
  return v_conv;
end $$;
grant execute on function public.start_studio_conversation(uuid) to authenticated;
