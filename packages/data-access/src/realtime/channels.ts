import type { ArtistId, ConversationId, ProfileId } from "@inkora/domain";

/** Typed channel names — never string-built ad hoc. Per-conversation topics scale
 *  past the postgres_changes cliff (broadcast-from-DB at scale). */
export type ChannelName =
  | `conversation:${ConversationId}`
  | `user:${ProfileId}`
  | `artist:${ArtistId}:requests`
  | `presence:${ConversationId}`;

export type RealtimeMechanism = "postgres_changes" | "broadcast" | "presence";

export const channels = {
  conversation: (id: ConversationId) => `conversation:${id}` as ChannelName,
  user: (id: ProfileId) => `user:${id}` as ChannelName,
  artistRequests: (id: ArtistId) => `artist:${id}:requests` as ChannelName,
  presence: (id: ConversationId) => `presence:${id}` as ChannelName,
};
