import type {
  AppointmentId, AppointmentStatus, ConversationId, Message, Notification, ProfileId,
} from "@inkora/domain";
import type { ChannelName } from "./channels";

export interface RealtimeEventMap {
  "message.new": { message: Message };
  "message.read": { conversationId: ConversationId; readerId: ProfileId; at: string };
  "typing": { conversationId: ConversationId; userId: ProfileId };
  "booking.updated": { appointmentId: AppointmentId; status: AppointmentStatus };
  "request.created": { requestId: string };
  "notification.new": { notification: Notification };
  "presence.sync": { online: ProfileId[] };
}

export type Unsubscribe = () => void;

/** Owns the connection lifecycle; events are written INTO the query cache (no parallel store). */
export interface RealtimeManager {
  subscribe<E extends keyof RealtimeEventMap>(
    channel: ChannelName, event: E, handler: (p: RealtimeEventMap[E]) => void,
  ): Unsubscribe;
  broadcast<E extends keyof RealtimeEventMap>(channel: ChannelName, event: E, payload: RealtimeEventMap[E]): void;
  track(channel: ChannelName, state: Record<string, unknown>): void; // presence
  disconnectAll(): void;
}

// TODO: implement RealtimeManager + reconnect→refetch backfill wiring.
