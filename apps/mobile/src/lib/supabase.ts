import "./crypto-polyfill"; // WebCrypto (subtle.digest + TextEncoder) for PKCE S256 on Hermes
import "react-native-url-polyfill/auto"; // required for supabase-js in React Native

import type { Database } from "@inkora/data-access";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import { env } from "./env";
import { LargeSecureStore } from "./large-secure-store";

/**
 * Mobile Supabase client. Session persisted (encrypted) via LargeSecureStore;
 * PKCE flow for OAuth; detectSessionInUrl off (deep links handled explicitly).
 */
export const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});

// Refresh the session while the app is foregrounded; pause when backgrounded.
AppState.addEventListener("change", (state) => {
  if (state === "active") void supabase.auth.startAutoRefresh();
  else void supabase.auth.stopAutoRefresh();
});
