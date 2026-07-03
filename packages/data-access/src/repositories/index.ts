/**
 * Repository INTERFACES — pure data access over the RLS-scoped client.
 * No business rules, no side effects. One per aggregate root.
 *
 * Full set to implement (see schema): Profile, Artist, Studio, StudioMembership,
 * Style, Portfolio, Idea, Favorite, Board, SavedDesign, Conversation, Message,
 * Availability, AppointmentRequest, Offer, Appointment, PriceEstimation, Review,
 * Notification, RewardAccount, JourneyEntry, AiPreview, DeviceToken.
 */
import type {
  ArtistDetail, ArtistSummary,   ConversationId, ConversationSummary,
Message, Page, PageParams,
} from "@inkora/domain";

export interface Repository<T, Filter> {
  getById(id: string): Promise<T | null>;
  list(filter: Filter, page: PageParams): Promise<Page<T>>;
}

export interface ArtistFilter {
  styleSlugs?: string[];
  near?: { lat: number; lng: number; radiusKm: number };
  acceptingOnly?: boolean;
  minRating?: number;
  sort?: "relevance" | "distance" | "rating";
}

export interface ArtistRepository {
  getByUsername(username: string): Promise<ArtistDetail | null>;
  listSummaries(filter: ArtistFilter, page: PageParams): Promise<Page<ArtistSummary>>;
}

export interface MessageRepository {
  listByConversation(id: ConversationId, page: PageParams): Promise<Page<Message>>;
  // mutations RLS-gated (must be a participant)
}

export interface ConversationRepository {
  listForViewer(page: PageParams): Promise<Page<ConversationSummary>>;
}

// NOTE: there is intentionally NO RewardRepository.createTransaction — minting points
// goes through the apply_reward_transaction RPC via RewardsService (privileged).

// TODO: declare the remaining repository interfaces in their own files and re-export here.
