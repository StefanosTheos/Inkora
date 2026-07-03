import type { Database } from "@inkora/data-access";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "./env";

/**
 * Server Supabase client for RSC, Route Handlers, and Server Actions.
 * Cookie writes from a Server Component throw (read-only) — caught and ignored;
 * the middleware is responsible for refreshing/persisting the session cookie.
 */
export function createClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* called from a Server Component — ignore; middleware handles refresh */
        }
      },
    },
  });
}
