-- =====================================================================
-- 0054  FIX: respond_studio_application enum assignment
--   The status CASE resolves to `text`, which Postgres won't implicitly
--   assign to the `membership_status` enum column ("column status is of type
--   membership_status but the expression is of type text"). Latent since
--   20260701180900 — only surfaced once the studio-owner UI called it. Cast
--   the CASE result to the enum. Behaviour is otherwise unchanged.
-- =====================================================================
set search_path = public, extensions;

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
     set status    = (case when p_accept then 'active' else 'removed' end)::membership_status,
         joined_at = case when p_accept then now() else joined_at end
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
