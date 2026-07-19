"use client";
import {
  publicStorageUrl, useArtistAvailability, useArtistOffers, useArtistPortfolio,
  useArtistProfile, useArtistReviews,
} from "@inkora/data-access";
import { type Complexity, DAY_LABELS, estimatePrice, formatAmount } from "@inkora/domain";
import Link from "next/link";
import { useState } from "react";

import { env } from "../../lib/env";
import { getSupabaseBrowser } from "../../lib/supabase-browser";

const img = (p?: string | null) => (p ? publicStorageUrl(env.SUPABASE_URL, p) : undefined);
const money = formatAmount;
type Tab = "portfolio" | "reviews" | "offers" | "availability";

export function ArtistProfileView({ id }: { id: string }) {
  const client = getSupabaseBrowser();
  const profile = useArtistProfile(client, id);
  const portfolio = useArtistPortfolio(client, id);
  const reviews = useArtistReviews(client, id);
  const offers = useArtistOffers(client, id);
  const availability = useArtistAvailability(client, id);
  const [tab, setTab] = useState<Tab>("portfolio");
  const [complexity, setComplexity] = useState<Complexity>("medium");

  if (profile.isLoading) return <p className="p-8 text-center text-zinc-500">Loading…</p>;
  const a = profile.data;
  if (!a) return <p className="p-8 text-center text-zinc-500">Artist not found.</p>;
  const est = estimatePrice(complexity, a.hourlyRate, a.minCharge, a.currencyCode);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#1F1B2E] text-4xl font-bold text-white">
          {img(a.avatarPath) ? <img src={img(a.avatarPath)} alt={a.displayName} className="h-full w-full object-cover" /> : a.displayName.charAt(0)}
        </div>
        <h1 className="mt-3 text-2xl font-extrabold">{a.displayName}{a.verified && <span className="ml-2 text-blue-500">✓</span>}</h1>
        {a.headline && <p className="text-zinc-600">{a.headline}</p>}
        <p className="mt-1 font-semibold">{a.ratingCount > 0 ? `★ ${a.ratingAvg.toFixed(1)} (${a.ratingCount})` : "New artist"}{a.city ? ` · ${a.city}` : ""}</p>
      </div>

      {a.styles.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {a.styles.map((s) => <span key={s} className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold">{s}</span>)}
        </div>
      )}
      {a.bio && <p className="mt-4 text-zinc-700">{a.bio}</p>}
      {a.studios.map((st) => (
        <Link key={st.id} href={`/studios/${st.slug}`} className="mt-3 block rounded-xl bg-zinc-100 p-3 font-medium">🏠 {st.name}</Link>
      ))}

      {/* Price estimator */}
      <div className="mt-5 rounded-2xl border p-4">
        <p className="mb-2 font-bold">Estimate a price</p>
        <div className="mb-2 flex gap-2">
          {(["simple", "medium", "complex"] as Complexity[]).map((c) => (
            <button key={c} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${complexity === c ? "bg-[#E5484D] text-white" : "bg-zinc-100"}`} onClick={() => setComplexity(c)}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
        <p className="text-2xl font-extrabold text-[#E5484D]">{money(est.min, est.currencyCode)} – {money(est.max, est.currencyCode)}</p>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-4 border-b">
        {(["portfolio", "reviews", "offers", "availability"] as Tab[]).map((t) => (
          <button key={t} className={`-mb-px border-b-2 pb-2 font-semibold capitalize ${tab === t ? "border-[#E5484D] text-black" : "border-transparent text-zinc-500"}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div className="mt-4 min-h-[140px]">
        {tab === "portfolio" && (
          (portfolio.data ?? []).length === 0 ? <p className="text-zinc-500">No portfolio pieces yet.</p> :
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(portfolio.data ?? []).map((im) => <img key={im.id} src={img(im.imagePath)} alt="" className="aspect-square w-full rounded-xl object-cover" />)}
          </div>
        )}
        {tab === "reviews" && (
          <>
            <p className="mb-3 font-semibold">{a.ratingCount > 0 ? `★ ${a.ratingAvg.toFixed(1)} · ${a.ratingCount} reviews` : "No reviews yet."}</p>
            {(reviews.data ?? []).map((r) => (
              <div key={r.id} className="mb-3 rounded-xl border p-3">
                <p className="font-bold">{r.authorName} · ★ {r.overallRating}</p>
                {r.title && <p className="font-medium">{r.title}</p>}
                {r.body && <p className="text-zinc-700">{r.body}</p>}
              </div>
            ))}
          </>
        )}
        {tab === "offers" && (
          (offers.data ?? []).length === 0 ? <p className="text-zinc-500">No offers right now.</p> :
          (offers.data ?? []).map((o) => (
            <div key={o.id} className="mb-3 flex items-center gap-3 rounded-xl border p-3">
              <div className="flex-1"><p className="font-bold">{o.title}</p>{o.description && <p className="text-sm text-zinc-500">{o.description}</p>}</div>
              {o.priceAmount != null && <span className="font-extrabold text-[#E5484D]">{money(o.priceAmount, o.currencyCode)}</span>}
            </div>
          ))
        )}
        {tab === "availability" && (
          (availability.data ?? []).length === 0 ? <p className="text-zinc-500">Availability not set.</p> :
          // Collapse split shifts onto one row per day (slots arrive ordered by
          // day then start time), e.g. "10:00–14:00, 16:00–20:00".
          [...(availability.data ?? []).reduce((map, sl) => {
            const ranges = map.get(sl.dayOfWeek) ?? [];
            ranges.push(`${sl.startTime.slice(0, 5)}–${sl.endTime.slice(0, 5)}`);
            return map.set(sl.dayOfWeek, ranges);
          }, new Map<number, string[]>()).entries()].map(([dow, ranges]) => (
            <div key={dow} className="flex justify-between border-b py-2"><span className="font-bold">{DAY_LABELS[dow]}</span><span className="text-zinc-700">{ranges.join(", ")}</span></div>
          ))
        )}
      </div>

      <div className="sticky bottom-0 mt-8 flex gap-3 border-t bg-white py-3">
        <Link href="/messages" className="flex-1 rounded-xl border py-3 text-center font-semibold">Message</Link>
        <Link href={`/booking-request?artistId=${a.id}`} className={`flex-[2] rounded-xl py-3 text-center font-semibold text-white ${a.isAccepting ? "bg-[#E5484D]" : "pointer-events-none bg-zinc-300"}`}>
          {a.isAccepting ? "Request booking" : "Not accepting"}
        </Link>
      </div>
    </main>
  );
}
