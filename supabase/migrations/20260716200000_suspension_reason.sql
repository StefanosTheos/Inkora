-- =====================================================================
-- 0044  SUSPENSION context: reason + stats for suspended members
-- ---------------------------------------------------------------------
-- The studio dashboard showed suspended artists name-only, so an owner's
-- reactivate/remove decision was blind. Two changes:
--   * capture an optional reason when suspending (studio_set_membership gains
--     p_reason; stored on the membership, cleared on reactivate/remove);
--   * include suspended members in studio_artist_stats so the dashboard can
--     show their performance alongside active roster cards.
-- =====================================================================
set search_path = public, extensions;

alter table public.studio_memberships add column if not exists suspension_reason text;

create or replace function public.studio_set_membership(
  p_studio_id uuid, p_artist_id uuid, p_status text, p_reason text default null)
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
     set status = p_status::membership_status,
         -- keep the reason only while suspended; clear on reactivate / remove
         suspension_reason = case when p_status = 'suspended' then p_reason else null end,
         updated_at = now()
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
grant execute on function public.studio_set_membership(uuid, uuid, text, text) to authenticated;

-- Include suspended members so the dashboard can show their stats too. (Removed
-- members drop off; rating/saves/visits stay global, bookings scoped to studio.)
drop function if exists public.studio_artist_stats(uuid);
create or replace function public.studio_artist_stats(p_studio_id uuid)
returns table (
  artist_id      uuid,
  rating_avg     numeric,
  rating_count   int,
  saved_by       int,
  work_saves     int,
  completed      int,
  scheduled      int,
  cancelled      int,
  no_show        int,
  profile_visits int,
  revenue        numeric
)
language sql stable security definer set search_path = public as $$
  select
    a.id,
    a.rating_avg,
    a.rating_count,
    (select count(*) from favorites f where f.target_type = 'artist' and f.target_id = a.id)::int,
    (select count(*) from favorites f join portfolio_images pi on pi.id = f.target_id
       where f.target_type = 'portfolio_image' and pi.artist_id = a.id)::int,
    (select count(*) from appointments ap where ap.artist_id = a.id and ap.studio_id = p_studio_id and ap.status = 'completed')::int,
    (select count(*) from appointments ap where ap.artist_id = a.id and ap.studio_id = p_studio_id and ap.status in ('scheduled', 'rescheduled'))::int,
    (select count(*) from appointments ap where ap.artist_id = a.id and ap.studio_id = p_studio_id and ap.status = 'cancelled')::int,
    (select count(*) from appointments ap where ap.artist_id = a.id and ap.studio_id = p_studio_id and ap.status = 'no_show')::int,
    (select count(*) from profile_visits pv where pv.target_type = 'artist' and pv.target_id = a.id)::int,
    coalesce((select sum(ap.price_amount) from appointments ap where ap.artist_id = a.id and ap.studio_id = p_studio_id and ap.status = 'completed'), 0)::numeric
  from studio_memberships m
  join artists a on a.id = m.artist_id
  where m.studio_id = p_studio_id and m.status in ('active', 'suspended')
    and public.is_studio_admin(p_studio_id)
  order by a.rating_avg desc nulls last;
$$;
grant execute on function public.studio_artist_stats(uuid) to authenticated;
