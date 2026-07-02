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
