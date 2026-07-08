// Locally-tracked "seen" booking requests for the seeker. A seeker gets no
// server notification for their own request, so the open-request badge is
// state-derived (pending/reviewing count). To let opening a request's booking
// page drop the badge, we remember which request ids the seeker has viewed.
//
// Stored in MMKV and exposed through a React Query entry so every badge
// consumer (tab bar, dashboard, bookings) updates reactively. The queryFn reads
// from MMKV, so the set survives the app-wide cache invalidation on auth-ready.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MMKV } from "react-native-mmkv";

const KEY = "inkora.seen-requests.v1";
const SEEN_KEY = ["seen-requests"] as const;
const MAX = 500; // cap so the list can't grow unbounded

let store: { getString(k: string): string | undefined; set(k: string, v: string): void } | null = null;
try {
  store = new MMKV({ id: "inkora-seen" });
} catch {
  store = null; // native module unavailable → badges just won't persist "seen"
}

function read(): string[] {
  try {
    const raw = store?.getString(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}
function write(ids: string[]): void {
  try {
    store?.set(KEY, JSON.stringify(ids.slice(-MAX)));
  } catch {
    /* ignore write failures */
  }
}

/** Reactive set of request ids the seeker has opened. */
export function useSeenRequests(): string[] {
  const { data } = useQuery({ queryKey: SEEN_KEY, queryFn: read, initialData: read, staleTime: Infinity, gcTime: Infinity });
  return data ?? [];
}

/** Returns a stable callback that records a request id as seen. */
export function useMarkRequestSeen(): (id: string) => void {
  const qc = useQueryClient();
  return (id: string) => {
    if (!id) return;
    const current = read();
    if (current.includes(id)) return;
    const next = [...current, id];
    write(next);
    qc.setQueryData(SEEN_KEY, next);
  };
}
