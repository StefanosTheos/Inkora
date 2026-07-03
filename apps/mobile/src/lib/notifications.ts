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

/** Register the device's push token so the server can send remote pushes (FCM). */
export async function registerPushToken(): Promise<void> {
  try {
    if (!(await ensureNotificationPermissions())) return; // denied / can't ask again
    const token = (await Notifications.getDevicePushTokenAsync()).data;
    if (!token) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase
      .from("device_tokens")
      .upsert({ profile_id: data.user.id, fcm_token: token, platform: Platform.OS as "ios" | "android" | "web" }, { onConflict: "fcm_token" });
  } catch (e) {
    console.warn("[push] token registration failed:", (e as Error)?.message ?? e);
  }
}

const REMINDER_OFFSETS = [
  { hours: 24, label: "tomorrow" },
  { hours: 2, label: "in 2 hours" },
];

/**
 * Re-schedule local reminders for all upcoming scheduled appointments.
 * Clears previously scheduled reminders first so it's idempotent per refresh.
 */
export async function scheduleAppointmentReminders(appointments: AppointmentView[]): Promise<void> {
  try {
    if (!(await ensureNotificationPermissions())) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = Date.now();
    for (const appt of appointments) {
      if (appt.status !== "scheduled" && appt.status !== "rescheduled") continue;
      const start = new Date(appt.scheduledStart).getTime();
      for (const off of REMINDER_OFFSETS) {
        const fireAt = start - off.hours * 3600_000;
        if (fireAt <= now) continue;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Tattoo appointment ${off.label}`,
            body: `with ${appt.counterparty.name}`,
            data: { appointmentId: appt.id },
          },
          trigger: { date: new Date(fireAt), channelId: "reminders" },
        });
      }
    }
  } catch {
    // best-effort
  }
}
