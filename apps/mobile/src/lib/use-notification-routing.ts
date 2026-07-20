import { notificationHref,type NotificationType } from "@inkora/domain";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";

/** Map a tapped notification's `data` payload to its in-app deep link. The
 *  payload is the notification's `data` jsonb — carried by FCM pushes (plus
 *  `type`/`entityId` from notify-dispatch) and by local appointment reminders
 *  (`{appointmentId, kind}`). `notificationHref` keys off appointmentId /
 *  requestId / conversationId first, then falls back to the type. */
function hrefFromData(raw: unknown): string {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d: Record<string, string> = {};
  for (const [k, v] of Object.entries(src)) if (v != null) d[k] = String(v);
  return notificationHref({
    type: (d.type as NotificationType | undefined) ?? "system",
    data: d,
    entityId: d.entityId ?? null,
    entityType: d.entityType ?? null,
  });
}

/**
 * Route a tapped notification (local reminder or FCM push) to its target
 * screen, for both a warm tap (app already running/backgrounded) and a cold
 * start (app launched by the tap). Without this the delivered deep-link `data`
 * is ignored and the tap just opens the app wherever it was. Mount once.
 */
export function useNotificationRouting() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    // Cold start: the app was launched by tapping a notification.
    void Notifications.getLastNotificationResponseAsync().then((resp) => {
      if (cancelled || !resp) return;
      router.push(hrefFromData(resp.notification.request.content.data));
    });
    // Warm: tapped while the app is running or backgrounded.
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      router.push(hrefFromData(resp.notification.request.content.data));
    });
    return () => { cancelled = true; sub.remove(); };
  }, [router]);
}
