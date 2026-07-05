-- =====================================================================
-- 0045  Artist → studio applications (artist-initiated membership)
-- =====================================================================
-- Mirror of the studio-initiated 'invited' flow: an artist applies to a
-- studio (status 'requested'), the studio owner approves (-> 'active') or
-- declines (-> 'removed'). All transitions run through SECURITY DEFINER
-- RPCs so RLS can stay locked down (see the memb_self_respond drop below).
--
-- MVP rules baked in here:
--   * an artist may hold only ONE non-terminal membership at a time
--     (requested/invited/active/suspended) -> "one studio for now".
--     (Enforced in apply_to_studio, not a unique index: the seed already
--      has owner-invited artists resident in several studios, which is a
--      legitimate grandfathered state a hard constraint would reject.)
--   * re-applying after a decline is allowed (a terminal 'removed' row is
--     revived back to 'requested').
set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- Artist applies to a studio
-- ---------------------------------------------------------------------
create or replace function public.apply_to_studio(p_studio_id uuid)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid           uuid := auth.uid();
  v_owner         uuid;
  v_other_studio  uuid;
  v_name          text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if not public.has_role('artist') then
    raise exception 'Only artists can apply to studios' using errcode = '42501';
  end if;

  select owner_id into v_owner from public.studios where id = p_studio_id and is_active;
  if v_owner is null then
    raise exception 'Studio not found' using errcode = 'P0002';
  end if;

  -- one non-terminal membership at a time
  select studio_id into v_other_studio
  from public.studio_memberships
  where artist_id = v_uid and status in ('requested','invited','active','suspended')
  limit 1;

  if v_other_studio is not null then
    if v_other_studio = p_studio_id then
      raise exception 'You already have a pending or active membership with this studio'
        using errcode = '23505';
    else
      raise exception 'You''re already with another studio' using errcode = '23505';
    end if;
  end if;

  -- fresh application, or revive a previously-declined ('removed') row
  insert into public.studio_memberships (studio_id, artist_id, role, status, invited_by, joined_at)
  values (p_studio_id, v_uid, 'artist', 'requested', null, null)
  on conflict (studio_id, artist_id) do update
    set status = 'requested', role = 'artist', invited_by = null, joined_at = null;

  select display_name into v_name from public.profiles where id = v_uid;
  perform public.push_notification(
    v_owner, 'membership_request', 'New artist application',
    coalesce(v_name, 'An artist') || ' applied to join your studio',
    'studio', p_studio_id,
    jsonb_build_object('artistId', v_uid::text, 'studioId', p_studio_id::text));

  return 'requested';
end $$;

-- ---------------------------------------------------------------------
-- Artist withdraws their own pending application
-- ---------------------------------------------------------------------
create or replace function public.withdraw_studio_application(p_studio_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.studio_memberships
     set status = 'removed'
   where studio_id = p_studio_id
     and artist_id = auth.uid()
     and status = 'requested';
  if not found then
    raise exception 'No pending application to withdraw' using errcode = 'P0002';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Studio owner/manager approves or declines an application.
-- SERVER-READY: no studio-side UI yet (stub). Lets the artist flow be
-- exercised end-to-end from SQL and is the endpoint the future
-- "Applications" screen will call.
-- ---------------------------------------------------------------------
create or replace function public.respond_studio_application(
  p_studio_id uuid, p_artist_id uuid, p_accept boolean)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_studio text;
begin
  if not public.is_studio_admin(p_studio_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.studio_memberships
     set status    = case when p_accept then 'active'  else 'removed' end,
         joined_at = case when p_accept then now()     else joined_at end
   where studio_id = p_studio_id
     and artist_id = p_artist_id
     and status = 'requested';
  if not found then
    raise exception 'No pending application' using errcode = 'P0002';
  end if;

  select name into v_studio from public.studios where id = p_studio_id;
  perform public.push_notification(
    p_artist_id, 'membership_request',
    case when p_accept then 'Application accepted' else 'Application declined' end,
    case when p_accept
         then 'You''re now part of ' || coalesce(v_studio, 'the studio')
         else coalesce(v_studio, 'The studio') || ' declined your application' end,
    'studio', p_studio_id,
    jsonb_build_object('studioId', p_studio_id::text, 'accepted', p_accept));

  return case when p_accept then 'active' else 'removed' end;
end $$;

-- ---------------------------------------------------------------------
-- RLS: all membership writes now go through the RPCs above. Drop the
-- broad self-update policy that let an artist set their own row to ANY
-- status (e.g. self-approving 'requested' -> 'active'). Admin writes
-- (memb_admin_write) and the public/own read policies are unchanged.
-- ---------------------------------------------------------------------
drop policy if exists memb_self_respond on public.studio_memberships;

grant execute on function public.apply_to_studio(uuid)                     to authenticated;
grant execute on function public.withdraw_studio_application(uuid)         to authenticated;
grant execute on function public.respond_studio_application(uuid, uuid, boolean) to authenticated;
