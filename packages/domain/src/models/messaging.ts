import type { ConversationType, MessageType } from "../enums";
import type { ConversationId, MessageId, ProfileId } from "../ids";

export interface ConversationSummary {
  id: ConversationId;
  type: ConversationType;
  otherId: ProfileId | null;
  otherName: string;
  otherAvatarPath: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unread: boolean;
}

export interface MessageAttachment {
  path: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface Message {
  id: MessageId;
  conversationId: ConversationId;
  senderId: ProfileId | null;
  type: MessageType;
  body: string | null;
  attachments: MessageAttachment[];
  metadata: Record<string, unknown>;
  createdAt: string;
  pending?: boolean; // optimistic (client-only)
}

/** Refined message kind for rendering (metadata.kind overrides the enum type). */
export type MessageKind = "text" | "image" | "voice" | "quote" | "consultation" | "system" | "booking_card";

export function messageKind(m: Pick<Message, "type" | "metadata">): MessageKind {
  const k = m.metadata?.["kind"];
  if (typeof k === "string") return k as MessageKind;
  return m.type as MessageKind;
}

/** In-chat quote request payload (stored in message.metadata). */
export interface QuotePayload {
  placement?: string;
  size?: string;
  description?: string;
}

/** In-chat consultation request payload. */
export interface ConsultationPayload {
  note?: string;
  preferredDate?: string;
}
