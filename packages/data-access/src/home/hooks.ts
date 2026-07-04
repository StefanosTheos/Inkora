import type { IdeaCard,Page } from "@inkora/domain";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import type { InkoraClient } from "../client/types";
import {
  fetchFeaturedArtists, fetchIdeaFeedPage, fetchMyLocation, fetchNearbyStudios,
  fetchPromotions, fetchRecommendedForMe, fetchTrendingArtists,
type IdeaFeedFilters, } from "./queries";

export function usePromotions(client: InkoraClient) {
  return useQuery({ queryKey: ["promotions"], queryFn: () => fetchPromotions(client) });
}
export function useFeaturedArtists(client: InkoraClient) {
  return useQuery({ queryKey: ["featured-artists"], queryFn: () => fetchFeaturedArtists(client) });
}
export function useRecommendedForMe(client: InkoraClient) {
  return useQuery({ queryKey: ["recommended-for-me"], queryFn: () => fetchRecommendedForMe(client) });
}
export function useTrendingArtists(client: InkoraClient) {
  return useQuery({ queryKey: ["trending-artists"], queryFn: () => fetchTrendingArtists(client) });
}
export function useMyLocation(client: InkoraClient) {
  return useQuery({ queryKey: ["my-location"], queryFn: () => fetchMyLocation(client) });
}
export function useNearbyStudios(client: InkoraClient, coords: { lat: number; lng: number } | null | undefined) {
  return useQuery({
    queryKey: ["nearby-studios", coords?.lat, coords?.lng],
    queryFn: () => fetchNearbyStudios(client, coords!.lat, coords!.lng),
    enabled: coords != null,
  });
}

/** Infinite inspiration feed, optionally filtered by keyword + styles. */
export function useIdeaFeed(client: InkoraClient, filters: IdeaFeedFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["idea-feed", filters.q ?? "", filters.styleSlugs ?? []],
    queryFn: ({ pageParam }: { pageParam?: string }) => fetchIdeaFeedPage(client, pageParam, filters),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Page<IdeaCard>) => last.nextCursor ?? undefined,
  });
}
