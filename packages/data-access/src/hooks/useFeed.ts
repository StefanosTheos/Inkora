import type { IdeaCard, Page } from "@inkora/domain";

/**
 * EXAMPLE hook signature stub — NOT implemented.
 * Real impl: useInfiniteQuery(queryKeys.feed(kind), …) with cursor pagination.
 */
export interface UseFeedResult {
  pages: Page<IdeaCard>[];
  isLoading: boolean;
  fetchNextPage: () => void;
  hasNextPage: boolean;
}

// TODO: export function useFeed(kind: "for-you" | "following"): UseFeedResult
export {};
