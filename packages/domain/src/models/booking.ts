import type { AppointmentStatus, OfferStatus, RequestStatus } from "../enums";
import type {
  AppointmentId, AppointmentRequestId, ArtistId, ConversationId, IdeaId, OfferId, ProfileId, StudioId,
} from "../ids";

/** Coarse time-of-day the seeker prefers; null means flexible. Guides the
 *  artist's proposed slots without pinning an exact time. */
export type TimeOfDay = "morning" | "afternoon" | "evening";

export const TIME_OF_DAY_LABEL: Record<TimeOfDay, string> = {
  morning: "Morning", afternoon: "Afternoon", evening: "Evening",
};

/** Local-hour range [startHour, endHourExclusive) for each part of the day. */
export const TIME_OF_DAY_RANGE: Record<TimeOfDay, [number, number]> = {
  morning: [0, 12], afternoon: [12, 17], evening: [17, 24],
};

/** Whether a slot's start (ISO timestamp) falls in the preferred part of day.
 *  A null preference matches everything. Uses local time, matching the display. */
export function slotMatchesTimeOfDay(iso: string, pref: TimeOfDay | null): boolean {
  if (!pref) return true;
  const [lo, hi] = TIME_OF_DAY_RANGE[pref];
  const h = new Date(iso).getHours();
  return h >= lo && h < hi;
}

export interface AppointmentRequest {
  id: AppointmentRequestId;
  clientId: ProfileId;
  artistId: ArtistId;
  studioId: StudioId | null;
  conversationId: ConversationId | null;
  ideaId: IdeaId | null;
  title: string;
  description: string | null;
  placement: string | null;
  approxSize: string | null;
  isColor: boolean | null;
  budgetMin: number | null;
  budgetMax: number | null;
  referencePaths: string[];
  status: RequestStatus;
  createdAt: string;
}

export interface Offer {
  id: OfferId;
  requestId: AppointmentRequestId;
  artistId: ArtistId;
  proposedStart: string | null;
  proposedEnd: string | null;
  priceAmount: number;
  depositAmount: number | null;
  currencyCode: string;
  message: string | null;
  status: OfferStatus;
  expiresAt: string | null;
}

export interface Appointment {
  id: AppointmentId;
  requestId: AppointmentRequestId | null;
  offerId: OfferId | null;
  clientId: ProfileId;
  artistId: ArtistId;
  studioId: StudioId | null;
  scheduledStart: string;
  scheduledEnd: string;
  status: AppointmentStatus;
  priceAmount: number | null;
  depositAmount: number | null;
  depositPaid: boolean;
}

export interface PriceEstimate {
  artistId: ArtistId;
  amountMin: number;
  amountMax: number;
  currencyCode: string;
  complexity: "simple" | "medium" | "complex" | null;
}

// ---------------------------------------------------------------- inputs
/** What the booking stepper collects before it hits the DB. */
export interface BookingRequestInput {
  artistId: ArtistId;
  studioId?: StudioId | null;
  conversationId?: ConversationId | null;
  ideaId?: IdeaId | null;
  title: string;
  description?: string | null;
  placement?: string | null;
  approxSize?: string | null;
  isColor?: boolean | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  preferredDate?: string | null; // ISO date (yyyy-mm-dd), single day for MVP
  preferredTimeOfDay?: TimeOfDay | null;
  referencePaths?: string[];
}

/** What an artist fills in to answer a request. */
export interface OfferInput {
  requestId: AppointmentRequestId;
  proposedStart: string; // ISO timestamptz
  proposedEnd: string;
  priceAmount: number;
  depositAmount?: number | null;
  currencyCode?: string;
  message?: string | null;
  expiresAt?: string | null;
}

// ---------------------------------------------------------------- views (joined)
/** A party on the other side of a request/appointment (for list rows). */
export interface CounterpartyRef {
  id: ProfileId;
  name: string;
  avatarPath: string | null;
}

export interface OfferView extends Offer {
  createdAt: string;
}

/** Request row enriched with the counterparty and its offers. */
export interface AppointmentRequestView {
  id: AppointmentRequestId;
  clientId: ProfileId;
  artistId: ArtistId;
  studioId: StudioId | null;
  studioName: string | null; // set when the request was made through a studio
  counterparty: CounterpartyRef; // the OTHER party, resolved per viewer
  title: string;
  description: string | null;
  placement: string | null;
  approxSize: string | null;
  isColor: boolean | null;
  budgetMin: number | null;
  budgetMax: number | null;
  preferredDate: string | null;
  preferredTimeOfDay: TimeOfDay | null;
  referencePaths: string[];
  status: RequestStatus;
  createdAt: string;
  offers: OfferView[];
}

