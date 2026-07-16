-- =====================================================================
-- 0041  STUDIO STATS: attribute bookings by studio_id (stable history)
-- ---------------------------------------------------------------------
-- Previously studio_overview joined appointments to ACTIVE memberships, so
-- suspending/removing an artist instantly erased their historical revenue,
-- bookings and cancellations from studio totals — an owner watched lifetime
-- revenue drop when they suspended someone. It also mis-attributed: an active
-- artist's bookings counted even when they weren't made through this studio.
--
-- Fix: attribute studio bookings by `appointments.studio_id` (persisted on
-- studio bookings), independent of current roster membership. Per-artist stats
-- are likewise scoped to THIS studio's bookings so the roster cards and the
-- overview agree. Rating/saves/profile-visits stay global (they're about the
-- artist, not the studio). Signatures are unchanged — client code untouched.
-- =====================================================================
set search_path = public, extensions;

create or replace function public.studio_overview(p_studio_id uuid)
returns table (
  active_artists       int,
  pending_applications int,
  profile_visits       int,
  completed_bookings   int,
  scheduled_bookings   int,
  cancelled_bookings   int,
  revenue              numeric,
  studio_saves         int,
  rating_avg           numeric,
  rating_count         int
)
language sql stable security definer set search_path = public as $$
  with studio_appts as (
    -- All bookings made through this studio, regardless of who is currently on
    -- the roster — so totals are stable when the roster changes.
    select ap.status, ap.price_amount
    from appointments ap
    where ap.studio_id = p_studio_id
  )
  select
    (select count(*) from studio_memberships m where m.studio_id = p_studio_id and m.status = 'active')::int,
    (select count(*) from studio_memberships m where m.studio_id = p_studio_id and m.status = 'requested')::int,
    (select count(*) from profile_visits pv where pv.target_type = 'studio' and pv.target_id = p_studio_id)::int,
    (select count(*) from studio_appts where status = 'completed')::int,
    (select count(*) from studio_appts where status in ('scheduled', 'rescheduled'))::int,
    (select count(*) from studio_appts where status = 'cancelled')::int,
    coalesce((select sum(price_amount) from studio_appts where status = 'completed'), 0)::numeric,
    (select count(*) from favorites f where f.target_type = 'studio' and f.target_id = p_studio_id)::int,
    coalesce((select round(avg(r.overall_rating), 2) from reviews r where r.studio_id = p_studio_id and r.is_published), 0)::numeric,
    (select count(*) from reviews r where r.studio_id = p_studio_id and r.is_published)::int
  where public.is_studio_admin(p_studio_id);
$$;
grant execute on function public.studio_overview(uuid) to authenticated;

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
    -- Bookings scoped to THIS studio (not the artist's independent work).
    (select count(*) from appointments ap where ap.artist_id = a.id and ap.studio_id = p_studio_id and ap.status = 'completed')::int,
    (select count(*) from appointments ap where ap.artist_id = a.id and ap.studio_id = p_studio_id and ap.status in ('scheduled', 'rescheduled'))::int,
    (select count(*) from appointments ap where ap.artist_id = a.id and ap.studio_id = p_studio_id and ap.status = 'cancelled')::int,
    (select count(*) from profile_visits pv where pv.target_type = 'artist' and pv.target_id = a.id)::int,
    coalesce((select sum(ap.price_amount) from appointments ap where ap.artist_id = a.id and ap.studio_id = p_studio_id and ap.status = 'completed'), 0)::numeric
  from studio_memberships m
  join artists a on a.id = m.artist_id
  where m.studio_id = p_studio_id and m.status = 'active'
    and public.is_studio_admin(p_studio_id)
  order by a.rating_avg desc nulls last;
$$;
grant execute on function public.studio_artist_stats(uuid) to authenticated;
