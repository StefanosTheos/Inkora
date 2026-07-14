-- =====================================================================
-- 0057  STUDIO OWNER: roster management
--   Owner can suspend/remove an artist, or invite one; the artist accepts or
--   declines the invite. All owner actions are is_studio_admin-guarded; the
--   invite respects the "one studio at a time" rule.
-- =====================================================================
set search_path = public, extensions;

-- ---- owner suspends / removes / reinstates an existing member -------
create or replace function public.studio_set_membership(p_studio_id uuid, p_artist_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if not public.is_studio_admin(p_studio_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended', 'removed') then
    raise exception 'Invalid status' using errcode = 'check_violation';
  end if;

  update public.studio_memberships
     set status = p_status::membership_status, updated_at = now()
   where studio_id = p_studio_id and artist_id = p_artist_id;
  if not found then
    raise exception 'Not a member of this studio' using errcode = 'P0002';
  end if;

  select name into v_name from public.studios where id = p_studio_id;
  perform public.push_notification(
    p_artist_id, 'membership_request',
    case p_status when 'removed' then 'Removed from studio'
                  when 'suspended' then 'Membership suspended'
                  else 'Membership reactivated' end,
    case p_status when 'active' then 'You''re active again at ' || coalesce(v_name, 'the studio')
                  else coalesce(v_name, 'The studio') || (case p_status when 'suspended' then ' suspended your membership' else ' removed you from the roster' end) end,
    'studio', p_studio_id, jsonb_build_object('studioId', p_studio_id::text, 'status', p_status));
end;
$$;
grant execute on function public.studio_set_membership(uuid, uuid, text) to authenticated;

-- ---- owner invites an artist ---------------------------------------
create or replace function public.studio_invite_artist(p_studio_id uuid, p_artist_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_name text; v_slug text;
begin
  if not public.is_studio_admin(p_studio_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from artists a where a.id = p_artist_id) then
    raise exception 'Not an artist' using errcode = 'P0002';
  end if;
  -- one studio at a time: block if bound to another studio
  if exists (
    select 1 from studio_memberships m
    where m.artist_id = p_artist_id and m.studio_id <> p_studio_id
      and m.status in ('requested', 'invited', 'active', 'suspended')
  ) then
    raise exception 'That artist is already with another studio' using errcode = '23505';
  end if;

  insert into public.studio_memberships (studio_id, artist_id, role, status, invited_by)
  values (p_studio_id, p_artist_id, 'artist', 'invited', auth.uid())
  on conflict (studio_id, artist_id) do update set status = 'invited', invited_by = auth.uid(), joined_at = null;

  select name, slug into v_name, v_slug from public.studios where id = p_studio_id;
  perform public.push_notification(
    p_artist_id, 'membership_request', 'Studio invitation',
    coalesce(v_name, 'A studio') || ' invited you to join their roster',
    'studio', p_studio_id, jsonb_build_object('studioId', p_studio_id::text, 'studioSlug', v_slug, 'invite', 'true'));
end;
$$;
grant execute on function public.studio_invite_artist(uuid, uuid) to authenticated;

-- ---- artist accepts / declines an invite ---------------------------
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
    'studio', p_studio_id, jsonb_build_object('studioId', p_studio_id::text));
  return case when p_accept then 'active' else 'removed' end;
end;
$$;
grant execute on function public.respond_studio_invite(uuid, boolean) to authenticated;
