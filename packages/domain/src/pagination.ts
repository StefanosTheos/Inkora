/** Cursor-based pagination — used everywhere (feed, search, messages, lists). */
export interface PageParams {
  /** opaque cursor returned by the previous page; omit for the first page */
  cursor?: string;
  /** requested size; the server clamps to a safe maximum */
  limit?: number;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

// TODO: add a `SearchResult<T> extends Page<T>` with `facets` + `tookMs` (see data-access search).
