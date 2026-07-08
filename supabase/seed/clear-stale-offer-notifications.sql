-- =====================================================================
-- One-off cleanup: clear stale "new offer" notifications.
--
-- Before the chat accept/decline handler learned to mark an offer's
-- notification read (markEntityNotificationsRead on respond), seekers who
-- responded to an offer from within the chat were left with a lingering unread
-- 'offer' notification. That inflated their offer badges — the bookings
-- "Requests" tab and the dashboard "Upcoming · See all" — so the count never
-- dropped after they accepted/declined.
--
-- This marks read every unread 'offer' notification whose offer is no longer
-- pending (accepted / declined / withdrawn / expired). It only touches
-- already-resolved offers, so live pending offers keep their badge. Idempotent
-- — safe to re-run.
-- =====================================================================
set search_path = public, extensions;

update public.notifications n
set read_at = now()
from public.offers o
where n.type = 'offer'
  and n.entity_type = 'offer'
  and n.entity_id = o.id
  and o.status <> 'pending'
  and n.read_at is null;
