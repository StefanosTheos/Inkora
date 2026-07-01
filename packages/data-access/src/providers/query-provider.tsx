import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useState } from "react";

export interface QueryProviderProps {
  children: React.ReactNode;
  /** apps may pass a pre-built client (e.g. mobile with MMKV persistence) */
  client?: QueryClient;
}

const defaultOptions = {
  queries: {
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  },
} as const;

export function QueryProvider({ children, client }: QueryProviderProps) {
  const [qc] = useState(() => client ?? new QueryClient({ defaultOptions }));
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
