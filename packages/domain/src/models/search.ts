import type { ArtistId, StudioId } from "../ids";

export type ArtistSort = "relevance" | "distance" | "rating";

/** What the Discover tab is searching. */
export type SearchScope = "artists" | "studios" | "ideas";

export interface ArtistSearchParams {
  q: string;
  styleSlugs: string[];
  near?: { lat: number; lng: number } | null;
  radiusKm?: number | null;
  minRating?: number;
  acceptingOnly?: boolean;
  sort: ArtistSort;
}

export interface SearchArtist {
  id: ArtistId;
  displayName: string;
  avatarPath: string | null;
  headline: string | null;
  ratingAvg: number;
  ratingCount: number;
  city: string | null;
  styles: string[];
  distanceKm: number | null;
  isAccepting: boolean;
  relevance: number;
}

/** Count of active filters (for the "Filters (n)" badge). */
export function activeFilterCount(p: ArtistSearchParams): number {
  let n = 0;
  n += p.styleSlugs.length;
  if (p.radiusKm) n += 1;
  if (p.minRating && p.minRating > 0) n += 1;
  if (p.acceptingOnly) n += 1;
  return n;
}

// ---------------------------------------------------------------- studios
export interface StudioSearchParams {
  q: string;
  styleSlugs: string[];
  near?: { lat: number; lng: number } | null;
  radiusKm?: number | null;
  minRating?: number;
  sort: ArtistSort;
}

export interface SearchStudio {
  id: StudioId;
  name: string;
  slug: string;
  logoPath: string | null;
  city: string | null;
  styles: string[];
  distanceKm: number | null;
  artistCount: number;
  ratingAvg: number;
  ratingCount: number;
  relevance: number;
}

/** Studios have no "accepting" flag, so the filter set is a subset of artists'. */
export function activeStudioFilterCount(p: StudioSearchParams): number {
  let n = 0;
  n += p.styleSlugs.length;
  if (p.radiusKm) n += 1;
  if (p.minRating && p.minRating > 0) n += 1;
  return n;
}
