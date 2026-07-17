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
      // Artist's invitation -> the studio page to accept/decline.
      if (d["invite"] === "true" && d["studioSlug"]) return `/studio/${d["studioSlug"]}`;
      // Owner's "new application" (has artistId) -> Applications inbox.
      if (d["artistId"]) return "/studio-applications";
      // Owner-facing roster changes (invite accepted/declined, artist joined/
      // left) -> the studio roster.
      if (d["audience"] === "owner") return "/studio-dashboard/roster";
      // Fall back to the studio page when we have a slug…
      if (d["studioSlug"]) return `/studio/${d["studioSlug"]}`;
      // …otherwise this is an artist-facing status change (application
      // accepted/declined/expired, suspended/removed/reactivated) -> their
      // dashboard, which shows their current studio affiliation.
      return "/artist-dashboard";
    default:
      return "/notifications";
  }
}
