// Edge Function: notify-dispatch (Deno). PRIVILEGED (service_role).
// Sends a push notification for an already-inserted `notifications` row,
// honoring the recipient's notification_preferences + active device_tokens.
//
// Invocation (server-to-server): a DB trigger/webhook on `notifications` INSERT
// calls this with { notificationId }. In-app inbox rows are written by DB
// triggers already (migration 0030); this only adds the PUSH fan-out.
//
// STATUS: scaffold. The FCM send is stubbed behind an env secret because it
// needs a Firebase credential this repo can't hold.
// TODO(push):
//   1. Set FCM_SERVICE_ACCOUNT (HTTP v1) as an Edge Function secret.
//   2. Mint an OAuth access token from the service account (googleapis auth).
//   3. POST to https://fcm.googleapis.com/v1/projects/<id>/messages:send per token.
//   4. On UNREGISTERED/InvalidRegistration, set device_tokens.disabled_at.
//   5. Wire a DB webhook: notifications INSERT -> invoke this function.
import { serviceClient } from "../_shared/client.ts";
import { corsHeaders, json } from "../_shared/cors.ts";

interface DeviceToken { fcm_token: string; platform: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const { notificationId } = await req.json().catch(() => ({ notificationId: undefined }));
    if (!notificationId) return json({ error: "notificationId_required" }, 400);

    const svc = serviceClient();

    // 1. load the notification
    const { data: notif } = await svc
      .from("notifications")
      .select("recipient_id, type, title, body, data")
      .eq("id", notificationId)
      .maybeSingle();
    if (!notif) return json({ error: "notification_not_found" }, 404);

    // 2. respect push preference (default on)
    const { data: prefs } = await svc
      .from("notification_preferences")
      .select("channels")
      .eq("profile_id", notif.recipient_id)
      .maybeSingle();
    const channels = (prefs?.channels ?? {}) as Record<string, unknown>;
    if (channels["push"] === false) return json({ ok: true, skipped: "push_disabled" });

    // 3. load active device tokens
    const { data: tokens } = await svc
      .from("device_tokens")
      .select("fcm_token, platform")
      .eq("profile_id", notif.recipient_id)
      .is("disabled_at", null);
    const targets = (tokens ?? []) as DeviceToken[];
    if (targets.length === 0) return json({ ok: true, sent: 0 });

    // 4. send — STUBBED. See TODO(push) above.
    const FCM_CONFIGURED = Boolean(Deno.env.get("FCM_SERVICE_ACCOUNT"));
    if (!FCM_CONFIGURED) {
      return json({ ok: true, sent: 0, note: "FCM not configured — push send skipped (placeholder)" });
    }
    // TODO(push): real HTTP v1 send loop here.
    return json({ ok: true, sent: 0, note: "send not implemented" });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? "internal" }, 500);
  }
});
