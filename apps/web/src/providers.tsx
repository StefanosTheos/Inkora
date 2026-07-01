"use client";
import { AuthProvider, QueryProvider } from "@inkora/data-access";
import React from "react";
import { webOAuth } from "./lib/oauth-adapter";
import { getSupabaseBrowser } from "./lib/supabase-browser";

/** Client-side providers for interactive components. SSR/route protection is handled
 *  by middleware + RSC; this gives client components `useAuth()` + query cache. */
export function Providers({ children }: { children: React.ReactNode }) {
  const client = getSupabaseBrowser();
  return (
    <QueryProvider>
      <AuthProvider client={client} oauth={webOAuth}>
        {children}
      </AuthProvider>
    </QueryProvider>
  );
}
