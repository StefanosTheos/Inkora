import type { ArtistId, StudioId } from "../ids";

export interface StudioRosterArtist {
  id: ArtistId;
  displayName: string;
  avatarPath: string | null;
  headline: string | null;
  ratingAvg: number;
}

export interface StudioProfile {
  id: StudioId;
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
  roster: StudioRosterArtist[];
}
