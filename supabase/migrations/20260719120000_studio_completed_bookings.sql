-- =====================================================================
-- 0043  STUDIO INSIGHTS: completed-bookings detail (per day/week/month)
-- ---------------------------------------------------------------------
-- The dashboard's period overview aggregates totals. This backs a drill-down
-- report where the owner sees EVERY completed booking in a window with its
-- artist, client, price and session length (plus the request's placement/size
-- when the booking came from one). Attributed by appointments.studio_id — the
-- same stable basis as studio_overview (migration 0041) — and gated to the
-- studio's admin. Windowed by scheduled_start (the session date), which is what
-- "per day / per week / per month" means to the owner; the client computes the
-- local-time boundaries and passes them in (as studio_overview_period does).
-- =====================================================================
set search_path = public, extensions;

create or replace function public.studio_completed_bookings(
  p_studio_id uuid,
  p_start     timestamptz,
  p_end       timestamptz
) returns table (
  appointment_id  uuid,
  scheduled_start timestamptz,
  scheduled_end   timestamptz,
  price_amount    numeric,
  artist_id       uuid,
  artist_name     text,
  artist_avatar   text,
  client_id       uuid,
  client_name     text,
  client_avatar   text,
  title           text,
  placement       text,
  approx_size     text,
  is_color        boolean
)
language sql stable security definer set search_path = public as $$
  select
    ap.id,
    ap.scheduled_start,
    ap.scheduled_end,
    ap.price_amount,
    ap.artist_id,
    ar.display_name,
    ar.avatar_path,
    ap.client_id,
    cl.display_name,
    cl.avatar_path,
    rq.title,
    rq.placement,
    rq.approx_size,
    rq.is_color
  from appointments ap
  join profiles ar on ar.id = ap.artist_id        -- artists.id == profiles.id
  join profiles cl on cl.id = ap.client_id
  left join appointment_requests rq on rq.id = ap.request_id
  where ap.studio_id = p_studio_id
    and ap.status = 'completed'
    and ap.scheduled_start >= p_start
    and ap.scheduled_start <  p_end
    and public.is_studio_admin(p_studio_id)
  order by ap.scheduled_start desc;
$$;
grant execute on function public.studio_completed_bookings(uuid, timestamptz, timestamptz) to authenticated;
