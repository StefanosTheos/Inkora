"use client";
import type { Database } from "@inkora/data-access";
import { createBrowserClient } from "@supabase/ssr";
import { env } from "./env";

/**
 * Browser Supabase client (@supabase/ssr). Persists the session to cookies so the
 * server (middleware, RSC, route handlers) can read it. Singleton per tab.
 */
let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function getSupabaseBrowser() {
  if (!client) {
    client = createBrowserClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { flowType: "pkce" },
    });
  }
  return client;
}
