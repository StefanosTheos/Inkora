"use client";
import { publicStorageUrl, startStudioConversation, useStudioPortfolio, useStudioProfile, useStudioReviews } from "@inkora/data-access";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { env } from "../../lib/env";
import { getSupabaseBrowser } from "../../lib/supabase-browser";

const img = (p?: string | null) => (p ? publicStorageUrl(env.SUPABASE_URL, p) : undefined);
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
type Tab = "artists" | "portfolio" | "reviews" | "about";

export function StudioProfileView({ slug }: { slug: string }) {
  const client = getSupabaseBrowser();
  const router = useRouter();
  const studio = useStudioProfile(client, slug);
  const artistIds = useMemo(() => (studio.data?.roster ?? []).map((r) => r.id), [studio.data]);
  const portfolio = useStudioPortfolio(client, artistIds);
  const reviews = useStudioReviews(client, studio.data?.id ?? "");
  const [tab, setTab] = useState<Tab>("artists");

  if (studio.isLoading) return <p className="p-8 text-center text-zinc-500">Loading…</p>;
  const st = studio.data;
  if (!st) return <p className="p-8 text-center text-zinc-500">Studio not found.</p>;

  async function message() {
    try {
      const cid = await startStudioConversation(client, st!.id);
      router.push(`/messages/${cid}`);
    } catch (e) { alert((e as Error).message); }
  }

  const tabs: Tab[] = ["artists", "portfolio", "reviews", "about"];

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-[#1F1B2E] text-3xl font-bold text-white">
          {img(st.logoPath) ? <img src={img(st.logoPath)} alt={st.name} className="h-full w-full object-cover" /> : st.name.charAt(0)}
        </div>
        <h1 className="mt-3 text-2xl font-extrabold">{st.name}</h1>
        <p className="text-zinc-600">{st.roster.length} artist{st.roster.length === 1 ? "" : "s"}{st.city ? ` · ${st.city}` : ""}</p>
        <p className="text-sm text-zinc-500">{[st.addressLine, st.city, st.country].filter(Boolean).join(", ") || "—"}</p>
        {st.styles.length > 0 && (
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {st.styles.map((sl) => <span key={sl} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold">{sl}</span>)}
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-4 border-b">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 pb-2 font-semibold capitalize ${tab === t ? "border-[#E5484D]" : "border-transparent text-zinc-500"}`}>
            {t === "artists" ? `Artists (${st.roster.length})` : t}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "artists" && (
          st.roster.length === 0 ? <p className="text-zinc-500">No resident artists listed.</p> :
          st.roster.map((r) => (
            <Link key={r.id} href={`/artists/${r.id}`} className="flex items-center gap-3 border-b py-3 hover:bg-zinc-50">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#1F1B2E] font-bold text-white">
                {img(r.avatarPath) ? <img src={img(r.avatarPath)} alt={r.displayName} className="h-full w-full object-cover" /> : r.displayName.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-bold">{r.displayName}</p>
                <p className="text-sm text-zinc-500">{r.ratingCount > 0 ? `★ ${r.ratingAvg.toFixed(1)} (${r.ratingCount})` : "New"}{r.headline ? ` · ${r.headline}` : ""}</p>
                {r.styles.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{r.styles.slice(0, 3).map((sl) => <span key={sl} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600">{sl}</span>)}</div>}
              </div>
              <span className="text-2xl font-light text-zinc-300">›</span>
            </Link>
          ))
        )}

        {tab === "portfolio" && (
          portfolio.isLoading ? <p className="text-zinc-500">Loading…</p> :
          (portfolio.data ?? []).length === 0 ? <p className="text-zinc-500">No portfolio pieces yet.</p> :
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(portfolio.data ?? []).map((im) => (
              <div key={im.id} className="aspect-square overflow-hidden rounded-xl bg-zinc-200">
                {img(im.imagePath) && <img src={img(im.imagePath)} alt={im.caption ?? ""} className="h-full w-full object-cover" />}
              </div>
            ))}
          </div>
        )}

        {tab === "reviews" && (
          (reviews.data ?? []).length === 0 ? <p className="text-zinc-500">No reviews yet.</p> :
          (reviews.data ?? []).map((r) => (
            <div key={r.id} className="mb-3 rounded-xl border p-3">
              <p className="font-bold">{r.authorName} · ★ {r.overallRating}</p>
              {r.title && <p className="font-semibold">{r.title}</p>}
              {r.body && <p className="text-zinc-600">{r.body}</p>}
            </div>
          ))
        )}

        {tab === "about" && (
          <>
            {st.bio && <p className="mb-4 text-zinc-700">{st.bio}</p>}
            <p className="mb-2 font-bold">Opening hours</p>
            {DAY_ORDER.map((d) => (
              <div key={d} className="flex justify-between border-b py-2">
                <span className="font-bold capitalize">{d}</span>
                <span className="text-zinc-700">{st.openingHours[d]?.length ? st.openingHours[d].map((r) => `${r[0]}–${r[1]}`).join(", ") : "Closed"}</span>
              </div>
            ))}
            <a href={`https://www.google.com/maps/search/?api=1&query=${st.latitude},${st.longitude}`} target="_blank" rel="noreferrer" className="mt-4 block rounded-xl bg-zinc-100 py-3 text-center font-semibold">📍 Get directions</a>
          </>
        )}
      </div>

      <div className="sticky bottom-0 mt-8 flex gap-3 border-t bg-white py-3">
        <button onClick={message} className="flex-1 rounded-xl border py-3 text-center font-semibold">Message</button>
        <Link href={`/booking-request?studioSlug=${st.slug}`} className="flex-[2] rounded-xl bg-[#E5484D] py-3 text-center font-semibold text-white">Request booking</Link>
      </div>
    </main>
  );
}
