import type { ArtistId, ProfileId, StudioId } from "../ids";

export interface StudioRosterArtist {
  id: ArtistId;
  displayName: string;
  avatarPath: string | null;
  headline: string | null;
  ratingAvg: number;
  ratingCount: number;
  styles: string[]; // style slugs
}

export interface StudioProfile {
  id: StudioId;
  /** The studio owner's profile id — used as the target of the Message CTA. */
  ownerId: ProfileId;
  name: string;
  slug: string;
  bio: string | null;
  logoPath: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  addressLine: string | null;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  /** { mon: [["11:00","19:00"]], ... } */
  openingHours: Record<string, string[][]>;
  /** Union of the roster's style slugs (studio "specialties"). */
  styles: string[];
  roster: StudioRosterArtist[];
  /** Suspended members — only populated for the studio owner (RLS-scoped). */
  suspended: StudioRosterArtist[];
}

/** Editable studio fields (studio-owner "Edit studio"). */
export interface StudioEditInput {
  name: string;
  bio: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  addressLine: string | null;
  city: string | null;
  openingHours: Record<string, string[][]>;
}

/** Studio-owner dashboard: headline aggregates across the studio. */
export interface StudioOverview {
  activeArtists: number;
  pendingApplications: number;
  profileVisits: number;
  completedBookings: number;
  scheduledBookings: number;
  cancelledBookings: number;
  revenue: number; // sum of completed-booking prices across the roster
  studioSaves: number; // people who saved the studio
  ratingAvg: number; // the studio's own review rating
  ratingCount: number;
}

/** Time window for the studio dashboard's activity metrics. */
export type StatsPeriod = "30d" | "mtd" | "ytd";

export const STATS_PERIOD_LABEL: Record<StatsPeriod, string> = {
  "30d": "30 days",
  mtd: "This month",
  ytd: "This year",
};

/** Period-scoped studio activity, with the prior equal-length window for trends. */
export interface StudioPeriodStat {
  completed: number;
  cancelled: number;
  revenue: number;
  profileVisits: number;
  prevCompleted: number;
  prevCancelled: number;
  prevRevenue: number;
  prevProfileVisits: number;
}

/** A pending artist application to join a studio (owner's inbox). */
export interface StudioApplication {
  artistId: ArtistId;
  displayName: string;
  avatarPath: string | null;
  headline: string | null;
  ratingAvg: number;
  ratingCount: number;
  appliedAt: string;
}

/** Studio-owner dashboard: per-artist performance stats. */
export interface StudioArtistStat {
  artistId: ArtistId;
  ratingAvg: number;
  ratingCount: number;
  savedBy: number; // people who favourited the artist
  workSaves: number; // people who favourited the artist's work
  completed: number;
  scheduled: number;
  cancelled: number;
  profileVisits: number;
  revenue: number; // sum of the artist's completed-booking prices
}
