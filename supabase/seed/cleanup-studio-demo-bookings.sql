-- =====================================================================
-- ONE-TIME CLEANUP: stale demo bookings from the earlier studio-owner seed
--   The first version of studio-owner-demo.sql created scheduled/cancelled
--   bookings for the Iron Lotus roster WITHOUT a studio_id. The current version
--   tags them with studio_id, so those old untagged rows now double-count.
--   This deletes ONLY rows matching that old seed's exact signature (studio_id
--   NULL + a current roster artist + the specific price/status/reason), so it
--   can't affect real bookings or the newly-seeded studio-tagged ones.
--   Run once in the SQL Editor; it's a no-op on subsequent runs.
-- =====================================================================
delete from public.appointments ap
using public.studio_memberships m
where m.studio_id = 'e1000000-0000-4000-8000-000000000001'
  and m.status = 'active'
  and ap.artist_id = m.artist_id
  and ap.studio_id is null
  and (
    (ap.status = 'scheduled' and ap.price_amount = 180 and ap.scheduled_start > now())
    or (ap.status = 'cancelled' and ap.price_amount = 160 and ap.cancellation_reason = 'Client rescheduled elsewhere')
  );
