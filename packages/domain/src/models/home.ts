import type { ArtistId, StudioId } from "../ids";

/** Compact artist card used across Home carousels (featured / recommended / trending). */
export interface HomeArtist {
  id: ArtistId;
  displayName: string;
  avatarPath: string | null;
  headline: string | null;
  ratingAvg: number;
  ratingCount: number;
  styles: string[]; // slugs
}

export interface NearbyStudio {
  id: StudioId;
  name: string;
  slug: string;
  logoPath: string | null;
  city: string | null;
  distanceKm: number | null;
}

export interface Promotion {
  id: string;
  title: string;
  subtitle: string | null;
  imagePath: string | null;
  ctaLabel: string | null;
  ctaRoute: string | null;
}
