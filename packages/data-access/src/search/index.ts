import type { ArtistId, ArtistSearchParams, SearchArtist } from "@inkora/domain";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";

const PAGE_SIZE = 20;

/** Full-text artist search with filters/sort/geo (offset-paginated). */
export async function searchArtists(
  client: InkoraClient,
  params: ArtistSearchParams,
  limit = PAGE_SIZE,
  offset = 0,
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
    p_offset: offset,
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

/** Infinite search results; re-runs whenever `params` changes (instant updates). */
export function useArtistSearch(client: InkoraClient, params: ArtistSearchParams) {
  return useInfiniteQuery({
    queryKey: ["artist-search", params],
    queryFn: ({ pageParam }: { pageParam: number }) => searchArtists(client, params, PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last: SearchArtist[], all: SearchArtist[][]) =>
      last.length === PAGE_SIZE ? all.length * PAGE_SIZE : undefined,
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
