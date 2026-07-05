import type { Notification, NotificationId, NotificationType, ProfileId } from "@inkora/domain";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";

interface NotifRow {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, string> | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

function mapNotif(r: NotifRow): Notification {
  return {
    id: r.id as NotificationId,
    recipientId: r.recipient_id as ProfileId,
    type: r.type as NotificationType,
    title: r.title,
    body: r.body,
    data: r.data ?? {},
    entityType: r.entity_type,
    entityId: r.entity_id,
    readAt: r.read_at,
    createdAt: r.created_at,
  };
}

export async function listNotifications(client: InkoraClient, limit = 50): Promise<Notification[]> {
  const { data, error } = await client
    .from("notifications")
    .select("id, recipient_id, type, title, body, data, entity_type, entity_id, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<NotifRow[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map(mapNotif);
}

export async function markNotificationRead(client: InkoraClient, id: string): Promise<void> {
  const { error } = await client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  if (error) throw toAppError(error);
}

export async function markAllNotificationsRead(client: InkoraClient): Promise<void> {
  const { error } = await client.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (error) throw toAppError(error);
}

/** Mark the caller's unread notifications for a given entity as read (best effort).
 *  Used when acting on an entity clears its "new" badge (e.g. answering a booking
 *  request). Never throws so it can't fail the primary action. */
export async function markEntityNotificationsRead(client: InkoraClient, entityType: string, entityId: string): Promise<void> {
  const { data: userRes } = await client.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return;
  await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", uid)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .is("read_at", null);
}

/** Mark all the caller's unread notifications of a given type as read (best
 *  effort). Used when opening a screen that surfaces them (e.g. Rewards). */
export async function markTypeNotificationsRead(client: InkoraClient, type: string): Promise<void> {
  const { data: userRes } = await client.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return;
  await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", uid)
    .eq("type", type)
    .is("read_at", null);
}

const NOTIF_KEY = ["notifications"] as const;

// One realtime channel shared by every useNotifications consumer (the header
// bell + the inbox screen). All consumers read from the same NOTIF_KEY cache,
// so a single subscription updating that cache is enough — no need for a
// channel per hook instance. Ref-counted so it opens on the first mount and
// closes only when the last consumer unmounts.
let sharedChannel: RealtimeChannel | null = null;
let subscriberCount = 0;

type QueryClientRef = ReturnType<typeof useQueryClient>;
function acquireNotificationChannel(client: InkoraClient, qc: QueryClientRef): () => void {
  subscriberCount += 1;
  if (!sharedChannel) {
    sharedChannel = client
      .channel("notifications-inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        const n = mapNotif(payload.new as unknown as NotifRow);
        qc.setQueryData<Notification[]>(NOTIF_KEY, (old = []) => (old.some((x) => x.id === n.id) ? old : [n, ...old]));
      })
      .subscribe();
  }
  return () => {
    subscriberCount -= 1;
    if (subscriberCount <= 0 && sharedChannel) {
      void client.removeChannel(sharedChannel);
      sharedChannel = null;
      subscriberCount = 0;
    }
  };
}

/**
 * Live notification inbox: initial fetch + realtime INSERTs (RLS scopes rows
 * to the recipient). Returns the list, unread count, and mark helpers.
 */
export function useNotifications(client: InkoraClient) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: NOTIF_KEY, queryFn: () => listNotifications(client) });

  useEffect(() => acquireNotificationChannel(client, qc), [client, qc]);

  const notifications = useMemo(() => q.data ?? [], [q.data]);
  const unread = useMemo(() => notifications.filter((n) => !n.readAt).length, [notifications]);

  return {
    notifications,
    unread,
    isLoading: q.isLoading,
    markRead: async (id: string) => {
      qc.setQueryData<Notification[]>(NOTIF_KEY, (old = []) => old.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)));
      await markNotificationRead(client, id);
    },
    markAllRead: async () => {
      const now = new Date().toISOString();
      qc.setQueryData<Notification[]>(NOTIF_KEY, (old = []) => old.map((n) => ({ ...n, readAt: n.readAt ?? now })));
      await markAllNotificationsRead(client);
    },
  };
}
