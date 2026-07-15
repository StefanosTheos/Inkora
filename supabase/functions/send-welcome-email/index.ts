// Edge Function: send-welcome-email. Sends the ONE-TIME welcome email via Resend
// when a new user consents to email during onboarding.
//
// This is the only lifecycle email the app sends automatically — everyday
// activity (bookings, applications, messages) is covered by in-app + push
// notifications, not email. Future marketing/announcement emails are a separate,
// opt-in broadcast that honors notification_preferences.channels.email.
//
// SETUP to activate: create a Resend account, verify a sending domain, then set
//   supabase secrets set RESEND_API_KEY="re_..."
//   supabase secrets set EMAIL_FROM="Inkora <hello@yourdomain.com>"
// Until RESEND_API_KEY is set this returns 200 with skipped:"resend_not_configured"
// so the onboarding flow never breaks.
import { getCaller } from "../_shared/client.ts";
import { corsHeaders, json } from "../_shared/cors.ts";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function welcomeHtml(name: string): string {
  const safe = escapeHtml(name);
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
      <div style="background:#18181B;border-radius:20px;padding:36px 28px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#fff;">Welcome to Inkora</div>
        <div style="color:#A1A1AA;font-size:15px;margin-top:8px;">Your tattoo journey starts here 🖤</div>
      </div>
      <div style="background:#fff;border-radius:20px;padding:28px;margin-top:16px;color:#3F3F46;font-size:15px;line-height:1.6;">
        <p style="margin:0 0 14px;">Hi ${safe},</p>
        <p style="margin:0 0 14px;">Thanks for joining Inkora — where seekers, artists and studios connect. Discover artists whose style matches your taste, save ideas, and book with confidence.</p>
        <p style="margin:0 0 14px;">We'll only email you now and then about big news, offers and app updates. Everything about your day-to-day — bookings, offers and messages — comes through the app's notifications, so we'll keep your inbox quiet.</p>
        <p style="margin:0;">See you inside,<br/>The Inkora team</p>
      </div>
      <div style="text-align:center;color:#A1A1AA;font-size:12px;margin-top:16px;">You're receiving this because you enabled email updates when you signed up.</div>
    </div>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const user = await getCaller(req);
    if (!user) return json({ error: "unauthenticated" }, 401);
    const email = user.email;
    if (!email) return json({ ok: true, skipped: "no_email" });

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return json({ ok: true, skipped: "resend_not_configured" });
    const from = Deno.env.get("EMAIL_FROM") ?? "Inkora <onboarding@resend.dev>";
    const name = (user.user_metadata as { display_name?: string } | undefined)?.display_name ?? "there";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email], subject: "Welcome to Inkora 🖤", html: welcomeHtml(name) }),
    });
    if (!res.ok) return json({ error: `resend: ${await res.text()}` }, 502);
    return json({ ok: true, sent: true });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? "internal" }, 500);
  }
});
