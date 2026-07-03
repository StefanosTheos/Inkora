import type { Database } from "@inkora/data-access";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest,NextResponse } from "next/server";

import { env } from "./env";

/**
 * Minimal, pure decode of the `app_roles` claim for the edge runtime.
 * Mirrors @inkora/data-access's rolesFromAccessToken but inlined to avoid bundling
 * React/supabase-js into middleware. Signature is NOT verified here — that happens
 * server-side at the API; this is only for cheap routing decisions.
 */
export function rolesFromToken(accessToken?: string): string[] {
  if (!accessToken) return [];
  try {
    const part = accessToken.split(".")[1];
    if (!part) return [];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const payload = JSON.parse(globalThis.atob(b64)) as { app_roles?: unknown };
    return Array.isArray(payload.app_roles) ? (payload.app_roles as string[]) : [];
  } catch {
    return [];
  }
}

/** Refresh the auth cookie on every request and return the user + the response carrying updated cookies. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Touch getUser() to trigger token refresh and cookie rotation.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return { user, roles: rolesFromToken(session?.access_token), response };
}
