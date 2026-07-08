-- =====================================================================
-- 0056  Preferred time of day on a booking request
-- =====================================================================
-- The seeker communicates only a preferred date; the artist proposes the exact
-- time. A coarse time-of-day preference (morning/afternoon/evening) guides that
-- proposal without pinning a time. Null = flexible.
set search_path = public, extensions;

alter table public.appointment_requests
  add column if not exists preferred_time_of_day text
  check (preferred_time_of_day in ('morning', 'afternoon', 'evening'));
