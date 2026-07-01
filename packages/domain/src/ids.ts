/**
 * Branded ID types — prevent passing an ArtistId where a ProfileId is expected.
 * All are UUID strings at runtime.
 */
type Brand<K, T> = K & { readonly __brand: T };

export type ProfileId = Brand<string, "ProfileId">;
/** NOTE: artists.id === profiles.id in the schema (1:1). ArtistId is a ProfileId at runtime. */
export type ArtistId = Brand<string, "ArtistId">;
export type StudioId = Brand<string, "StudioId">;
export type StyleId = Brand<string, "StyleId">;
export type PortfolioId = Brand<string, "PortfolioId">;
export type PortfolioImageId = Brand<string, "PortfolioImageId">;
export type IdeaId = Brand<string, "IdeaId">;
export type BoardId = Brand<string, "BoardId">;
export type FavoriteId = Brand<string, "FavoriteId">;
export type SavedDesignId = Brand<string, "SavedDesignId">;
export type ConversationId = Brand<string, "ConversationId">;
export type MessageId = Brand<string, "MessageId">;
export type AppointmentRequestId = Brand<string, "AppointmentRequestId">;
export type OfferId = Brand<string, "OfferId">;
export type AppointmentId = Brand<string, "AppointmentId">;
export type ReviewId = Brand<string, "ReviewId">;
export type NotificationId = Brand<string, "NotificationId">;
export type AiPreviewId = Brand<string, "AiPreviewId">;
export type JourneyEntryId = Brand<string, "JourneyEntryId">;

// TODO: add a small `asProfileId(s: string): ProfileId` cast helper set if needed at boundaries.
