// Edge Function: create-studio (PRIVILEGED, service_role).
// Creates a studio owned by the caller and grants the studio_admin role.
import { getCaller, serviceClient } from "../_shared/client.ts";
import { corsHeaders, json } from "../_shared/cors.ts";

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${base || "studio"}-${crypto.randomUUID().slice(0, 6)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const user = await getCaller(req);
    if (!user) return json({ error: "unauthenticated" }, 401);

    const body = await req.json().catch(() => null);
    if (!body?.name || typeof body.latitude !== "number" || typeof body.longitude !== "number") {
      return json({ error: "validation: name, latitude, longitude required" }, 400);
    }

    const svc = serviceClient();

    const { data: studio, error: studioErr } = await svc
      .from("studios")
      .insert({
        owner_id: user.id,
        name: body.name,
        slug: slugify(body.name),
        city: body.city ?? null,
        latitude: body.latitude,
        longitude: body.longitude,
      })
      .select("id")
      .single();
    if (studioErr || !studio) return json({ error: studioErr?.message ?? "insert_failed" }, 400);

    const { error: roleErr } = await svc
      .from("role_grants")
      .upsert({ profile_id: user.id, role: "studio_admin" }, { onConflict: "profile_id,role", ignoreDuplicates: true });
    if (roleErr) return json({ error: roleErr.message }, 400);

    // Keep account types separate: a studio owner is not also a seeker.
    const { error: seekerErr } = await svc
      .from("role_grants")
      .delete()
      .eq("profile_id", user.id)
      .eq("role", "seeker");
    if (seekerErr) return json({ error: seekerErr.message }, 400);

    await svc.from("audit_log").insert({
      actor_id: user.id,
      action: "studio.create",
      entity_type: "studios",
      entity_id: studio.id,
      after: { name: body.name },
    });

    return json({ studioId: studio.id });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? "internal" }, 500);
  }
});
