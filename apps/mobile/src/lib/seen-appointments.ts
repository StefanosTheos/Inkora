// Locally-tracked "seen" appointments. Accepting an offer creates the seeker's
// own appointment, so no server notification fires for them — this is how the
// "new booking" badge (profile tab, My bookings "See all", Upcoming tab) knows
// which upcoming bookings the seeker hasn't reviewed yet. Cleared when they open
// the Upcoming tab. Same MMKV + React Query shape as seen-requests.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MMKV } from "react-native-mmkv";

const KEY = "inkora.seen-appointments.v1";
const SEEN_KEY = ["seen-appointments"] as const;
const MAX = 500;

let store: { getString(k: string): string | undefined; set(k: string, v: string): void } | null = null;
try {
  store = new MMKV({ id: "inkora-seen-appts" });
} catch {
  store = null;
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

/** Reactive set of appointment ids the seeker has seen in their bookings. */
export function useSeenAppointments(): string[] {
  const { data } = useQuery({ queryKey: SEEN_KEY, queryFn: read, initialData: read, staleTime: Infinity, gcTime: Infinity });
  return data ?? [];
}

/** Returns a stable callback that records appointment ids as seen (batch). */
export function useMarkAppointmentsSeen(): (ids: string[]) => void {
  const qc = useQueryClient();
  return (ids: string[]) => {
    if (!ids.length) return;
    const set = new Set(read());
    let changed = false;
    for (const id of ids) {
      if (id && !set.has(id)) { set.add(id); changed = true; }
    }
    if (!changed) return;
    const next = [...set];
    write(next);
    qc.setQueryData(SEEN_KEY, next);
  };
}
