import type { ConversationId } from "@inkora/domain";

/**
 * EXAMPLE realtime hook stub — NOT implemented.
 * Subscribes to `conversation:{id}`, writes new messages/read-receipts INTO the
 * query cache (queryKeys.messages(id)); typing via broadcast; reconnect → refetch.
 */
// TODO: export function useConversationRealtime(id: ConversationId): void
export type _UseConversationRealtime = (id: ConversationId) => void;
export {};
