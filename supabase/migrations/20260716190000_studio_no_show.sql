-- =====================================================================
-- 0043  NO-SHOW: count it in studio stats (revenue-loss signal)
-- ---------------------------------------------------------------------
-- The appointment_status enum has 'no_show' but nothing set it and no stat
-- counted it, so a real revenue-loss signal was invisible. The app now lets an
-- artist mark a client no-show (sets status='no_show', cancelled_at=now()).
-- This surfaces it in the three studio-stat functions.
--
-- Return types change (new columns), so each function is dropped and recreated.
-- `drop ... if exists` keeps this safe whether or not the period function from
-- migration 0042 has been applied yet. Everything else matches 0041/0042:
-- bookings attributed by studio_id; no_show timed by cancelled_at (set when the
-- artist marks it), coalesced to updated_at for safety.
-- =====================================================================
set search_path = public, extensions;

drop function if exists public.studio_overview(uuid);
create or replace function public.studio_overview(p_studio_id uuid)
returns table (
  active_artists       int,
  pending_applications int,
  profile_visits       int,
  completed_bookings   int,
  scheduled_bookings   int,
  cancelled_bookings   int,
  no_show_bookings     int,
  revenue              numeric,
  studio_saves         int,
  rating_avg           numeric,
  rating_count         int
)
language sql stable security definer set search_path = public as $$
  with studio_appts as (
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
    (select count(*) from studio_appts where status = 'no_show')::int,
    coalesce((select sum(price_amount) from studio_appts where status = 'completed'), 0)::numeric,
    (select count(*) from favorites f where f.target_type = 'studio' and f.target_id = p_studio_id)::int,
    coalesce((select round(avg(r.overall_rating), 2) from reviews r where r.studio_id = p_studio_id and r.is_published), 0)::numeric,
    (select count(*) from reviews r where r.studio_id = p_studio_id and r.is_published)::int
  where public.is_studio_admin(p_studio_id);
$$;
grant execute on function public.studio_overview(uuid) to authenticated;

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
  where m.studio_id = p_studio_id and m.status = 'active'
    and public.is_studio_admin(p_studio_id)
  order by a.rating_avg desc nulls last;
$$;
grant execute on function public.studio_artist_stats(uuid) to authenticated;

drop function if exists public.studio_overview_period(uuid, timestamptz, timestamptz, timestamptz, timestamptz);
create or replace function public.studio_overview_period(
  p_studio_id  uuid,
  p_cur_start  timestamptz,
  p_cur_end    timestamptz,
  p_prev_start timestamptz,
  p_prev_end   timestamptz
) returns table (
  completed           int,
  cancelled           int,
  no_show             int,
  revenue             numeric,
  profile_visits      int,
  prev_completed      int,
  prev_cancelled      int,
  prev_no_show        int,
  prev_revenue        numeric,
  prev_profile_visits int
)
language sql stable security definer set search_path = public as $$
  with appts as (
    select
      status,
      price_amount,
      coalesce(completed_at, updated_at) as completed_ts,
      coalesce(cancelled_at, updated_at) as cancelled_ts
    from appointments
    where studio_id = p_studio_id
  ),
  vis as (
    select created_at
    from profile_visits
    where target_type = 'studio' and target_id = p_studio_id
  )
  select
    (select count(*) from appts where status = 'completed' and completed_ts >= p_cur_start and completed_ts < p_cur_end)::int,
    (select count(*) from appts where status = 'cancelled' and cancelled_ts >= p_cur_start and cancelled_ts < p_cur_end)::int,
    (select count(*) from appts where status = 'no_show'   and cancelled_ts >= p_cur_start and cancelled_ts < p_cur_end)::int,
    coalesce((select sum(price_amount) from appts where status = 'completed' and completed_ts >= p_cur_start and completed_ts < p_cur_end), 0)::numeric,
    (select count(*) from vis where created_at >= p_cur_start and created_at < p_cur_end)::int,
    (select count(*) from appts where status = 'completed' and completed_ts >= p_prev_start and completed_ts < p_prev_end)::int,
    (select count(*) from appts where status = 'cancelled' and cancelled_ts >= p_prev_start and cancelled_ts < p_prev_end)::int,
    (select count(*) from appts where status = 'no_show'   and cancelled_ts >= p_prev_start and cancelled_ts < p_prev_end)::int,
    coalesce((select sum(price_amount) from appts where status = 'completed' and completed_ts >= p_prev_start and completed_ts < p_prev_end), 0)::numeric,
    (select count(*) from vis where created_at >= p_prev_start and created_at < p_prev_end)::int
  where public.is_studio_admin(p_studio_id);
$$;
grant execute on function public.studio_overview_period(uuid, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;
