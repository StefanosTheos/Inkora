-- =====================================================================
-- 0044  Membership application enum values
-- =====================================================================
-- Artists can now apply to work at a studio (artist-initiated membership),
-- the mirror of the existing studio-initiated 'invited' flow. This needs a
-- new membership_status ('requested') and a self-documenting notification
-- type ('membership_request') for the studio owner.
--
-- Enum values live in their OWN migration on purpose: Postgres forbids using
-- a newly-added enum value in the same transaction that adds it, so the RPCs
-- that reference these values (0045) must run only after this file commits.
alter type membership_status add value if not exists 'requested';
alter type notification_type add value if not exists 'membership_request';