/** Whose approval a proposed reschedule is waiting on (or 'none'). */
export type RescheduleStatus = "none" | "pending_client" | "pending_artist";

export interface AppointmentView {
  id: AppointmentId;
  requestId: AppointmentRequestId | null;
  clientId: ProfileId;
  artistId: ArtistId;
  studioId: StudioId | null;
  studioName: string | null; // set when booked through a studio
  counterparty: CounterpartyRef;
  scheduledStart: string;
  scheduledEnd: string;
  status: AppointmentStatus;
  priceAmount: number | null;
  depositAmount: number | null;
  depositPaid: boolean;
  locationNote: string | null;
  notes: string | null;
  cancellationReason: string | null;
  // Pending reschedule proposal (either party can propose; the other approves).
  rescheduleStatus: RescheduleStatus;
  rescheduleStart: string | null;
  rescheduleEnd: string | null;
  rescheduleBy: ProfileId | null; // who proposed the pending time
}

// ---------------------------------------------------------------- labels / colors
// Legal booking-status transitions are enforced server-side (the appointment
// transition-guard trigger + the create_offer / respond_offer / reschedule RPCs),
// so there's no client-side transition table to keep in sync.
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Pending", reviewing: "Reviewing", offered: "Offer sent",
  accepted: "Accepted", declined: "Declined", expired: "Expired",
  cancelled: "Cancelled", converted: "Booked",
};

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled", rescheduled: "Rescheduled", completed: "Completed",
  cancelled: "Cancelled", no_show: "No-show",
};

/** Semantic color token for a status chip. */
export function statusTone(
  status: RequestStatus | AppointmentStatus | OfferStatus,
): "positive" | "warning" | "neutral" | "danger" {
  switch (status) {
    case "accepted": case "converted": case "completed": case "scheduled": case "rescheduled":
      return "positive";
    case "pending": case "reviewing": case "offered":
      return "warning";
    case "declined": case "cancelled": case "expired": case "withdrawn": case "no_show":
      return "danger";
    default:
      return "neutral";
  }
}

// ---------------------------------------------------------------- seeker reviews
// The client reviews the ARTIST after a completed session — five 1-5 category
// scores (stored in the `ratings` table) plus an optional title/body. The
// review's overall_rating is the rounded average of the five.
export const REVIEW_CATEGORIES = [
  { key: "quality", label: "Quality", hint: "Line work, shading and detail" },
  { key: "cleanliness", label: "Cleanliness", hint: "Hygiene and a clean setup" },
  { key: "professionalism", label: "Professionalism", hint: "Conduct and care throughout" },
  { key: "communication", label: "Communication", hint: "Clear about the design and aftercare" },
  { key: "value", label: "Value", hint: "Worth the price you paid" },
] as const;

export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number]["key"];

/** Category scores a client submits about an artist (each 1-5). */
export interface ReviewScores {
  quality: number;
  cleanliness: number;
  professionalism: number;
  communication: number;
  value: number;
}

// ---------------------------------------------------------------- client reviews
// The artist reviews the CLIENT after a completed session — five 1-5 category
// scores plus an optional written comment (see the client_reviews migration).
export const CLIENT_REVIEW_CATEGORIES = [
  { key: "punctuality", label: "Punctuality", hint: "On time, no last-minute reschedules" },
  { key: "communication", label: "Communication", hint: "Responsive and clear about the design" },
  { key: "preparedness", label: "Preparedness", hint: "Arrived ready, followed pre-care" },
  { key: "satWell", label: "Sat well", hint: "Composure and stillness during the session" },
  { key: "respect", label: "Respect", hint: "Respectful of the artist, space and time" },
] as const;

export type ClientReviewCategory = (typeof CLIENT_REVIEW_CATEGORIES)[number]["key"];

/** Category scores an artist submits about a client (each 1-5). */
export interface ClientReviewScores {
  punctuality: number;
  communication: number;
  preparedness: number;
  satWell: number;
  respect: number;
}

export interface ClientReviewInput extends ClientReviewScores {
  appointmentId: string;
  clientId: string;
  comment?: string;
}

/** A client review as shown to artists (and the client) on a seeker profile. */
export interface ClientReviewItem extends ClientReviewScores {
  id: string;
  authorName: string;
  authorAvatarPath: string | null;
  overall: number;
  /** Null while the written comment is still hidden (double-blind window). */
  comment: string | null;
  /** True when the comment is withheld pending mutual review / the time window. */
  textLocked: boolean;
  createdAt: string;
}
