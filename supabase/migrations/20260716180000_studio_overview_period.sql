-- =====================================================================
-- 0042  STUDIO STATS: period-scoped activity (30d / MTD / YTD + trends)
-- ---------------------------------------------------------------------
-- studio_overview totals are all-time, so an owner can't answer "how did we do
-- this month?". This adds a window-scoped aggregate for the activity metrics
-- (completed bookings, revenue, cancellations, profile visits) plus the prior
-- equal-length window so the client can render trend arrows. Current-state
-- metrics (active artists, rating, saves, scheduled, applications) stay all-time
-- in studio_overview — a period doesn't apply to them.
--
-- Bases: completed/revenue by completed_at, cancellations by cancelled_at,
-- visits by profile_visits.created_at (coalesced to updated_at for older rows
-- that predate those columns being set). Bookings are attributed by
-- appointments.studio_id, matching studio_overview (migration 0041).
-- =====================================================================
set search_path = public, extensions;

create or replace function public.studio_overview_period(
  p_studio_id  uuid,
  p_cur_start  timestamptz,
  p_cur_end    timestamptz,
  p_prev_start timestamptz,
  p_prev_end   timestamptz
) returns table (
  completed           int,
  cancelled           int,
  revenue             numeric,
  profile_visits      int,
  prev_completed      int,
  prev_cancelled      int,
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
    coalesce((select sum(price_amount) from appts where status = 'completed' and completed_ts >= p_cur_start and completed_ts < p_cur_end), 0)::numeric,
    (select count(*) from vis where created_at >= p_cur_start and created_at < p_cur_end)::int,
    (select count(*) from appts where status = 'completed' and completed_ts >= p_prev_start and completed_ts < p_prev_end)::int,
    (select count(*) from appts where status = 'cancelled' and cancelled_ts >= p_prev_start and cancelled_ts < p_prev_end)::int,
    coalesce((select sum(price_amount) from appts where status = 'completed' and completed_ts >= p_prev_start and completed_ts < p_prev_end), 0)::numeric,
    (select count(*) from vis where created_at >= p_prev_start and created_at < p_prev_end)::int
  where public.is_studio_admin(p_studio_id);
$$;
grant execute on function public.studio_overview_period(uuid, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;
