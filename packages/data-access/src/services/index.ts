/**
 * Service INTERFACES — business orchestration over repositories.
 * Two tiers:
 *   - client-safe  : run anywhere, only do what RLS permits.
 *   - privileged   : run ONLY in Edge Functions/Route Handlers (service_role);
 *                    invoked from clients as Edge Function calls.
 */
import type {
Appointment,   AppointmentId,   AppointmentRequest, AppointmentStatus, ArtistId,
ArtistSummary, AuthContext, ConversationId,
  IdeaCard, Message, Offer, Page, PageParams, ProfileId, RewardReason, RewardRef, RewardTransaction,
} from "@inkora/domain";

import type { ArtistFilter } from "../repositories";

// ---- client-safe ----
export interface DiscoveryService {
  searchArtists(filter: ArtistFilter, page: PageParams): Promise<Page<ArtistSummary>>;
}
export interface FeedService {
  forYou(page: PageParams): Promise<Page<IdeaCard>>;
  following(page: PageParams): Promise<Page<IdeaCard>>;
}
export interface MessagingService {
  startConversation(withArtist: ArtistId, opener: string): Promise<ConversationId>;
  send(c: ConversationId, body: string, attachments?: string[]): Promise<Message>;
  markRead(c: ConversationId): Promise<void>;
}

// ---- privileged (server-only) ----
export interface BookingService {
  submitRequest(input: unknown, ctx: AuthContext): Promise<AppointmentRequest>;
  makeOffer(requestId: string, offer: unknown, ctx: AuthContext): Promise<Offer>;
  acceptOffer(offerId: string, ctx: AuthContext): Promise<Appointment>;   // creates appointment
  transition(id: AppointmentId, to: AppointmentStatus, ctx: AuthContext): Promise<Appointment>;
}
export interface RewardsService {
  award(p: ProfileId, reason: RewardReason, amount: number, ref: RewardRef, idemKey: string): Promise<RewardTransaction>;
  redeem(p: ProfileId, amount: number, ref: RewardRef, idemKey: string): Promise<RewardTransaction>;
}

// TODO: ModerationService, NotificationDispatcher (Edge), StorageService (see storage hooks).
