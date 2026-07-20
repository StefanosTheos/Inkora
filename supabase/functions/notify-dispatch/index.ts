// Edge Function: notify-dispatch (Deno). PRIVILEGED (service_role).
// Sends a push notification for an already-inserted `notifications` row,
// honoring the recipient's notification_preferences + active device_tokens.
//
// Invocation (server-to-server): a Supabase Database Webhook on `notifications`
// INSERT calls this with the row payload. In-app inbox rows are written by DB
// triggers already (migration 0030); this adds the PUSH fan-out via FCM v1.
//
// REQUIRED SETUP to activate (see functions/README.md):
//   1. Create a Firebase project; add an Android app; put google-services.json in
//      the mobile build (app.config plugin) so getDevicePushTokenAsync() returns
//      real FCM tokens.
//   2. Create a service account, download its JSON, and set it as an Edge
//      Function secret: `supabase secrets set FCM_SERVICE_ACCOUNT="$(cat sa.json)"`.
//   3. Create a Database Webhook: table public.notifications, event INSERT,
//      POST to this function's URL with the service_role key as a header.
import { serviceClient } from "../_shared/client.ts";
import { corsHeaders, json } from "../_shared/cors.ts";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri: string;
}

// --- Google OAuth: sign a JWT with the SA key, exchange for an access token ----
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/, "").replace(/-----END [^-]+-----/, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
function b64url(input: string | Uint8Array): string {
  const str = typeof input === "string" ? input : String.fromCharCode(...input);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  }));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claim}`)));
  const jwt = `${header}.${claim}.${b64url(sig)}`;
  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`oauth: ${JSON.stringify(body)}`);
  return body.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    // Database Webhook sends { record: {...} }; direct calls send { notificationId }.
    const payload = await req.json().catch(() => ({}));
    const notificationId = payload?.record?.id ?? payload?.notificationId;
    if (!notificationId) return json({ error: "notificationId_required" }, 400);

    const svc = serviceClient();
    const { data: notif } = await svc
      .from("notifications")
      .select("recipient_id, title, body, data, type, entity_id, entity_type")
      .eq("id", notificationId)
      .maybeSingle();
    if (!notif) return json({ error: "notification_not_found" }, 404);

    // Push is opt-in: only fan out to devices when the recipient has explicitly
    // enabled push (which the app only persists after OS-level consent).
    const { data: prefs } = await svc.from("notification_preferences").select("channels").eq("profile_id", notif.recipient_id).maybeSingle();
    if (((prefs?.channels ?? {}) as Record<string, unknown>)["push"] !== true) {
      return json({ ok: true, skipped: "push_not_enabled" });
    }

    const { data: tokens } = await svc
      .from("device_tokens")
      .select("fcm_token")
      .eq("profile_id", notif.recipient_id)
      .is("disabled_at", null);
    const targets = (tokens ?? []) as { fcm_token: string }[];
    if (targets.length === 0) {
      // Recipient opted into push but has no live device token (never registered,
      // or all tokens got disabled after rotation). Logged so this shows up
      // instead of silently reporting success.
      console.warn(`[notify-dispatch] push enabled but no active device tokens for ${notif.recipient_id} (notif ${notificationId})`);
      return json({ ok: true, sent: 0, skipped: "no_active_tokens" });
    }

    const saRaw = Deno.env.get("FCM_SERVICE_ACCOUNT");
    if (!saRaw) {
      // The whole push pipeline is inert without this secret — surface it loudly
      // in the function logs rather than returning a quiet success.
      console.error("[notify-dispatch] FCM_SERVICE_ACCOUNT is not set — no pushes will be delivered. Set it with `supabase secrets set`.");
      return json({ ok: true, sent: 0, note: "FCM_SERVICE_ACCOUNT not set — push skipped" });
    }
    // Accept either raw JSON or base64(JSON) so the secret is easy to set.
    const saJson = saRaw.trim().startsWith("{") ? saRaw : atob(saRaw);
    const sa = JSON.parse(saJson) as ServiceAccount;
    const accessToken = await getAccessToken(sa);

    // Include type + entity so the app can deep-link the tap via notificationHref
    // (FCM data values must be strings).
    const rawData = {
      ...(notif.data as Record<string, unknown> ?? {}),
      type: notif.type,
      entityId: notif.entity_id ?? "",
      entityType: notif.entity_type ?? "",
    };
    const data = Object.fromEntries(Object.entries(rawData).map(([k, v]) => [k, String(v)]));
    let sent = 0;
    let failed = 0;
    for (const t of targets) {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { token: t.fcm_token, notification: { title: notif.title, body: notif.body ?? "" }, data } }),
      });
      if (res.ok) {
        sent++;
      } else if (res.status === 404 || res.status === 400) {
        // Unregistered / invalid token → stop targeting it (FCM returns 404
        // UNREGISTERED for dead tokens and 400 INVALID_ARGUMENT for malformed).
        await svc.from("device_tokens").update({ disabled_at: new Date().toISOString() }).eq("fcm_token", t.fcm_token);
        failed++;
        console.warn(`[notify-dispatch] disabled token after FCM ${res.status} (notif ${notificationId})`);
      } else {
        // Transient/auth error (401/403/5xx): leave the token, log for triage.
        failed++;
        const errBody = await res.text().catch(() => "");
        console.error(`[notify-dispatch] FCM send failed ${res.status} (notif ${notificationId}): ${errBody.slice(0, 300)}`);
      }
    }
    return json({ ok: true, sent, failed });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? "internal" }, 500);
  }
});
