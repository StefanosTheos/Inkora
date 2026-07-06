-- =====================================================================
-- 0050  Journey enum values
-- =====================================================================
-- New reward reasons for the per-booking tattoo journey (milestone photo +
-- full completion bonus) and a notification type for milestone reminders.
-- Enum values live in their own migration: Postgres can't use a value in the
-- same transaction that adds it, so the functions that reference them (0051,
-- 0052) must run only after this commits.
alter type reward_reason    add value if not exists 'journey_milestone';
alter type reward_reason    add value if not exists 'journey_completed';
alter type notification_type add value if not exists 'journey';
