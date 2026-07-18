// Local reminder scheduling for upcoming appointments + push-token registration.
// Uses expo-notifications. Requires a native rebuild after adding the dependency.
import type { AppointmentView } from "@inkora/domain";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { supabase } from "./supabase";

// Foreground presentation: show the banner even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let permissionAsked = false;

/** Current OS notification permission (for surfacing an "enable in settings" nudge). */
export async function getPushPermission(): Promise<{ granted: boolean; canAskAgain: boolean }> {
  const p = await Notifications.getPermissionsAsync();
  return { granted: p.granted, canAskAgain: p.canAskAgain };
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (permissionAsked && !current.canAskAgain) return false;
  permissionAsked = true;
  const req = await Notifications.requestPermissionsAsync();
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Appointment reminders",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  return req.granted;
}

/** Upsert the current user's device token, (re)activating it if it was disabled. */
async function storeToken(token: string): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  const { error } = await supabase
    .from("device_tokens")
    .upsert(
      { profile_id: data.user.id, fcm_token: token, platform: Platform.OS as "ios" | "android" | "web", disabled_at: null },
      { onConflict: "fcm_token" },
    );
  return !error;
}

/**
 * Register the device's push token so the server can send remote pushes (FCM).
 * Requests OS permission if needed. Returns true only if permission was granted
 * and a token was stored — callers use this to gate the push opt-in.
 */
export async function registerPushToken(): Promise<boolean> {
  try {
    if (!(await ensureNotificationPermissions())) return false; // denied / can't ask again
    const token = (await Notifications.getDevicePushTokenAsync()).data;
    if (!token) return false;
    return await storeToken(token);
  } catch (e) {
    console.warn("[push] token registration failed:", (e as Error)?.message ?? e);
    return false;
  }
}

let tokenListenerBound = false;

/**
 * Keep the stored FCM token fresh without ever prompting. FCM tokens rotate
 * (app reinstall, restore, periodic refresh); if the stored one goes stale the
 * server 404s it, disables it, and push silently stops. Call this on every boot
 * for a signed-in user whose push is enabled: it re-upserts the *current* token
 * only when OS permission is already granted, and subscribes to in-session
 * rotations so a live token is always on file.
 */
export async function syncPushRegistration(pushEnabled: boolean): Promise<void> {
  try {
    if (!pushEnabled) return;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return; // never prompt here — opt-in owns that
    const token = (await Notifications.getDevicePushTokenAsync()).data;
    if (token) await storeToken(token);
    if (!tokenListenerBound) {
      tokenListenerBound = true;
      Notifications.addPushTokenListener((t) => {
        if (t?.data) void storeToken(String(t.data));
      });
    }
  } catch (e) {
    console.warn("[push] token sync failed:", (e as Error)?.message ?? e);
  }
}

const REMINDER_OFFSETS = [
  { hours: 24, label: "tomorrow" },
  { hours: 2, label: "in 2 hours" },
];

/** Stable per-(appointment, offset) identifier so reminders can be reconciled
 *  individually — never a blanket "cancel everything". */
const reminderId = (appointmentId: string, hours: number) => `appt-reminder-${appointmentId}-${hours}h`;

/**
 * Reconcile local reminders (24h + 2h before) for the given appointments,
 * keyed by a stable identifier per appointment. For each one it cancels any
 * prior reminder and re-creates it only if the appointment is still active and
 * the fire time is in the future — so a reschedule moves the reminder and a
 * cancellation removes it, on the next data refresh.
 *
 * Scoped by identifier: it never touches unrelated local notifications, and
 * calling it from multiple screens is idempotent (they converge on the same set
 * instead of wiping each other). Silent when notification permission isn't
 * already granted — it never prompts (push/reminders are opt-in elsewhere).
 */
export async function scheduleAppointmentReminders(appointments: AppointmentView[]): Promise<void> {
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return; // don't prompt from here
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("reminders", {
        name: "Appointment reminders",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const now = Date.now();
    for (const appt of appointments) {
      const active = appt.status === "scheduled" || appt.status === "rescheduled";
      const start = new Date(appt.scheduledStart).getTime();
      for (const off of REMINDER_OFFSETS) {
        const id = reminderId(appt.id, off.hours);
        // Clear this appointment's prior reminder (no-op if none), then re-create
        // if still wanted — handles reschedule (moves it) and cancel (drops it).
        await Notifications.cancelScheduledNotificationAsync(id);
        const fireAt = start - off.hours * 3600_000;
        if (active && fireAt > now) {
          await Notifications.scheduleNotificationAsync({
            identifier: id,
            content: {
              title: `Tattoo appointment ${off.label}`,
              body: `with ${appt.counterparty.name}`,
              data: { appointmentId: appt.id, kind: "appt_reminder" },
            },
            trigger: { date: new Date(fireAt), channelId: "reminders" },
          });
        }
      }
    }
  } catch {
    // best-effort
  }
}
