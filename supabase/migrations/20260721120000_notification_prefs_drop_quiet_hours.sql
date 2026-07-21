-- =====================================================================
-- 0058  NOTIFICATION PREFERENCES — drop the never-wired quiet-hours model
-- ---------------------------------------------------------------------
-- The original table shipped a per-type channel + quiet-hours model that was
-- never implemented. In practice the app only ever reads/writes a FLAT `channels`
-- jsonb of booleans ({ "push": bool, "email": bool }); quiet_hours_start,
-- quiet_hours_end and timezone have no reader anywhere in the app or functions.
-- Drop the dead columns (and their paired-null constraint) so the schema matches
-- what actually ships.
--
-- Behaviour that remains: in-app inbox notifications are ALWAYS created;
-- `channels.push` gates push dispatch (notify-dispatch / use-push-sync), and
-- email is opt-in and additionally feature-flagged off client-side. Absence of a
-- row or of a key means that channel is OFF (opt-in).
-- =====================================================================
set search_path = public, extensions;

alter table public.notification_preferences
  drop constraint if exists quiet_hours_paired,
  drop column if exists quiet_hours_start,
  drop column if exists quiet_hours_end,
  drop column if exists timezone;

comment on column public.notification_preferences.channels is
  'Flat delivery-channel toggles as jsonb booleans, e.g. {"push": true, "email": false}. A missing key (or missing row) means that channel is OFF — delivery is opt-in. In-app inbox notifications are created regardless of this.';
