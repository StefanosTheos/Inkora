import { AuthProvider, QueryProvider } from "@inkora/data-access";
import React from "react";
import { mobileOAuth } from "../lib/oauth-adapter";
import { supabase } from "../lib/supabase";

/**
 * Root provider composition for mobile. Wires the SecureStore-backed Supabase
 * client and the native OAuth adapter into the shared providers.
 * TODO: add RealtimeProvider + MMKV-persisted QueryClient.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider client={supabase} oauth={mobileOAuth}>
        {children}
      </AuthProvider>
    </QueryProvider>
  );
}
