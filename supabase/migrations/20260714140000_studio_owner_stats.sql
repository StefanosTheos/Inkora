-- =====================================================================
-- 0052  STUDIO OWNER: profile-visit tracking + per-artist / studio stats
--   Powers the studio-owner dashboard. Visits are logged via a definer RPC
--   (favorites/visits are private, so aggregates are read through SECURITY
--   DEFINER functions guarded by is_studio_admin).
-- =====================================================================
set search_path = public, extensions;

-- ---- profile visit log ----------------------------------------------
create table if not exists public.profile_visits (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('artist', 'studio')),
  target_id   uuid not null,
  viewer_id   uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_profile_visits_target on public.profile_visits (target_type, target_id);
alter table public.profile_visits enable row level security;
-- No client policies: rows are written via record_profile_visit and read only
-- through the aggregate RPCs below (both SECURITY DEFINER).

-- Log a view of an artist or studio profile. Ignores self-views and dedupes to
-- one visit per viewer per target per day so a stat can't be inflated by
-- re-opening a page. Anonymous viewers (no auth) always count.
create or replace function public.record_profile_visit(p_target_type text, p_target_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if p_target_type not in ('artist', 'studio') then return; end if;
  -- don't count the artist/owner viewing their own page
  if p_target_type = 'artist' and v_uid = p_target_id then return; end if;
  if p_target_type = 'studio'
     and exists (select 1 from studios s where s.id = p_target_id and s.owner_id = v_uid) then
    return;
  end if;
  if v_uid is not null and exists (
    select 1 from profile_visits pv
    where pv.target_type = p_target_type and pv.target_id = p_target_id
      and pv.viewer_id = v_uid and pv.created_at > now() - interval '1 day'
  ) then
    return;
  end if;
  insert into profile_visits (target_type, target_id, viewer_id)
  values (p_target_type, p_target_id, v_uid);
end;
$$;
grant execute on function public.record_profile_visit(text, uuid) to authenticated, anon;

-- ---- per-artist stats for a studio's active roster ------------------
create or replace function public.studio_artist_stats(p_studio_id uuid)
returns table (
  artist_id      uuid,
  rating_avg     numeric,
  rating_count   int,
  saved_by       int,  -- people who favourited the artist
  work_saves     int,  -- people who favourited the artist's portfolio/flash work
  completed      int,
  scheduled      int,  -- scheduled + rescheduled (upcoming)
  cancelled      int,
  profile_visits int
)
language sql stable security definer set search_path = public as $$
  select
    a.id,
    a.rating_avg,
    a.rating_count,
    (select count(*) from favorites f where f.target_type = 'artist' and f.target_id = a.id)::int,
    (select count(*) from favorites f join portfolio_images pi on pi.id = f.target_id
       where f.target_type = 'portfolio_image' and pi.artist_id = a.id)::int,
    (select count(*) from appointments ap where ap.artist_id = a.id and ap.status = 'completed')::int,
    (select count(*) from appointments ap where ap.artist_id = a.id and ap.status in ('scheduled', 'rescheduled'))::int,
    (select count(*) from appointments ap where ap.artist_id = a.id and ap.status = 'cancelled')::int,
    (select count(*) from profile_visits pv where pv.target_type = 'artist' and pv.target_id = a.id)::int
  from studio_memberships m
  join artists a on a.id = m.artist_id
  where m.studio_id = p_studio_id and m.status = 'active'
    and public.is_studio_admin(p_studio_id)
  order by a.rating_avg desc nulls last;
$$;
grant execute on function public.studio_artist_stats(uuid) to authenticated;

-- ---- studio-level overview ------------------------------------------
create or replace function public.studio_overview(p_studio_id uuid)
returns table (
  active_artists       int,
  pending_applications int,
  profile_visits       int,
  completed_bookings   int,
  scheduled_bookings   int,
  cancelled_bookings   int
)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from studio_memberships m where m.studio_id = p_studio_id and m.status = 'active')::int,
    (select count(*) from studio_memberships m where m.studio_id = p_studio_id and m.status = 'requested')::int,
    (select count(*) from profile_visits pv where pv.target_type = 'studio' and pv.target_id = p_studio_id)::int,
    (select count(*) from appointments ap
       join studio_memberships m on m.artist_id = ap.artist_id and m.studio_id = p_studio_id and m.status = 'active'
       where ap.status = 'completed')::int,
    (select count(*) from appointments ap
       join studio_memberships m on m.artist_id = ap.artist_id and m.studio_id = p_studio_id and m.status = 'active'
       where ap.status in ('scheduled', 'rescheduled'))::int,
    (select count(*) from appointments ap
       join studio_memberships m on m.artist_id = ap.artist_id and m.studio_id = p_studio_id and m.status = 'active'
       where ap.status = 'cancelled')::int
  where public.is_studio_admin(p_studio_id);
$$;
grant execute on function public.studio_overview(uuid) to authenticated;
