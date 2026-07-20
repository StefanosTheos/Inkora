import type {
  ConversationId, ConversationSummary, ConversationType, Message, MessageAttachment, MessageId, ProfileId,
} from "@inkora/domain";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import type { InkoraClient } from "../client/types";
import type { Json } from "../db/database.types";
import { toAppError } from "../errors";
import { markEntityNotificationsRead } from "../notifications";

const BUCKET = "chat-attachments";

// ------------------------------------------------------------------ mapping
interface MsgRow {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  type: string;
  body: string | null;
  attachments: MessageAttachment[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
function mapMessage(row: MsgRow): Message {
  return {
    id: row.id as MessageId,
    conversationId: row.conversation_id as ConversationId,
    senderId: (row.sender_id as ProfileId | null) ?? null,
    type: row.type as Message["type"],
    body: row.body,
    attachments: row.attachments ?? [],
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

// ------------------------------------------------------------------ conversations
interface ConvRow {
  id: string;
  type: string;
  studio_id: string | null;
  studios: { name: string; slug: string; logo_path: string | null; owner_id: string } | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  conversation_participants: { profile_id: string; last_read_at: string | null; profiles: { display_name: string; avatar_path: string | null; artists: { id: string } | null } | null }[] | null;
}

const CONV_SELECT =
  "id, type, studio_id, studios(name, slug, logo_path, owner_id), last_message_at, last_message_preview, conversation_participants(profile_id, last_read_at, profiles(display_name, avatar_path, artists(id)))";

/** Resolve a conversation row into the viewer-relative summary (who the "other"
 *  party is, their name/avatar, unread state). */
function mapConvRow(c: ConvRow, me: string | undefined): ConversationSummary {
  const parts = c.conversation_participants ?? [];
  const mine = parts.find((p) => p.profile_id === me);
  const other = parts.find((p) => p.profile_id !== me);
  const unread = c.last_message_at != null && (mine?.last_read_at == null || c.last_message_at > mine.last_read_at);
  // A studio-tagged conversation shows the STUDIO's identity — but to the
  // studio's OWNER it shows the other participant (e.g. the applying artist),
  // since "chatting with your own studio" makes no sense.
  const showStudio = !!c.studios && c.studios.owner_id !== me;
  return {
    id: c.id as ConversationId,
    type: c.type as ConversationType,
    otherId: (other?.profile_id as ProfileId | null) ?? null,
    otherName: (showStudio ? c.studios?.name : null) ?? other?.profiles?.display_name ?? "Conversation",
    otherAvatarPath: showStudio ? (c.studios?.logo_path ?? null) : (other?.profiles?.avatar_path ?? null),
    otherIsArtist: !!other?.profiles?.artists,
    studioId: (c.studio_id as ConversationSummary["studioId"]) ?? null,
    studioSlug: showStudio ? (c.studios?.slug ?? null) : null,
    lastMessagePreview: c.last_message_preview,
    lastMessageAt: c.last_message_at,
    unread,
  };
}

export async function listConversations(client: InkoraClient): Promise<ConversationSummary[]> {
  const { data: userRes } = await client.auth.getUser();
  const me = userRes.user?.id;
  const { data, error } = await client
    .from("conversations")
    .select(CONV_SELECT)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100)
    .returns<ConvRow[]>();
  if (error) throw toAppError(error);
  // Hide conversations no one has spoken in yet — they'd clutter the list.
  return (data ?? []).filter((c) => c.last_message_at != null).map((c) => mapConvRow(c, me));
}

/** Fetch a single conversation's summary directly, so the chat screen can render
 *  the right header (name + avatar) even for a freshly-started conversation that
 *  has no messages yet and thus isn't in the (message-filtered) list. */
export async function getConversation(client: InkoraClient, conversationId: string): Promise<ConversationSummary | null> {
  const { data: userRes } = await client.auth.getUser();
  const me = userRes.user?.id;
  const { data, error } = await client
    .from("conversations")
    .select(CONV_SELECT)
    .eq("id", conversationId)
    .maybeSingle<ConvRow>();
  if (error) throw toAppError(error);
  return data ? mapConvRow(data, me) : null;
}

// ------------------------------------------------------------------ messages
export const MESSAGE_PAGE = 40;

/** Fetch a page of messages, newest-first internally then returned oldest→newest
 *  for display. Without a cursor it returns the most recent page; pass `before`
 *  (a message's created_at) to page backwards into the history ("load earlier").
 *  This replaces the old fixed 200-cap that silently hid a long chat's history. */
export async function getMessages(
  client: InkoraClient,
  conversationId: string,
  opts?: { before?: string; limit?: number },
): Promise<Message[]> {
  let q = client
    .from("messages")
    .select("id, conversation_id, sender_id, type, body, attachments, metadata, created_at")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? MESSAGE_PAGE);
  if (opts?.before) q = q.lt("created_at", opts.before);
  const { data, error } = await q.returns<MsgRow[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map(mapMessage).reverse(); // oldest→newest for the list
}

interface SendFields {
  type: Message["type"];
  body?: string | null;
  attachments?: MessageAttachment[];
  metadata?: Record<string, unknown>;
}
export async function sendMessage(client: InkoraClient, conversationId: string, senderId: string, f: SendFields): Promise<Message> {
  const { data, error } = await client
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      type: f.type,
      body: f.body ?? null,
      attachments: (f.attachments ?? []) as unknown as Json,
      metadata: (f.metadata ?? {}) as unknown as Json,
    })
    .select("id, conversation_id, sender_id, type, body, attachments, metadata, created_at")
    .single<MsgRow>();
  if (error) throw toAppError(error);
  // The sender has, by definition, seen their own message. Advance their read
  // marker to it (using the server timestamp that also drives last_message_at)
  // so the conversation isn't flagged unread to the sender — the unread dot /
  // bold text only makes sense for the recipient. Best-effort; never fail the send.
  await client
    .from("conversation_participants")
    .update({ last_read_at: data.created_at })
    .eq("conversation_id", conversationId)
    .eq("profile_id", senderId);
  return mapMessage(data);
}

export async function markRead(client: InkoraClient, conversationId: string): Promise<void> {
  const { data: userRes } = await client.auth.getUser();
  const me = userRes.user?.id;
  if (!me) return;
  await client
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("profile_id", me);
}

export async function getOtherReadAt(client: InkoraClient, conversationId: string, meId: string): Promise<string | null> {
  const { data } = await client
    .from("conversation_participants")
    .select("profile_id, last_read_at")
    .eq("conversation_id", conversationId);
  const other = (data ?? []).find((p) => p.profile_id !== meId);
  return other?.last_read_at ?? null;
}

export async function startDirectConversation(client: InkoraClient, otherId: string): Promise<ConversationId> {
  const { data, error } = await client.rpc("start_direct_conversation", { p_other: otherId });
  if (error) throw toAppError(error);
  return data as ConversationId;
}

/** Delete a conversation (participant-only, via RPC). Messages + participants
 *  cascade; any linked booking request keeps its data (conversation_id set null). */
export async function deleteConversation(client: InkoraClient, conversationId: string): Promise<void> {
  const { error } = await client.rpc("delete_conversation", { p_conversation_id: conversationId });
  if (error) throw toAppError(error);
}

/** Start/open the conversation that represents a studio (with its owner). */
export async function startStudioConversation(client: InkoraClient, studioId: string): Promise<ConversationId> {
  const { data, error } = await client.rpc("start_studio_conversation", { p_studio: studioId });
  if (error) throw toAppError(error);
  return data as ConversationId;
}

// ------------------------------------------------------------------ attachments (private bucket)
export async function uploadChatFile(
  client: InkoraClient,
  conversationId: string,
  body: ArrayBuffer | Blob,
  contentType: string,
  ext: string,
): Promise<string> {
  const path = `${conversationId}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
  const { error } = await client.storage.from(BUCKET).upload(path, body, { contentType, upsert: false });
  if (error) throw toAppError(error);
  return path;
}

// Cache signed URLs by path so a chat image/voice note that re-mounts (FlatList
// recycling, re-render) reuses the SAME url instead of minting a new one each
// time — a changing uri made expo-image reload and flicker. Reused while >1 min
// of the TTL remains.
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export async function getChatSignedUrl(client: InkoraClient, path: string, ttlSeconds = 3600): Promise<string | null> {
  const now = Date.now();
  const hit = signedUrlCache.get(path);
  if (hit && hit.expiresAt > now + 60_000) return hit.url;
  const { data } = await client.storage.from(BUCKET).createSignedUrl(path, ttlSeconds);
  const url = data?.signedUrl ?? null;
  if (url) signedUrlCache.set(path, { url, expiresAt: now + ttlSeconds * 1000 });
  return url;
}

// ------------------------------------------------------------------ hooks
export function useConversations(client: InkoraClient) {
  return useQuery({ queryKey: ["conversations"], queryFn: () => listConversations(client) });
}

/** Single conversation summary — a fallback for the chat header when the
 *  conversation isn't in the list yet (no messages sent). */
export function useConversation(client: InkoraClient, conversationId: string) {
  return useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => getConversation(client, conversationId),
    enabled: !!conversationId,
  });
}

/**
 * App-wide realtime that keeps the conversations list (and the Chats tab badge)
 * fresh when a message arrives while the user is elsewhere. Chat messages don't
 * create notifications, so without this the unread count only updated on visiting
 * Chats. Realtime is RLS-scoped, so the user only receives their own
 * conversations' inserts. Mount ONCE (in the root gate).
 */
export function useConversationsRealtime(client: InkoraClient) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = client
      .channel("conversations-badge")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        void qc.invalidateQueries({ queryKey: ["conversations"] });
      })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [client, qc]);
}

/** Combined chat hook: messages + realtime append + typing indicator + senders. */
export function useChat(client: InkoraClient, conversationId: string, meId: string | null) {
  const qc = useQueryClient();
  const key = ["messages", conversationId] as const;
  const messagesQ = useQuery({ queryKey: key, queryFn: () => getMessages(client, conversationId), enabled: !!conversationId });
  const [typingOther, setTypingOther] = useState(false);
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initedRef = useRef<string | null>(null);

  // Whether a full first page came back → there may be older messages to page in.
  // Set once per conversation so realtime appends don't reset it.
  useEffect(() => {
    if (!messagesQ.data || initedRef.current === conversationId) return;
    initedRef.current = conversationId;
    setHasMore(messagesQ.data.length >= MESSAGE_PAGE);
  }, [messagesQ.data, conversationId]);

  const loadEarlier = useCallback(async () => {
    if (loadingEarlier || !hasMore || !conversationId) return;
    const current = qc.getQueryData<Message[]>(key) ?? [];
    const earliest = current[0];
    if (!earliest) return;
    setLoadingEarlier(true);
    try {
      const older = await getMessages(client, conversationId, { before: earliest.createdAt });
      if (older.length < MESSAGE_PAGE) setHasMore(false);
      if (older.length > 0) {
        qc.setQueryData<Message[]>(key, (old = []) => {
          const seen = new Set(old.map((x) => x.id));
          return [...older.filter((x) => !seen.has(x.id)), ...old];
        });
      }
    } finally {
      setLoadingEarlier(false);
    }
  }, [client, conversationId, hasMore, loadingEarlier, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  const append = useCallback(
    (m: Message) => {
      qc.setQueryData<Message[]>(key, (old = []) => (old.some((x) => x.id === m.id) ? old : [...old, m]));
    },
    [qc, conversationId], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Opening a chat clears its unread state: the per-participant read marker AND
  // any 'message' notification for it (so the bell/inbox doesn't stay lit).
  const clearUnread = useCallback(() => {
    void markRead(client, conversationId);
    void markEntityNotificationsRead(client, "conversation", conversationId)
      .then(() => qc.invalidateQueries({ queryKey: ["notifications"] }))
      .catch(() => { /* best-effort */ });
  }, [client, conversationId, qc]);

  useEffect(() => {
    if (!conversationId) return;
    clearUnread();
    if (meId) void getOtherReadAt(client, conversationId, meId).then(setOtherReadAt);
    const channel = client
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = mapMessage(payload.new as unknown as MsgRow);
          append(m);
          void qc.invalidateQueries({ queryKey: ["conversations"] });
          // A message arriving while the chat is open is already seen — clear it.
          if (m.senderId !== meId) clearUnread();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_participants", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as { profile_id: string; last_read_at: string | null };
          if (row.profile_id !== meId) setOtherReadAt(row.last_read_at);
        },
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.["userId"] && payload["userId"] !== meId) {
          setTypingOther(true);
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTypingOther(false), 3000);
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      void client.removeChannel(channel);
    };
  }, [conversationId, meId, client, qc, append, clearUnread]);

  const send = useCallback(async (fn: () => Promise<Message>) => {
    if (!meId) return;
    append(await fn());
  }, [append, meId]);

  return {
    messages: messagesQ.data ?? [],
    isLoading: messagesQ.isLoading,
    typingOther,
    otherReadAt,
    hasMore,
    loadingEarlier,
    loadEarlier,
    sendText: (body: string) => send(() => sendMessage(client, conversationId, meId!, { type: "text", body })),
    sendImage: (path: string) => send(() => sendMessage(client, conversationId, meId!, { type: "image", body: "📷 Photo", attachments: [{ path }] })),
    sendVoice: (path: string, durationMs: number) =>
      send(() => sendMessage(client, conversationId, meId!, { type: "text", body: "🎤 Voice message", attachments: [{ path, durationMs }], metadata: { kind: "voice" } })),
    sendQuote: (p: Record<string, unknown>) =>
      send(() => sendMessage(client, conversationId, meId!, { type: "booking_card", body: "💬 Quote request", metadata: { kind: "quote", ...p } })),
    sendConsultation: (p: Record<string, unknown>) =>
      send(() => sendMessage(client, conversationId, meId!, { type: "booking_card", body: "📅 Consultation request", metadata: { kind: "consultation", ...p } })),
    sendTyping: () => channelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: meId } }),
  };
}
