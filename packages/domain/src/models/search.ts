import type { ArtistId } from "../ids";

export type ArtistSort = "relevance" | "distance" | "rating";

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

export const EMPTY_SEARCH: ArtistSearchParams = { q: "", styleSlugs: [], sort: "relevance" };

/** Count of active filters (for the "Filters (n)" badge). */
export function activeFilterCount(p: ArtistSearchParams): number {
  let n = 0;
  n += p.styleSlugs.length;
  if (p.radiusKm) n += 1;
  if (p.minRating && p.minRating > 0) n += 1;
  if (p.acceptingOnly) n += 1;
  return n;
}
