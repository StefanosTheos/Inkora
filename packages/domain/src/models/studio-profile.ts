import type { AppointmentStatus } from "../enums";
import type { ArtistId, ProfileId, StudioId } from "../ids";

export interface StudioRosterArtist {
  id: ArtistId;
  displayName: string;
  avatarPath: string | null;
  headline: string | null;
  ratingAvg: number;
  ratingCount: number;
  styles: string[]; // style slugs
  /** Only meaningful for suspended members: why, and when. */
  suspensionReason?: string | null;
  suspendedAt?: string | null;
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
  currencyCode: string;
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
  logoPath: string | null;
  currencyCode: string;
}

/** Studio-owner dashboard: headline aggregates across the studio. */
export interface StudioOverview {
  activeArtists: number;
  pendingApplications: number;
  profileVisits: number;
  completedBookings: number;
  scheduledBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  revenue: number; // sum of completed-booking prices across the roster
  studioSaves: number; // people who saved the studio
  ratingAvg: number; // the studio's own review rating
  ratingCount: number;
}

/** Time window for the studio dashboard's activity metrics. */
export type StatsPeriod = "wtd" | "mtd" | "ytd";

export const STATS_PERIOD_LABEL: Record<StatsPeriod, string> = {
  wtd: "This week",
  mtd: "This month",
  ytd: "This year",
};

/** Period-scoped studio activity, with the prior equal-length window for trends. */
export interface StudioPeriodStat {
  completed: number;
  cancelled: number;
  noShow: number;
  revenue: number;
  profileVisits: number;
  prevCompleted: number;
  prevCancelled: number;
  prevNoShow: number;
  prevRevenue: number;
  prevProfileVisits: number;
}

/** One completed booking in the studio insights drill-down. */
export interface StudioBookingDetail {
  appointmentId: string;
  scheduledStart: string;
  scheduledEnd: string;
  durationMinutes: number;
  priceAmount: number | null;
  artistId: ProfileId;
  artistName: string;
  artistAvatarPath: string | null;
  clientId: ProfileId;
  clientName: string;
  clientAvatarPath: string | null;
  title: string | null;
  placement: string | null;
  approxSize: string | null;
  isColor: boolean | null;
}

/** A booking on the studio owner's calendar — upcoming or completed. */
export interface StudioCalendarBooking extends StudioBookingDetail {
  status: AppointmentStatus;
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
  noShow: number;
  profileVisits: number;
  revenue: number; // sum of the artist's completed-booking prices
}
