"use client";
import {
  publicStorageUrl, useArtistSearch, useDebouncedValue, useMyLocation, useStyleDeck,
} from "@inkora/data-access";
import { activeFilterCount, type ArtistSearchParams, type ArtistSort } from "@inkora/domain";
import Link from "next/link";
import { useMemo, useState } from "react";
import { env } from "../../lib/env";
import { getSupabaseBrowser } from "../../lib/supabase-browser";

const img = (path?: string | null) => (path ? publicStorageUrl(env.SUPABASE_URL, path) : undefined);
const SORTS: { key: ArtistSort; label: string; needsLocation?: boolean }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "distance", label: "Nearest", needsLocation: true },
  { key: "rating", label: "Top rated" },
];
const DISTANCES = [5, 10, 25, 50];
const RATINGS = [4.0, 4.5];

type Filters = Pick<ArtistSearchParams, "styleSlugs" | "radiusKm" | "minRating" | "acceptingOnly" | "sort">;
const INITIAL: Filters = { styleSlugs: [], radiusKm: null, minRating: 0, acceptingOnly: false, sort: "relevance" };

function chip(active: boolean, disabled = false) {
  return `rounded-full px-3 py-1.5 text-sm font-semibold ${
    active ? "bg-[#E5484D] text-white" : "bg-zinc-100 text-zinc-800"
  } ${disabled ? "opacity-40" : ""}`;
}

export function DiscoverView() {
  const client = getSupabaseBrowser();
  const near = useMyLocation(client).data ?? null;
  const styleDeck = useStyleDeck(client);
  const [text, setText] = useState("");
  const [filters, setFilters] = useState<Filters>(INITIAL);

  const q = useDebouncedValue(text.trim(), 300);
  const params: ArtistSearchParams = useMemo(() => ({ q, near, ...filters }), [q, near, filters]);
  const search = useArtistSearch(client, params);
  const results = search.data?.pages.flat() ?? [];
  const onChange = (patch: Partial<ArtistSearchParams>) => setFilters((f) => ({ ...f, ...patch }));
  const toggleStyle = (slug: string) =>
    onChange({
      styleSlugs: filters.styleSlugs.includes(slug)
        ? filters.styleSlugs.filter((x) => x !== slug)
        : [...filters.styleSlugs, slug],
    });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <input
        className="mb-4 w-full rounded-xl bg-zinc-100 px-4 py-3 text-base"
        placeholder="Search artists, styles"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="mb-3 flex flex-wrap gap-2">
        {SORTS.map((so) => (
          <button key={so.key} className={chip(filters.sort === so.key, so.needsLocation && !near)} disabled={so.needsLocation && !near} onClick={() => onChange({ sort: so.key })}>
            {so.label}
          </button>
        ))}
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        {(styleDeck.data ?? []).map((st) => (
          <button key={st.id} className={chip(filters.styleSlugs.includes(st.slug))} onClick={() => toggleStyle(st.slug)}>
            {st.name}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-zinc-500">Distance:</span>
        <button className={chip(!filters.radiusKm)} onClick={() => onChange({ radiusKm: null })}>Any</button>
        {DISTANCES.map((d) => (
          <button key={d} className={chip(filters.radiusKm === d, !near)} disabled={!near} onClick={() => onChange({ radiusKm: d })}>{d} km</button>
        ))}
        <span className="ml-2 text-sm text-zinc-500">Rating:</span>
        <button className={chip(!filters.minRating)} onClick={() => onChange({ minRating: 0 })}>Any</button>
        {RATINGS.map((r) => (
          <button key={r} className={chip(filters.minRating === r)} onClick={() => onChange({ minRating: r })}>★ {r.toFixed(1)}+</button>
        ))}
        <label className="ml-2 flex items-center gap-1 text-sm">
          <input type="checkbox" checked={!!filters.acceptingOnly} onChange={(e) => onChange({ acceptingOnly: e.target.checked })} />
          Accepting only
        </label>
      </div>

      <p className="mb-2 text-sm text-zinc-400">{results.length} result{results.length === 1 ? "" : "s"}{activeFilterCount(params) ? " · filtered" : ""}</p>

      {search.isLoading ? (
        <p className="text-zinc-500">Searching…</p>
      ) : results.length === 0 ? (
        <p className="text-zinc-500">No artists match your search.</p>
      ) : (
        <ul className="divide-y">
          {results.map((a) => (
            <li key={a.id}>
              <Link href={`/artists/${a.id}`} className="flex items-center gap-3 py-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-[#1F1B2E] text-xl font-bold text-white">
                  {img(a.avatarPath) ? <img src={img(a.avatarPath)} alt={a.displayName} className="h-full w-full object-cover" /> : a.displayName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{a.displayName}{!a.isAccepting && <span className="ml-2 rounded border px-1 text-xs text-zinc-400">booked</span>}</p>
                  <p className="text-sm text-zinc-600">{a.ratingCount > 0 ? `★ ${a.ratingAvg.toFixed(1)}` : "New"}{a.styles.length ? ` · ${a.styles.slice(0, 2).join(", ")}` : ""}</p>
                  <p className="text-xs text-zinc-400">{[a.city, a.distanceKm != null ? `${a.distanceKm} km` : null].filter(Boolean).join(" · ")}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {search.hasNextPage && (
        <button className="mx-auto mt-6 block rounded-lg border px-6 py-3 font-medium disabled:opacity-50" disabled={search.isFetchingNextPage} onClick={() => search.fetchNextPage()}>
          {search.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </main>
  );
}
