"use client";
import {
  publicStorageUrl, useFeaturedArtists, useIdeaFeed, useMyLocation, useNearbyStudios,
  usePromotions, useRecommendedForMe, useStyleDeck, useTrendingArtists,
} from "@inkora/data-access";
import type { HomeArtist } from "@inkora/domain";
import Link from "next/link";
import { env } from "../../lib/env";
import { getSupabaseBrowser } from "../../lib/supabase-browser";

const img = (path?: string | null) => (path ? publicStorageUrl(env.SUPABASE_URL, path) : undefined);

export function HomeFeed() {
  const client = getSupabaseBrowser();
  const promotions = usePromotions(client);
  const categories = useStyleDeck(client);
  const featured = useFeaturedArtists(client);
  const recommended = useRecommendedForMe(client);
  const trending = useTrendingArtists(client);
  const location = useMyLocation(client);
  const nearby = useNearbyStudios(client, location.data);
  const feed = useIdeaFeed(client);
  const ideas = feed.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      {/* Search */}
      <Link href="/discover" className="mb-6 flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-zinc-500">
        <span>⌕</span> Search artists, styles, studios
      </Link>

      {/* Promotions */}
      {(promotions.data ?? []).length > 0 && (
        <div className="mb-6 flex gap-3 overflow-x-auto pb-2">
          {(promotions.data ?? []).map((p) => (
            <Link key={p.id} href={p.ctaRoute ?? "/"} className="relative flex h-36 w-80 shrink-0 flex-col justify-end overflow-hidden rounded-2xl bg-[#1F1B2E] p-4 text-white">
              {img(p.imagePath) ? <img src={img(p.imagePath)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" /> : null}
              <div className="relative">
                <p className="text-lg font-extrabold">{p.title}</p>
                {p.subtitle && <p className="text-sm opacity-90">{p.subtitle}</p>}
                {p.ctaLabel && <p className="mt-2 text-sm font-bold">{p.ctaLabel} →</p>}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Categories */}
      {(categories.data ?? []).length > 0 && (
        <Section title="Categories">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {(categories.data ?? []).map((c) => (
              <Link key={c.id} href="/discover" className="w-20 shrink-0 text-center">
                <div className="aspect-square overflow-hidden rounded-xl bg-zinc-200">
                  {img(c.imagePath) ? <img src={img(c.imagePath)} alt={c.name} className="h-full w-full object-cover" /> : null}
                </div>
                <p className="mt-1 truncate text-xs font-semibold">{c.name}</p>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <ArtistRow title="Featured artists" q={featured} />
      <ArtistRow title="Recommended for you" q={recommended} />
      <ArtistRow title="Trending" q={trending} />

      {!nearby.isLoading && (nearby.data ?? []).length > 0 && (
        <Section title="Nearby studios">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {(nearby.data ?? []).map((st) => (
              <Link key={st.id} href={`/studios/${st.slug}`} className="flex w-60 shrink-0 items-center gap-3 rounded-xl bg-zinc-100 p-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#1F1B2E] font-bold text-white">{st.name.charAt(0)}</div>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{st.name}</p>
                  <p className="truncate text-xs text-zinc-500">{st.city ?? "—"}{st.distanceKm != null ? ` · ${st.distanceKm} km` : ""}</p>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* Infinite feed (masonry via CSS columns) */}
      <h2 className="mb-3 mt-8 text-lg font-bold">Explore</h2>
      {ideas.length === 0 && !feed.isLoading ? (
        <p className="text-zinc-500">No inspiration yet — check back soon.</p>
      ) : (
        <div className="columns-2 gap-3 md:columns-4">
          {ideas.map((idea) => (
            <div key={idea.id} className="mb-3 break-inside-avoid overflow-hidden rounded-xl bg-zinc-200">
              {img(idea.imagePath) ? <img src={img(idea.imagePath)} alt={idea.title ?? ""} className="w-full" /> : <div className="aspect-square" />}
              {idea.title && <p className="p-2 text-xs font-semibold">{idea.title}</p>}
            </div>
          ))}
        </div>
      )}
      {feed.hasNextPage && (
        <button
          className="mx-auto mt-6 block rounded-lg border px-6 py-3 font-medium disabled:opacity-50"
          disabled={feed.isFetchingNextPage}
          onClick={() => feed.fetchNextPage()}
        >
          {feed.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        <Link href="/discover" className="text-sm font-semibold text-[#E5484D]">See all</Link>
      </div>
      {children}
    </section>
  );
}

function ArtistRow({ title, q }: { title: string; q: { data?: HomeArtist[]; isLoading: boolean } }) {
  if (!q.isLoading && (q.data ?? []).length === 0) return null;
  return (
    <Section title={title}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {(q.data ?? []).map((a) => (
          <Link key={a.id} href={`/artists/${a.id}`} className="w-28 shrink-0">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-[#1F1B2E] text-3xl font-bold text-white">
              {img(a.avatarPath) ? <img src={img(a.avatarPath)} alt={a.displayName} className="h-full w-full object-cover" /> : a.displayName.charAt(0)}
            </div>
            <p className="mt-1 truncate text-sm font-semibold">{a.displayName}</p>
            <p className="truncate text-xs text-zinc-500">{a.ratingCount > 0 ? `★ ${a.ratingAvg.toFixed(1)}` : "New"}{a.styles[0] ? ` · ${a.styles[0]}` : ""}</p>
          </Link>
        ))}
      </div>
    </Section>
  );
}
