import type { ArtistId, ArtistSearchParams, SearchArtist } from "@inkora/domain";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";

const PAGE_SIZE = 20;

/** Keyset cursor for the "rating" sort — the last row of the previous page. */
export interface SearchCursor {
  rating: number;
  id: string;
}

/**
 * Full-text artist search with filters/sort/geo. The "rating" sort paginates by
 * keyset (`cursor`); relevance/distance paginate by `offset`. Passing a cursor
 * makes the RPC ignore offset and continue strictly after the cursor row.
 */
export async function searchArtists(
  client: InkoraClient,
  params: ArtistSearchParams,
  limit = PAGE_SIZE,
  offset = 0,
  cursor?: SearchCursor,
): Promise<SearchArtist[]> {
  const { data, error } = await client.rpc("search_artists", {
    p_q: params.q ?? "",
    p_style_slugs: params.styleSlugs ?? [],
    p_lat: params.near?.lat ?? undefined,
    p_lng: params.near?.lng ?? undefined,
    p_radius_km: params.radiusKm ?? undefined,
    p_min_rating: params.minRating ?? 0,
    p_accepting_only: params.acceptingOnly ?? false,
    p_sort: params.sort ?? "relevance",
    p_limit: limit,
    p_offset: cursor ? 0 : offset,
    p_after_rating: cursor?.rating ?? undefined,
    p_after_id: cursor?.id ?? undefined,
  });
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    id: r.id as ArtistId,
    displayName: r.display_name,
    avatarPath: r.avatar_path,
    headline: r.headline,
    ratingAvg: Number(r.rating_avg),
    ratingCount: r.rating_count,
    city: r.city,
    styles: r.styles ?? [],
    distanceKm: r.distance_km,
    isAccepting: r.is_accepting,
    relevance: Number(r.relevance),
  }));
}

// Page cursor: numeric offset (relevance/distance) or a keyset cursor (rating).
type SearchPageParam = number | SearchCursor;

/** Infinite search results; re-runs whenever `params` changes (instant updates). */
export function useArtistSearch(client: InkoraClient, params: ArtistSearchParams) {
  const keyset = (params.sort ?? "relevance") === "rating";
  return useInfiniteQuery({
    queryKey: ["artist-search", params],
    queryFn: ({ pageParam }: { pageParam: SearchPageParam }) =>
      typeof pageParam === "number"
        ? searchArtists(client, params, PAGE_SIZE, pageParam)
        : searchArtists(client, params, PAGE_SIZE, 0, pageParam),
    initialPageParam: 0 as SearchPageParam, // first page: offset 0 / no cursor for both modes
    getNextPageParam: (last: SearchArtist[], all: SearchArtist[][]): SearchPageParam | undefined => {
      if (last.length < PAGE_SIZE) return undefined;
      if (keyset) {
        const tail = last[last.length - 1]!;
        return { rating: tail.ratingAvg, id: tail.id };
      }
      return all.length * PAGE_SIZE;
    },
  });
}

/** Debounce a rapidly-changing value (e.g. the search text) for instant-but-throttled search. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
