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
}

/** Studio-owner dashboard: headline aggregates across the studio. */
export interface StudioOverview {
  activeArtists: number;
  pendingApplications: number;
  profileVisits: number;
  completedBookings: number;
  scheduledBookings: number;
  cancelledBookings: number;
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
}
