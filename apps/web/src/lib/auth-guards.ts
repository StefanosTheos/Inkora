import { redirect } from "next/navigation";

import { createClient } from "./supabase-server";

/**
 * Server-side guards for RSC / Server Actions (defense-in-depth alongside middleware).
 * RLS remains the real boundary; these are for UX redirects + typed access to the user.
 */
export async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

/** Use in authenticated feature layouts (NOT public profile/SEO pages). */
export async function requireOnboarded() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("profiles").select("onboarded_at").eq("id", user.id).maybeSingle();
  if (!(data as { onboarded_at: string | null } | null)?.onboarded_at) redirect("/onboarding");
  return user;
}
