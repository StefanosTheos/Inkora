// Locally-tracked "seen" appointments, in two independent namespaces:
//   - upcoming:  drives the "new booking" badge (a scheduled appointment the
//                user hasn't reviewed in their Upcoming list yet).
//   - completed: drives the "newly completed" badge (a completed appointment
//                they haven't reviewed in their Completed list yet).
// They're separate so an appointment seen while upcoming still re-badges once
// it later completes. Accepting/completing is the user's own action (no server
// notification for the actor), so these local sets are how the badges know.
// Keyed by user id so a shared device / account switch never leaks one user's
// seen state to another. MMKV-persisted + reactive via React Query.
import { useAuth } from "@inkora/data-access";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MMKV } from "react-native-mmkv";

const UPCOMING_BASE = "inkora.seen-appointments.v1";
const COMPLETED_BASE = "inkora.seen-completed.v1";
const MAX = 500;

let store: { getString(k: string): string | undefined; set(k: string, v: string): void } | null = null;
try {
  store = new MMKV({ id: "inkora-seen-appts" });
} catch {
  store = null;
}

function read(mmkvKey: string): string[] {
  try {
    const raw = store?.getString(mmkvKey);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}
function write(mmkvKey: string, ids: string[]): void {
  try {
    store?.set(mmkvKey, JSON.stringify(ids.slice(-MAX)));
  } catch {
    /* ignore write failures */
  }
}
function markSeen(qc: ReturnType<typeof useQueryClient>, mmkvKey: string, queryKey: readonly unknown[], ids: string[]): void {
  if (!ids.length) return;
  const set = new Set(read(mmkvKey));
  let changed = false;
  for (const id of ids) {
    if (id && !set.has(id)) { set.add(id); changed = true; }
  }
  if (!changed) return;
  const next = [...set];
  write(mmkvKey, next);
  qc.setQueryData(queryKey, next);
}

function useSeen(base: string): string[] {
  const { ctx } = useAuth();
  const uid = ctx.userId ?? "anon";
  const mmkvKey = `${base}.${uid}`;
  const { data } = useQuery({ queryKey: [base, uid], queryFn: () => read(mmkvKey), initialData: () => read(mmkvKey), staleTime: Infinity, gcTime: Infinity });
  return data ?? [];
}
function useMarkSeen(base: string): (ids: string[]) => void {
  const { ctx } = useAuth();
  const uid = ctx.userId ?? "anon";
  const qc = useQueryClient();
  return (ids: string[]) => markSeen(qc, `${base}.${uid}`, [base, uid], ids);
}

/** Appointment ids the user has seen in their Upcoming list. */
export function useSeenAppointments(): string[] {
  return useSeen(UPCOMING_BASE);
}
export function useMarkAppointmentsSeen(): (ids: string[]) => void {
  return useMarkSeen(UPCOMING_BASE);
}

/** Appointment ids the user has seen in their Completed list. */
export function useSeenCompleted(): string[] {
  return useSeen(COMPLETED_BASE);
}
export function useMarkCompletedSeen(): (ids: string[]) => void {
  return useMarkSeen(COMPLETED_BASE);
}
