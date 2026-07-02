-- =====================================================================
-- 0034  Public studio rosters
-- =====================================================================
-- The only SELECT policy on studio_memberships restricted reads to the
-- artist themselves or studio admins — so a seeker browsing a studio saw
-- an empty Artists tab. A studio's ACTIVE roster is public marketplace
-- info, so allow anyone to read active memberships. (Invited/suspended
-- rows stay private under the existing memb_read policy.)
create policy memb_public_read on public.studio_memberships
  for select using (status = 'active');
