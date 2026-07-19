-- =====================================================================
-- 0044  STUDIO CALENDAR: upcoming + completed bookings with detail
-- ---------------------------------------------------------------------
-- Backs the studio owner's in-depth calendar: every upcoming (scheduled /
-- rescheduled) and past completed booking in a window, each with its artist,
-- client, price, session length and the request's placement/size/colour. Same
-- stable attribution (appointments.studio_id) and admin gate as the other studio
-- RPCs; windowed by scheduled_start (the calendar's day axis) with boundaries
-- computed client-side. Cancellations / no-shows are intentionally excluded —
-- the calendar shows what's happening, not what fell through.
-- =====================================================================
set search_path = public, extensions;

create or replace function public.studio_calendar_bookings(
  p_studio_id uuid,
  p_start     timestamptz,
  p_end       timestamptz
) returns table (
  appointment_id  uuid,
  scheduled_start timestamptz,
  scheduled_end   timestamptz,
  status          text,
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
    ap.status::text,
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
    and ap.status in ('scheduled', 'rescheduled', 'completed')
    and ap.scheduled_start >= p_start
    and ap.scheduled_start <  p_end
    and public.is_studio_admin(p_studio_id)
  order by ap.scheduled_start asc;
$$;
grant execute on function public.studio_calendar_bookings(uuid, timestamptz, timestamptz) to authenticated;
