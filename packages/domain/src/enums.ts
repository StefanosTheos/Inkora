/**
 * Enums MIRROR the Postgres enum types exactly. The DB is the source of truth.
 * Keep in sync with supabase/migrations/20260629120100_enums.sql.
 */
export type UserRole = "seeker" | "artist" | "studio_admin" | "moderator";
export type MembershipRole = "owner" | "manager" | "artist";
export type MembershipStatus = "invited" | "active" | "suspended" | "removed";

export type ConversationType = "direct" | "support";
export type MessageType = "text" | "image" | "system" | "booking_card";

export type RequestStatus =
  | "pending" | "reviewing" | "offered" | "accepted"
  | "declined" | "expired" | "cancelled" | "converted";
export type OfferStatus = "pending" | "accepted" | "declined" | "withdrawn" | "expired";
export type AppointmentStatus =
  | "scheduled" | "rescheduled" | "completed" | "cancelled" | "no_show";
export type EstimationStatus = "draft" | "sent" | "accepted" | "expired";

export type FavoriteTarget = "idea" | "artist" | "studio" | "portfolio_image";
export type AiPreviewStatus = "draft" | "queued" | "processing" | "completed" | "failed";
export type JourneyEntryType =
  | "idea" | "consultation" | "appointment" | "healing" | "milestone" | "completed";

export type NotificationType =
  | "message" | "booking_request" | "booking_update"
  | "offer" | "review" | "reward" | "follow" | "system"
  | "membership_request" | "journey";
export type RewardTxnType = "earn" | "redeem" | "adjust" | "expire" | "refund";
export type RewardReason =
  | "signup" | "daily_active" | "save" | "message_sent"
  | "booking_completed" | "review_left" | "referral" | "redemption" | "manual_adjust"
  | "journey_milestone" | "journey_completed";
export type RewardTier = "bronze" | "silver" | "gold" | "platinum";
export type ModerationStatus = "pending" | "approved" | "rejected";
export type DevicePlatform = "ios" | "android" | "web";
