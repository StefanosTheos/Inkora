import { useConversations, useNotifications } from "@inkora/data-access";

import { supabase } from "./supabase";

/**
 * Unread counts that drive the app's notification dots/badges. All derived
 * from the shared notifications cache (same source as the bell) plus the
 * conversations list, so every badge stays in sync.
 */
export function useBadgeCounts() {
  const { notifications } = useNotifications(supabase);
  const convs = useConversations(supabase);
  const unread = notifications.filter((n) => !n.readAt);
  return {
    rewards: unread.filter((n) => n.type === "reward").length,
    offers: unread.filter((n) => n.type === "offer").length,
    requests: unread.filter((n) => n.type === "booking_request").length,
    journey: unread.filter((n) => n.type === "journey").length,
    chats: (convs.data ?? []).filter((c) => c.unread).length,
  };
}
