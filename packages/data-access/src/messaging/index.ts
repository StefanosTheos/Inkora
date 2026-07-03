import type {
  ConversationId, ConversationSummary, ConversationType, Message, MessageAttachment, MessageId, ProfileId,
} from "@inkora/domain";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import type { InkoraClient } from "../client/types";
import type { Json } from "../db/database.types";
import { toAppError } from "../errors";

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
  studios: { name: string; logo_path: string | null } | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  conversation_participants: { profile_id: string; last_read_at: string | null; profiles: { display_name: string; avatar_path: string | null } | null }[] | null;
}

export async function listConversations(client: InkoraClient): Promise<ConversationSummary[]> {
  const { data: userRes } = await client.auth.getUser();
  const me = userRes.user?.id;
  const { data, error } = await client
    .from("conversations")
    .select("id, type, studio_id, studios(name, logo_path), last_message_at, last_message_preview, conversation_participants(profile_id, last_read_at, profiles(display_name, avatar_path))")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .returns<ConvRow[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map((c) => {
    const parts = c.conversation_participants ?? [];
    const mine = parts.find((p) => p.profile_id === me);
    const other = parts.find((p) => p.profile_id !== me);
    const unread = c.last_message_at != null && (mine?.last_read_at == null || c.last_message_at > mine.last_read_at);
    // A studio-tagged conversation shows the STUDIO's identity, not the owner's.
    return {
      id: c.id as ConversationId,
      type: c.type as ConversationType,
      otherId: (other?.profile_id as ProfileId | null) ?? null,
      otherName: c.studios?.name ?? other?.profiles?.display_name ?? "Conversation",
      otherAvatarPath: c.studios ? c.studios.logo_path : (other?.profiles?.avatar_path ?? null),
      lastMessagePreview: c.last_message_preview,
      lastMessageAt: c.last_message_at,
      unread,
    };
  });
}

// ------------------------------------------------------------------ messages
export async function getMessages(client: InkoraClient, conversationId: string): Promise<Message[]> {
  const { data, error } = await client
    .from("messages")
    .select("id, conversation_id, sender_id, type, body, attachments, metadata, created_at")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(200)
    .returns<MsgRow[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map(mapMessage);
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

export async function getChatSignedUrl(client: InkoraClient, path: string, ttlSeconds = 3600): Promise<string | null> {
  const { data } = await client.storage.from(BUCKET).createSignedUrl(path, ttlSeconds);
  return data?.signedUrl ?? null;
}

// ------------------------------------------------------------------ hooks
export function useConversations(client: InkoraClient) {
  return useQuery({ queryKey: ["conversations"], queryFn: () => listConversations(client) });
}

/** Combined chat hook: messages + realtime append + typing indicator + senders. */
export function useChat(client: InkoraClient, conversationId: string, meId: string | null) {
  const qc = useQueryClient();
  const key = ["messages", conversationId] as const;
  const messagesQ = useQuery({ queryKey: key, queryFn: () => getMessages(client, conversationId), enabled: !!conversationId });
  const [typingOther, setTypingOther] = useState(false);
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const append = useCallback(
    (m: Message) => {
      qc.setQueryData<Message[]>(key, (old = []) => (old.some((x) => x.id === m.id) ? old : [...old, m]));
    },
    [qc, conversationId], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (!conversationId) return;
    void markRead(client, conversationId);
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
          if (m.senderId !== meId) void markRead(client, conversationId);
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
  }, [conversationId, meId, client, qc, append]);

  const send = useCallback(async (fn: () => Promise<Message>) => {
    if (!meId) return;
    append(await fn());
  }, [append, meId]);

  return {
    messages: messagesQ.data ?? [],
    isLoading: messagesQ.isLoading,
    typingOther,
    otherReadAt,
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
