"use client";
import { publicStorageUrl, useStudioProfile } from "@inkora/data-access";
import Link from "next/link";
import { useState } from "react";
import { env } from "../../lib/env";
import { getSupabaseBrowser } from "../../lib/supabase-browser";

const img = (p?: string | null) => (p ? publicStorageUrl(env.SUPABASE_URL, p) : undefined);
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function StudioProfileView({ slug }: { slug: string }) {
  const client = getSupabaseBrowser();
  const studio = useStudioProfile(client, slug);
  const [tab, setTab] = useState<"about" | "artists">("about");

  if (studio.isLoading) return <p className="p-8 text-center text-zinc-500">Loading…</p>;
  const st = studio.data;
  if (!st) return <p className="p-8 text-center text-zinc-500">Studio not found.</p>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-[#1F1B2E] text-3xl font-bold text-white">
          {img(st.logoPath) ? <img src={img(st.logoPath)} alt={st.name} className="h-full w-full object-cover" /> : st.name.charAt(0)}
        </div>
        <h1 className="mt-3 text-2xl font-extrabold">{st.name}</h1>
        <p className="text-zinc-600">{[st.addressLine, st.city, st.country].filter(Boolean).join(", ") || "—"}</p>
      </div>

      <div className="mt-6 flex gap-4 border-b">
        <button className={`-mb-px border-b-2 pb-2 font-semibold ${tab === "about" ? "border-[#E5484D]" : "border-transparent text-zinc-500"}`} onClick={() => setTab("about")}>About</button>
        <button className={`-mb-px border-b-2 pb-2 font-semibold ${tab === "artists" ? "border-[#E5484D]" : "border-transparent text-zinc-500"}`} onClick={() => setTab("artists")}>Artists ({st.roster.length})</button>
      </div>

      <div className="mt-4">
        {tab === "about" ? (
          <>
            {st.bio && <p className="mb-4 text-zinc-700">{st.bio}</p>}
            <p className="mb-2 font-bold">Opening hours</p>
            {DAY_ORDER.map((d) => (
              <div key={d} className="flex justify-between border-b py-2">
                <span className="font-bold capitalize">{d}</span>
                <span className="text-zinc-700">{st.openingHours[d]?.length ? st.openingHours[d].map((r) => `${r[0]}–${r[1]}`).join(", ") : "Closed"}</span>
              </div>
            ))}
          </>
        ) : st.roster.length === 0 ? (
          <p className="text-zinc-500">No resident artists listed.</p>
        ) : (
          st.roster.map((r) => (
            <Link key={r.id} href={`/artists/${r.id}`} className="flex items-center gap-3 border-b py-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-[#1F1B2E] font-bold text-white">
                {img(r.avatarPath) ? <img src={img(r.avatarPath)} alt={r.displayName} className="h-full w-full object-cover" /> : r.displayName.charAt(0)}
              </div>
              <div><p className="font-semibold">{r.displayName}</p><p className="text-sm text-zinc-500">{r.ratingAvg > 0 ? `★ ${r.ratingAvg.toFixed(1)}` : "New"}{r.headline ? ` · ${r.headline}` : ""}</p></div>
            </Link>
          ))
        )}
      </div>

      <div className="sticky bottom-0 mt-8 flex gap-3 border-t bg-white py-3">
        <Link href="/messages" className="flex-1 rounded-xl border py-3 text-center font-semibold">Message</Link>
        <a href={`https://www.google.com/maps/search/?api=1&query=${st.latitude},${st.longitude}`} target="_blank" rel="noreferrer" className="flex-1 rounded-xl bg-[#E5484D] py-3 text-center font-semibold text-white">Directions</a>
      </div>
    </main>
  );
}
