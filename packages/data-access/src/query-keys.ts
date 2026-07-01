/**
 * Centralized TanStack Query keys. Stable keys are required for cache writes from
 * realtime events and optimistic updates — never inline a key array.
 */
export const queryKeys = {
  artist: (id: string) => ["artist", id] as const,
  artistSearch: (params: unknown) => ["artist-search", params] as const,
  feed: (kind: "for-you" | "following") => ["feed", kind] as const,
  idea: (id: string) => ["idea", id] as const,
  conversations: () => ["conversations"] as const,
  messages: (conversationId: string) => ["messages", conversationId] as const,
  bookingRequests: (role: "client" | "artist") => ["booking-requests", role] as const,
  rewards: () => ["rewards"] as const,
  notifications: () => ["notifications"] as const,
  aiPreview: (id: string) => ["ai-preview", id] as const,
} as const;
