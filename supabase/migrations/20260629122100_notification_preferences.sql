-- =====================================================================
-- 0022  NOTIFICATION PREFERENCES  (per-type channel toggles + quiet hours)
-- ---------------------------------------------------------------------
-- `channels` shape: { "message": {"inApp": true, "push": true}, ... }
-- ABSENCE OF A ROW (or of a type key) MEANS ENABLED — the dispatcher
-- treats missing prefs as "all channels on", so no signup backfill needed.
-- =====================================================================
create table public.notification_preferences (
  profile_id        uuid primary key references public.profiles(id) on delete cascade,
  channels          jsonb not null default '{}'::jsonb,
  quiet_hours_start time,
  quiet_hours_end   time,
  timezone          text not null default 'UTC',
  updated_at        timestamptz not null default now(),
  -- if one quiet-hours bound is set, both must be
  constraint quiet_hours_paired
    check ((quiet_hours_start is null) = (quiet_hours_end is null))
);
create trigger trg_notification_prefs_updated before update on public.notification_preferences
  for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;

create policy notif_prefs_owner on public.notification_preferences for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
