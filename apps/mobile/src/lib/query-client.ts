// TanStack QueryClient with an MMKV-backed offline cache: the last successful
// query results are persisted and rehydrated on cold start, so the app opens
// with content instead of spinners when offline / on a slow first paint.
//
// Hand-rolled (dehydrate/hydrate + a debounced cache subscription) to avoid an
// extra dependency. MMKV is native — guarded so a missing module degrades to an
// in-memory client rather than crashing.
import { dehydrate, hydrate, QueryClient } from "@tanstack/react-query";
import { MMKV } from "react-native-mmkv";

const CACHE_KEY = "inkora.query-cache.v1";

interface KVStore {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
}

let store: KVStore | null = null;
try {
  // encryptionKey keeps the on-disk cache from being plaintext (it holds
  // profile/booking data). It is obfuscation, not a secret store — auth tokens
  // stay in SecureStore.
  const mmkv = new MMKV({ id: "inkora-cache", encryptionKey: "inkora-query-cache" });
  store = { getString: (k) => mmkv.getString(k), set: (k, v) => mmkv.set(k, v) };
} catch {
  store = null; // native module unavailable → no persistence, app still works
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24, // keep 24h so persisted entries survive to rehydrate
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

if (store) {
  // 1. rehydrate on cold start
  try {
    const cached = store.getString(CACHE_KEY);
    if (cached) hydrate(queryClient, JSON.parse(cached));
  } catch {
    // corrupt/incompatible cache → ignore and start fresh
  }

  // 2. persist on cache changes, debounced
  let timer: ReturnType<typeof setTimeout> | null = null;
  const persist = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        store!.set(CACHE_KEY, JSON.stringify(dehydrate(queryClient)));
      } catch {
        // serialization failure → skip this write
      }
    }, 1000);
  };
  queryClient.getQueryCache().subscribe(persist);
}
