import { useConversations, useMyRequests, useNotifications } from "@inkora/data-access";

import { useSeenRequests } from "./seen-requests";
import { supabase } from "./supabase";

/**
 * Unread counts that drive the app's notification dots/badges. All derived
 * from the shared notifications cache (same source as the bell), the
 * conversations list, and the seeker's own requests, so every badge stays in
 * sync.
 */
export function useBadgeCounts() {
  const { notifications } = useNotifications(supabase);
  const convs = useConversations(supabase);
  const myRequests = useMyRequests(supabase, "client");
  const seenRequests = useSeenRequests();
  const unread = notifications.filter((n) => !n.readAt);
  return {
    rewards: unread.filter((n) => n.type === "reward").length,
    offers: unread.filter((n) => n.type === "offer").length,
    // Booking requests badge = new incoming requests + the client's responses to
    // the artist's offers (accepted/declined). Offer responses arrive as
    // booking_update notifications scoped to an appointment_request entity, which
    // keeps them distinct from appointment updates (booking_update on an
    // appointment). New requests clear when answered; responses clear when the
    // artist opens the Booking requests page.
    requests: unread.filter(
      (n) => n.type === "booking_request" || (n.type === "booking_update" && n.entityType === "appointment_request"),
    ).length,
    journey: unread.filter((n) => n.type === "journey").length,
    chats: (convs.data ?? []).filter((c) => c.unread).length,
    // Seeker's own booking requests still awaiting the artist that they haven't
    // opened yet. Making a request lights the badge; opening its booking page
    // (marks it seen) or the artist offering/declining clears it. Offers to
    // respond to are covered separately by `offers`.
    openRequests: (myRequests.data ?? []).filter(
      (r) => (r.status === "pending" || r.status === "reviewing") && !seenRequests.includes(r.id),
    ).length,
  };
}
