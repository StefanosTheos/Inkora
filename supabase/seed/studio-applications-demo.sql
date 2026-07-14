-- =====================================================================
-- DEMO: pending studio applications (for reviewing Phase 2)
--   Run in the hosted SQL Editor AFTER studio-owner-demo.sql and migration
--   20260714150000_studio_applications_owner.sql.
--
--   For the demo studio "Iron Lotus" (owner studio@demo.inkora.dev) it:
--     * adds a few existing artists as PENDING applicants with varied ages
--       (so the "auto-rejects in N days" countdowns differ), and
--     * gives every pending applicant a studio conversation + a "🎨 Application
--       to join your studio" chat card — exactly what the app posts when an
--       artist applies — so the owner can accept/decline both from the
--       Applications inbox and inline in Chats.
--   Idempotent — safe to re-run.
-- =====================================================================
do $$
declare
  v_owner  uuid := 'e0000000-0000-4000-8000-000000000001';
  v_studio uuid := 'e1000000-0000-4000-8000-000000000001';
  r        record;
  v_conv   uuid;
  ages     int[] := array[0, 1, 2, 3, 4];  -- days ago -> 5,4,3,2,1 days left
  i        int := 0;
begin
  -- 1) A handful of pending applicants with varied application ages.
  for r in
    select a.id as artist_id
    from public.artists a
    where a.id not in (select artist_id from public.studio_memberships where studio_id = v_studio)
    order by a.rating_count desc nulls last, a.rating_avg desc nulls last
    limit 4
  loop
    insert into public.studio_memberships (studio_id, artist_id, role, status, created_at)
    values (v_studio, r.artist_id, 'artist', 'requested', now() - (ages[(i % 5) + 1] || ' days')::interval)
    on conflict (studio_id, artist_id) do nothing;
    i := i + 1;
  end loop;

  -- 2) Every pending applicant gets a studio conversation + application card.
  for r in
    select artist_id, created_at
    from public.studio_memberships
    where studio_id = v_studio and status = 'requested'
  loop
    -- reuse an existing owner<->applicant studio conversation if present
    select c.id into v_conv
    from public.conversations c
    join public.conversation_participants cp1 on cp1.conversation_id = c.id and cp1.profile_id = r.artist_id
    join public.conversation_participants cp2 on cp2.conversation_id = c.id and cp2.profile_id = v_owner
    where c.type = 'direct' and c.studio_id = v_studio
    limit 1;

    if v_conv is null then
      v_conv := gen_random_uuid();
      insert into public.conversations (id, type, studio_id, created_by, created_at)
      values (v_conv, 'direct', v_studio, r.artist_id, r.created_at);
      insert into public.conversation_participants (conversation_id, profile_id)
      values (v_conv, r.artist_id), (v_conv, v_owner)
      on conflict do nothing;
    end if;

    -- one application card per conversation
    if not exists (
      select 1 from public.messages m
      where m.conversation_id = v_conv and m.metadata->>'kind' = 'application'
    ) then
      insert into public.messages (conversation_id, sender_id, type, body, metadata, created_at)
      values (v_conv, r.artist_id, 'booking_card', '🎨 Application to join your studio',
              jsonb_build_object('kind', 'application', 'studioId', v_studio::text), r.created_at);
    end if;
  end loop;
end $$;
