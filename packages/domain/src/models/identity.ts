import type { MembershipRole, MembershipStatus } from "../enums";
import type { ArtistId, ProfileId, StudioId } from "../ids";

/** "Users" entity (profiles table). */
export interface Profile {
  id: ProfileId;
  username: string | null;
  displayName: string;
  avatarPath: string | null;
  bio: string | null;
  pronouns: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  searchRadiusKm: number;
  onboardedAt: string | null;
  createdAt: string;
}

export interface ArtistSummary {
  id: ArtistId;
  displayName: string;
  avatarPath: string | null;
  headline: string | null;
  styles: string[];          // style slugs
  ratingAvg: number;         // denormalized cache
  ratingCount: number;       // denormalized cache
  city: string | null;
  isAccepting: boolean;
  verified: boolean;
  distanceKm?: number;       // present only on geo queries
}

export interface ArtistDetail extends ArtistSummary {
  bio: string | null;
  yearsExperience: number | null;
  hourlyRate: number | null;
  currencyCode: string;
  studios: StudioSummary[];
  // TODO: portfolio images, availability snapshot, reviews preview
}

export interface StudioSummary {
  id: StudioId;
  name: string;
  slug: string;
  logoPath: string | null;
  city: string | null;
  distanceKm?: number;
}

export interface StudioMembership {
  studioId: StudioId;
  artistId: ArtistId;
  role: MembershipRole;
  status: MembershipStatus;
}

// TODO: StudioDetail (gallery, hours, roster, geo).
