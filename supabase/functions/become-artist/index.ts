// Edge Function: become-artist (PRIVILEGED, service_role).
// Self-service role elevation to ARTIST. role_grants has no client write policy,
// so this is the only path to grant it. Idempotent.
import { getCaller, serviceClient } from "../_shared/client.ts";
import { corsHeaders, json } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const user = await getCaller(req);
    if (!user) return json({ error: "unauthenticated" }, 401);

    const { headline } = await req.json().catch(() => ({ headline: undefined }));
    const svc = serviceClient();

    // grant role (idempotent on (profile_id, role))
    const { error: roleErr } = await svc
      .from("role_grants")
      .upsert({ profile_id: user.id, role: "artist" }, { onConflict: "profile_id,role", ignoreDuplicates: true });
    if (roleErr) return json({ error: roleErr.message }, 400);

    // create the artist record (idempotent on id)
    const { error: artistErr } = await svc
      .from("artists")
      .upsert({ id: user.id, headline: headline ?? null }, { onConflict: "id", ignoreDuplicates: true });
    if (artistErr) return json({ error: artistErr.message }, 400);

    await svc.from("audit_log").insert({
      actor_id: user.id,
      action: "role.grant",
      entity_type: "role_grants",
      entity_id: user.id,
      after: { role: "artist" },
    });

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? "internal" }, 500);
  }
});
