import type { AppointmentId, ArtistId, BoardId, ConversationId, IdeaId, RewardReason } from "@inkora/domain";

/**
 * Typed PostHog event catalog (the activation funnel). Closed union — no ad-hoc strings.
 * ⭐ North Star activation events: `first_message_sent`, `booking_requested`.
 * Lifecycle events (booking_*, review_left, reward_earned) are emitted SERVER-side so they're trustworthy.
 */
export type AnalyticsEvent =
  | { name: "questionnaire_started"; props: Record<string, never> }
  | { name: "questionnaire_completed"; props: { styleCount: number; hasLocation: boolean } }
  | { name: "idea_saved"; props: { ideaId: IdeaId; boardId?: BoardId; source: "feed" | "detail" | "search" } }
  | { name: "find_similar_tapped"; props: { ideaId: IdeaId } }
  | { name: "first_message_sent"; props: { conversationId: ConversationId; artistId: ArtistId } }
  | { name: "message_sent"; props: { conversationId: ConversationId } }
  | { name: "booking_requested"; props: { artistId: ArtistId; hasReference: boolean; budgetSet: boolean } }
  | { name: "offer_made"; props: { requestId: string; amount: number } }
  | { name: "booking_accepted"; props: { appointmentId: AppointmentId } }
  | { name: "booking_completed"; props: { appointmentId: AppointmentId } }
  | { name: "review_left"; props: { artistId: ArtistId; rating: number } }
  | { name: "create_idea_started"; props: { source: "saved" | "upload" | "describe" } }
  | { name: "reward_earned"; props: { reason: RewardReason; amount: number } };

export type AnalyticsEventName = AnalyticsEvent["name"];
