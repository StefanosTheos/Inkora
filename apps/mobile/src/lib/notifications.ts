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

/** Common prefix for our reminder identifiers, so a reconcile can find (and only
 *  ever touch) reminders we scheduled — never unrelated local notifications. */
const REMINDER_PREFIX = "appt-reminder-";
/** Stable per-(appointment, offset) identifier. */
const reminderId = (appointmentId: string, hours: number) => `${REMINDER_PREFIX}${appointmentId}-${hours}h`;

// Serialize reconciles into a single chain. Two screens (My bookings, the
// agenda) both schedule off the shared appointments cache, so their effects can
// fire concurrently with the same data; without this their cancel/schedule
// steps interleave and leave a duplicate reminder (seen as two identical
// "appointment tomorrow" alerts). The queue makes every call run to completion
// before the next starts.
let reminderQueue: Promise<void> = Promise.resolve();

/**
 * Reconcile local reminders (24h + 2h before) for the given appointments.
 *
 * It clears every existing reminder we own, then schedules exactly one per
 * still-active, still-future (appointment, offset) — so a reschedule moves the
 * reminder, a cancellation removes it, duplicates collapse to one, and repeated
 * appointments in the input are ignored. Runs serialized (never interleaves with
 * another call) and never touches unrelated notifications. Silent when
 * notification permission isn't already granted — it never prompts.
 */
export function scheduleAppointmentReminders(appointments: AppointmentView[]): Promise<void> {
  reminderQueue = reminderQueue.then(() => reconcileReminders(appointments)).catch(() => { /* best-effort */ });
  return reminderQueue;
}

async function reconcileReminders(appointments: AppointmentView[]): Promise<void> {
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return; // don't prompt from here
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Appointment reminders",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  // Cancel every reminder we own first — this collapses any pre-existing
  // duplicates and drops reminders for now-cancelled/rescheduled slots.
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const req of existing) {
    const id = req.identifier;
    if (id && id.startsWith(REMINDER_PREFIX)) await Notifications.cancelScheduledNotificationAsync(id);
  }

  // Re-create the desired set: one reminder per active, future (appt, offset).
  const now = Date.now();
  const seen = new Set<string>();
  for (const appt of appointments) {
    if (seen.has(appt.id)) continue; // guard against the same appointment appearing twice
    seen.add(appt.id);
    const active = appt.status === "scheduled" || appt.status === "rescheduled";
    if (!active) continue;
    const start = new Date(appt.scheduledStart).getTime();
    for (const off of REMINDER_OFFSETS) {
      const fireAt = start - off.hours * 3600_000;
      if (fireAt <= now) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: reminderId(appt.id, off.hours),
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
