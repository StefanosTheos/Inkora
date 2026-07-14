import type { DevicePlatform, NotificationType } from "../enums";
import type { NotificationId, ProfileId } from "../ids";

export interface Notification {
  id: NotificationId;
  recipientId: ProfileId;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, string>;   // deep-link target etc.
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface DeviceToken {
  fcmToken: string;
  platform: DevicePlatform;
}

export interface NotificationPreferences {
  channels: Partial<Record<NotificationType, { inApp: boolean; push: boolean }>>;
  quietHours?: { start: string; end: string; timezone: string };
}

/** Emoji glyph shown on an inbox row per type. */
export const NOTIFICATION_ICON: Record<NotificationType, string> = {
  message: "💬",
  booking_request: "📩",
  booking_update: "📅",
  offer: "🏷️",
  review: "⭐",
  reward: "🎁",
  follow: "➕",
  system: "🔔",
  membership_request: "🎨",
  journey: "📸",
};

/**
 * Resolve the in-app route a notification should deep-link to.
 * Pure — the same mapping works on mobile (expo-router) and web (next).
 */
export function notificationHref(n: Pick<Notification, "type" | "data" | "entityId" | "entityType">): string {
  const d = n.data ?? {};
  if (d["appointmentId"]) return `/booking/${d["appointmentId"]}`;
  if (d["requestId"]) return `/booking/${d["requestId"]}`;
  if (d["conversationId"]) return `/chats/${d["conversationId"]}`;
  switch (n.type) {
    case "message":
      return n.entityId ? `/chats/${n.entityId}` : "/chats";
    case "booking_request":
    case "booking_update":
    case "offer":
      return "/bookings";
    case "journey":
      return n.entityId ? `/journey/${n.entityId}` : "/journey";
    case "reward":
      return "/rewards";
    case "membership_request":
      // Owner's "new application" (has artistId) -> Applications inbox.
      // Artist's invitation (has studioSlug) -> the studio page to accept.
      if (d["artistId"]) return "/studio-applications";
      if (d["studioSlug"]) return `/studio/${d["studioSlug"]}`;
      return "/notifications";
    default:
      return "/notifications";
  }
}
