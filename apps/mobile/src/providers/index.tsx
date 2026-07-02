import { AuthProvider, QueryProvider } from "@inkora/data-access";
import React from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ToastProvider } from "../components/Toast";
import { mobileOAuth } from "../lib/oauth-adapter";
import { queryClient } from "../lib/query-client";
import { supabase } from "../lib/supabase";

/**
 * Root provider composition for mobile. Wires the SecureStore-backed Supabase
 * client and the native OAuth adapter into the shared providers, plus an
 * app-wide error boundary and a global toast host.
 * TODO: add RealtimeProvider + MMKV-persisted QueryClient.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <QueryProvider client={queryClient}>
        <AuthProvider client={supabase} oauth={mobileOAuth}>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}
