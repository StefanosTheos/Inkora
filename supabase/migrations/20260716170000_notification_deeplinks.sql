-- =====================================================================
-- 0041  NOTIFICATION deep-links: tag owner-facing roster notifications
-- ---------------------------------------------------------------------
-- Several membership_request notifications carried only a studioId, which the
-- client's notificationHref() couldn't turn into a useful route — they dead-
-- ended at /notifications. The client now routes membership_request by payload:
--   * invite + studioSlug          -> /studio/{slug}          (artist accepts)
--   * artistId                     -> /studio-applications     (owner: new app)
--   * audience = 'owner'           -> /studio-dashboard/roster (owner: roster)
--   * else (artist status change)  -> /artist-dashboard
--
-- The owner-facing "invite accepted / declined" notification had no field to
-- distinguish it from an artist-facing status change (both only had studioId),
-- so tag it with audience='owner'. Artist-facing ones need no DB change — they
-- fall through to /artist-dashboard.
-- =====================================================================
set search_path = public, extensions;

create or replace function public.respond_studio_invite(p_studio_id uuid, p_accept boolean)
returns text
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_name text;
begin
  if not public.has_role('artist') then
    raise exception 'Only artists can respond to invites' using errcode = '42501';
  end if;
  update public.studio_memberships
     set status = (case when p_accept then 'active' else 'removed' end)::membership_status,
         joined_at = case when p_accept then now() else joined_at end
   where studio_id = p_studio_id and artist_id = v_uid and status = 'invited';
  if not found then
    raise exception 'No pending invite' using errcode = 'P0002';
  end if;

  select owner_id, name into v_owner, v_name from public.studios where id = p_studio_id;
  select display_name into v_name from public.profiles where id = v_uid; -- reuse v_name for artist
  perform public.push_notification(
    v_owner, 'membership_request',
    case when p_accept then 'Invite accepted' else 'Invite declined' end,
    coalesce(v_name, 'An artist') || (case when p_accept then ' joined your studio' else ' declined your invite' end),
    'studio', p_studio_id, jsonb_build_object('studioId', p_studio_id::text, 'audience', 'owner'));
  return case when p_accept then 'active' else 'removed' end;
end;
$$;
grant execute on function public.respond_studio_invite(uuid, boolean) to authenticated;
