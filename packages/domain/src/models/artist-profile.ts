import type { AppointmentId, ArtistId, ProfileId, ReviewId, StudioId } from "../ids";

export interface ArtistStudioRef {
  id: StudioId;
  name: string;
  slug: string;
}

/** Full artist profile (header). */
export interface ArtistProfile {
  id: ArtistId;
  displayName: string;
  username: string | null;
  avatarPath: string | null;
  bio: string | null;
  city: string | null;
  headline: string | null;
  yearsExperience: number | null;
  hourlyRate: number | null;
  minCharge: number | null;
  currencyCode: string;
  ratingAvg: number;
  ratingCount: number;
  isAccepting: boolean;
  verified: boolean;
  instagram: string | null;
  styles: string[]; // slugs (tags)
  studios: ArtistStudioRef[];
}

export interface ReviewItem {
  id: ReviewId;
  authorId: ProfileId | null;
  authorName: string;
  authorAvatarPath: string | null;
  overallRating: number;
  title: string | null;
  body: string | null;
  createdAt: string;
  /** Tattoo progress/journey photos the seeker attached (public bucket paths). */
  photoPaths: string[];
  /** The artist's / studio owner's public reply, if any. */
  reply: string | null;
  repliedAt: string | null;
}

/** Public snapshot of a seeker, shown when tapping their review. */
export interface PublicSeekerProfile {
  id: ProfileId;
  displayName: string;
  username: string | null;
  avatarPath: string | null;
  city: string | null;
  bio: string | null;
  memberSince: string;
  bookingsCount: number;
  reviewsCount: number;
}

/** A review written BY a seeker (shown on their public profile). */
export interface SeekerReview {
  id: ReviewId;
  appointmentId: AppointmentId | null; // the session this review is for (to match by appointment)
  subjectName: string; // the artist or studio reviewed
  overallRating: number;
  title: string | null;
  body: string | null;
  createdAt: string;
  photoPaths: string[];
}

export interface ArtistOffer {
  id: string;
  title: string;
  description: string | null;
  priceAmount: number | null;
  currencyCode: string;
}

export interface AvailabilitySlot {
  dayOfWeek: number; // 0=Sun..6=Sat
  startTime: string; // "11:00:00"
  endTime: string;
}

// ---------------------------------------------------------------- price estimator
export type Complexity = "simple" | "medium" | "complex";

/** Rough hours range per complexity — the estimator maps these to a price band. */
const HOURS: Record<Complexity, [number, number]> = {
  simple: [1, 2],
  medium: [2, 4],
  complex: [4, 8],
};

export interface EstimatedPrice {
  min: number;
  max: number;
  currencyCode: string;
}

/**
 * Estimate a price band from the artist's rate + a chosen complexity.
 * Falls back to a sensible default rate if the artist hasn't set one.
 * Pure — safe to run anywhere.
 */
export function estimatePrice(
  complexity: Complexity,
  hourlyRate: number | null,
  minCharge: number | null,
  currencyCode = "EUR",
): EstimatedPrice {
  const rate = hourlyRate && hourlyRate > 0 ? hourlyRate : 120;
  const floor = minCharge && minCharge > 0 ? minCharge : 0;
  const [lo, hi] = HOURS[complexity];
  return {
    min: Math.max(floor, Math.round(lo * rate)),
    max: Math.max(floor, Math.round(hi * rate)),
    currencyCode,
  };
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
